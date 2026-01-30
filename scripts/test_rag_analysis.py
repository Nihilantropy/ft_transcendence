#!/usr/bin/env python3
"""Test RAG integration with vision pipeline using real images."""

import requests
import json
import base64
import sys
from pathlib import Path

# Configuration
API_GATEWAY_URL = "http://localhost:8001"
TEST_IMAGES_DIR = Path("scripts/jupyter/test_data/images")

# Test images to analyze
TEST_IMAGES = [
    "german_shepherd_golder_retriever_1.jpg",
    "golden_retriever_1.jpg"
]

# Test user credentials
TEST_USER_EMAIL = "rag_test@example.com"
TEST_USER_PASSWORD = "testpassword123"

session = requests.Session()


def register_and_login():
    """Register and login test user."""
    print("🔐 Authenticating...")

    # Try to register
    response = session.post(
        f"{API_GATEWAY_URL}/api/v1/auth/register",
        json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
        },
        timeout=10
    )

    if response.status_code == 409:
        # User exists, just login
        response = session.post(
            f"{API_GATEWAY_URL}/api/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
            },
            timeout=10
        )

    if response.status_code in [200, 201]:
        print(f"✅ Authenticated as {TEST_USER_EMAIL}\n")
        return True
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        print(f"   {response.text}")
        return False


def load_image_as_base64(image_path):
    """Load image file and convert to base64 data URI."""
    with open(image_path, 'rb') as f:
        image_data = f.read()

    ext = image_path.suffix.lower().lstrip('.')
    if ext == 'jpg':
        ext = 'jpeg'

    encoded = base64.b64encode(image_data).decode()
    return f"data:image/{ext};base64,{encoded}"


def analyze_image(image_path):
    """Send image to vision analysis endpoint."""
    print(f"📸 Analyzing: {image_path.name}")
    print(f"   Size: {image_path.stat().st_size / 1024:.1f} KB")

    test_image = load_image_as_base64(image_path)

    print(f"   🚀 Sending request...")
    response = session.post(
        f"{API_GATEWAY_URL}/api/v1/vision/analyze",
        json={"image": test_image},
        timeout=60
    )

    print(f"   ✅ Response: {response.status_code} ({response.elapsed.total_seconds():.2f}s)\n")

    return response.json()


def extract_rag_info(result):
    """Extract RAG-related information from response."""
    if not result.get('success'):
        return None

    data = result['data']
    enriched = data.get('enriched_info', {})

    crossbreed = data['breed_analysis'].get('crossbreed_analysis') or {}

    return {
        'species': data.get('species'),
        'primary_breed': data['breed_analysis']['primary_breed'],
        'confidence': data['breed_analysis']['confidence'],
        'is_crossbreed': data['breed_analysis']['is_likely_crossbreed'],
        'detected_breeds': crossbreed.get('detected_breeds', []),
        'rag_breed': enriched.get('breed'),
        'rag_parent_breeds': enriched.get('parent_breeds'),
        'rag_description': enriched.get('description', '')[:300] if enriched.get('description') else '',
        'rag_care': enriched.get('care_summary', '')[:200] if enriched.get('care_summary') else '',
        'rag_health': enriched.get('health_info', '')[:200] if enriched.get('health_info') else '',
        'rag_sources': enriched.get('sources', [])
    }


def cleanup():
    """Delete test user."""
    print("🧹 Cleaning up...")
    response = session.delete(f"{API_GATEWAY_URL}/api/v1/auth/delete")
    if response.status_code == 200:
        print("✅ Test user deleted\n")


def main():
    """Run RAG analysis tests."""
    print("="*80)
    print("RAG INTEGRATION TEST - Vision Pipeline Analysis")
    print("="*80 + "\n")

    # Authenticate
    if not register_and_login():
        return 1

    results = []

    # Analyze each test image
    for image_name in TEST_IMAGES:
        image_path = TEST_IMAGES_DIR / image_name

        if not image_path.exists():
            print(f"❌ Image not found: {image_path}")
            continue

        print("-" * 80)
        result = analyze_image(image_path)
        rag_info = extract_rag_info(result)

        if rag_info:
            results.append((image_name, rag_info))

            # Display RAG analysis
            print(f"📊 CLASSIFICATION RESULTS:")
            print(f"   Species: {rag_info['species']}")
            print(f"   Primary Breed: {rag_info['primary_breed'].replace('_', ' ').title()}")
            print(f"   Confidence: {rag_info['confidence']*100:.1f}%")
            print(f"   Crossbreed: {'Yes' if rag_info['is_crossbreed'] else 'No'}")

            if rag_info['detected_breeds']:
                print(f"   Detected Breeds: {', '.join(rag_info['detected_breeds'])}")

            print(f"\n📚 RAG ENRICHMENT:")
            print(f"   Breed: {rag_info['rag_breed']}")
            print(f"   Parent Breeds: {rag_info['rag_parent_breeds']}")
            print(f"   Sources: {', '.join(rag_info['rag_sources'])}")

            if rag_info['rag_description']:
                print(f"\n   Description Preview:")
                print(f"   {rag_info['rag_description'][:150]}...")

            if rag_info['rag_care']:
                print(f"\n   Care Preview:")
                print(f"   {rag_info['rag_care'][:150]}...")

            print()
        else:
            print(f"❌ Analysis failed for {image_name}\n")

    print("-" * 80)
    print("\n" + "="*80)
    print("RAG EFFECTIVENESS ANALYSIS")
    print("="*80 + "\n")

    for image_name, info in results:
        print(f"🖼️  {image_name}:")
        print(f"   Classification: {info['primary_breed'].replace('_', ' ').title()} ({info['confidence']*100:.1f}%)")

        # Check if RAG provided useful information
        has_description = bool(info['rag_description'].strip())
        has_care = bool(info['rag_care'].strip())
        has_health = bool(info['rag_health'].strip())
        has_sources = info['rag_sources'] and info['rag_sources'][0] != 'unknown'

        rag_status = "✅ WORKING" if (has_description and has_sources) else "⚠️  PARTIAL/DEGRADED"

        print(f"   RAG Status: {rag_status}")
        print(f"   - Description: {'✓' if has_description else '✗'}")
        print(f"   - Care Info: {'✓' if has_care else '✗'}")
        print(f"   - Health Info: {'✓' if has_health else '✗'}")
        print(f"   - Sources: {'✓' if has_sources else '✗ (unknown)'}")
        print()

    # Cleanup
    cleanup()

    print("="*80)
    print("✅ RAG Integration Test Complete")
    print("="*80)

    return 0


if __name__ == "__main__":
    sys.exit(main())
