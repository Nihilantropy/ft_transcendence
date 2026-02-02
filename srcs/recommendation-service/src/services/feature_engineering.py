"""Feature engineering for pet-product matching."""
import numpy as np
from typing import Dict, List, Any
from src.models.product import Product


class PetFeatureExtractor:
    """Extract numerical features from pet profile data."""

    # Health condition mapping (index 4-10 in feature vector)
    HEALTH_CONDITIONS = [
        "sensitive_stomach",
        "weight_management",
        "joint_health",
        "skin_allergies",
        "dental_health",
        "kidney_health",
    ]

    def extract(self, pet_data: Dict[str, Any]) -> np.ndarray:
        """
        Extract 15-dimensional feature vector from pet profile.

        Feature vector structure:
        [0] Age compatibility (normalized 0-1)
        [1] Min weight compatibility (normalized)
        [2] Breed match score
        [3] Max weight compatibility (normalized)
        [4-10] Health conditions (7 binary flags: 6 conditions + 1 unused)
        [11-13] Nutritional needs (protein, fat, calories normalized)
        [14] Reserved (ingredient preferences)
        """
        features = np.zeros(15)

        # [0] Age (months) - normalize to 0-1 (assuming max 200 months = ~16 years)
        age_months = pet_data.get("age_months", 0)
        features[0] = min(age_months / 200.0, 1.0)

        # [1, 3] Weight (kg) - normalize to 0-1 (assuming max 100kg)
        weight_kg = pet_data.get("weight_kg", 0)
        normalized_weight = min(weight_kg / 100.0, 1.0)
        features[1] = normalized_weight
        features[3] = normalized_weight

        # [2] Breed match - normalized breed name similarity (0-1)
        # For now, just store presence (1.0 if breed specified)
        features[2] = 1.0 if pet_data.get("breed") else 0.5

        # [4-10] Health conditions (6 actual + 1 reserved)
        health_conditions = pet_data.get("health_conditions", [])
        for i, condition in enumerate(self.HEALTH_CONDITIONS):
            if condition in health_conditions:
                features[4 + i] = 1.0
        # features[10] reserved for future use

        # [11-13] Nutritional needs (normalized estimates based on age/weight)
        # These represent the pet's nutritional requirements
        # Older/larger dogs need higher protein, moderate fat
        if age_months > 84:  # Senior (7+ years)
            features[11] = 0.8  # Higher protein need
            features[12] = 0.6  # Moderate fat
            features[13] = 0.7  # Moderate calories
        elif age_months < 12:  # Puppy
            features[11] = 0.9  # Very high protein
            features[12] = 0.8  # High fat
            features[13] = 0.9  # High calories
        else:  # Adult
            features[11] = 0.7  # Moderate protein
            features[12] = 0.5  # Moderate fat
            features[13] = 0.6  # Moderate calories

        # [14] Reserved for ingredient preferences
        features[14] = 0.0

        return features


class ProductFeatureExtractor:
    """Extract numerical features from product data."""

    def extract(self, product: Product) -> np.ndarray:
        """
        Extract 15-dimensional feature vector from product.

        Feature vector structure matches pet features for similarity calculation.
        [0] Age suitability (normalized)
        [1] Min weight suitability (normalized)
        [2] Breed suitability
        [3] Max weight suitability (normalized)
        [4-10] Health condition targeting (7 flags)
        [11-13] Nutritional profile (protein, fat, calories normalized)
        [14] Ingredient features (grain-free, organic, etc.)
        """
        features = np.zeros(15)

        # [0] Age suitability - midpoint of age range normalized
        if product.min_age_months is not None and product.max_age_months is not None:
            avg_age = (product.min_age_months + product.max_age_months) / 2
            features[0] = min(avg_age / 200.0, 1.0)
        elif product.min_age_months is not None:
            features[0] = min(product.min_age_months / 200.0, 1.0)
        elif product.max_age_months is not None:
            features[0] = min(product.max_age_months / 200.0, 1.0)
        else:
            features[0] = 0.5  # All ages

        # [1, 3] Weight suitability - midpoint of weight range normalized
        if product.min_weight_kg is not None and product.max_weight_kg is not None:
            avg_weight = float(product.min_weight_kg + product.max_weight_kg) / 2
            normalized = min(avg_weight / 100.0, 1.0)
            features[1] = normalized
            features[3] = normalized
        elif product.min_weight_kg is not None:
            features[1] = min(float(product.min_weight_kg) / 100.0, 1.0)
            features[3] = features[1]
        elif product.max_weight_kg is not None:
            features[3] = min(float(product.max_weight_kg) / 100.0, 1.0)
            features[1] = features[3]
        else:
            features[1] = 0.5
            features[3] = 0.5

        # [2] Breed suitability - presence of breed targeting
        features[2] = 1.0 if product.suitable_breeds else 0.5

        # [4-10] Health condition flags
        features[4] = 1.0 if product.for_sensitive_stomach else 0.0
        features[5] = 1.0 if product.for_weight_management else 0.0
        features[6] = 1.0 if product.for_joint_health else 0.0
        features[7] = 1.0 if product.for_skin_allergies else 0.0
        features[8] = 1.0 if product.for_dental_health else 0.0
        features[9] = 1.0 if product.for_kidney_health else 0.0
        features[10] = 0.0  # Reserved

        # [11-13] Nutritional profile (normalized 0-1)
        if product.protein_percentage is not None:
            features[11] = float(product.protein_percentage) / 100.0
        if product.fat_percentage is not None:
            features[12] = float(product.fat_percentage) / 100.0
        if product.calories_per_100g is not None:
            # Normalize calories (typical range 300-450 kcal/100g)
            features[13] = min((product.calories_per_100g - 250) / 250.0, 1.0)

        # [14] Ingredient features (binary flags combined)
        ingredient_score = 0.0
        if product.grain_free:
            ingredient_score += 0.3
        if product.organic:
            ingredient_score += 0.3
        if product.hypoallergenic:
            ingredient_score += 0.4
        features[14] = min(ingredient_score, 1.0)

        return features
