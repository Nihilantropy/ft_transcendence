from PIL import Image
from transformers import AutoModelForImageClassification, AutoProcessor
import torch
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class NSFWDetector:
    """NSFW content detection using HuggingFace model."""

    def __init__(self, device: str = "cuda", model_id: str = "Falconsai/nsfw_image_detection"):
        """Initialize NSFW detector.

        Args:
            device: Device to run model on ("cuda" or "cpu")
            model_id: HuggingFace model ID
        """
        self.device = device
        self.model_id = model_id

        logger.info(f"Loading NSFW detector: {model_id} on {device}")

        # Load model and processor
        self.model = AutoModelForImageClassification.from_pretrained(model_id)
        self.processor = AutoProcessor.from_pretrained(model_id)

        # Move model to device
        self.model.to(self.device)
        self.model.eval()

        logger.info("NSFW detector loaded successfully")

    def predict(self, image: Image.Image) -> Dict[str, any]:
        """Predict NSFW probability for image.

        Args:
            image: PIL Image object

        Returns:
            Dict with is_safe (bool) and nsfw_probability (float)
        """
        # Preprocess image
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Run inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits

        # Get probabilities
        probs = torch.nn.functional.softmax(logits, dim=-1)

        # Assuming binary classification: [safe, nsfw]
        # (Note: Actual label mapping may vary by model)
        nsfw_prob = probs[0][1].item() if probs.shape[1] > 1 else 0.0

        return {
            "is_safe": nsfw_prob < 0.5,  # Simple threshold for now
            "nsfw_probability": round(nsfw_prob, 3)
        }
