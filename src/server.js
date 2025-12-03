import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callLLM } from './llm_client.js';
import { handleTerminalConnection, setSharedTerminalMode, setLLMProcessing, getLLMProcessing } from './terminal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Config
setSharedTerminalMode(false);
const port = 6060;

const server = http.createServer((req, res) => {
    // Handle POST request for AI messages
    if (req.method === 'POST' && req.url === '/api/ai-message') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                
                const { message, timestamp } = JSON.parse(body);
                console.log("Message arriving on server", message);
                setLLMProcessing(true);
                callLLM(`User message: ${message}`)
                    .then(llmReply => {
                        console.log("Reply from LLM server sending to client:", llmReply);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            response: llmReply,
                            receivedMessage: message
                        }));
                    })
                    .catch(err => {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err }));
                        setLLMProcessing(false);
                    });

                
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        
        return;
    }
    
    // Handle GET requests
    if (req.method === 'GET') {
        const routeName = req.url.slice(1);
        const assetObj = {
            '': { file: "index.html", contentType: "text/html" },
            'client.js': { file: "client.js", contentType: "text/javascript" }
        }[routeName];

        if (!assetObj) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Path not found');
        }

        const filePath = path.join(__dirname, assetObj.file);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Failed to load file');
            } else {
                res.writeHead(200, { 'Content-Type': assetObj.contentType });
                res.end(data);
            }
        });
    }
});

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', handleTerminalConnection);

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

server.listen(port, () => {
    console.log(`HTTP and WebSocket server is running on port ${port}`);
});