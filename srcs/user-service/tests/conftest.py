import pytest
import uuid
from apps.profiles.models import UserProfile, Pet, PetAnalysis


@pytest.fixture(scope='session')
def django_db_setup(django_db_blocker):
    """
    Override pytest-django's default db setup to skip serialization.

    The user-service has django.contrib.auth in INSTALLED_APPS (required for DRF),
    but the auth_user table doesn't exist in user_schema (it's in auth_schema,
    managed by auth-service). This causes serialization to fail.

    Solution: Create test database without serialization.
    """
    from django.conf import settings
    from django.test.utils import setup_databases, teardown_databases

    # Force fresh test DB creation without serialization
    with django_db_blocker.unblock():
        db_cfg = setup_databases(
            verbosity=1,
            interactive=False,
            keepdb=False,  # Don't reuse - create fresh
            serialize=False,  # Skip serialization (key fix)
        )

    yield

    with django_db_blocker.unblock():
        try:
            teardown_databases(db_cfg, verbosity=1)
        except Exception:
            pass  # Ignore teardown errors


@pytest.fixture
def user_id():
    """UUID for test user (simulates auth-service user)"""
    return uuid.uuid4()


@pytest.fixture
def admin_user_id():
    """UUID for admin user"""
    return uuid.uuid4()


@pytest.fixture
def user_profile(db, user_id):
    """Create test user profile (db fixture enables database access)"""
    return UserProfile.objects.create(
        user_id=user_id,
        phone='+1234567890',
        address={'city': 'San Francisco', 'country': 'USA'},
        preferences={'theme': 'dark'}
    )


@pytest.fixture
def pet(db, user_id):
    """Create test pet (db fixture enables database access)"""
    return Pet.objects.create(
        user_id=user_id,
        name='Buddy',
        species='dog',
        breed='Golden Retriever',
        breed_confidence=0.95,
        age=24,
        weight=30.5
    )


@pytest.fixture
def pet_analysis(db, user_id, pet):
    """Create test pet analysis (db fixture enables database access)"""
    return PetAnalysis.objects.create(
        pet_id=pet.id,
        user_id=user_id,
        image_url='/media/test.jpg',
        breed_detected='Golden Retriever',
        confidence=0.95,
        traits={'size': 'large', 'energy': 'high'}
    )
