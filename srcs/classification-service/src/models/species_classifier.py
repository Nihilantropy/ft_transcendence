from PIL import Image
from transformers import AutoModelForImageClassification, AutoProcessor
import torch
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

# Species mapping from scientific names to simple labels
SPECIES_MAPPING = {
    "canis-lupus-familiaris": "dog",
    "canis lupus familiaris": "dog",
    "canis": "dog",
    "dog": "dog",
    "felis-catus": "cat",
    "felis catus": "cat",
    "felis": "cat",
    "cat": "cat",
}


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

        # Normalize species to "dog" or "cat" if possible
        raw_species = top_predictions[0]["label"]
        normalized_species = SPECIES_MAPPING.get(raw_species, raw_species)

        return {
            "species": normalized_species,
            "confidence": top_predictions[0]["confidence"],
            "top_predictions": top_predictions
        }
