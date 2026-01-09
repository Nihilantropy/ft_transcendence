# Ollama LLM Service

This file provides guidance for using the Ollama local LLM service in n8n workflows.

## Service Overview

**Ollama** is a local LLM runtime that makes it easy to run large language models on your own hardware with GPU acceleration.

- **Container**: `ollama`
- **Port**: 11434 (exposed to host)
- **API**: OpenAI-compatible chat completions
- **Models**: Download on-demand (llama3, mistral, gemma, etc.)
- **Storage**: Models persist in `ollama` volume

## API Usage

### Base URL

```
http://localhost:11434 (from host)
http://ollama:11434 (from n8n/other containers)
```

### Primary Endpoints

**Generate Completion:**
```
POST http://ollama:11434/api/generate
Content-Type: application/json
```

**Chat Completion (OpenAI-compatible):**
```
POST http://ollama:11434/v1/chat/completions
Content-Type: application/json
```

**List Models:**
```
GET http://ollama:11434/api/tags
```

**Pull Model:**
```
POST http://ollama:11434/api/pull
Content-Type: application/json
```

## n8n Integration

### Chat Completion (Recommended)

**HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "http://ollama:11434/v1/chat/completions",
  "body": {
    "model": "llama3",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "={{ $json.userMessage }}"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 500
  }
}
```

**Response:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "AI response here"
      }
    }
  ]
}
```

Access response: `{{ $json.choices[0].message.content }}`

### Simple Text Generation

**HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "http://ollama:11434/api/generate",
  "body": {
    "model": "llama3",
    "prompt": "={{ $json.userPrompt }}",
    "stream": false
  }
}
```

**Response:**
```json
{
  "response": "Generated text here",
  "done": true
}
```

Access response: `{{ $json.response }}`

### Structured Output (JSON Mode)

**HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "http://ollama:11434/api/generate",
  "body": {
    "model": "llama3",
    "prompt": "Extract name and email from: {{ $json.text }}",
    "format": "json",
    "stream": false
  }
}
```

Returns structured JSON that can be parsed in n8n.

## Model Management

### Pulling Models via CLI

```bash
# Enter ollama container
docker exec -it ollama bash

# Pull a model
ollama pull llama3
ollama pull mistral
ollama pull gemma:7b

# List installed models
ollama list

# Remove a model
ollama rm modelname
```

### Pulling Models via API (from n8n)

**HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "http://ollama:11434/api/pull",
  "body": {
    "name": "llama3"
  }
}
```

### Popular Models

**Small (7B parameters, ~4GB VRAM):**
- `llama3:8b` - Meta's Llama 3 8B
- `mistral:7b` - Mistral 7B
- `gemma:7b` - Google's Gemma 7B

**Medium (13B parameters, ~8GB VRAM):**
- `llama3:13b` - Meta's Llama 3 13B
- `mistral:13b` - Mistral 13B variant

**Large (70B+ parameters, 40GB+ VRAM):**
- `llama3:70b` - Meta's Llama 3 70B (requires high-end GPU)

**Specialized:**
- `codellama:7b` - Code generation
- `llama3-vision` - Multi-modal (text + images)

**Full list:** https://ollama.com/library

## Service Management

### Start/Stop Service

```bash
# Start service
make up-ollama

# Stop service
make down-ollama

# Restart service
make restart-ollama

# View logs
make logs-ollama
```

### GPU Verification

```bash
# Check GPU usage
docker exec ollama nvidia-smi

# Check loaded models
docker exec ollama ollama list
```

### Model Storage

Models are stored in the `ollama` Docker volume:
```bash
# Inspect volume
docker volume inspect ollama

