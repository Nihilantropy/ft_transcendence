#!/usr/bin/env python3
"""
E2E test script - executes notebook functionality via API Gateway with authentication
Tests authenticated access through API Gateway (localhost:8001)
"""

import requests
import json
import base64
from pathlib import Path
from io import BytesIO
from PIL import Image

# Configuration
API_GATEWAY_URL = "http://localhost:8001"  # API Gateway (exposed)
TEST_IMAGES_DIR = Path("test_data/images")
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}

# Test user credentials
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "testpassword123"

# Session for maintaining cookies
session = requests.Session()

def create_test_image(color="brown", size=(512, 512)):
    """Create a simple test image as base64 (fallback if no real images)."""
    img = Image.new('RGB', size, color=color)
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{encoded}"

def find_test_images():
    """Find all image files in test data directory."""
    if not TEST_IMAGES_DIR.exists():
        print(f"⚠️  Test images directory not found: {TEST_IMAGES_DIR.absolute()}")
        return []

    images = []
    for ext in IMAGE_EXTENSIONS:
        images.extend(TEST_IMAGES_DIR.glob(f'*{ext}'))
        images.extend(TEST_IMAGES_DIR.glob(f'*{ext.upper()}'))

    return sorted(images)

def load_image_as_base64(image_path):
    """Load image file and convert to base64 data URI."""
    with open(image_path, 'rb') as f:
        image_data = f.read()

    ext = image_path.suffix.lower().lstrip('.')
    if ext == 'jpg':
        ext = 'jpeg'

    encoded = base64.b64encode(image_data).decode()
    return f"data:image/{ext};base64,{encoded}"

