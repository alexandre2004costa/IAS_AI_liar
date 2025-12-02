import os from 'os';
import { appendEntry } from './store_util.js';
import { v4 as uuidv4 } from 'uuid';
import pty from 'node-pty';
const sessionsBuffer = {};

let sharedPtyProcess = null;
let sharedTerminalMode = false;
let Enter = 0;
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

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


    ws.on('message', command => {
        //<Buffer 7f> remove
        //<Buffer 0d> enter
        console.log("Command:", command);
        const processedCommand = commandProcessor(command);
        for (const byte of command) {
            switch(byte) {
              case 0x0d: // CR (Enter em Windows)
              case 0x0a: // LF (Enter Unix)
                Enter = 1;
                break;
              case 0x7f: // DEL / backspace
                sessionsBuffer[sessionId] = sessionsBuffer[sessionId].slice(0, -1);
                break;
              default:
                // adiciona carácter normal ao buffer
                sessionsBuffer[sessionId] += String.fromCharCode(byte);
                break;
            }
          }
        ptyProcess.write(processedCommand);
    });

    ptyProcess.on('data', (rawOutput) => {
        console.log("ENTER:", Enter);
        const processedOutput = outputProcessor(rawOutput);
        console.log("Saving response:", rawOutput);
        if (Enter == 2){
            const fullCommand = sessionsBuffer[sessionId];
            sessionsBuffer[sessionId] = ''; 
            if (fullCommand) {
                console.log("Saving command: ", fullCommand);
                console.log("With response: ", rawOutput);
                appendEntry({
                    ts: new Date().toISOString(),
                    sessionId,
                    type: 'response',
                    command: fullCommand,
                    response: rawOutput,
                    meta: {}
                });
            }
        Enter = 0;
        }
        if (Enter == 1) Enter = 2;
        ws.send(processedOutput);
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