# Models location: /root/.ollama inside container
```

## Use Cases in n8n Workflows

1. **Text Analysis**: Sentiment analysis, classification, summarization
2. **Content Generation**: Blog posts, emails, product descriptions
3. **Data Extraction**: Extract structured data from unstructured text
4. **Chatbots**: Build conversational agents with context
5. **Code Generation**: Generate code snippets or scripts
6. **Translation**: Multi-language text translation
7. **Q&A Systems**: Answer questions based on context/documents

## Advanced Features

### Context Window and Memory

**Chat with conversation history:**
```json
{
  "model": "llama3",
  "messages": [
    {"role": "user", "content": "What is the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."},
    {"role": "user", "content": "What's its population?"}
  ]
}
```

### Temperature Control

```json
{
  "model": "llama3",
  "prompt": "Write a story",
  "temperature": 0.9  // Higher = more creative (0.0-2.0)
}
```

- `0.0-0.3`: Deterministic, factual
- `0.4-0.7`: Balanced
- `0.8-2.0`: Creative, varied

### Token Limits

```json
{
  "model": "llama3",
  "prompt": "Explain quantum physics",
  "num_predict": 500  // Max tokens to generate
}
```

### System Prompts

```json
{
  "model": "llama3",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert Python developer. Always provide working code with comments."
    },
    {
      "role": "user",
      "content": "Write a function to sort a list"
    }
  ]
}
```

## Performance Characteristics

**7B models (~4GB VRAM):**
- Load time: 5-10 seconds
- Generation speed: 20-40 tokens/second (on RTX 4060 Ti)
- Suitable for: General tasks, fast responses

**13B models (~8GB VRAM):**
- Load time: 10-20 seconds
- Generation speed: 10-20 tokens/second
- Suitable for: Better quality, complex reasoning

**GPU Memory Management:**
- Ollama loads models into VRAM on first use
- Models stay loaded until another model is requested
- Can share GPU with TTS/STT services (models load/unload automatically)

## Important Notes

- Service is exposed to host on port 11434
- First model pull downloads 4-40GB depending on model size
- Models persist in Docker volume (survive container restarts)
- Requires NVIDIA GPU with proper drivers and nvidia-container-toolkit
- Shares GPU with other services (ollama dynamically manages VRAM)
- OpenAI-compatible API allows easy migration from OpenAI to local LLMs

## API Parameter Reference

### Generate Endpoint (`/api/generate`)

```json
{
  "model": "llama3",           // Required
  "prompt": "text",            // Required
  "stream": false,             // Optional: streaming responses
  "format": "json",            // Optional: force JSON output
  "temperature": 0.7,          // Optional: 0.0-2.0
  "num_predict": 500,          // Optional: max tokens
  "top_p": 0.9,                // Optional: nucleus sampling
  "top_k": 40,                 // Optional: top-k sampling
  "repeat_penalty": 1.1        // Optional: reduce repetition
}
```

### Chat Endpoint (`/v1/chat/completions`)

```json
{
  "model": "llama3",           // Required
  "messages": [...],           // Required: array of message objects
  "temperature": 0.7,          // Optional: 0.0-2.0
  "max_tokens": 500,           // Optional: max tokens
  "stream": false,             // Optional: streaming
  "top_p": 0.9,                // Optional: nucleus sampling
  "presence_penalty": 0.0,     // Optional: -2.0 to 2.0
  "frequency_penalty": 0.0     // Optional: -2.0 to 2.0
}
```

## Troubleshooting

**Model not loading:**
- Check disk space (models are 4-40GB)
- Ensure GPU is accessible: `docker exec ollama nvidia-smi`
- Check logs: `make logs-ollama`

**Out of memory errors:**
- Use smaller model (7B instead of 13B/70B)
- Reduce `num_predict` (max tokens)
- Ensure other GPU services aren't using all VRAM

**Slow generation:**
- Verify GPU is being used (check nvidia-smi during generation)
- Try smaller model for faster inference
- Reduce `num_predict` for shorter responses

**Connection errors from n8n:**
- Use `http://ollama:11434` (not localhost) from n8n
- Verify both services are on `n8n_stack_network`
- Check service is running: `docker ps | grep ollama`

## Links

- **Ollama Library**: https://ollama.com/library
- **API Documentation**: https://github.com/ollama/ollama/blob/main/docs/api.md
- **Model List**: https://ollama.com/library
- **GitHub**: https://github.com/ollama/ollama
