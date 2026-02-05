# Classification Service

Image classification microservice for the SmartBreeds platform. Provides NSFW detection, species identification, and breed classification using HuggingFace Transformers.

## Features

- **NSFW Detection**: Content safety filter using Falconsai model
- **Species Classification**: Dog/Cat/Other identification (151 animal types)
- **Breed Classification**: 120 dog breeds, 70 cat breeds
- **Crossbreed Detection**: Multi-rule heuristic for mixed breed identification
- **GPU Acceleration**: RTX 5060 Ti (Blackwell) support via PyTorch 2.11 nightly

## Technology Stack

- **Framework**: FastAPI
- **ML Framework**: PyTorch 2.11 nightly + CUDA 12.8
- **Models**: HuggingFace Transformers (ViT-based classifiers)
- **Device**: Auto-detect GPU/CPU with fallback

## Quick Start

```bash
# Start services
make up

# Verify GPU
docker exec ft_transcendence_classification_service python -c "import torch; print(torch.cuda.is_available())"

# Run tests
docker compose run --rm classification-service python -m pytest tests/ -v
```

## API

**Internal endpoint** (called by AI Service):
```
POST /classify
Content-Type: application/json

{
  "image": "<base64-encoded-image>"
}
```

## Models

| Purpose | Model | Classes |
|---------|-------|---------|
| NSFW | Falconsai/nsfw_image_detection | safe/nsfw |
| Species | dima806/animal_151_types_image_detection | 151 animals |
| Dog breeds | wesleyacheng/dog-breeds-multiclass-image-classification-with-vit | 120 breeds |
| Cat breeds | dima806/cat_breed_image_detection | 70 breeds |

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance.
