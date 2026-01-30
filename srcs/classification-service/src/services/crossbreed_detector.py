from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class CrossbreedDetector:
    """Detect crossbreeds from breed probability distributions."""

    def __init__(self, config):
        """Initialize crossbreed detector with thresholds.

        Args:
            config: Settings instance with crossbreed detection thresholds
        """
        self.crossbreed_probability_threshold = config.CROSSBREED_PROBABILITY_THRESHOLD
        self.purebred_confidence_threshold = config.PUREBRED_CONFIDENCE_THRESHOLD
        self.purebred_gap_threshold = config.PUREBRED_GAP_THRESHOLD
        self.min_second_breed = config.CROSSBREED_MIN_SECOND_BREED

        logger.info(
            f"CrossbreedDetector initialized: "
            f"prob_threshold={self.crossbreed_probability_threshold}, "
            f"purebred_threshold={self.purebred_confidence_threshold}, "
            f"gap_threshold={self.purebred_gap_threshold}, "
            f"min_second_breed={self.min_second_breed}"
        )

    def process_breed_result(self, breed_probabilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process breed probabilities and detect crossbreeds.

        Args:
            breed_probabilities: List of {"breed": str, "probability": float}

        Returns:
            Dict with breed_analysis structure including crossbreed detection
        """
        # Sort by probability descending
        breed_probs_sorted = sorted(
            breed_probabilities,
            key=lambda x: x["probability"],
            reverse=True
        )

        # Handle empty list
        if not breed_probs_sorted:
            return {
                "primary_breed": "unknown",
                "confidence": 0.0,
                "is_likely_crossbreed": False,
                "breed_probabilities": [],
                "crossbreed_analysis": None
            }

        top_breed = breed_probs_sorted[0]
        second_breed = breed_probs_sorted[1] if len(breed_probs_sorted) > 1 else None

        # Crossbreed detection logic
        is_crossbreed = False
        crossbreed_analysis = None
        primary_breed = top_breed["breed"]
        confidence = top_breed["probability"]

        # Detect crossbreed based on probability distribution
        if second_breed:
            # Rule 1: Second breed has significant probability
            if second_breed["probability"] > self.crossbreed_probability_threshold:
                is_crossbreed = True

            # Rule 2: Low confidence in top breed + small gap to second
            if top_breed["probability"] < self.purebred_confidence_threshold:
                probability_gap = top_breed["probability"] - second_breed["probability"]
                if probability_gap < self.purebred_gap_threshold:
                    # Ensure second breed is substantial, not just noise
                    if second_breed["probability"] > self.min_second_breed:
                        is_crossbreed = True

        # Build crossbreed analysis if detected
        if is_crossbreed and second_breed:
            detected_breeds = [
                top_breed["breed"].replace("_", " ").title(),
                second_breed["breed"].replace("_", " ").title()
            ]

            # Identify common crossbreed name
            common_name = self.identify_common_name(detected_breeds)

            # Build reasoning
            reasoning_parts = []
            if second_breed["probability"] > self.crossbreed_probability_threshold:
                reasoning_parts.append(
                    f"Multiple breeds with high probabilities "
                    f"({top_breed['breed']}: {top_breed['probability']:.2f}, "
                    f"{second_breed['breed']}: {second_breed['probability']:.2f})"
                )
            if top_breed["probability"] < self.purebred_confidence_threshold:
                reasoning_parts.append(
                    f"Low top-breed confidence ({top_breed['probability']:.2f})"
                )

            reasoning = ". ".join(reasoning_parts) if reasoning_parts else "Multiple breed characteristics detected"

            crossbreed_analysis = {
                "detected_breeds": detected_breeds,
                "common_name": common_name,
                "confidence_reasoning": reasoning
            }

            # Update primary breed to crossbreed name
            if common_name:
                primary_breed = common_name.lower().replace(" ", "_")
            else:
                primary_breed = f"{detected_breeds[0].lower().replace(' ', '_')}_{detected_breeds[1].lower().replace(' ', '_')}_mix"

            # Recalculate confidence as average of top 2
            confidence = round((top_breed["probability"] + second_breed["probability"]) / 2, 2)

        # Build final result
        return {
            "primary_breed": primary_breed,
            "confidence": round(confidence, 2),
            "is_likely_crossbreed": is_crossbreed,
            "breed_probabilities": [
                {"breed": bp["breed"], "probability": round(bp["probability"], 2)}
                for bp in breed_probs_sorted
            ],
            "crossbreed_analysis": crossbreed_analysis
        }

    def identify_common_name(self, breeds: List[str]) -> Optional[str]:
        """Identify common crossbreed name from parent breeds.

        Args:
            breeds: List of parent breed names (e.g., ["Golden Retriever", "Poodle"])

        Returns:
            Common crossbreed name or None
        """
        # Normalize breed names
        breeds_normalized = sorted([b.lower() for b in breeds])

        # Common crossbreed mappings
        crossbreed_map = {
            ("golden retriever", "poodle"): "Goldendoodle",
            ("labrador retriever", "poodle"): "Labradoodle",
            ("pug", "beagle"): "Puggle",
            ("cocker spaniel", "poodle"): "Cockapoo",
            ("yorkshire terrier", "poodle"): "Yorkipoo",
            ("maltese", "poodle"): "Maltipoo",
            ("cavalier king charles spaniel", "poodle"): "Cavapoo",
            ("pomeranian", "husky"): "Pomsky",
            ("chihuahua", "dachshund"): "Chiweenie",
            ("chihuahua", "yorkshire terrier"): "Chorkie",
        }

        # Try exact match
        key = tuple(breeds_normalized)
        if key in crossbreed_map:
            return crossbreed_map[key]

        # Try reversed
        key_reversed = tuple(reversed(breeds_normalized))
        if key_reversed in crossbreed_map:
            return crossbreed_map[key_reversed]

        return None
