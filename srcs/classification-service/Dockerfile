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

# Which PyTorch wheel index to build against. CPU by default: this service runs
# in the default stack on machines with no GPU (including the evaluation
# machine), and the code already falls back on its own —
# src/main.py resolves DEVICE=auto to "cpu" when CUDA is absent. The CUDA wheels
# would only add ~3 GB of libraries that go unused there.
#
# docker-compose.gpu.yml overrides this to `cu128` for developer machines with
# an NVIDIA card: stable CUDA 12.8 wheels cover Ada (sm_89) and Blackwell
# (sm_120, RTX 5060 Ti). The version pair is pinned and identical on both
# indexes — only the index changes — and must stay matched (torch 2.11 <->
# torchvision 0.26): the unpinned nightly this replaced broke once the two
# drifted apart on the index.
ARG TORCH_INDEX=cpu
RUN pip3 install --no-cache-dir \
    torch==2.11.0 \
    torchvision==0.26.0 \
    --index-url https://download.pytorch.org/whl/${TORCH_INDEX}

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
