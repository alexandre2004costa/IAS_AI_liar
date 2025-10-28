"""
Simulated LLM Terminal (Flask)
Agora a LLM reage automaticamente sempre que o terminal muda,
e identifica o comando executado, mostrando no chat numa cor diferente.
"""

from flask import Flask, request, session, jsonify, render_template
from datetime import timedelta
import os
import hashlib
import re
from threading import Lock
from llm_client import call_llm

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-me')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=60)

TERMINAL_LOG_FILE = 'test/terminal_log.txt'
terminal_hash_lock = Lock()
last_terminal_hash_global = None

# --- Helpers ---
def read_terminal_log():
    if not os.path.exists(TERMINAL_LOG_FILE):
        return ''
    with open(TERMINAL_LOG_FILE, 'r', encoding='utf-8') as f:
        return f.read()

def hash_content(content):
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def extract_last_command(log):
    """
    Retorna o último comando executado no terminal.
    Procura a última linha que começa com '$' e remove o prompt.
    """
    lines = [line.strip() for line in log.strip().splitlines() if line.strip()]
    # Percorre de trás para frente
    for line in reversed(lines):
        if line.startswith('$'):
            # Remove o prompt do tipo "$ " ou "user@machine:~$ "
            cmd = re.sub(r'^.*?\$\s*', '', line)
            return cmd
    return None

# --- LLM integration ---
def simulate_response(user_input, context_log="", cls='ai'):
    """
    Gera resposta da LLM usando o histórico guardado na sessão.
    - Passa o history para call_llm(history, new_input)
    - Depois de obter a resposta, atualiza session['history'] com user+assistant
    """
    # Recolhe o histórico actual (pode ser vazio)
    history = session.get('history', [])

    # Prepara o novo prompt (podemos passar o prompt completo como new_input)
    prompt = (
        f"TERMINAL LOG:\n{context_log}\n\nUSER INPUT: {user_input}"
    )

    # Chamada ao LLM passando o histórico real
    try:
        llm_text = call_llm(history, prompt)
    except Exception as e:
        llm_text = f"[LLM Error]: {e}"

    print(f"[DEBUG] LLM response: {llm_text}")

    # Atualiza o histórico da sessão com o par (user, assistant)
    try:
        history = session.get('history', [])  # ler de novo para evitar race conditions
        history.append({'role': 'user', 'content': user_input})
        history.append({'role': 'assistant', 'content': llm_text})
        session['history'] = history
    except Exception:
        # falhar a gravar o histórico não deve quebrar a resposta
        pass

    # Se a mensagem for automática do utilizador (cls == 'auto') devolve esse formato,
    # caso contrário devolve resposta AI como antes.
    if cls == 'auto':
        return [{'cls': 'auto', 'text': f'[User-auto]: {user_input}'},
                {'cls': 'ai', 'text': f'[AI]: {llm_text}'}]
    else:
        return [{'cls': 'ai', 'text': f'[AI]: {llm_text}'}]


# --- Routes ---
@app.route('/')
def index():
    session['last_terminal_hash'] = hash_content(read_terminal_log())
    return render_template('index.html')

@app.route('/api/command', methods=['POST'])
def api_command():
    data = request.get_json() or {}
    cmd = data.get('cmd', '').strip()
    if not cmd:
        return jsonify({'output': [{'cls': 'ai', 'text': '[AI]: no command received.'}]})
    output = simulate_response(cmd, read_terminal_log(), cls='user')
    return jsonify({'output': output})

@app.route('/api/terminal', methods=['GET'])
def api_terminal():
    """Verifica se o terminal mudou desde a última leitura com lock global."""
    global last_terminal_hash_global

    content = read_terminal_log()
    new_hash = hash_content(content)

    response_data = {'content': content, 'ai_output': None}

    with terminal_hash_lock:
        if last_terminal_hash_global != new_hash:
            print("[INFO] Mudança detectada no terminal_log.txt — chamando LLM...")
            last_terminal_hash_global = new_hash  # Atualiza hash global

            command = extract_last_command(content)
            if command:
                # Adiciona mensagem automática no chat
                auto_msg = f"Comando '{command}' escrito no terminal."
                response_data['ai_output'] = simulate_response(auto_msg, content, cls='auto')

    return jsonify(response_data)

@app.route('/api/reset', methods=['POST'])
def api_reset():
    session.clear()
    return jsonify({'msg': '[AI]: simulation reset.'})

# --- Main ---
if __name__ == '__main__':
    
    app.run(debug=True)
