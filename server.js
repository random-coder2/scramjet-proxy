const express = require('express');
const path = require('path');
const { createServer } = require('http');
const os = require('os');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Try to load WISP server
let wisp = null;
let wispAvailable = false;

try {
    const { server: wispServer } = require('@mercuryworkshop/wisp-js/server');
    wisp = wispServer;
    wispAvailable = true;
    console.log('WISP server loaded successfully');
} catch (err) {
    console.log('WISP server not available, using WebSocket fallback:', err.message);
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Proxy libcurl transport files from unpkg
app.get('/libcurl/*', async (req, res) => {
    const filePath = req.params[0];
    const unpkgUrl = `https://unpkg.com/@mercuryworkshop/libcurl-transport@2.0.5/dist/${filePath}`;
    
    try {
        const https = require('https');
        https.get(unpkgUrl, (proxyRes) => {
            res.status(proxyRes.statusCode);
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/javascript');
            res.setHeader('Access-Control-Allow-Origin', '*');
            proxyRes.pipe(res);
        }).on('error', (err) => {
            res.status(500).send(`Error fetching libcurl: ${err.message}`);
        });
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
});

// Main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper: Rewrite URLs in HTML/JS/CSS content
function rewriteUrls(content, contentType, baseUrl, proxyOrigin) {
    if (!content) return content;
    
    const isHtml = contentType && contentType.includes('text/html');
    const isJs = contentType && contentType.includes('javascript');
    const isCss = contentType && contentType.includes('css');
    
    if (!isHtml && !isJs && !isCss) return content;
    
    let rewritten = content;
    
    // Encode URL to proxy format
    const encodeProxyUrl = (url) => {
        try {
            // Handle absolute URLs
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return `${proxyOrigin}/~/${Buffer.from(url).toString('base64')}`;
            }
            // Handle relative URLs - resolve against base
            if (url.startsWith('/') || url.startsWith('./') || !url.includes('://')) {
                const resolved = new URL(url, baseUrl).href;
                return `${proxyOrigin}/~/${Buffer.from(resolved).toString('base64')}`;
            }
            return url;
        } catch (e) {
            return url;
        }
    };
    
    if (isHtml) {
        // Rewrite href and src attributes
        rewritten = rewritten.replace(/\s(href|src|action)=(["'])([^"']+)\2/gi, (match, attr, quote, url) => {
            if (url.startsWith('#') || url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('mailto:')) {
                return match;
            }
            const encoded = encodeProxyUrl(url);
            return ` ${attr}=${quote}${encoded}${quote}`;
        });
        
        // Rewrite srcset (images)
        rewritten = rewritten.replace(/\ssrcset=(["'])([^"']+)\1/gi, (match, quote, srcset) => {
            const urls = srcset.split(',').map(part => {
                const [url, descriptor] = part.trim().split(/\s+/);
                if (!url || url.startsWith('data:')) return part;
                const encoded = encodeProxyUrl(url);
                return descriptor ? `${encoded} ${descriptor}` : encoded;
            });
            return ` srcset=${quote}${urls.join(', ')}${quote}`;
        });
        
        // Rewrite CSS url() in style attributes
        rewritten = rewritten.replace(/style=(["'])([^"']*)\1/gi, (match, quote, styles) => {
            const newStyles = styles.replace(/url\((["']?)([^)]+)\1\)/gi, (m, q, url) => {
                if (url.startsWith('data:')) return m;
                const encoded = encodeProxyUrl(url);
                return `url(${q}${encoded}${q})`;
            });
            return `style=${quote}${newStyles}${quote}`;
        });
    }
    
    if (isCss || isHtml) {
        // Rewrite CSS url() and @import
        rewritten = rewritten.replace(/url\((["']?)([^)]+)\1\)/gi, (match, quote, url) => {
            if (url.startsWith('data:')) return match;
            const encoded = encodeProxyUrl(url);
            return `url(${quote}${encoded}${quote})`;
        });
        
        rewritten = rewritten.replace(/@import\s+(["'])([^"']+)\1/gi, (match, quote, url) => {
            const encoded = encodeProxyUrl(url);
            return `@import ${quote}${encoded}${quote}`;
        });
    }
    
    if (isJs) {
        // Basic URL rewriting in JS - only rewrite obvious URL strings
        rewritten = rewritten.replace(/(["'])(https?:\/\/[^"']+)\1/g, (match, quote, url) => {
            const encoded = encodeProxyUrl(url);
            return `${quote}${encoded}${quote}`;
        });
    }
    
    return rewritten;
}

// CORS preflight handler
app.options('/~/*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.status(204).send();
});

// Handle /~/ encoded URLs - ALL HTTP methods
app.all('/~/*', async (req, res) => {
    try {
        const base64 = req.params[0];
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        console.log(`Server: ${req.method} ${decoded}`);
        
        // Validate URL
        if (!decoded.startsWith('http://') && !decoded.startsWith('https://')) {
            return res.status(400).send('Invalid URL');
        }
        
        const url = new URL(decoded);
        
        // Make proxy request
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: req.method,
            headers: {
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
                'Accept': req.headers['accept'] || '*/*',
                'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Referer': url.origin,
                'Origin': url.origin
            }
        };
        
        // Forward content headers for POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            if (req.headers['content-type']) {
                options.headers['Content-Type'] = req.headers['content-type'];
            }
            if (req.headers['content-length']) {
                options.headers['Content-Length'] = req.headers['content-length'];
            }
        }
        
        const client = url.protocol === 'https:' ? require('https') : require('http');
        
        const proxyReq = client.request(options, (proxyRes) => {
            const contentType = proxyRes.headers['content-type'] || 'text/plain';
            
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            
            // Check if we should rewrite content
            const shouldRewrite = contentType.includes('text/html') || 
                                  contentType.includes('javascript') || 
                                  contentType.includes('css');
            
            if (shouldRewrite && req.method === 'GET') {
                // Collect response body
                let data = '';
                proxyRes.setEncoding('utf8');
                proxyRes.on('data', chunk => data += chunk);
                proxyRes.on('end', () => {
                    const rewritten = rewriteUrls(data, contentType, decoded, `${req.protocol}://${req.headers.host}`);
                    res.status(proxyRes.statusCode);
                    res.setHeader('Content-Type', contentType);
                    res.send(rewritten);
                });
            } else {
                // Pass through unchanged
                res.status(proxyRes.statusCode);
                res.setHeader('Content-Type', contentType);
                proxyRes.pipe(res);
            }
        });
        
        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err);
            res.status(500).send(`Proxy error: ${err.message}`);
        });
        
        // Pipe request body for POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            req.pipe(proxyReq);
        } else {
            proxyReq.end();
        }
        
    } catch (err) {
        console.error('Decode error:', err);
        res.status(400).send(`Error: ${err.message}`);
    }
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server for WISP
const wss = new WebSocket.Server({ noServer: true });

// WISP Protocol Implementation
// WISP frames: [stream_id: 1 byte] [type: 1 byte] [payload_len: 2 bytes] [payload: variable]

const STREAMS = new Map(); // stream_id -> { socket, buffer, ws }

function parseWispFrame(data) {
    if (data.length < 4) return null;
    const streamId = data[0];
    const type = data[1];
    const payloadLen = (data[2] << 8) | data[3];
    const payload = data.slice(4, 4 + payloadLen);
    return { streamId, type, payload };
}

function createWispFrame(streamId, type, payload) {
    const header = Buffer.allocUnsafe(4);
    header[0] = streamId;
    header[1] = type;
    header[2] = (payload.length >> 8) & 0xFF;
    header[3] = payload.length & 0xFF;
    return Buffer.concat([header, payload]);
}

// WISP packet types
const WISP_TYPES = {
    CONNECT: 0x01,
    DATA: 0x02,
    CLOSE: 0x03,
    CONTINUE: 0x04
};

// Handle WISP protocol
wss.on('connection', (ws, req) => {
    console.log('WISP client connected from:', req.socket.remoteAddress);
    
    const clientStreams = new Set();
    
    ws.on('message', async (data) => {
        try {
            const frame = parseWispFrame(data);
            if (!frame) return;
            
            const { streamId, type, payload } = frame;
            
            switch (type) {
                case WISP_TYPES.CONNECT: {
                    // CONNECT: [hostname: string] [port: 2 bytes]
                    const hostnameEnd = payload.indexOf(0);
                    const hostname = payload.slice(0, hostnameEnd).toString();
                    const port = (payload[payload.length - 2] << 8) | payload[payload.length - 1];
                    
                    console.log(`WISP: Stream ${streamId} connecting to ${hostname}:${port}`);
                    
                    try {
                        // Create TCP connection
                        const socket = require('net').createConnection(port, hostname);
                        
                        socket.on('connect', () => {
                            console.log(`WISP: Stream ${streamId} connected to ${hostname}:${port}`);
                            // Send CONTINUE with initial window size
                            const continueFrame = createWispFrame(streamId, WISP_TYPES.CONTINUE, Buffer.from([0x00, 0x40])); // 16KB window
                            ws.send(continueFrame);
                        });
                        
                        socket.on('data', (data) => {
                            // Send DATA frame
                            const dataFrame = createWispFrame(streamId, WISP_TYPES.DATA, data);
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(dataFrame);
                            }
                        });
                        
                        socket.on('close', () => {
                            console.log(`WISP: Stream ${streamId} closed by target`);
                            const closeFrame = createWispFrame(streamId, WISP_TYPES.CLOSE, Buffer.from([0x03])); // 0x03 = closed by target
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(closeFrame);
                            }
                            STREAMS.delete(streamId);
                            clientStreams.delete(streamId);
                        });
                        
                        socket.on('error', (err) => {
                            console.error(`WISP: Stream ${streamId} error:`, err.message);
                            const closeFrame = createWispFrame(streamId, WISP_TYPES.CLOSE, Buffer.from([0x02])); // 0x02 = connection error
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(closeFrame);
                            }
                            STREAMS.delete(streamId);
                            clientStreams.delete(streamId);
                        });
                        
                        STREAMS.set(streamId, { socket, ws });
                        clientStreams.add(streamId);
                        
                    } catch (err) {
                        console.error(`WISP: Failed to connect to ${hostname}:${port}:`, err.message);
                        const closeFrame = createWispFrame(streamId, WISP_TYPES.CLOSE, Buffer.from([0x02]));
                        ws.send(closeFrame);
                    }
                    break;
                }
                
                case WISP_TYPES.DATA: {
                    // Forward data to target
                    const stream = STREAMS.get(streamId);
                    if (stream && stream.socket.writable) {
                        stream.socket.write(payload);
                    }
                    break;
                }
                
                case WISP_TYPES.CLOSE: {
                    // Close the stream
                    const stream = STREAMS.get(streamId);
                    if (stream) {
                        stream.socket.end();
                        STREAMS.delete(streamId);
                        clientStreams.delete(streamId);
                    }
                    break;
                }
                
                case WISP_TYPES.CONTINUE: {
                    // Flow control - acknowledge
                    break;
                }
            }
        } catch (err) {
            console.error('WISP frame error:', err);
        }
    });
    
    ws.on('close', () => {
        console.log('WISP client disconnected');
        // Close all streams for this client
        clientStreams.forEach(streamId => {
            const stream = STREAMS.get(streamId);
            if (stream) {
                stream.socket.end();
                STREAMS.delete(streamId);
            }
        });
    });
    
    ws.on('error', (err) => {
        console.error('WISP WebSocket error:', err);
    });
});

// Handle upgrade requests
server.on('upgrade', (req, socket, head) => {
    if (req.url.endsWith('/wisp/')) {
        if (wispAvailable && wisp) {
            // Use native WISP server
            wisp.routeRequest(req, socket, head);
        } else {
            // Use ws library fallback
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, req);
            });
        }
    } else {
        socket.destroy();
    }
});

// Start server
server.listen(PORT, HOST, () => {
    console.log(`========================================`);
    console.log(`  Scramjet Proxy Server Running`);
    console.log(`========================================`);
    console.log(`  Platform: ${os.platform()}`);
    console.log(`  WISP: ${wispAvailable ? 'Native' : 'WebSocket fallback'} (WebSocket support enabled)`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://${HOST}:${PORT}`);
    console.log(`========================================`);
    console.log(`  Press Ctrl+C to stop`);
    console.log(`========================================`);
});
