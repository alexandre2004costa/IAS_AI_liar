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
            PROMPT_COMMAND: "history -a"   // ⭐ Nunca imprime nada
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

        // Detect prompt (método simples)
        if (rawOutput.endsWith("$ ") || rawOutput.endsWith("# ") || rawOutput.endsWith("> ")) {
            console.log("Detected prompt, invoking LLM...");
            if (!getLLMProcessing()) {
                const cmd = getLastCommandFromHistory();
                console.log("Last command from history:", cmd);
                if (cmd) {
                    callAI(ws, cmd, rawOutput);
                }
            }
        }
    });

    ws.on('close', () => {
        if (!sharedTerminalMode) {
            ptyProcess.kill();
        }
    });
};

function getLastCommandFromHistory() {
    try {
        const text = fs.readFileSync('/tmp/.cmdlog', 'utf8');
        console.log("Contents of /tmp/.cmdlog:", text);
        const lines = text.trim().split('\n');
        return lines[lines.length - 1];
    } catch {
        return null;
    }
}


// ⭐ new helper
async function callAI(ws, command, rawOutput) {
    setLLMProcessing(true);

    ws.send(JSON.stringify({
        type: 'warning',
        text: 'AI is processing your command...]'
    }));

    try {
        const llmReply = await callLLM(`Command: ${command}\nOutput: ${rawOutput}`);
        ws.send(JSON.stringify({ type: 'llm_feedback_feedback', text: llmReply }));
        ws.send(JSON.stringify({ type: 'llm_reasoning', text: 'Reasoning' }));
    } catch (err) {
        console.error("Erro ao chamar LLM:", err);
    }

    setLLMProcessing(false);
}
