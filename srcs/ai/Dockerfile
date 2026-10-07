FROM python:3.12.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# CPU-only PyTorch, installed BEFORE requirements.txt so sentence-transformers finds it already
# satisfied. Left to plain pip, it pulled the PyPI default — the CUDA build, with ~3.2 GB of nvidia
# libraries and ~0.9 GB of triton — which made this image 10.5 GB. Nothing here uses a GPU: torch
# only runs the small all-MiniLM-L6-v2 embedder (src/services/embedder.py), on the CPU already.
# Same version as classification-service; pinned because the index is not the PyPI resolver.
RUN pip install --no-cache-dir torch==2.11.0 --index-url https://download.pytorch.org/whl/cpu

# Copy and install requirements (baked into image)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY tests/ ./tests/
COPY pytest.ini .

# Create data directories for ChromaDB and knowledge base
RUN mkdir -p /app/data/chroma /app/data/knowledge_base

# Create non-root user and set permissions
RUN useradd -m -u 1000 aiuser && \
    chown -R aiuser:aiuser /app

USER aiuser

EXPOSE 3003

# One worker on purpose. ChromaDB runs embedded (PersistentClient) and keeps its
# vector index in process memory: a second worker never sees what the first one
# ingests or deletes, so its RAG queries return stale or dangling results until a
# restart. Requests stay concurrent — the slow work is awaited (LLM, classification)
# or runs in a thread (knowledge base sync).
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3003", "--workers", "1"]
