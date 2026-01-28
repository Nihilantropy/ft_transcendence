from PIL import Image
from transformers import AutoModelForImageClassification, AutoProcessor
import torch
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class BreedClassifierBase:
    """Base class for breed classifiers."""

    def __init__(self, device: str, model_id: str, species: str):
        """Initialize breed classifier.

        Args:
            device: Device to run model on ("cuda" or "cpu")
            model_id: HuggingFace model ID
            species: Species name for logging (dog/cat)
        """
        self.device = device
        self.model_id = model_id
        self.species = species

        logger.info(f"Loading {species} breed classifier: {model_id} on {device}")

        # Load model and processor
        self.model = AutoModelForImageClassification.from_pretrained(model_id)
        self.processor = AutoProcessor.from_pretrained(model_id)

        # Move model to device
        self.model.to(self.device)
        self.model.eval()

        logger.info(f"{species.capitalize()} breed classifier loaded successfully")

    def predict(self, image: Image.Image, top_k: int = 5) -> List[Dict]:
        """Predict breed with top-K results.

        Args:
            image: PIL Image object
            top_k: Number of top predictions to return

        Returns:
            List of {"breed": str, "probability": float} sorted descending
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

        # Map indices to breed labels
        id2label = self.model.config.id2label
        top_predictions = [
            {
                "breed": id2label[idx.item()].lower().replace(" ", "_").replace("-", "_"),
                "probability": round(prob.item(), 3)
            }
            for prob, idx in zip(top_probs, top_indices)
        ]

        return top_predictions


class DogBreedClassifier(BreedClassifierBase):
    """Dog breed classifier using ViT model (120 breeds)."""

    def __init__(
        self,
        device: str = "cuda",
        model_id: str = "wesleyacheng/dog-breeds-multiclass-image-classification-with-vit"
    ):
        """Initialize dog breed classifier."""
        super().__init__(device=device, model_id=model_id, species="dog")


class CatBreedClassifier(BreedClassifierBase):
    """Cat breed classifier."""

    def __init__(
        self,
        device: str = "cuda",
        model_id: str = "dima806/cat_breed_image_detection"
    ):
        """Initialize cat breed classifier."""
        super().__init__(device=device, model_id=model_id, species="cat")
