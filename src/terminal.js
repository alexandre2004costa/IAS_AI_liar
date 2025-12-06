import os from 'os';
import pty from 'node-pty';
import { callLLM } from './llm_client.js';
import fs from 'fs';


const sessionsBuffer = {};

let sharedPtyProcess = null;
let sharedTerminalMode = false;
let lastCommand = null;          // ⭐ Modified
let isLLMProcessing = false;
let outputBuffer = "";
let promptRegex = /[$#>] $/;   // matches: "$ ", "# ", "> "
let commandOutput = '';
let awaitingPrompt = false;


export function setLLMProcessing(value) {
    isLLMProcessing = value;
}

export function getLLMProcessing() {
    return isLLMProcessing;
}

const spawnShell = () => {
    const isWindows = os.platform() === 'win32';

    const env = {
        ...process.env,
        ...(isWindows ? {} : {
            HISTFILE: "/tmp/.cmdlog",
            PROMPT_COMMAND: "history -a"   
        })
    };

    return pty.spawn(isWindows ? "powershell.exe" : "bash", [], {
        name: 'xterm-color',
        env
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


    setTimeout(() => {
        ptyProcess.write('cd test\r');
    }, 500);

    ws.on('message', command => {
        if (getLLMProcessing()) {
            ws.send(JSON.stringify({
                type: 'warning',
                text: 'Terminal input is disabled while AI is processing...'
            }));
            return;
        }
        ptyProcess.write(command);
    });

    ptyProcess.on('data', async (rawOutput) => {
        console.log("Full raw output:", rawOutput);
        ws.send(JSON.stringify({ type: 'terminal', text: rawOutput }));
        
        // Detect if Enter was pressed (command submitted)
        if (rawOutput.includes('\r') || rawOutput.includes('\n')) {
            commandOutput = rawOutput; // Start collecting from this point
            awaitingPrompt = true;
        } 
        // Continue collecting output
        else if (awaitingPrompt) {
            commandOutput += rawOutput;
        }
        
        // Check if command execution finished (prompt detected)
        if ((rawOutput.endsWith("$ ") || rawOutput.endsWith("# ") || rawOutput.endsWith("> ")) && awaitingPrompt) {
            console.log("Detected prompt after command execution");
            
            if (!getLLMProcessing()) {
                const cmd = getLastCommandFromHistory();
                if (cmd) {
                    // Remove the trailing prompt line
                    let cleanOutput = commandOutput;
                    
                    // Find the last occurrence of the prompt pattern and remove everything after the last \n before it
                    const lines = cleanOutput.split('\n');
                    // Remove the last line (which contains the prompt)
                    if (lines.length > 0) {
                        lines.pop();
                    }
                    cleanOutput = lines.join('\n');
                    
                    console.log("Command:", cmd);
                    console.log("Clean Output:", cleanOutput);
                    callAI_Feedback(ws, cmd, cleanOutput);
                }
            }
            
            // Reset for next command
            commandOutput = '';
            awaitingPrompt = false;
        }
    });
};

function getLastCommandFromHistory() {
    try {
        const text = fs.readFileSync('/tmp/.cmdlog', 'utf8');
        const lines = text.trim().split('\n');
        return lines[lines.length - 1];
    } catch {
        return null;
    }
}


async function callAI_Feedback(ws, command, rawOutput) {
    setLLMProcessing(true);

    ws.send(JSON.stringify({
        type: 'warning',
        text: 'AI is processing your command...'
    }));

    try {
        const { text, reasoning }  = await callLLM(`Command: ${command}\nOutput: ${rawOutput}`);
        ws.send(JSON.stringify({ type: 'llm_feedback_feedback', text: text }));
        ws.send(JSON.stringify({ type: 'llm_reasoning', text: reasoning}));
    } catch (err) {
        console.error("Erro ao chamar LLM:", err);
    }

    setLLMProcessing(false);
}

export async function callAI_Question(body, res) {
    setLLMProcessing(true);
    try {
                
        const { message, timestamp } = JSON.parse(body);
        console.log("Message arriving on server", message);
        setLLMProcessing(true);
        callLLM(`User message: ${message}`)
        .then(llmReply => {
            console.log("Reply from LLM server sending to client:", llmReply);
    
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                response: {
                    text: llmReply.text,
                    reasoning: llmReply.reasoning
                },
                receivedMessage: message
            }));
        })
        .catch(err => {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message || err }));
        });
    

        
    } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }

    setLLMProcessing(false);
}
