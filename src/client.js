
const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socketUrl = `${socketProtocol}//${window.location.host}`;
const socket = new WebSocket(socketUrl);
let isLLMProcessingFrontend = false;
let warningTimeout = null;

function showGlobalWarning(text) {
    const box = document.getElementById("global-warning");
    
    // Update the current text
    box.textContent = text;

    // Make visible
    box.classList.remove("hidden");
    box.classList.add("visible");

    // Reset timer if already visible
    if (warningTimeout) {
        clearTimeout(warningTimeout);
    }

    // Hide after 5 seconds
    warningTimeout = setTimeout(() => {
        box.classList.remove("visible");
        box.classList.add("hidden");
    }, 5000);
}


function AiBoxDisply(type, text){
    const aiBox = document.getElementById('ai-box');
        
        if (aiBox) {
            // Criar container para a mensagem
            const messageContainer = document.createElement('div');
            messageContainer.className = 'ai-message';
            
            // Criar elemento para o prefixo
            const prefixElement = document.createElement('span');
            prefixElement.className = 'ai-prefix';
            
            // Determinar o prefixo e a classe com base no tipo de mensagem
            if (type === 'llm_feedback_answer') {
                prefixElement.textContent = 'AI (answer): ';
                prefixElement.classList.add('ai-prefix-answer');
            } else {
                prefixElement.textContent = 'AI (feedback): ';
                prefixElement.classList.add('ai-prefix-feedback');
            }
            
            // Criar elemento para o conteúdo
            const contentElement = document.createElement('div');
            contentElement.className = 'ai-content';
            
            // CONVERSÃO DE MARKDOWN PARA HTML
            const markdownText = text;
            const htmlContent = marked.parse(markdownText);
            contentElement.innerHTML = htmlContent;
            
            // Montar a mensagem
            messageContainer.appendChild(prefixElement);
            messageContainer.appendChild(contentElement);
            
            // Adicionar linha separadora
            const separator = document.createElement('hr');
            separator.className = 'ai-separator';
            
            // Adicionar ao AI box
            aiBox.appendChild(messageContainer);
            aiBox.appendChild(separator);
            aiBox.scrollTop = aiBox.scrollHeight; // scroll automático
        }
}

function reasoningDisplay(text){

const reasoningBox = document.getElementById('reasoning-box');
        
if (reasoningBox) {
    // Criar container para esta mensagem de reasoning
    const reasoningContainer = document.createElement('div');
    reasoningContainer.className = 'reasoning-message';
    
    // Criar elemento para o prefixo
    const prefixElement = document.createElement('div');
    prefixElement.className = 'reasoning-prefix';
    prefixElement.textContent = 'AI Reasoning';
    
    // Adicionar timestamp
    const timestamp = new Date().toLocaleTimeString();
    const timestampElement = document.createElement('span');
    timestampElement.className = 'reasoning-timestamp';
    timestampElement.textContent = ` [${timestamp}]`;
    prefixElement.appendChild(timestampElement);
    
    // Criar elemento para o conteúdo
    const contentElement = document.createElement('div');
    contentElement.className = 'reasoning-text';
    
    // Converter e adicionar o texto do reasoning
    const markdownText = text;
    const htmlContent = marked.parse(markdownText);
    contentElement.innerHTML = htmlContent;
    
    // Montar a mensagem
    reasoningContainer.appendChild(prefixElement);
    reasoningContainer.appendChild(contentElement);
    
    // Adicionar ao reasoning box
    reasoningBox.appendChild(reasoningContainer);
    
    // Scroll automático para o final
    reasoningBox.scrollTop = reasoningBox.scrollHeight;

}}

socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

    if (data.type === 'terminal') {
        // Saída do terminal (sem alteração)
        term.write(data.text);
    } else if (data.type === 'llm_feedback_answer' || data.type === 'llm_feedback_feedback') {
        AiBoxDisply(data.type, data.text);        
    } else if (data.type === 'llm_reasoning') {
        reasoningDisplay(data.text);        
    }else if (data.type === "warning") {
        showGlobalWarning(data.text);
    }
};

const aiInput = document.getElementById('ai-input');
const aiSendBtn = document.getElementById('send-button');

function sendMessageToBackend() {
    if (isLLMProcessingFrontend) {
        showGlobalWarning("AI is still processing. Please wait.");
        console.log("LLM is processing, cannot send a new message yet.");
        return;
    }

    const message = aiInput.value.trim();
    if (message === '') return;

    isLLMProcessingFrontend = true; // block new messages while waiting

    // Optionally show warning locally
    showGlobalWarning("AI is processing your message...");

    fetch('/api/ai-message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            timestamp: new Date().toISOString()
        })
    })
    .then(response => response.json())
    .then(data => {
        const llmText = data.response.text;
        const llmReasoning = data.response.reasoning;
        reasoningDisplay(llmReasoning);        
        AiBoxDisply('llm_feedback_answer', llmText);
        isLLMProcessingFrontend = false;
    })
    .catch(error => {
        console.error('Erro ao enviar mensagem:', error);
    })

    aiInput.value = '';
}

// Event listeners
aiSendBtn.addEventListener('click', sendMessageToBackend);
aiInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessageToBackend();
});

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