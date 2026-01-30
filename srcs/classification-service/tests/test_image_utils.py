import pytest
import base64
from io import BytesIO
from PIL import Image

from src.services.image_utils import ImageUtils


@pytest.fixture
def sample_image_base64():
    """Create a sample base64-encoded image."""
    img = Image.new('RGB', (100, 100), color='red')
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


@pytest.fixture
def sample_image_base64_no_prefix():
    """Create a sample base64-encoded image without data URI prefix."""
    img = Image.new('RGB', (100, 100), color='blue')
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    return base64.b64encode(buffer.getvalue()).decode()


def test_decode_base64_with_data_uri(sample_image_base64):
    """Test decoding base64 image with data URI prefix."""
    pil_image = ImageUtils.decode_base64(sample_image_base64)

    assert isinstance(pil_image, Image.Image)
    assert pil_image.size == (100, 100)
    assert pil_image.mode == 'RGB'


def test_decode_base64_without_prefix(sample_image_base64_no_prefix):
    """Test decoding base64 image without data URI prefix."""
    pil_image = ImageUtils.decode_base64(sample_image_base64_no_prefix)

    assert isinstance(pil_image, Image.Image)
    assert pil_image.size == (100, 100)


def test_decode_invalid_base64():
    """Test decoding invalid base64 raises ValueError."""
    with pytest.raises(ValueError, match="Failed to decode base64 image"):
        ImageUtils.decode_base64("invalid_base64_data")


def test_preprocess_image_for_model(sample_image_base64):
    """Test preprocessing image for model inference."""
    import torch

    pil_image = ImageUtils.decode_base64(sample_image_base64)
    tensor = ImageUtils.preprocess_for_model(pil_image, target_size=(224, 224))

    assert isinstance(tensor, torch.Tensor)
    assert tensor.shape == (3, 224, 224)  # C, H, W
    assert tensor.dtype == torch.float32
