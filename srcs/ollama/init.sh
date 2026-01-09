#!/bin/sh

# Start ollama server in the background
/bin/ollama serve &

# Wait for ollama server to be ready
echo "Waiting for Ollama server to start..."
sleep 5

# Download ollama models from models.txt
while IFS= read -r model || [ -n "$model" ]; do
  # Skip empty lines and comments
  if [ -n "$model" ] && [ "${model#\#}" = "$model" ]; then
    echo "Pulling model: $model"
    /bin/ollama pull "$model"
  fi
done < /workspace/models.txt

# Wait for the background server process
wait