import subprocess
import os

# Ficheiro onde vamos guardar os comandos e saídas
log_file = "terminal_log.txt"

# Mudar automaticamente para o diretório 'tests' no início
try:
    os.chdir("test")
except FileNotFoundError:
    print("A pasta 'test' não existe!")
    exit(1)

print(f"Terminal interativo (diretório atual: {os.getcwd()}). Digite 'exit' para sair.")

while True:
    try:
        # Ler comando do utilizador
        command = input("$ ")
        if command.strip().lower() == "exit":
            break
        
        # Executar comando no shell no diretório atual ('tests')
        result = subprocess.run(command, shell=True, text=True, capture_output=True)
        
        # Mostrar saída no terminal
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="")
        
        # Guardar comando e saída no ficheiro
        with open(log_file, "a") as f:
            f.write(f"$ {command}\n")
            if result.stdout:
                f.write(result.stdout)
            if result.stderr:
                f.write(result.stderr)
            
    except KeyboardInterrupt:
        print("\nSaindo...")
        break