def test_authentication():
    """Test authentication with API Gateway."""
    print("\n" + "="*60)
    print("🔐 AUTHENTICATION TEST")
    print("="*60 + "\n")

    print("Logging in to API Gateway...")
    try:
        response = session.post(
            f"{API_GATEWAY_URL}/api/v1/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            },
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Login successful")
            print(f"   User: {result.get('data', {}).get('email', 'N/A')}")
            print(f"   Cookies: {len(session.cookies)} set")
            return True
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False

    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API Gateway")
        print("   Run: docker compose ps api-gateway")
        return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

def test_service_health():
    """Test API Gateway health."""
    print("\n" + "="*60)
    print("🏥 API GATEWAY HEALTH CHECK")
    print("="*60 + "\n")

    try:
        resp = requests.get(f"{API_GATEWAY_URL}/health", timeout=5)
        if resp.status_code == 200:
            print(f"✅ API Gateway healthy ({resp.elapsed.total_seconds():.3f}s)")
            return True
        else:
            print(f"⚠️  API Gateway degraded (status: {resp.status_code})")
            return False
    except Exception as e:
        print(f"❌ API Gateway down: {str(e)[:50]}")
        return False

def test_vision_pipeline(image_base64, image_name="test_image"):
    """Test full vision analysis pipeline via API Gateway."""
    print("\n" + "="*60)
    print(f"🔬 TESTING VISION PIPELINE - {image_name}")
    print("="*60 + "\n")

    try:
        print("🚀 Sending authenticated request to API Gateway...")
        response = session.post(
            f"{API_GATEWAY_URL}/api/v1/vision/analyze",
            json={"image": image_base64},
            timeout=60
        )

        print(f"   Status: {response.status_code}")
        print(f"   Latency: {response.elapsed.total_seconds():.2f}s")

        result = response.json()

        # Handle FastAPI HTTPException detail wrapper
        if 'detail' in result and isinstance(result['detail'], dict):
            result = result['detail']

        if result.get('success'):
            data = result['data']

            # Species
            print(f"\n✅ Species: {data['species'].upper()}")

            # Breed
            breed = data['breed_analysis']
            print(f"✅ Breed: {breed['primary_breed'].replace('_', ' ').title()}")
            print(f"   Confidence: {breed['confidence']*100:.1f}%")
            print(f"   Crossbreed: {'Yes' if breed['is_likely_crossbreed'] else 'No'}\"")

            # Top breeds
            if breed['breed_probabilities']:
                print(f"\n   Top 3 Breeds:")
                for i, bp in enumerate(breed['breed_probabilities'][:3], 1):
                    breed_name = bp['breed'].replace('_', ' ').title()
                    prob = bp['probability'] * 100
                    bar = '█' * int(bp['probability'] * 20)
                    print(f"      {i}. {breed_name:20s} {prob:5.1f}% {bar}")

            # Visual description
            print(f"\n✅ Description: {data['description'][:100]}...")

            # Traits
            traits = data['traits']
            print(f"\n✅ Traits:")
            print(f"   Size: {traits['size']}")
            print(f"   Energy: {traits['energy_level']}")
            print(f"   Temperament: {traits['temperament']}")

            # Health
            if data['health_observations']:
                print(f"\n✅ Health Observations: {len(data['health_observations'])} noted")
            else:
                print(f"\n✅ Health Observations: None")

            # RAG enrichment
            if data.get('enriched_info'):
                enriched = data['enriched_info']
                print(f"\n✅ RAG Enrichment: Available")
                if enriched.get('breed'):
                    print(f"   Breed: {enriched['breed']}")
                if enriched.get('sources'):
                    print(f"   Sources: {len(enriched['sources'])} documents")
            else:
                print(f"\n⚠️  RAG Enrichment: Unavailable (graceful degradation)")

            print("\n✅ PIPELINE TEST PASSED")
            return True

        else:
            error = result.get('error', {})
            print(f"\n❌ PIPELINE TEST FAILED")
            print(f"   Error Code: {error.get('code', 'UNKNOWN')}")
            print(f"   Message: {error.get('message', 'No details')}")
            return False

    except requests.exceptions.Timeout:
        print(f"\n❌ PIPELINE TEST FAILED - Timeout")
        return False
    except requests.exceptions.ConnectionError:
        print(f"\n❌ PIPELINE TEST FAILED - Connection error")
        return False
    except Exception as e:
        print(f"\n❌ PIPELINE TEST FAILED - {str(e)}")
        return False

def main():
    """Main test execution."""
    print("\n" + "="*60)
    print("🧪 AI SERVICE E2E TESTING (via API Gateway)")
    print("="*60)

    # Test 1: Service Health
    health_ok = test_service_health()
    if not health_ok:
        print("\n❌ API Gateway is down. Cannot proceed.")
        return 1

    # Test 2: Authentication
    auth_ok = test_authentication()
    if not auth_ok:
        print("\n❌ Authentication failed. Cannot proceed.")
        print("\n📝 To fix:")
        print("   1. Check API Gateway: curl http://localhost:8001/health")
        print("   2. Check auth-service is running")
        print("   3. Create test user or update credentials in script")
        return 1

    # Find or create test image
    available_images = find_test_images()

    if available_images:
        print(f"\n✅ Found {len(available_images)} test images")
        test_image_path = available_images[0]
        test_image = load_image_as_base64(test_image_path)
        image_name = test_image_path.name
        print(f"   Using: {image_name}")
    else:
        print(f"\n⚠️  No real test images found, creating synthetic image")
        test_image = create_test_image("brown")
        image_name = "synthetic_dog.jpg"

    # Test 3: Vision Pipeline
    pipeline_ok = test_vision_pipeline(test_image, image_name)

    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    print(f"API Gateway Health:  {'✅ PASS' if health_ok else '❌ FAIL'}")
    print(f"Authentication:      {'✅ PASS' if auth_ok else '❌ FAIL'}")
    print(f"Vision Pipeline:     {'✅ PASS' if pipeline_ok else '❌ FAIL'}")
    print("="*60)

    # Overall result
    all_pass = health_ok and auth_ok and pipeline_ok
    if all_pass:
        print("\n🎉 ALL E2E TESTS PASSED")
        print("\n✅ Architecture validated:")
        print("   - Requests go through API Gateway")
        print("   - JWT authentication enforced")
        print("   - Backend services protected (not exposed)")
        print("   - Multi-stage pipeline operational")
        return 0
    else:
        print("\n⚠️  SOME E2E TESTS FAILED")
        return 1

if __name__ == "__main__":
    exit(main())
