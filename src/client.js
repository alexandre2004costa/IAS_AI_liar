
const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socketUrl = `${socketProtocol}//${window.location.host}`;
const socket = new WebSocket(socketUrl);

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'terminal') {
        // Saída do terminal (sem alteração)
        term.write(data.text);
    } else if (data.type === 'llm_feedback') {
        // Saída da AI
        const aiBox = document.getElementById('ai-box');
        
        if (aiBox) {
            // 1. CONVERSÃO DE MARKDOWN PARA HTML
            // O conteúdo do LLM é passado para a função marked.parse()
            // para converter o Markdown (ex: **negrito**) em HTML (ex: <strong>negrito</strong>).
            const markdownText = data.text;
            const htmlContent = marked.parse(markdownText);
            
            // 2. Criação de um container (usamos <div> porque a saída do LLM 
            // frequentemente contém títulos, listas, etc., o que não cabe em um <p>.)
            const contentContainer = document.createElement('div');
            
            // 3. Uso de innerHTML para renderizar o HTML gerado
            contentContainer.innerHTML = htmlContent;
            
            aiBox.appendChild(contentContainer);
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
