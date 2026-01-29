import base64
from io import BytesIO
from PIL import Image


def create_test_image(color: str = "red", size: tuple = (224, 224)) -> str:
    """Create a simple test image as base64.

    Args:
        color: Color name (red, blue, green, etc.)
        size: Image dimensions (width, height)

    Returns:
        Base64-encoded JPEG with data URI prefix
    """
    img = Image.new('RGB', size, color=color)
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"


# Pre-generated fixtures
SAMPLE_DOG_IMAGE = create_test_image("brown")
SAMPLE_CAT_IMAGE = create_test_image("gray")
SAMPLE_INVALID_IMAGE = "data:image/jpeg;base64,invalid_data"
