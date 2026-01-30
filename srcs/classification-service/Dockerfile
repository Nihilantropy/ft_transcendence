FROM python:3.12.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --pre -r requirements.txt
RUN pip3 install --pre torch torchvision --index-url https://download.pytorch.org/whl/nightly/cu128

# Copy application code
COPY src/ ./src/
COPY tests/ ./tests/

# Create non-root user
RUN useradd -m -u 1000 classifier && \
    mkdir -p /app/.cache/huggingface && \
    chown -R classifier:classifier /app
USER classifier

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:3004/health || exit 1

EXPOSE 3004

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3004"]
