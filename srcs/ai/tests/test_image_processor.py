"""Tests for ImageProcessor service."""
import base64
import io
import pytest
from PIL import Image
from unittest.mock import MagicMock

from src.services.image_processor import ImageProcessor


@pytest.fixture
def config():
    cfg = MagicMock()
    cfg.MAX_IMAGE_SIZE_MB = 10
    cfg.MAX_IMAGE_DIMENSION = 1024
    cfg.MIN_IMAGE_DIMENSION = 50
    cfg.SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp']
    return cfg


@pytest.fixture
def processor(config):
    return ImageProcessor(config)


def make_jpeg_uri(width=100, height=100):
    img = Image.new('RGB', (width, height), color=(128, 64, 32))
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    encoded = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


def make_png_uri(width=100, height=100, mode='RGBA'):
    img = Image.new(mode, (width, height), color=(128, 64, 32, 200))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    encoded = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def test_init_sets_config_values(config):
    p = ImageProcessor(config)
    assert p.max_size_bytes == 10 * 1024 * 1024
    assert p.max_dimension == 1024
    assert p.min_dimension == 50
    assert p.supported_formats == ['jpeg', 'jpg', 'png', 'webp']


def test_process_image_valid_jpeg(processor):
    result = processor.process_image(make_jpeg_uri(100, 100))
    assert result.startswith("data:image/jpeg;base64,")


def test_process_image_valid_png_rgba(processor):
    result = processor.process_image(make_png_uri(100, 100, mode='RGBA'))
    assert result.startswith("data:image/png;base64,")


def test_process_image_too_large(config):
    config.MAX_IMAGE_SIZE_MB = 0  # 0 MB → everything fails
    p = ImageProcessor(config)
    with pytest.raises(ValueError, match="exceeds"):
        p.process_image(make_jpeg_uri(100, 100))


def test_process_image_too_small(config):
    config.MIN_IMAGE_DIMENSION = 200
    p = ImageProcessor(config)
    with pytest.raises(ValueError, match="too small"):
        p.process_image(make_jpeg_uri(100, 100))


def test_process_image_resizes_large_image(config):
    config.MAX_IMAGE_DIMENSION = 50
    p = ImageProcessor(config)
    result = p.process_image(make_jpeg_uri(200, 200))
    assert result.startswith("data:image/jpeg;base64,")


def test_parse_data_uri_invalid_prefix(processor):
    with pytest.raises(ValueError, match="Invalid data URI"):
        processor._parse_data_uri("http://example.com/image.jpg")


def test_parse_data_uri_missing_comma(processor):
    with pytest.raises(ValueError, match="Invalid data URI"):
        processor._parse_data_uri("data:image/jpeg;base64:abc123")


def test_parse_data_uri_unsupported_format(processor):
    with pytest.raises(ValueError, match="Unsupported format"):
        processor._parse_data_uri("data:image/bmp;base64,abc123")


def test_parse_data_uri_valid_jpeg(processor):
    fmt, data = processor._parse_data_uri("data:image/jpeg;base64,/9j/abc123")
    assert fmt == "jpeg"
    assert data == "/9j/abc123"


def test_parse_data_uri_valid_png(processor):
    fmt, data = processor._parse_data_uri("data:image/png;base64,iVBOR")
    assert fmt == "png"
    assert data == "iVBOR"


def test_resize_image(processor):
    img = Image.new('RGB', (2000, 1000), color=(128, 64, 32))
    resized = processor._resize_image(img)
    assert max(resized.size) <= processor.max_dimension


def test_encode_image_jpeg(processor):
    img = Image.new('RGB', (100, 100), color=(128, 64, 32))
    result = processor._encode_image(img, 'jpeg')
    assert result.startswith("data:image/jpeg;base64,")


def test_encode_image_jpg(processor):
    img = Image.new('RGB', (100, 100), color=(128, 64, 32))
    result = processor._encode_image(img, 'jpg')
    assert result.startswith("data:image/jpg;base64,")


def test_encode_image_png(processor):
    img = Image.new('RGB', (100, 100), color=(128, 64, 32))
    result = processor._encode_image(img, 'png')
    assert result.startswith("data:image/png;base64,")
