import pytest
import base64
from PIL import Image
import io
from src.services.image_processor import ImageProcessor
from src.config import Settings

@pytest.fixture
def settings():
    """Test settings."""
    return Settings()

@pytest.fixture
def image_processor(settings):
    """Image processor instance."""
    return ImageProcessor(settings)

@pytest.fixture
def valid_image_base64():
    """Generate valid 512x512 test image."""
    img = Image.new('RGB', (512, 512), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

@pytest.fixture
def large_image_base64():
    """Generate 2048x2048 test image (needs resize)."""
    img = Image.new('RGB', (2048, 2048), color='blue')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

@pytest.fixture
def small_image_base64():
    """Generate 100x100 test image (too small)."""
    img = Image.new('RGB', (100, 100), color='green')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

class TestImageProcessor:
    def test_process_valid_image(self, image_processor, valid_image_base64):
        """Test processing valid image."""
        result = image_processor.process_image(valid_image_base64)

        assert result.startswith("data:image/jpeg;base64,")
        assert len(result) > 100

    def test_process_large_image_resizes(self, image_processor, large_image_base64):
        """Test large image is resized to max dimension."""
        result = image_processor.process_image(large_image_base64)

        # Decode and check dimensions
        base64_data = result.split(',')[1]
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_bytes))

        assert max(img.size) <= 1024
        assert min(img.size) <= 1024

    def test_invalid_data_uri_rejected(self, image_processor):
        """Test invalid data URI format is rejected."""
        with pytest.raises(ValueError, match="Invalid data URI"):
            image_processor.process_image("not-a-data-uri")

    def test_unsupported_format_rejected(self, image_processor):
        """Test unsupported image format is rejected."""
        # Create BMP image (not supported)
        img = Image.new('RGB', (512, 512), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format='BMP')
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/bmp;base64,{encoded}"

        with pytest.raises(ValueError, match="Unsupported format"):
            image_processor.process_image(data_uri)

    def test_small_image_rejected(self, image_processor, small_image_base64):
        """Test image below minimum dimensions is rejected."""
        with pytest.raises(ValueError, match="too small"):
            image_processor.process_image(small_image_base64)

    def test_oversized_image_rejected(self, image_processor, settings):
        """Test image exceeding size limit is rejected."""
        # Create very large image that exceeds 5MB
        # Use random colors to make it uncompressible
        import random
        img = Image.new('RGB', (5000, 5000))
        pixels = img.load()
        for i in range(5000):
            for j in range(5000):
                pixels[i, j] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))

        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=95)
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/jpeg;base64,{encoded}"

        with pytest.raises(ValueError, match="exceeds"):
            image_processor.process_image(data_uri)

    def test_png_image_processed(self, image_processor):
        """Test PNG images are processed correctly."""
        img = Image.new('RGB', (512, 512), color='blue')
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        encoded = base64.b64encode(buffer.getvalue()).decode()
        data_uri = f"data:image/png;base64,{encoded}"

        result = image_processor.process_image(data_uri)
        assert result.startswith("data:image/png;base64,")
