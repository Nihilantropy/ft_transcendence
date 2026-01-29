import httpx
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class OllamaVisionClient:
    """Client for Ollama vision analysis using native HTTP API.
    
    Supports both simple breed detection and multi-breed/crossbreed detection.
    """

    def __init__(self, config):
        """Initialize Ollama client with configuration.

        Args:
            config: Settings instance with Ollama configuration
        """
        self.base_url = config.OLLAMA_BASE_URL
        self.model = config.OLLAMA_MODEL
        self.timeout = config.OLLAMA_TIMEOUT
        self.temperature = config.OLLAMA_TEMPERATURE
        self.low_confidence_threshold = config.LOW_CONFIDENCE_THRESHOLD
        
        # Crossbreed detection thresholds
        self.crossbreed_probability_threshold = 0.35
        self.purebred_confidence_threshold = 0.75
        self.purebred_gap_threshold = 0.30
        
        logger.info(f"Initialized Ollama client: {self.base_url}, model: {self.model}")

    async def analyze_breed(
        self,
        image_base64: str,
        detect_crossbreed: bool = True,
        top_n_breeds: int = 2
    ) -> Dict[str, Any]:
        """Analyze pet breed from base64 image.

        Args:
            image_base64: Base64-encoded image data URI
            detect_crossbreed: If True, return multi-breed probabilities and crossbreed detection
            top_n_breeds: Number of breed probabilities to return (only if detect_crossbreed=True)

        Returns:
            Dict with breed, confidence, traits, health_considerations
            If detect_crossbreed=True, includes breed_analysis with probabilities

        Raises:
            ValueError: If response cannot be parsed
            ConnectionError: If Ollama is unreachable
        """
        try:
            # Extract just the base64 part (remove data URI prefix)
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]

            # Build structured prompt
            if detect_crossbreed:
                prompt = self._build_crossbreed_prompt(top_n_breeds)
            else:
                prompt = self._build_analysis_prompt()

            logger.info(f"Sending image to Ollama for {'crossbreed' if detect_crossbreed else 'standard'} analysis")

            # Call Ollama HTTP API with explicit timeout
            timeout = httpx.Timeout(self.timeout, connect=self.timeout)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt,
                                "images": [image_base64]
                            }
                        ],
                        "stream": False,
                        "options": {
                            "temperature": self.temperature
                        }
                    }
                )

                response.raise_for_status()
                response_data = response.json()

            # Extract content from response
            content = response_data.get("message", {}).get("content", "")

            # Parse JSON response
            result = self._parse_response(content)

            # Process crossbreed detection if requested
            if detect_crossbreed:
                result = self._process_crossbreed_result(result)
            else:
                # Add note if low confidence
                if result["confidence"] < self.low_confidence_threshold:
                    result["note"] = "Low confidence - manual verification recommended"
                    logger.warning(f"Low confidence result: {result['confidence']}")
                else:
                    logger.info(f"Breed identified: {result['breed']} (confidence: {result['confidence']})")

            return result

        except httpx.HTTPError as e:
            logger.error(f"Ollama connection failed: {str(e)}")
            raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")
        except Exception as e:
            logger.error(f"Ollama analysis failed: {str(e)}")
            raise

    def _build_analysis_prompt(self) -> str:
        """Build structured prompt for breed analysis.

        Returns:
            Prompt string for Ollama
        """
        return """Analyze this pet image and identify the breed.
Return ONLY valid JSON in this exact format:
{
  "breed": "breed name or Unknown",
  "confidence": 0.0-1.0,
  "traits": {
    "size": "small/medium/large",
    "energy_level": "low/medium/high",
    "temperament": "brief description"
  },
  "health_considerations": ["condition1", "condition2"]
}"""

    def _build_crossbreed_prompt(self, top_n: int = 3) -> str:
        """Build enhanced prompt for crossbreed detection.

        Args:
            top_n: Number of breed probabilities to request

        Returns:
            Prompt string for Ollama
        """
        return f"""Analyze this pet image and identify the breed(s).

Consider if this is a PUREBRED or CROSS-BREED (mixed breed). Look for:
- Multiple breed characteristics present
- Coat texture/color not typical of single breed
- Body proportions blending multiple breeds
- Facial features from different breeds

Return ONLY valid JSON with the TOP {top_n} most likely breeds:

{{
  "breed_probabilities": [
    {{"breed": "breed_name", "probability": 0.0-1.0}},
    {{"breed": "breed_name", "probability": 0.0-1.0}}
  ],
  "traits": {{
    "size": "small/medium/large",
    "energy_level": "low/medium/high",
    "temperament": "brief description"
  }},
  "health_considerations": ["condition1", "condition2"]
}}

Probabilities should sum to approximately 1.0."""

    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse JSON from model response.

        Args:
            response_text: Raw response text from Ollama

        Returns:
            Parsed JSON dict

        Raises:
            RuntimeError: If JSON cannot be parsed (service error, not user input error)
        """
        try:
            # Try direct JSON parse
            return json.loads(response_text)
        except json.JSONDecodeError:
            # Extract JSON from markdown code blocks if present
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                if end > start:
                    json_str = response_text[start:end].strip()
                    return json.loads(json_str)

            logger.error(f"Failed to parse response: {response_text[:200]}")
            raise RuntimeError("Failed to parse JSON from response")

    def _process_crossbreed_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Process crossbreed detection result and add breed_analysis.

        Args:
            result: Parsed response with breed_probabilities

        Returns:
            Enhanced result with breed_analysis field
        """
        breed_probs = result.get("breed_probabilities", [])
        
        # Sort by probability descending
        breed_probs_sorted = sorted(breed_probs, key=lambda x: x["probability"], reverse=True)
        
        if not breed_probs_sorted:
            # Fallback if no probabilities
            return {
                "breed_analysis": {
                    "primary_breed": "Unknown",
                    "confidence": 0.0,
                    "is_likely_crossbreed": True,
                    "breed_probabilities": [],
                    "crossbreed_analysis": None
                },
                "traits": result.get("traits", {}),
                "health_considerations": result.get("health_considerations", [])
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
            # Multiple breeds with significant probabilities
            if second_breed["probability"] > self.crossbreed_probability_threshold:
                is_crossbreed = True
            
            # Low confidence in top breed + small gap to second
            if top_breed["probability"] < self.purebred_confidence_threshold:
                probability_gap = top_breed["probability"] - second_breed["probability"]
                if probability_gap < self.purebred_gap_threshold:
                    is_crossbreed = True
        
        # Build crossbreed analysis if detected
        if is_crossbreed and second_breed:
            detected_breeds = [
                top_breed["breed"].replace("_", " "),
                second_breed["breed"].replace("_", " ")
            ]
            
            # Attempt to identify common crossbreed name
            common_name = self._identify_crossbreed_name(detected_breeds)
            
            # Build reasoning
            reasoning_parts = []
            if second_breed["probability"] > self.crossbreed_probability_threshold:
                reasoning_parts.append(
                    f"Multiple breeds with high probabilities "
                    f"({top_breed['breed']}: {top_breed['probability']:.2f}, "
                    f"{second_breed['breed']}: {second_breed['probability']:.2f})"
                )
            if top_breed["probability"] < self.purebred_confidence_threshold:
                reasoning_parts.append(f"Low top-breed confidence ({top_breed['probability']:.2f})")
            
            reasoning = ". ".join(reasoning_parts) if reasoning_parts else "Multiple breed characteristics detected"
            
            crossbreed_analysis = {
                "detected_breeds": detected_breeds,
                "common_name": common_name,
                "confidence_reasoning": reasoning
            }
            
            # Update primary breed to crossbreed name if identified
            if common_name:
                primary_breed = common_name.lower().replace(" ", "_")
            else:
                primary_breed = f"{detected_breeds[0].lower().replace(' ', '_')}_{detected_breeds[1].lower().replace(' ', '_')}_mix"
            
            # Recalculate confidence as average of top 2
            confidence = (top_breed["probability"] + second_breed["probability"]) / 2
        
        # Build final result
        breed_analysis = {
            "primary_breed": primary_breed,
            "confidence": round(confidence, 2),
            "is_likely_crossbreed": is_crossbreed,
            "breed_probabilities": [
                {"breed": bp["breed"], "probability": round(bp["probability"], 2)}
                for bp in breed_probs_sorted
            ],
            "crossbreed_analysis": crossbreed_analysis
        }
        
        final_result = {
            "breed_analysis": breed_analysis,
            "traits": result.get("traits", {}),
            "health_considerations": result.get("health_considerations", [])
        }
        
        logger.info(
            f"Breed analysis: {breed_analysis['primary_breed']} "
            f"(crossbreed: {breed_analysis['is_likely_crossbreed']}, "
            f"confidence: {breed_analysis['confidence']:.2f})"
        )
        
        return final_result

    def _identify_crossbreed_name(self, breeds: List[str]) -> Optional[str]:
        """Identify common crossbreed name from parent breeds.

        Args:
            breeds: List of parent breed names (normalized)

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

    async def generate(self, prompt: str) -> str:
        """Generate text response from prompt (no image).

        Args:
            prompt: Text prompt for generation

        Returns:
            Generated text response

        Raises:
            ConnectionError: If Ollama is unreachable
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False,
                        "options": {"temperature": self.temperature}
                    }
                )
                response.raise_for_status()
                response_data = response.json()

            return response_data.get("message", {}).get("content", "")

        except httpx.HTTPError as e:
            logger.error(f"Ollama generation failed: {str(e)}")
            raise ConnectionError(f"Failed to connect to Ollama: {str(e)}")

    async def analyze_with_context(
        self,
        image_base64: str,
        species: str,
        breed_analysis: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze pet image with pre-classified context.

        Args:
            image_base64: Base64-encoded image (data URI or raw)
            species: Pre-classified species (dog/cat)
            breed_analysis: Complete breed classification result
            rag_context: RAG-enriched breed knowledge (can be None)

        Returns:
            Dict with visual description, traits, health observations

        Raises:
            ConnectionError: If Ollama unreachable
            RuntimeError: If response parsing fails
        """
        # Extract base64 part if data URI
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]

        # Build contextual prompt
        prompt = self._build_contextual_prompt(species, breed_analysis, rag_context)

        # Call Ollama HTTP API
        try:
            timeout = httpx.Timeout(self.timeout, connect=self.timeout)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt,
                                "images": [image_base64]
                            }
                        ],
                        "stream": False,
                        "options": {"temperature": self.temperature}
                    }
                )
                response.raise_for_status()
                response_data = response.json()

        except httpx.ConnectError as e:
            logger.error(f"Ollama connection failed: {e}")
            raise ConnectionError("Ollama service unavailable")
        except httpx.TimeoutException as e:
            logger.error(f"Ollama timeout: {e}")
            raise ConnectionError("Ollama service timeout")

        # Parse JSON response
        content = response_data.get("message", {}).get("content", "")
        result = self._parse_response(content)

        logger.info(f"Visual analysis complete for {breed_analysis['primary_breed']}")
        return result

    def _build_contextual_prompt(
        self,
        species: str,
        breed_analysis: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]]
    ) -> str:
        """Build focused prompt with classification context."""

        is_crossbreed = breed_analysis["is_likely_crossbreed"]
        confidence = breed_analysis["confidence"]

        # Build RAG context section
        if rag_context:
            if is_crossbreed:
                breed_name = (
                    breed_analysis.get("crossbreed_analysis", {}).get("common_name") or
                    f"{breed_analysis['crossbreed_analysis']['detected_breeds'][0]}-"
                    f"{breed_analysis['crossbreed_analysis']['detected_breeds'][1]} mix"
                )
                parent_breeds = breed_analysis["crossbreed_analysis"]["detected_breeds"]
                context_section = f"""BREED CONTEXT (from database):
Parent breeds: {', '.join(parent_breeds)}
Typical characteristics: {rag_context['description']}
Common health considerations: {rag_context['health_info']}"""
            else:
                breed_name = breed_analysis["primary_breed"].replace("_", " ").title()
                context_section = f"""BREED CONTEXT (from database):
{rag_context['description']}
Common health considerations: {rag_context['health_info']}"""
        else:
            breed_name = breed_analysis["primary_breed"].replace("_", " ").title()
            context_section = "BREED CONTEXT: (unavailable)"

        return f"""You are analyzing a {species} image that has been pre-classified as a {breed_name} (confidence: {confidence:.2f}).

{context_section}

YOUR TASK: Describe THIS SPECIFIC {species} based on what you SEE in the image:
- Physical appearance and condition (coat quality, body condition, visible features)
- Estimated age range based on visual cues
- Any notable characteristics or features specific to this individual
- Visible health indicators (if any)

Return ONLY valid JSON:
{{
  "description": "detailed visual description of this specific {species}",
  "traits": {{
    "size": "small/medium/large (based on visual proportions)",
    "energy_level": "low/medium/high (inferred from posture/expression)",
    "temperament": "brief description based on expression and body language"
  }},
  "health_observations": ["visible observation 1", "visible observation 2"]
}}

Focus on describing what you SEE, not general breed knowledge."""
