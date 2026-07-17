FROM python:3.12.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Stable torch+torchvision with CUDA 12.8 — supports both Ada (sm_89) and
# Blackwell (sm_120, RTX 5060 Ti). Replaces the fragile unpinned nightly, which
# broke once torch/torchvision nightlies drifted out of sync on the index.
RUN pip3 install \
    torch==2.11.0+cu128 \
    torchvision==0.26.0+cu128 \
    --index-url https://download.pytorch.org/whl/cu128

# Copy application code
COPY src/ ./src/
COPY tests/ ./tests/

# Create non-root user
RUN useradd -m -u 1000 classifier && \
    mkdir -p /app/.cache/huggingface && \
    chown -R classifier:classifier /app
USER classifier

EXPOSE 3004

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3004"]
