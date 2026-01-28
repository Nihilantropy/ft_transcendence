from PIL import Image
from transformers import AutoModelForImageClassification, AutoProcessor
import torch
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class SpeciesClassifier:
    """Species classification using HuggingFace model (151 animal types)."""

    def __init__(
        self,
        device: str = "cuda",
        model_id: str = "dima806/animal_151_types_image_detection"
    ):
        """Initialize species classifier.

        Args:
            device: Device to run model on ("cuda" or "cpu")
            model_id: HuggingFace model ID
        """
        self.device = device
        self.model_id = model_id

        logger.info(f"Loading species classifier: {model_id} on {device}")

        # Load model and processor
        self.model = AutoModelForImageClassification.from_pretrained(model_id)
        self.processor = AutoProcessor.from_pretrained(model_id)

        # Move model to device
        self.model.to(self.device)
        self.model.eval()

        logger.info("Species classifier loaded successfully")

    def predict(self, image: Image.Image, top_k: int = 3) -> Dict:
        """Predict animal species with top-K results.

        Args:
            image: PIL Image object
            top_k: Number of top predictions to return

        Returns:
            Dict with species, confidence, and top_predictions
        """
        # Preprocess image
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Run inference
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits

        # Get probabilities
        probs = torch.nn.functional.softmax(logits, dim=-1)[0]

        # Get top-K predictions
        top_probs, top_indices = torch.topk(probs, k=min(top_k, len(probs)))

        # Map indices to labels
        id2label = self.model.config.id2label
        top_predictions = [
            {
                "label": id2label[idx.item()].lower(),
                "confidence": round(prob.item(), 3)
            }
            for prob, idx in zip(top_probs, top_indices)
        ]

        return {
            "species": top_predictions[0]["label"],
            "confidence": top_predictions[0]["confidence"],
            "top_predictions": top_predictions
        }
