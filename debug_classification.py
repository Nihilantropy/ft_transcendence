#!/usr/bin/env python3
"""Debug classification results - show top 10 predictions with probabilities."""

import base64
import httpx
import sys
from pathlib import Path

def debug_classify(image_path: str):
    """Send image to classification service and show top 10 predictions."""

    # Read and encode image
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()

    # Call classification service directly
    response = httpx.post(
        "http://localhost:3004/classify",
        json={"image": image_b64},
        timeout=30.0
    )

    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return

    data = response.json()["data"]

    print(f"\n{'='*80}")
    print(f"📸 Image: {Path(image_path).name}")
    print(f"{'='*80}")

    # NSFW check
    nsfw = data.get("nsfw_classification", {})
    print(f"\n🔞 NSFW Check:")
    print(f"   Result: {nsfw.get('result')}")
    print(f"   NSFW Score: {nsfw.get('scores', {}).get('nsfw', 0):.1%}")
    print(f"   Normal Score: {nsfw.get('scores', {}).get('normal', 0):.1%}")

    # Species classification
    species = data.get("species_classification", {})
    print(f"\n🐾 Species Classification:")
    print(f"   Species: {species.get('species')}")
    print(f"   Confidence: {species.get('confidence', 0):.1%}")
    predictions = species.get("top_predictions", [])
    if predictions:
        print(f"\n   Top 5 Species:")
        for pred in predictions[:5]:
            print(f"      {pred['species']:20s} {pred['probability']:.1%}")

    # Breed classification
    breed = data.get("breed_classification", {})
    print(f"\n🐕 Breed Classification:")
    print(f"   Primary Breed: {breed.get('primary_breed')}")
    print(f"   Confidence: {breed.get('confidence', 0):.1%}")
    print(f"   Is Crossbreed: {breed.get('is_crossbreed')}")

    predictions = breed.get("top_predictions", [])
    if predictions:
        print(f"\n   Top 10 Breed Predictions:")
        for i, pred in enumerate(predictions[:10], 1):
            breed_name = pred['breed'].replace('_', ' ').title()
            prob = pred['probability']
            bar_length = int(prob * 50)  # Scale to 50 chars max
            bar = '█' * bar_length
            print(f"      {i:2d}. {breed_name:30s} {prob:6.1%} {bar}")

    # Crossbreed detection details
    if breed.get('is_crossbreed'):
        detected_breeds = breed.get('detected_breeds', [])
        print(f"\n   Crossbreed Detected Breeds: {', '.join(detected_breeds)}")

    print(f"\n{'='*80}\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 debug_classification.py <image_path>")
        sys.exit(1)

    for image_path in sys.argv[1:]:
        debug_classify(image_path)
