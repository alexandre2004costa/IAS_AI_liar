import os
import requests
import json
from dotenv import load_dotenv
# Endpoint fornecido
API_ENDPOINT = os.getenv("GPT_ENDPOINT")
API_KEY = os.getenv("GPT_API_KEY")

def call_llm(history, new_input):
    """
    Envia histórico e novo input à API da iaedu.pt.
    Retorna apenas o texto final da resposta da LLM.
    """
    if not API_KEY:
        raise ValueError("Erro: variável de ambiente IAEDU_API_KEY não definida.")

    # Monta histórico em texto legível
    conversation = ""
    for msg in history:
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        conversation += f"[{role}]: {content}\n"
    conversation += f"[USER]: {new_input}\n"

    form_data = {
        "channel_id": "cmh6shrl51nqdiy019loozzwd",
        "thread_id": "o1QMsM3SbKksNAQ0oWSJT",
        "user_info": json.dumps({"source": "local_terminal"}),
        "message": conversation
    }

    headers = {
        "x-api-key": API_KEY,
    }

    print("\n========== [DEBUG: ENVIANDO PARA LLM] ==========")
    print(conversation)
    print("================================================\n")

    # Faz o request em modo streaming
    response = requests.post(API_ENDPOINT, headers=headers, data=form_data, stream=True)

    if response.status_code != 200:
        print(f"[ERRO API] {response.status_code}: {response.text}")
        return f"[ERRO API] {response.text}"

    final_content = ""

    # Lê linha por linha do stream
    for line in response.iter_lines():
        if not line:
            continue
        try:
            data = json.loads(line.decode("utf-8"))
        except json.JSONDecodeError:
            continue

        # Quando chegar ao evento "message", contém a resposta final
        if data.get("type") == "message":
            content_data = data.get("content", {})
            if isinstance(content_data, dict) and "content" in content_data:
                final_content = content_data["content"]
            elif isinstance(content_data, str):
                final_content = content_data
        elif data.get("type") == "token":
            # Opcional: mostrar tokens a chegar em tempo real (debug)
            print(data.get("content", ""), end="", flush=True)

    print("\n========== [DEBUG: RESPOSTA FINAL LLM] ==========")
    print(final_content)
    print("=================================================\n")

    return final_content