import base64
from io import BytesIO
from PIL import Image
import torch
from torchvision import transforms
from typing import Tuple
import logging

logger = logging.getLogger(__name__)


class ImageUtils:
    """Utility functions for image processing."""

    @staticmethod
    def decode_base64(image_base64: str) -> Image.Image:
        """Decode base64 image string to PIL Image.

        Args:
            image_base64: Base64-encoded image (with or without data URI prefix)

        Returns:
            PIL Image object

        Raises:
            ValueError: If base64 decoding fails or image cannot be opened
        """
        try:
            # Remove data URI prefix if present
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]

            # Decode base64
            image_bytes = base64.b64decode(image_base64)

            # Open image
            pil_image = Image.open(BytesIO(image_bytes))

            # Convert to RGB if needed (handles RGBA, grayscale, etc.)
            if pil_image.mode not in ('RGB', 'L'):
                pil_image = pil_image.convert('RGB')

            return pil_image

        except Exception as e:
            logger.error(f"Failed to decode base64 image: {e}")
            raise ValueError(f"Failed to decode base64 image: {str(e)}")

    @staticmethod
    def preprocess_for_model(
        pil_image: Image.Image,
        target_size: Tuple[int, int] = (224, 224)
    ) -> torch.Tensor:
        """Preprocess PIL Image for model inference.

        Args:
            pil_image: PIL Image object
            target_size: Target (height, width) for resizing

        Returns:
            Preprocessed tensor of shape (C, H, W) with values in [0, 1]
        """
        transform = transforms.Compose([
            transforms.Resize(target_size),
            transforms.ToTensor(),  # Converts to [0, 1] and (C, H, W)
        ])

        tensor = transform(pil_image)
        return tensor
