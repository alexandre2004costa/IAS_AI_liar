import os from 'os';
import { appendEntry } from './store_util.js';
import { v4 as uuidv4 } from 'uuid';
import pty from 'node-pty';
import { callLLM } from './llm_client.js';

const sessionsBuffer = {};

let sharedPtyProcess = null;
let sharedTerminalMode = false;
let Enter = 0;
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
let isLLMProcessing = false;

const spawnShell = () => {
    return pty.spawn(shell, [], {
        name: 'xterm-color',
        env: process.env,
    });
};

export const setSharedTerminalMode = (useSharedTerminal) => {
    sharedTerminalMode = useSharedTerminal;
    if (sharedTerminalMode && !sharedPtyProcess) {
        sharedPtyProcess = spawnShell();
    }
};

export const handleTerminalConnection = (ws) => {
    let ptyProcess = sharedTerminalMode ? sharedPtyProcess : spawnShell();
    const sessionId = `ws-${uuidv4()}`;
    setTimeout(() => {
        ptyProcess.write('cd test\r');
        }, 500);

    ws.on('message', command => {
        if (isLLMProcessing) {
            // Send a visual indicator that input is disabled
            ws.send(JSON.stringify({
            type: 'terminal',
            text: '\r\n\x1b[33m[Terminal input is disabled while AI is processing...]\x1b[0m\r\n'
            }));
            return;
        }
        const processedCommand = commandProcessor(command);
        console.log("Command received:", processedCommand);
        for (const byte of command) {
            switch(byte) {
                case 0x0d: // CR / Enter
                case 0x0a: // LF
                    if ((sessionsBuffer[sessionId] || '').length > 0) {
                        Enter = 1;
                    }
                    
                    break;
                case 0x7f: // DEL / Backspace
                    sessionsBuffer[sessionId] = (sessionsBuffer[sessionId] || '').slice(0, -1);
                    break;
                default:
                    // adiciona carácter normal ao buffer
                    sessionsBuffer[sessionId] = (sessionsBuffer[sessionId] || '') + String.fromCharCode(byte);
                    break;
            }
        }
        ptyProcess.write(processedCommand);
        
    });

    ptyProcess.on('data', async (rawOutput) => {
        // Envia sempre o output para o terminal
        const processedOutput = outputProcessor(rawOutput);
        ws.send(JSON.stringify({ type: 'terminal', text: processedOutput }));
    
        // Se Enter foi pressionado e buffer não está vazio, chama a LLM
        if (Enter === 2) {
            const fullCommand = sessionsBuffer[sessionId];
            sessionsBuffer[sessionId] = '';
            Enter = 0;
    
            if (fullCommand) {
                appendEntry({
                    ts: new Date().toISOString(),
                    sessionId,
                    type: 'response',
                    command: fullCommand,
                    response: rawOutput,
                    meta: {}
                });
                isLLMProcessing = true;
                ws.send(JSON.stringify({
                    type: 'terminal',
                    text: '\r\n\x1b[36m[AI is processing your command...]\x1b[0m\r\n'
                    }));
                // Chama a LLM de forma assíncrona, sem bloquear o terminal
                callLLM(`Command: ${fullCommand}\nResponse: ${rawOutput}`)
                    .then(llmReply => {
                        ws.send(JSON.stringify({ type: 'llm_feedback_feedback', text: llmReply }));
                        ws.send(JSON.stringify({ type: 'llm_reasoning', text: 'Reasoning' }));
                    })
                    .catch(err => console.error("Erro ao chamar LLM:", err));
            }
        }
    
        // Se Enter == 1, significa que detectamos Enter mas ainda não processamos a LLM
        if (Enter === 1) Enter = 2;
    });

    ws.on('close', () => {
        if (!sharedTerminalMode) {
            ptyProcess.kill();
        }
    });
};

// Utility function to process commands
const commandProcessor = (command) => {
    return command;
};

// Utility function to process output
const outputProcessor = (output) => {
    return output;
};