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

# Copy and install requirements (baked into image)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY tests/ ./tests/
COPY scripts/ ./scripts/
COPY pytest.ini .

# Create data directories for ChromaDB and knowledge base
RUN mkdir -p /app/data/chroma /app/data/knowledge_base

# Create non-root user and set permissions
RUN useradd -m -u 1000 aiuser && \
    chown -R aiuser:aiuser /app

USER aiuser

EXPOSE 3003

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3003", "--workers", "2"]
