from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class VisionOrchestrator:
    """Orchestrates multi-stage vision analysis pipeline.

    Coordinates sequential execution:
    1. Content safety check (NSFW detection)
    2. Species detection (dog/cat validation)
    3. Breed classification (with crossbreed detection)
    4. RAG enrichment (graceful failure)
    5. Contextual Ollama analysis
    """

    def __init__(self, classification_client, ollama_client, rag_service, config):
        """Initialize orchestrator with service dependencies.

        Args:
            classification_client: ClassificationClient instance
            ollama_client: OllamaVisionClient instance
            rag_service: RAGService instance
            config: Settings instance with threshold configuration
        """
        self.classification = classification_client
        self.ollama = ollama_client
        self.rag = rag_service
        self.config = config

        logger.info(
            f"VisionOrchestrator initialized: "
            f"species_threshold={config.SPECIES_MIN_CONFIDENCE}, "
            f"breed_threshold={config.BREED_MIN_CONFIDENCE}"
        )

    async def analyze_image(self, image: str) -> Dict[str, Any]:
        """Execute full vision analysis pipeline with early rejection.

        Args:
            image: Base64-encoded image (with or without data URI prefix)

        Returns:
            Dict with species, breed_analysis, description, traits,
            health_observations, and enriched_info

        Raises:
            ValueError: If any validation stage fails (CONTENT_POLICY_VIOLATION,
                       UNSUPPORTED_SPECIES, SPECIES_DETECTION_FAILED,
                       BREED_DETECTION_FAILED)
            ConnectionError: If classification or Ollama service unavailable
        """
        logger.info("Starting vision analysis pipeline")

        # Stage 1: Content safety (strict)
        safety = await self.classification.check_content(image)
        if not safety["is_safe"]:
            logger.warning(f"Content policy violation: NSFW probability {safety['nsfw_probability']}")
            raise ValueError("CONTENT_POLICY_VIOLATION")

        logger.info("Content safety check passed")

        # Stage 2: Species detection (strict)
        species_result = await self.classification.detect_species(image)
        if species_result["species"] not in ["dog", "cat"]:
            logger.warning(f"Unsupported species: {species_result['species']}")
            raise ValueError("UNSUPPORTED_SPECIES")
        if species_result["confidence"] < self.config.SPECIES_MIN_CONFIDENCE:
            logger.warning(f"Low species confidence: {species_result['confidence']}")
            raise ValueError("SPECIES_DETECTION_FAILED")

        logger.info(f"Species detected: {species_result['species']} (confidence: {species_result['confidence']:.2f})")

        # Stage 3: Breed classification (strict)
        breed_result = await self.classification.detect_breed(
            image,
            species_result["species"],
            top_k=5
        )
        if breed_result["breed_analysis"]["confidence"] < self.config.BREED_MIN_CONFIDENCE:
            logger.warning(f"Low breed confidence: {breed_result['breed_analysis']['confidence']}")
            raise ValueError("BREED_DETECTION_FAILED")

        logger.info(
            f"Breed detected: {breed_result['breed_analysis']['primary_breed']} "
            f"(confidence: {breed_result['breed_analysis']['confidence']:.2f}, "
            f"crossbreed: {breed_result['breed_analysis']['is_likely_crossbreed']})"
        )

        # Stage 4: RAG enrichment (graceful failure)
        rag_context = None
        try:
            if breed_result["breed_analysis"]["is_likely_crossbreed"]:
                detected_breeds = breed_result["breed_analysis"]["crossbreed_analysis"]["detected_breeds"]
                logger.info(f"Retrieving crossbreed context for: {detected_breeds}")
                rag_context = await self.rag.get_crossbreed_context(detected_breeds)
            else:
                logger.info(f"Retrieving breed context for: {breed_result['breed_analysis']['primary_breed']}")
                rag_context = await self.rag.get_breed_context(
                    breed_result["breed_analysis"]["primary_breed"]
                )
            logger.info("RAG enrichment successful")
        except Exception as e:
            logger.warning(f"RAG enrichment failed (graceful degradation): {e}")
            rag_context = None

        # Stage 5: Contextual Ollama analysis
        logger.info("Starting Ollama visual analysis")
        ollama_result = await self.ollama.analyze_with_context(
            image_base64=image,
            species=species_result["species"],
            breed_analysis=breed_result["breed_analysis"],
            rag_context=rag_context
        )

        # Assemble final response
        result = {
            "species": species_result["species"],
            "breed_analysis": breed_result["breed_analysis"],
            "description": ollama_result["description"],
            "traits": ollama_result["traits"],
            "health_observations": ollama_result["health_observations"],
            "enriched_info": rag_context
        }

        logger.info("Vision analysis pipeline completed successfully")
        return result
