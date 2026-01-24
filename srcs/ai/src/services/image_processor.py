from PIL import Image
import base64
import io
from typing import Tuple
import logging

logger = logging.getLogger(__name__)

class ImageProcessor:
    """Process and validate images for AI analysis."""

    def __init__(self, config):
        """Initialize image processor with configuration.

        Args:
            config: Settings instance with image processing config
        """
        self.max_size_bytes = config.MAX_IMAGE_SIZE_MB * 1024 * 1024
        self.max_dimension = config.MAX_IMAGE_DIMENSION
        self.min_dimension = config.MIN_IMAGE_DIMENSION
        self.supported_formats = config.SUPPORTED_FORMATS

    def process_image(self, data_uri: str) -> str:
        """Process and optimize image from data URI.

        Args:
            data_uri: Base64-encoded image with data URI format

        Returns:
            Processed image as data URI

        Raises:
            ValueError: If image is invalid, wrong format, or wrong size
        """
        # Extract format and base64 data
        format_str, base64_data = self._parse_data_uri(data_uri)

        # Decode base64
        image_bytes = base64.b64decode(base64_data)

        # Validate size
        if len(image_bytes) > self.max_size_bytes:
            raise ValueError(
                f"Image exceeds {self.max_size_bytes / (1024*1024):.0f}MB limit"
            )

        # Open image
        image = Image.open(io.BytesIO(image_bytes))

        # Validate dimensions
        width, height = image.size
        if width < self.min_dimension or height < self.min_dimension:
            raise ValueError(
                f"Image too small (min {self.min_dimension}x{self.min_dimension})"
            )

        # Resize if needed
        if width > self.max_dimension or height > self.max_dimension:
            logger.info(f"Resizing image from {width}x{height}")
            image = self._resize_image(image)

        # Convert to RGB if needed
        if image.mode not in ('RGB', 'L'):
            image = image.convert('RGB')

        # Re-encode optimized image
        return self._encode_image(image, format_str)

    def _parse_data_uri(self, data_uri: str) -> Tuple[str, str]:
        """Parse data URI into format and base64 data.

        Args:
            data_uri: Data URI string

        Returns:
            Tuple of (format, base64_data)

        Raises:
            ValueError: If data URI is invalid or format unsupported
        """
        if not data_uri.startswith('data:image/'):
            raise ValueError("Invalid data URI format")

        parts = data_uri.split(',', 1)
        if len(parts) != 2:
            raise ValueError("Invalid data URI format")

        header = parts[0]
        format_str = header.split('/')[1].split(';')[0].lower()

        if format_str not in self.supported_formats:
            raise ValueError(f"Unsupported format: {format_str}")

        return format_str, parts[1]

    def _resize_image(self, image: Image.Image) -> Image.Image:
        """Resize image maintaining aspect ratio.

        Args:
            image: PIL Image instance

        Returns:
            Resized PIL Image
        """
        image.thumbnail(
            (self.max_dimension, self.max_dimension),
            Image.Resampling.LANCZOS
        )
        return image

    def _encode_image(self, image: Image.Image, format_str: str) -> str:
        """Encode image to base64 data URI.

        Args:
            image: PIL Image instance
            format_str: Image format (jpeg, png, webp)

        Returns:
            Base64-encoded data URI
        """
        buffer = io.BytesIO()
        save_format = 'JPEG' if format_str in ['jpg', 'jpeg'] else format_str.upper()

        # Save with optimization
        if save_format == 'JPEG':
            image.save(buffer, format=save_format, quality=85, optimize=True)
        else:
            image.save(buffer, format=save_format, optimize=True)

        encoded = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/{format_str};base64,{encoded}"
