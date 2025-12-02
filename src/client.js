
const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socketUrl = `${socketProtocol}//${window.location.host}`;
const socket = new WebSocket(socketUrl);

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'terminal') {
        // saída do terminal
        term.write(data.text);
    } else if (data.type === 'llm_feedback') {
        // saída da AI em outro elemento, ex: <div id="ai-box">
        const aiBox = document.getElementById('ai-box');
        if (aiBox) {
            const p = document.createElement('p');
            p.textContent = data.text;
            aiBox.appendChild(p);
            aiBox.scrollTop = aiBox.scrollHeight; // scroll automático
        }
    }
};

var term = new window.Terminal({
    cursorBlink: true
});
term.open(document.getElementById('terminal'));

function init() {
    if (term._initialized) {
        return;
    }

    term._initialized = true;

    term.prompt = () => {
        runCommand('\n');
    };
    setTimeout(() => {
        term.prompt();
    }, 300);

    term.onKey(keyObj => {
        runCommand(keyObj.key);
    });

    term.attachCustomKeyEventHandler((e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            navigator.clipboard.readText().then(text => {
                runCommand(text);
            });
            return false;
        }
        return true;
    });
}

function runCommand(command) {
    socket.send(command);

}

init();
