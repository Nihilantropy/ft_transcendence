"""Weighted cosine similarity engine for pet-product matching."""
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from src.config import WEIGHT_VECTOR, MIN_SIMILARITY_THRESHOLD


class SimilarityEngine:
    """Calculate weighted cosine similarity between pet and product features."""

    def __init__(self, weight_vector: np.ndarray = None, threshold: float = None):
        """
        Initialize similarity engine.

        Args:
            weight_vector: 15-element weight vector (defaults to config.WEIGHT_VECTOR)
            threshold: Minimum similarity threshold (defaults to config.MIN_SIMILARITY_THRESHOLD)
        """
        self.weight_vector = weight_vector if weight_vector is not None else WEIGHT_VECTOR
        self.threshold = threshold if threshold is not None else MIN_SIMILARITY_THRESHOLD

    def calculate_similarity(
        self, pet_features: np.ndarray, product_features: np.ndarray
    ) -> float:
        """
        Calculate weighted cosine similarity between pet and product.

        Args:
            pet_features: 15-dimensional pet feature vector
            product_features: 15-dimensional product feature vector

        Returns:
            Similarity score (0.0-1.0), or 0.0 if below threshold
        """
        # Apply weights element-wise
        weighted_pet = pet_features * self.weight_vector
        weighted_product = product_features * self.weight_vector

        # Calculate cosine similarity
        # Reshape for sklearn (expects 2D arrays)
        similarity = cosine_similarity(
            weighted_pet.reshape(1, -1), weighted_product.reshape(1, -1)
        )[0, 0]

        # Apply threshold
        if similarity < self.threshold:
            return 0.0

        return float(similarity)

    def rank_products(
        self, pet_features: np.ndarray, product_features_list: list[np.ndarray]
    ) -> list[tuple[int, float]]:
        """
        Rank multiple products by similarity to pet.

        Args:
            pet_features: 15-dimensional pet feature vector
            product_features_list: List of product feature vectors

        Returns:
            List of (index, similarity_score) tuples, sorted by score descending
        """
        scores = []
        for i, product_features in enumerate(product_features_list):
            score = self.calculate_similarity(pet_features, product_features)
            if score > 0:  # Only include above threshold
                scores.append((i, score))

        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores
