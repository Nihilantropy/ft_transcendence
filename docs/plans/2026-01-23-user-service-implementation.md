# User-Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build user-service microservice for user profile and pet management with full CRUD operations, following TDD methodology.

**Architecture:** Django REST Framework service mirroring auth-service structure. Three models (UserProfile, Pet, PetAnalysis) with UUID-based cross-schema foreign keys to auth-service. Receives X-User-ID/X-User-Role headers from API Gateway for authentication context.

**Tech Stack:** Django 6.0.1, Django REST Framework, PostgreSQL (user_schema), pytest-django, Docker

---

## Task 1: Project Setup

**Files:**
- Create: `srcs/user-service/manage.py`
- Create: `srcs/user-service/requirements.txt`
- Create: `srcs/user-service/pytest.ini`
- Create: `srcs/user-service/.env`
- Create: `srcs/user-service/Dockerfile`

**Step 1: Create directory structure**

```bash
cd srcs
mkdir -p user-service/config
mkdir -p user-service/apps/profiles/migrations
mkdir -p user-service/tests
touch user-service/manage.py
touch user-service/requirements.txt
touch user-service/pytest.ini
touch user-service/.env
touch user-service/Dockerfile
touch user-service/config/__init__.py
touch user-service/apps/__init__.py
touch user-service/apps/profiles/__init__.py
touch user-service/apps/profiles/migrations/__init__.py
touch user-service/tests/__init__.py
```

**Step 2: Write requirements.txt**

```txt
Django==6.0.1
djangorestframework==3.15.2
psycopg2-binary==2.9.9
python-decouple==3.8
django-cors-headers==4.3.1
pytest==8.3.4
pytest-django==4.9.0
```

**Step 3: Write pytest.ini**

```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = tests.py test_*.py *_tests.py
python_classes = Test*
python_functions = test_*
addopts = -v --strict-markers --tb=short
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
```

**Step 4: Write .env**

```bash
# Django
SECRET_KEY=django-insecure-dev-key-user-service-change-in-prod
DEBUG=True
ALLOWED_HOSTS=user-service,localhost

# Database (shared with auth-service)
DB_NAME=smartbreeds
DB_USER=smartbreeds_user
DB_PASSWORD=smartbreeds_password
DB_HOST=db
DB_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Step 5: Write manage.py**

```python
#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
```

**Step 6: Write Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements (baked into image)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 userservice && chown -R userservice:userservice /app
USER userservice

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD curl -f http://localhost:3002/api/v1/users/me/ || exit 1

EXPOSE 3002

CMD ["python", "manage.py", "runserver", "0.0.0.0:3002"]
```

**Step 7: Commit**

```bash
git add srcs/user-service/
git commit -m "chore(user-service): initialize project structure

- Add Django 6.0.1 with DRF
- Configure pytest-django
- Create Dockerfile matching auth-service pattern
- Set up .env with database config"
```

---

## Task 2: Django Configuration

**Files:**
- Create: `srcs/user-service/config/settings.py`
- Create: `srcs/user-service/config/urls.py`
- Create: `srcs/user-service/config/wsgi.py`
- Create: `srcs/user-service/config/asgi.py`

**Step 1: Write config/settings.py**

```python
"""
Django settings for user-service
"""
import os
from pathlib import Path
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

# Security Settings
SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-key-change-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='user-service,localhost', cast=Csv())

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'apps.profiles',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.profiles.middleware.UserContextMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='smartbreeds'),
        'USER': config('DB_USER', default='smartbreeds_user'),
        'PASSWORD': config('DB_PASSWORD', default='smartbreeds_password'),
        'HOST': config('DB_HOST', default='db'),
        'PORT': config('DB_PORT', default='5432'),
        'OPTIONS': {
            'options': '-c search_path=user_schema,public'
        },
        'ATOMIC_REQUESTS': False,
    }
}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
}

# CORS Settings
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:5173,http://localhost:3000', cast=Csv())
CORS_ALLOW_CREDENTIALS = True
```

**Step 2: Write config/urls.py**

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.profiles.urls')),
]
```

**Step 3: Write config/wsgi.py**

```python
"""
WSGI config for user-service project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
```

**Step 4: Write config/asgi.py**

```python
"""
ASGI config for user-service project.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_asgi_application()
```

**Step 5: Commit**

```bash
git add srcs/user-service/config/
git commit -m "feat(user-service): add Django configuration

- Configure PostgreSQL with user_schema search path
- Add REST framework and CORS settings
- Include UserContextMiddleware in middleware stack"
```

---

## Task 3: Utilities Module

**Files:**
- Create: `srcs/user-service/apps/profiles/utils.py`

**Step 1: Copy utils.py from auth-service (adapted for user-service)**

```python
from datetime import datetime
from rest_framework.response import Response


def success_response(data, status=200):
    """
    Create standardized success response.

    Args:
        data: Response data
        status: HTTP status code

    Returns:
        Response object with standardized format
    """
    return Response({
        'success': True,
        'data': data,
        'error': None,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, status=status)


def error_response(code, message, details=None, status=400):
    """
    Create standardized error response.

    Args:
        code: Error code (e.g., 'VALIDATION_ERROR')
        message: Human-readable error message
        details: Optional dict with error details
        status: HTTP status code

    Returns:
        Response object with standardized format
    """
    return Response({
        'success': False,
        'data': None,
        'error': {
            'code': code,
            'message': message,
            'details': details or {}
        },
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }, status=status)
```

**Step 2: Commit**

```bash
git add srcs/user-service/apps/profiles/utils.py
git commit -m "feat(user-service): add standardized response utilities

Copied from auth-service for consistent API responses across services"
```

---

## Task 4: Models - UserProfile

**Files:**
- Create: `srcs/user-service/apps/profiles/models.py`
- Create: `srcs/user-service/tests/test_models.py`

**Step 1: Write failing test for UserProfile**

```python
import pytest
import uuid
from apps.profiles.models import UserProfile


@pytest.mark.django_db
class TestUserProfileModel:
    def test_create_user_profile_with_user_id(self):
        """Test creating a user profile with user_id"""
        user_id = uuid.uuid4()
        profile = UserProfile.objects.create(user_id=user_id)

        assert profile.id is not None
        assert profile.user_id == user_id
        assert profile.phone == ''
        assert profile.address is None
        assert profile.preferences == {}
        assert profile.created_at is not None
        assert profile.updated_at is not None

    def test_user_profile_user_id_unique(self):
        """Test that user_id must be unique"""
        user_id = uuid.uuid4()
        UserProfile.objects.create(user_id=user_id)

        with pytest.raises(Exception):  # IntegrityError
            UserProfile.objects.create(user_id=user_id)

    def test_user_profile_with_all_fields(self):
        """Test creating profile with all fields"""
        user_id = uuid.uuid4()
        address = {'city': 'San Francisco', 'country': 'USA'}
        preferences = {'theme': 'dark', 'notifications': True}

        profile = UserProfile.objects.create(
            user_id=user_id,
            phone='+1234567890',
            address=address,
            preferences=preferences
        )

        assert profile.phone == '+1234567890'
        assert profile.address == address
        assert profile.preferences == preferences

    def test_user_profile_string_representation(self):
        """Test __str__ method"""
        user_id = uuid.uuid4()
        profile = UserProfile.objects.create(user_id=user_id)

        assert str(profile) == f"Profile for {user_id}"
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_models.py::TestUserProfileModel -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'apps.profiles.models'"

**Step 3: Write minimal UserProfile model**

```python
import uuid
from django.db import models


class UserProfile(models.Model):
    """Extended user profile data"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(unique=True, db_index=True)

    phone = models.CharField(max_length=20, blank=True)
    address = models.JSONField(null=True, blank=True)
    preferences = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_profiles'
        indexes = [
            models.Index(fields=['user_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Profile for {self.user_id}"
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_models.py::TestUserProfileModel -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add srcs/user-service/apps/profiles/models.py srcs/user-service/tests/test_models.py
git commit -m "feat(user-service): add UserProfile model with tests

- UUID primary key and user_id foreign key reference
- JSON fields for address and preferences
- Timestamps and indexes
- 4 passing tests"
```

---

## Task 5: Models - Pet

**Files:**
- Modify: `srcs/user-service/apps/profiles/models.py`
- Modify: `srcs/user-service/tests/test_models.py`

**Step 1: Write failing tests for Pet model**

Add to `tests/test_models.py`:

```python
from apps.profiles.models import Pet


@pytest.mark.django_db
class TestPetModel:
    def test_create_pet_with_required_fields(self):
        """Test creating pet with minimum required fields"""
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id,
            name='Buddy',
            species='dog'
        )

        assert pet.id is not None
        assert pet.user_id == user_id
        assert pet.name == 'Buddy'
        assert pet.species == 'dog'
        assert pet.breed == ''
        assert pet.breed_confidence is None
        assert pet.age is None
        assert pet.weight is None
        assert pet.health_conditions == []
        assert pet.image_url is None

    def test_create_pet_with_all_fields(self):
        """Test creating pet with all fields"""
        user_id = uuid.uuid4()
        health_conditions = ['hip dysplasia', 'allergies']

        pet = Pet.objects.create(
            user_id=user_id,
            name='Max',
            breed='Golden Retriever',
            breed_confidence=0.95,
            species='dog',
            age=24,
            weight=30.5,
            health_conditions=health_conditions,
            image_url='/media/pets/test.jpg'
        )

        assert pet.breed == 'Golden Retriever'
        assert pet.breed_confidence == 0.95
        assert pet.age == 24
        assert pet.weight == 30.5
        assert pet.health_conditions == health_conditions
        assert pet.image_url == '/media/pets/test.jpg'

    def test_pet_species_choices(self):
        """Test species field accepts valid choices"""
        user_id = uuid.uuid4()

        dog = Pet.objects.create(user_id=user_id, name='Dog', species='dog')
        cat = Pet.objects.create(user_id=user_id, name='Cat', species='cat')
        other = Pet.objects.create(user_id=user_id, name='Other', species='other')

        assert dog.species == 'dog'
        assert cat.species == 'cat'
        assert other.species == 'other'

    def test_pet_string_representation(self):
        """Test __str__ method"""
        user_id = uuid.uuid4()
        pet = Pet.objects.create(user_id=user_id, name='Buddy', species='dog')

        assert str(pet) == 'Buddy (dog)'
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_models.py::TestPetModel -v`

Expected: FAIL with "ImportError: cannot import name 'Pet'"

**Step 3: Add Pet model**

Add to `apps/profiles/models.py`:

```python
class Pet(models.Model):
    """Pet profile owned by a user"""

    SPECIES_CHOICES = [
        ('dog', 'Dog'),
        ('cat', 'Cat'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)

    name = models.CharField(max_length=100)
    breed = models.CharField(max_length=100, blank=True)
    breed_confidence = models.FloatField(null=True, blank=True)
    species = models.CharField(max_length=10, choices=SPECIES_CHOICES, default='dog')

    age = models.IntegerField(null=True, blank=True)
    weight = models.FloatField(null=True, blank=True)
    health_conditions = models.JSONField(default=list, blank=True)

    image_url = models.CharField(max_length=500, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pets'
        indexes = [
            models.Index(fields=['user_id', 'created_at']),
            models.Index(fields=['species']),
        ]

    def __str__(self):
        return f"{self.name} ({self.species})"
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_models.py::TestPetModel -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add srcs/user-service/apps/profiles/models.py srcs/user-service/tests/test_models.py
git commit -m "feat(user-service): add Pet model with tests

- Pet profile with name, breed, species, age, weight
- JSON field for health conditions
- Species choices validation
- 4 passing tests"
```

---

## Task 6: Models - PetAnalysis

**Files:**
- Modify: `srcs/user-service/apps/profiles/models.py`
- Modify: `srcs/user-service/tests/test_models.py`

**Step 1: Write failing tests for PetAnalysis model**

Add to `tests/test_models.py`:

```python
from apps.profiles.models import PetAnalysis


@pytest.mark.django_db
class TestPetAnalysisModel:
    def test_create_pet_analysis(self):
        """Test creating pet analysis record"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()
        traits = {'size': 'large', 'energy': 'high'}

        analysis = PetAnalysis.objects.create(
            pet_id=pet_id,
            user_id=user_id,
            image_url='/media/analysis/test.jpg',
            breed_detected='Golden Retriever',
            confidence=0.95,
            traits=traits
        )

        assert analysis.id is not None
        assert analysis.pet_id == pet_id
        assert analysis.user_id == user_id
        assert analysis.image_url == '/media/analysis/test.jpg'
        assert analysis.breed_detected == 'Golden Retriever'
        assert analysis.confidence == 0.95
        assert analysis.traits == traits
        assert analysis.raw_response is None
        assert analysis.created_at is not None

    def test_pet_analysis_with_raw_response(self):
        """Test analysis with full AI response"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()
        raw_response = {'model': 'qwen3-vl', 'full_output': '...'}

        analysis = PetAnalysis.objects.create(
            pet_id=pet_id,
            user_id=user_id,
            image_url='/media/test.jpg',
            breed_detected='Labrador',
            confidence=0.88,
            traits={},
            raw_response=raw_response
        )

        assert analysis.raw_response == raw_response

    def test_pet_analysis_ordering(self):
        """Test that analyses are ordered by created_at descending"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()

        analysis1 = PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id, image_url='1.jpg',
            breed_detected='Breed1', confidence=0.9, traits={}
        )
        analysis2 = PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id, image_url='2.jpg',
            breed_detected='Breed2', confidence=0.8, traits={}
        )

        analyses = list(PetAnalysis.objects.all())
        assert analyses[0].id == analysis2.id  # Most recent first
        assert analyses[1].id == analysis1.id

    def test_pet_analysis_string_representation(self):
        """Test __str__ method"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()

        analysis = PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id, image_url='test.jpg',
            breed_detected='Beagle', confidence=0.92, traits={}
        )

        assert 'Beagle' in str(analysis)
        assert '0.92' in str(analysis)
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_models.py::TestPetAnalysisModel -v`

Expected: FAIL with "ImportError: cannot import name 'PetAnalysis'"

**Step 3: Add PetAnalysis model**

Add to `apps/profiles/models.py`:

```python
class PetAnalysis(models.Model):
    """History of breed identification analyses"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pet_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField(db_index=True)

    image_url = models.CharField(max_length=500)
    breed_detected = models.CharField(max_length=100)
    confidence = models.FloatField()
    traits = models.JSONField(default=dict)

    raw_response = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pet_analyses'
        indexes = [
            models.Index(fields=['pet_id', 'created_at']),
            models.Index(fields=['user_id', 'created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Analysis: {self.breed_detected} ({self.confidence:.2f})"
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_models.py::TestPetAnalysisModel -v`

Expected: PASS (4 tests)

**Step 5: Run all model tests**

Run: `cd srcs/user-service && python -m pytest tests/test_models.py -v`

Expected: PASS (12 tests total)

**Step 6: Commit**

```bash
git add srcs/user-service/apps/profiles/models.py srcs/user-service/tests/test_models.py
git commit -m "feat(user-service): add PetAnalysis model with tests

- Analysis history with breed, confidence, traits
- JSON fields for traits and raw AI response
- Ordered by created_at descending
- 12 total model tests passing"
```

---

## Task 7: Apps Configuration

**Files:**
- Create: `srcs/user-service/apps/profiles/apps.py`

**Step 1: Create apps.py**

```python
from django.apps import AppConfig


class ProfilesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.profiles'
```

**Step 2: Update apps/profiles/__init__.py**

```python
default_app_config = 'apps.profiles.apps.ProfilesConfig'
```

**Step 3: Commit**

```bash
git add srcs/user-service/apps/profiles/apps.py srcs/user-service/apps/profiles/__init__.py
git commit -m "chore(user-service): configure profiles app"
```

---

## Task 8: Middleware

**Files:**
- Create: `srcs/user-service/apps/profiles/middleware.py`
- Create: `srcs/user-service/tests/test_middleware.py`

**Step 1: Write failing test for UserContextMiddleware**

```python
import pytest
from django.test import RequestFactory
from apps.profiles.middleware import UserContextMiddleware


class TestUserContextMiddleware:
    def test_middleware_extracts_user_id_header(self):
        """Test middleware extracts X-User-ID header"""
        factory = RequestFactory()
        request = factory.get('/', HTTP_X_USER_ID='12345')

        middleware = UserContextMiddleware(lambda r: None)
        middleware(request)

        assert hasattr(request, 'user_id')
        assert request.user_id == '12345'

    def test_middleware_extracts_user_role_header(self):
        """Test middleware extracts X-User-Role header"""
        factory = RequestFactory()
        request = factory.get('/', HTTP_X_USER_ROLE='admin')

        middleware = UserContextMiddleware(lambda r: None)
        middleware(request)

        assert hasattr(request, 'user_role')
        assert request.user_role == 'admin'

    def test_middleware_defaults_user_role_to_user(self):
        """Test middleware defaults to 'user' role"""
        factory = RequestFactory()
        request = factory.get('/')

        middleware = UserContextMiddleware(lambda r: None)
        middleware(request)

        assert request.user_role == 'user'

    def test_middleware_handles_missing_user_id(self):
        """Test middleware handles missing X-User-ID"""
        factory = RequestFactory()
        request = factory.get('/')

        middleware = UserContextMiddleware(lambda r: None)
        middleware(request)

        assert request.user_id is None
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_middleware.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'apps.profiles.middleware'"

**Step 3: Write middleware**

```python
class UserContextMiddleware:
    """
    Extract X-User-ID and X-User-Role headers from API Gateway.
    Attach to request object for use in views/permissions.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extract headers set by API Gateway
        request.user_id = request.headers.get('X-User-ID')
        request.user_role = request.headers.get('X-User-Role', 'user')

        response = self.get_response(request)
        return response
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_middleware.py -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add srcs/user-service/apps/profiles/middleware.py srcs/user-service/tests/test_middleware.py
git commit -m "feat(user-service): add UserContextMiddleware with tests

Extracts X-User-ID and X-User-Role from API Gateway headers
4 passing tests"
```

---

## Task 9: Permissions

**Files:**
- Create: `srcs/user-service/apps/profiles/permissions.py`
- Create: `srcs/user-service/tests/test_permissions.py`

**Step 1: Write failing tests for permissions**

```python
import pytest
import uuid
from unittest.mock import Mock
from apps.profiles.permissions import IsOwnerOrAdmin, IsOwner
from apps.profiles.models import Pet


class TestIsOwnerOrAdmin:
    def test_admin_has_permission(self):
        """Test admin role has permission"""
        request = Mock()
        request.user_role = 'admin'
        request.user_id = str(uuid.uuid4())

        obj = Mock()
        obj.user_id = uuid.uuid4()

        permission = IsOwnerOrAdmin()
        assert permission.has_object_permission(request, None, obj) is True

    def test_owner_has_permission(self):
        """Test owner has permission to their own resource"""
        user_id = uuid.uuid4()
        request = Mock()
        request.user_role = 'user'
        request.user_id = str(user_id)

        obj = Mock()
        obj.user_id = user_id

        permission = IsOwnerOrAdmin()
        assert permission.has_object_permission(request, None, obj) is True

    def test_other_user_denied_permission(self):
        """Test non-owner user denied permission"""
        request = Mock()
        request.user_role = 'user'
        request.user_id = str(uuid.uuid4())

        obj = Mock()
        obj.user_id = uuid.uuid4()

        permission = IsOwnerOrAdmin()
        assert permission.has_object_permission(request, None, obj) is False


class TestIsOwner:
    def test_owner_has_permission(self):
        """Test owner has permission"""
        user_id = uuid.uuid4()
        request = Mock()
        request.user_id = str(user_id)

        obj = Mock()
        obj.user_id = user_id

        permission = IsOwner()
        assert permission.has_object_permission(request, None, obj) is True

    def test_non_owner_denied_permission(self):
        """Test non-owner denied even if admin"""
        request = Mock()
        request.user_role = 'admin'
        request.user_id = str(uuid.uuid4())

        obj = Mock()
        obj.user_id = uuid.uuid4()

        permission = IsOwner()
        assert permission.has_object_permission(request, None, obj) is False
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_permissions.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'apps.profiles.permissions'"

**Step 3: Write permissions**

```python
from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission: User can access their own resources, or admin can access all.
    Expects request.user_id and request.user_role set by middleware.
    """

    def has_object_permission(self, request, view, obj):
        # Admin can access everything
        if getattr(request, 'user_role', None) == 'admin':
            return True

        # Owner can access their own resources
        user_id = getattr(request, 'user_id', None)
        return str(obj.user_id) == str(user_id)


class IsOwner(permissions.BasePermission):
    """
    Permission: User can only access their own resources (no admin override).
    """

    def has_object_permission(self, request, view, obj):
        user_id = getattr(request, 'user_id', None)
        return str(obj.user_id) == str(user_id)
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_permissions.py -v`

Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add srcs/user-service/apps/profiles/permissions.py srcs/user-service/tests/test_permissions.py
git commit -m "feat(user-service): add permission classes with tests

- IsOwnerOrAdmin: owner or admin access
- IsOwner: strict owner-only access
- 5 passing tests"
```

## Task 10: Serializers - UserProfile

**Files:**
- Create: `srcs/user-service/apps/profiles/serializers.py`
- Create: `srcs/user-service/tests/test_serializers.py`

**Step 1: Write failing tests for UserProfileSerializer**

```python
import pytest
from apps.profiles.serializers import UserProfileSerializer, UserProfileUpdateSerializer
from apps.profiles.models import UserProfile
import uuid


@pytest.mark.django_db
class TestUserProfileSerializer:
    def test_serialize_user_profile(self):
        """Test serializing user profile"""
        user_id = uuid.uuid4()
        profile = UserProfile.objects.create(
            user_id=user_id,
            phone='+1234567890',
            address={'city': 'SF'},
            preferences={'theme': 'dark'}
        )

        serializer = UserProfileSerializer(profile)
        data = serializer.data

        assert str(data['user_id']) == str(user_id)
        assert data['phone'] == '+1234567890'
        assert data['address'] == {'city': 'SF'}
        assert data['preferences'] == {'theme': 'dark'}

    def test_user_profile_update_serializer_excludes_user_id(self):
        """Test update serializer does not include user_id"""
        serializer = UserProfileUpdateSerializer()
        assert 'user_id' not in serializer.fields

    def test_validate_phone_format(self):
        """Test phone validation"""
        serializer = UserProfileUpdateSerializer(data={'phone': 'invalid-phone'})
        assert not serializer.is_valid()
        assert 'phone' in serializer.errors

    def test_validate_address_structure(self):
        """Test address structure validation"""
        invalid_address = {'invalid_key': 'value'}
        serializer = UserProfileUpdateSerializer(data={'address': invalid_address})
        assert not serializer.is_valid()
        assert 'address' in serializer.errors
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_serializers.py::TestUserProfileSerializer -v`

Expected: FAIL

**Step 3: Write UserProfile serializers**

```python
from rest_framework import serializers
from apps.profiles.models import UserProfile, Pet, PetAnalysis


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile data"""

    class Meta:
        model = UserProfile
        fields = [
            'id', 'user_id', 'phone', 'address',
            'preferences', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at']

    def validate_phone(self, value):
        """Basic phone validation"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("Invalid phone number format")
        return value

    def validate_address(self, value):
        """Validate address structure if provided"""
        if value:
            allowed_keys = {'street', 'city', 'state', 'zip', 'country'}
            if not set(value.keys()).issubset(allowed_keys):
                raise serializers.ValidationError("Invalid address fields")
        return value


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating profile (excludes user_id)"""

    class Meta:
        model = UserProfile
        fields = ['phone', 'address', 'preferences']

    def validate_phone(self, value):
        """Basic phone validation"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("Invalid phone number format")
        return value

    def validate_address(self, value):
        """Validate address structure if provided"""
        if value:
            allowed_keys = {'street', 'city', 'state', 'zip', 'country'}
            if not set(value.keys()).issubset(allowed_keys):
                raise serializers.ValidationError("Invalid address fields")
        return value
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_serializers.py::TestUserProfileSerializer -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add srcs/user-service/apps/profiles/serializers.py srcs/user-service/tests/test_serializers.py
git commit -m "feat(user-service): add UserProfile serializers with tests

- UserProfileSerializer for read operations
- UserProfileUpdateSerializer for updates
- Phone and address validation
- 4 passing tests"
```

---

## Task 11: Serializers - Pet

**Files:**
- Modify: `srcs/user-service/apps/profiles/serializers.py`
- Modify: `srcs/user-service/tests/test_serializers.py`

**Step 1: Write failing tests**

Add to `tests/test_serializers.py`:

```python
from apps.profiles.serializers import PetSerializer, PetCreateSerializer


@pytest.mark.django_db
class TestPetSerializer:
    def test_serialize_pet(self):
        """Test serializing pet"""
        user_id = uuid.uuid4()
        pet = Pet.objects.create(
            user_id=user_id,
            name='Buddy',
            species='dog',
            breed='Golden Retriever',
            age=24,
            weight=30.5
        )

        serializer = PetSerializer(pet)
        data = serializer.data

        assert data['name'] == 'Buddy'
        assert data['species'] == 'dog'
        assert data['breed'] == 'Golden Retriever'
        assert data['age'] == 24
        assert data['weight'] == 30.5

    def test_validate_age_positive(self):
        """Test age must be positive"""
        serializer = PetSerializer(data={'name': 'Test', 'species': 'dog', 'age': -5})
        assert not serializer.is_valid()
        assert 'age' in serializer.errors

    def test_validate_weight_positive(self):
        """Test weight must be positive"""
        serializer = PetSerializer(data={'name': 'Test', 'species': 'dog', 'weight': -10})
        assert not serializer.is_valid()
        assert 'weight' in serializer.errors

    def test_validate_breed_confidence_range(self):
        """Test confidence must be 0-1"""
        serializer = PetSerializer(data={'name': 'Test', 'species': 'dog', 'breed_confidence': 1.5})
        assert not serializer.is_valid()
        assert 'breed_confidence' in serializer.errors

    def test_pet_create_serializer_minimal_fields(self):
        """Test PetCreateSerializer with minimal fields"""
        data = {'name': 'Buddy', 'species': 'dog'}
        serializer = PetCreateSerializer(data=data)
        assert serializer.is_valid()
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_serializers.py::TestPetSerializer -v`

Expected: FAIL

**Step 3: Add Pet serializers**

Add to `apps/profiles/serializers.py`:

```python
class PetSerializer(serializers.ModelSerializer):
    """Serializer for pet profile"""

    class Meta:
        model = Pet
        fields = [
            'id', 'user_id', 'name', 'breed', 'breed_confidence',
            'species', 'age', 'weight', 'health_conditions',
            'image_url', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at']

    def validate_age(self, value):
        """Age must be positive if provided"""
        if value is not None and value < 0:
            raise serializers.ValidationError("Age cannot be negative")
        return value

    def validate_weight(self, value):
        """Weight must be positive if provided"""
        if value is not None and value <= 0:
            raise serializers.ValidationError("Weight must be positive")
        return value

    def validate_breed_confidence(self, value):
        """Confidence must be between 0 and 1"""
        if value is not None and not (0 <= value <= 1):
            raise serializers.ValidationError("Confidence must be between 0 and 1")
        return value


class PetCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating pets (minimal required fields)"""

    class Meta:
        model = Pet
        fields = ['name', 'species']
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_serializers.py::TestPetSerializer -v`

Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add srcs/user-service/apps/profiles/serializers.py srcs/user-service/tests/test_serializers.py
git commit -m "feat(user-service): add Pet serializers with tests

- PetSerializer with field validation
- PetCreateSerializer for minimal creation
- Validation for age, weight, confidence
- 5 passing tests"
```

---

## Task 12: Serializers - PetAnalysis

**Files:**
- Modify: `srcs/user-service/apps/profiles/serializers.py`
- Modify: `srcs/user-service/tests/test_serializers.py`

**Step 1: Write failing tests**

Add to `tests/test_serializers.py`:

```python
from apps.profiles.serializers import PetAnalysisSerializer, PetAnalysisCreateSerializer


@pytest.mark.django_db
class TestPetAnalysisSerializer:
    def test_serialize_pet_analysis(self):
        """Test serializing pet analysis"""
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()
        analysis = PetAnalysis.objects.create(
            pet_id=pet_id,
            user_id=user_id,
            image_url='/media/test.jpg',
            breed_detected='Labrador',
            confidence=0.88,
            traits={'size': 'large'}
        )

        serializer = PetAnalysisSerializer(analysis)
        data = serializer.data

        assert data['breed_detected'] == 'Labrador'
        assert data['confidence'] == 0.88
        assert data['traits'] == {'size': 'large'}

    def test_pet_analysis_create_serializer(self):
        """Test PetAnalysisCreateSerializer"""
        data = {
            'pet_id': str(uuid.uuid4()),
            'user_id': str(uuid.uuid4()),
            'image_url': '/media/test.jpg',
            'breed_detected': 'Beagle',
            'confidence': 0.92,
            'traits': {}
        }
        serializer = PetAnalysisCreateSerializer(data=data)
        assert serializer.is_valid()
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_serializers.py::TestPetAnalysisSerializer -v`

Expected: FAIL

**Step 3: Add PetAnalysis serializers**

Add to `apps/profiles/serializers.py`:

```python
class PetAnalysisSerializer(serializers.ModelSerializer):
    """Serializer for pet analysis history"""

    class Meta:
        model = PetAnalysis
        fields = [
            'id', 'pet_id', 'user_id', 'image_url',
            'breed_detected', 'confidence', 'traits',
            'raw_response', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class PetAnalysisCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating analysis records (from AI service results)"""

    class Meta:
        model = PetAnalysis
        fields = ['pet_id', 'user_id', 'image_url', 'breed_detected',
                  'confidence', 'traits', 'raw_response']
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_serializers.py::TestPetAnalysisSerializer -v`

Expected: PASS (2 tests)

**Step 5: Run all serializer tests**

Run: `cd srcs/user-service && python -m pytest tests/test_serializers.py -v`

Expected: PASS (11 tests total)

**Step 6: Commit**

```bash
git add srcs/user-service/apps/profiles/serializers.py srcs/user-service/tests/test_serializers.py
git commit -m "feat(user-service): add PetAnalysis serializers with tests

- PetAnalysisSerializer for read operations
- PetAnalysisCreateSerializer for AI service integration
- 11 total serializer tests passing"
```

---

## Task 13: URL Configuration

**Files:**
- Create: `srcs/user-service/apps/profiles/urls.py`

**Step 1: Create URL configuration with DRF router**

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.profiles import views

router = DefaultRouter()
router.register(r'users', views.UserProfileViewSet, basename='user-profile')
router.register(r'pets', views.PetViewSet, basename='pet')
router.register(r'analyses', views.PetAnalysisViewSet, basename='pet-analysis')

urlpatterns = [
    path('', include(router.urls)),
]
```

**Step 2: Commit**

```bash
git add srcs/user-service/apps/profiles/urls.py
git commit -m "feat(user-service): configure URL routing with DRF router

Routes for UserProfile, Pet, and PetAnalysis viewsets"
```

---

## Task 14: Views - Stub ViewSets

**Files:**
- Create: `srcs/user-service/apps/profiles/views.py`

**Step 1: Create stub viewsets (minimal to unblock URL config)**

```python
from rest_framework import viewsets
from apps.profiles.models import UserProfile, Pet, PetAnalysis
from apps.profiles.serializers import (
    UserProfileSerializer, PetSerializer, PetAnalysisSerializer
)


class UserProfileViewSet(viewsets.ModelViewSet):
    """ViewSet for user profiles"""
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer


class PetViewSet(viewsets.ModelViewSet):
    """ViewSet for pet management"""
    queryset = Pet.objects.all()
    serializer_class = PetSerializer


class PetAnalysisViewSet(viewsets.ModelViewSet):
    """ViewSet for pet analysis history"""
    queryset = PetAnalysis.objects.all()
    serializer_class = PetAnalysisSerializer
```

**Step 2: Commit**

```bash
git add srcs/user-service/apps/profiles/views.py
git commit -m "feat(user-service): add stub viewsets

Minimal viewsets to unblock URL configuration
Will be enhanced with permissions and custom actions next"
```

---

## Task 15: Admin Configuration

**Files:**
- Create: `srcs/user-service/apps/profiles/admin.py`

**Step 1: Configure Django admin**

```python
from django.contrib import admin
from apps.profiles.models import UserProfile, Pet, PetAnalysis


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_id', 'phone', 'created_at']
    search_fields = ['user_id', 'phone']
    readonly_fields = ['id', 'created_at', 'updated_at']
    list_filter = ['created_at']


@admin.register(Pet)
class PetAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'species', 'breed', 'user_id', 'created_at']
    search_fields = ['name', 'breed', 'user_id']
    list_filter = ['species', 'created_at']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(PetAnalysis)
class PetAnalysisAdmin(admin.ModelAdmin):
    list_display = ['id', 'pet_id', 'breed_detected', 'confidence', 'created_at']
    search_fields = ['pet_id', 'user_id', 'breed_detected']
    list_filter = ['created_at']
    readonly_fields = ['id', 'created_at']
```

**Step 2: Commit**

```bash
git add srcs/user-service/apps/profiles/admin.py
git commit -m "feat(user-service): configure Django admin

Admin interfaces for UserProfile, Pet, and PetAnalysis models"
```

---

## Task 16: Test Fixtures

**Files:**
- Create: `srcs/user-service/tests/conftest.py`

**Step 1: Create pytest fixtures**

```python
import pytest
import uuid
from apps.profiles.models import UserProfile, Pet, PetAnalysis


@pytest.fixture
def user_id():
    """UUID for test user (simulates auth-service user)"""
    return uuid.uuid4()


@pytest.fixture
def admin_user_id():
    """UUID for admin user"""
    return uuid.uuid4()


@pytest.fixture
@pytest.mark.django_db
def user_profile(user_id):
    """Create test user profile"""
    return UserProfile.objects.create(
        user_id=user_id,
        phone='+1234567890',
        address={'city': 'San Francisco', 'country': 'USA'},
        preferences={'theme': 'dark'}
    )


@pytest.fixture
@pytest.mark.django_db
def pet(user_id):
    """Create test pet"""
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
@pytest.mark.django_db
def pet_analysis(user_id, pet):
    """Create test pet analysis"""
    return PetAnalysis.objects.create(
        pet_id=pet.id,
        user_id=user_id,
        image_url='/media/test.jpg',
        breed_detected='Golden Retriever',
        confidence=0.95,
        traits={'size': 'large', 'energy': 'high'}
    )
```

**Step 2: Commit**

```bash
git add srcs/user-service/tests/conftest.py
git commit -m "test(user-service): add pytest fixtures

Reusable fixtures for user_id, user_profile, pet, pet_analysis"
```

---

## Checkpoint: Phase 1 Complete

**Status:** Basic structure implemented with TDD

**Test Count:** ~32 tests passing
- Models: 12 tests
- Middleware: 4 tests  
- Permissions: 5 tests
- Serializers: 11 tests

**Next Phase:** Enhanced ViewSets, View tests, Migrations, Docker integration

---

## Task 17: Enhanced ViewSets - UserProfileViewSet

**Files:**
- Modify: `srcs/user-service/apps/profiles/views.py`
- Create: `srcs/user-service/tests/test_views.py`

**Step 1: Write failing tests for /users/me endpoint**

```python
import pytest
from django.test import RequestFactory
from apps.profiles.views import UserProfileViewSet
from apps.profiles.models import UserProfile
import uuid
import json


@pytest.mark.django_db
class TestUserProfileViewSet:
    def test_get_me_creates_profile_if_not_exists(self):
        """Test GET /users/me auto-creates profile"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        request = factory.get('/api/v1/users/me/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'get': 'me'})
        response = view(request)

        assert response.status_code == 200
        assert response.data['success'] is True
        assert UserProfile.objects.filter(user_id=user_id).exists()

    def test_get_me_returns_existing_profile(self):
        """Test GET /users/me returns existing profile"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        profile = UserProfile.objects.create(
            user_id=user_id,
            phone='+1234567890'
        )
        
        request = factory.get('/api/v1/users/me/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'get': 'me'})
        response = view(request)

        assert response.status_code == 200
        assert response.data['data']['phone'] == '+1234567890'

    def test_patch_me_updates_profile(self):
        """Test PATCH /users/me updates profile"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        UserProfile.objects.create(user_id=user_id)

        request = factory.patch(
            '/api/v1/users/me/',
            data=json.dumps({'phone': '+9999999999'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = UserProfileViewSet.as_view({'patch': 'me'})
        response = view(request)

        assert response.status_code == 200
        profile = UserProfile.objects.get(user_id=user_id)
        assert profile.phone == '+9999999999'
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_views.py::TestUserProfileViewSet -v`

Expected: FAIL

**Step 3: Implement UserProfileViewSet with /me endpoint**

Replace stub in `apps/profiles/views.py`:

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.profiles.models import UserProfile, Pet, PetAnalysis
from apps.profiles.serializers import (
    UserProfileSerializer, UserProfileUpdateSerializer,
    PetSerializer, PetCreateSerializer,
    PetAnalysisSerializer, PetAnalysisCreateSerializer
)
from apps.profiles.permissions import IsOwnerOrAdmin
from apps.profiles.utils import success_response, error_response


class UserProfileViewSet(viewsets.ModelViewSet):
    """ViewSet for user profiles - only supports /me endpoint"""
    serializer_class = UserProfileSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        user_id = self.request.user_id
        return UserProfile.objects.filter(user_id=user_id)

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """GET/PUT/PATCH /api/v1/users/me"""
        user_id = request.user_id

        if request.method == 'GET':
            profile, created = UserProfile.objects.get_or_create(user_id=user_id)
            serializer = UserProfileSerializer(profile)
            return Response(success_response(serializer.data))

        else:  # PUT or PATCH
            profile, created = UserProfile.objects.get_or_create(user_id=user_id)
            serializer = UserProfileUpdateSerializer(
                profile,
                data=request.data,
                partial=(request.method == 'PATCH')
            )

            if serializer.is_valid():
                serializer.save()
                response_serializer = UserProfileSerializer(profile)
                return Response(success_response(response_serializer.data))

            return Response(
                error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors),
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_views.py::TestUserProfileViewSet -v`

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add srcs/user-service/apps/profiles/views.py srcs/user-service/tests/test_views.py
git commit -m "feat(user-service): implement UserProfileViewSet /me endpoint

- Auto-create profile on first GET
- Support GET/PUT/PATCH operations
- Use standardized response format
- 3 passing view tests"
```

---

## Task 18: Enhanced ViewSets - PetViewSet

**Files:**
- Modify: `srcs/user-service/apps/profiles/views.py`
- Modify: `srcs/user-service/tests/test_views.py`

**Step 1: Write failing tests for Pet CRUD**

Add to `tests/test_views.py`:

```python
from apps.profiles.views import PetViewSet
from apps.profiles.models import Pet


@pytest.mark.django_db
class TestPetViewSet:
    def test_list_pets_filters_by_user_id(self):
        """Test GET /pets filters by user_id"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()

        Pet.objects.create(user_id=user_id, name='MyPet', species='dog')
        Pet.objects.create(user_id=other_user_id, name='OtherPet', species='cat')

        request = factory.get('/api/v1/pets/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'get': 'list'})
        response = view(request)

        assert response.status_code == 200
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['name'] == 'MyPet'

    def test_create_pet_sets_user_id_from_header(self):
        """Test POST /pets sets user_id from request"""
        factory = RequestFactory()
        user_id = uuid.uuid4()

        request = factory.post(
            '/api/v1/pets/',
            data=json.dumps({'name': 'Buddy', 'species': 'dog'}),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 201
        pet = Pet.objects.get(name='Buddy')
        assert pet.user_id == user_id

    def test_retrieve_pet_enforces_ownership(self):
        """Test GET /pets/{id} checks ownership"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()

        pet = Pet.objects.create(user_id=other_user_id, name='NotMine', species='cat')

        request = factory.get(f'/api/v1/pets/{pet.id}/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetViewSet.as_view({'get': 'retrieve'})
        response = view(request, pk=pet.id)

        assert response.status_code == 404

    def test_admin_can_view_all_pets(self):
        """Test admin role can view all pets"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()

        Pet.objects.create(user_id=user_id, name='Pet1', species='dog')
        Pet.objects.create(user_id=other_user_id, name='Pet2', species='cat')

        request = factory.get('/api/v1/pets/')
        request.user_id = str(user_id)
        request.user_role = 'admin'

        view = PetViewSet.as_view({'get': 'list'})
        response = view(request)

        assert response.status_code == 200
        assert len(response.data['data']) == 2
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_views.py::TestPetViewSet -v`

Expected: FAIL

**Step 3: Implement PetViewSet**

Replace stub with:

```python
class PetViewSet(viewsets.ModelViewSet):
    """ViewSet for pet management"""
    serializer_class = PetSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        user_id = self.request.user_id
        user_role = self.request.user_role

        if user_role == 'admin':
            return Pet.objects.all()
        return Pet.objects.filter(user_id=user_id)

    def list(self, request):
        """GET /api/v1/pets"""
        queryset = self.get_queryset()
        serializer = PetSerializer(queryset, many=True)
        return Response(success_response(serializer.data))

    def create(self, request):
        """POST /api/v1/pets"""
        serializer = PetCreateSerializer(data=request.data)

        if serializer.is_valid():
            pet = serializer.save(user_id=request.user_id)
            response_serializer = PetSerializer(pet)
            return Response(
                success_response(response_serializer.data),
                status=status.HTTP_201_CREATED
            )

        return Response(
            error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors),
            status=status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    def retrieve(self, request, pk=None):
        """GET /api/v1/pets/{id}"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)
            serializer = PetSerializer(pet)
            return Response(success_response(serializer.data))
        except Pet.DoesNotExist:
            return Response(
                error_response('NOT_FOUND', 'Pet not found'),
                status=status.HTTP_404_NOT_FOUND
            )

    def update(self, request, pk=None):
        """PUT /api/v1/pets/{id}"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)
            serializer = PetSerializer(pet, data=request.data)

            if serializer.is_valid():
                serializer.save()
                return Response(success_response(serializer.data))

            return Response(
                error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors),
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        except Pet.DoesNotExist:
            return Response(
                error_response('NOT_FOUND', 'Pet not found'),
                status=status.HTTP_404_NOT_FOUND
            )

    def partial_update(self, request, pk=None):
        """PATCH /api/v1/pets/{id}"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)
            serializer = PetSerializer(pet, data=request.data, partial=True)

            if serializer.is_valid():
                serializer.save()
                return Response(success_response(serializer.data))

            return Response(
                error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors),
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        except Pet.DoesNotExist:
            return Response(
                error_response('NOT_FOUND', 'Pet not found'),
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """DELETE /api/v1/pets/{id}"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)
            pet.delete()
            return Response(success_response({'message': 'Pet deleted successfully'}))
        except Pet.DoesNotExist:
            return Response(
                error_response('NOT_FOUND', 'Pet not found'),
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def analyses(self, request, pk=None):
        """GET /api/v1/pets/{id}/analyses"""
        try:
            pet = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, pet)

            analyses = PetAnalysis.objects.filter(pet_id=pet.id)
            serializer = PetAnalysisSerializer(analyses, many=True)
            return Response(success_response(serializer.data))
        except Pet.DoesNotExist:
            return Response(
                error_response('NOT_FOUND', 'Pet not found'),
                status=status.HTTP_404_NOT_FOUND
            )
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_views.py::TestPetViewSet -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add srcs/user-service/apps/profiles/views.py srcs/user-service/tests/test_views.py
git commit -m "feat(user-service): implement PetViewSet with full CRUD

- List/Create/Retrieve/Update/Delete operations
- Ownership enforcement via IsOwnerOrAdmin
- Admin can view all pets
- Custom /analyses endpoint
- 4 passing view tests"
```

---

## Task 19: Enhanced ViewSets - PetAnalysisViewSet

**Files:**
- Modify: `srcs/user-service/apps/profiles/views.py`
- Modify: `srcs/user-service/tests/test_views.py`

**Step 1: Write failing tests**

Add to `tests/test_views.py`:

```python
from apps.profiles.views import PetAnalysisViewSet
from apps.profiles.models import PetAnalysis


@pytest.mark.django_db
class TestPetAnalysisViewSet:
    def test_list_analyses_filters_by_user_id(self):
        """Test GET /analyses filters by user_id"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        other_user_id = uuid.uuid4()
        pet_id = uuid.uuid4()

        PetAnalysis.objects.create(
            pet_id=pet_id, user_id=user_id,
            image_url='/test.jpg', breed_detected='Lab', confidence=0.9, traits={}
        )
        PetAnalysis.objects.create(
            pet_id=pet_id, user_id=other_user_id,
            image_url='/test2.jpg', breed_detected='Poodle', confidence=0.85, traits={}
        )

        request = factory.get('/api/v1/analyses/')
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetAnalysisViewSet.as_view({'get': 'list'})
        response = view(request)

        assert response.status_code == 200
        assert len(response.data['data']) == 1
        assert response.data['data'][0]['breed_detected'] == 'Lab'

    def test_create_analysis(self):
        """Test POST /analyses"""
        factory = RequestFactory()
        user_id = uuid.uuid4()
        pet_id = uuid.uuid4()

        data = {
            'pet_id': str(pet_id),
            'user_id': str(user_id),
            'image_url': '/test.jpg',
            'breed_detected': 'Beagle',
            'confidence': 0.92,
            'traits': {'size': 'medium'}
        }

        request = factory.post(
            '/api/v1/analyses/',
            data=json.dumps(data),
            content_type='application/json'
        )
        request.user_id = str(user_id)
        request.user_role = 'user'

        view = PetAnalysisViewSet.as_view({'post': 'create'})
        response = view(request)

        assert response.status_code == 201
        assert PetAnalysis.objects.filter(breed_detected='Beagle').exists()
```

**Step 2: Run test to verify it fails**

Run: `cd srcs/user-service && python -m pytest tests/test_views.py::TestPetAnalysisViewSet -v`

Expected: FAIL

**Step 3: Implement PetAnalysisViewSet**

Replace stub with:

```python
class PetAnalysisViewSet(viewsets.ModelViewSet):
    """ViewSet for pet analysis history - read + create only"""
    serializer_class = PetAnalysisSerializer
    permission_classes = [IsOwnerOrAdmin]
    http_method_names = ['get', 'post']  # No update/delete

    def get_queryset(self):
        user_id = self.request.user_id
        user_role = self.request.user_role

        if user_role == 'admin':
            return PetAnalysis.objects.all()
        return PetAnalysis.objects.filter(user_id=user_id)

    def list(self, request):
        """GET /api/v1/analyses"""
        queryset = self.get_queryset()
        serializer = PetAnalysisSerializer(queryset, many=True)
        return Response(success_response(serializer.data))

    def create(self, request):
        """POST /api/v1/analyses"""
        serializer = PetAnalysisCreateSerializer(data=request.data)

        if serializer.is_valid():
            analysis = serializer.save()
            response_serializer = PetAnalysisSerializer(analysis)
            return Response(
                success_response(response_serializer.data),
                status=status.HTTP_201_CREATED
            )

        return Response(
            error_response('VALIDATION_ERROR', 'Invalid input', serializer.errors),
            status=status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    def retrieve(self, request, pk=None):
        """GET /api/v1/analyses/{id}"""
        try:
            analysis = self.get_queryset().get(pk=pk)
            self.check_object_permissions(request, analysis)
            serializer = PetAnalysisSerializer(analysis)
            return Response(success_response(serializer.data))
        except PetAnalysis.DoesNotExist:
            return Response(
                error_response('NOT_FOUND', 'Analysis not found'),
                status=status.HTTP_404_NOT_FOUND
            )
```

**Step 4: Run test to verify it passes**

Run: `cd srcs/user-service && python -m pytest tests/test_views.py::TestPetAnalysisViewSet -v`

Expected: PASS (2 tests)

**Step 5: Run all view tests**

Run: `cd srcs/user-service && python -m pytest tests/test_views.py -v`

Expected: PASS (9 tests total)

**Step 6: Commit**

```bash
git add srcs/user-service/apps/profiles/views.py srcs/user-service/tests/test_views.py
git commit -m "feat(user-service): implement PetAnalysisViewSet

- List/Create/Retrieve operations (no update/delete)
- Ownership filtering
- 9 total view tests passing"
```

---

## Task 20: Database Migrations

**Files:**
- Create: `srcs/user-service/apps/profiles/migrations/0001_initial.py`

**Step 1: Generate initial migration**

Run: `cd srcs/user-service && python manage.py makemigrations`

Expected: Creates `apps/profiles/migrations/0001_initial.py`

**Step 2: Customize migration for schema and FK constraints**

Edit the generated migration file to add:

```python
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        # Create user_schema
        migrations.RunSQL(
            "CREATE SCHEMA IF NOT EXISTS user_schema;",
            reverse_sql="DROP SCHEMA IF EXISTS user_schema CASCADE;"
        ),

        # Create UserProfile model
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('user_id', models.UUIDField(db_index=True, unique=True)),
                ('phone', models.CharField(blank=True, max_length=20)),
                ('address', models.JSONField(blank=True, null=True)),
                ('preferences', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'user_profiles',
            },
        ),

        # Create Pet model
        migrations.CreateModel(
            name='Pet',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('user_id', models.UUIDField(db_index=True)),
                ('name', models.CharField(max_length=100)),
                ('breed', models.CharField(blank=True, max_length=100)),
                ('breed_confidence', models.FloatField(blank=True, null=True)),
                ('species', models.CharField(choices=[('dog', 'Dog'), ('cat', 'Cat'), ('other', 'Other')], default='dog', max_length=10)),
                ('age', models.IntegerField(blank=True, null=True)),
                ('weight', models.FloatField(blank=True, null=True)),
                ('health_conditions', models.JSONField(blank=True, default=list)),
                ('image_url', models.CharField(blank=True, max_length=500, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'pets',
            },
        ),

        # Create PetAnalysis model
        migrations.CreateModel(
            name='PetAnalysis',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('pet_id', models.UUIDField(db_index=True)),
                ('user_id', models.UUIDField(db_index=True)),
                ('image_url', models.CharField(max_length=500)),
                ('breed_detected', models.CharField(max_length=100)),
                ('confidence', models.FloatField()),
                ('traits', models.JSONField(default=dict)),
                ('raw_response', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'pet_analyses',
                'ordering': ['-created_at'],
            },
        ),

        # Add cross-schema FK constraints
        migrations.RunSQL(
            """
            ALTER TABLE user_schema.user_profiles
            ADD CONSTRAINT fk_user_profiles_user
            FOREIGN KEY (user_id)
            REFERENCES auth_schema.users(id)
            ON DELETE CASCADE;
            """,
            reverse_sql="ALTER TABLE user_schema.user_profiles DROP CONSTRAINT IF EXISTS fk_user_profiles_user;"
        ),

        migrations.RunSQL(
            """
            ALTER TABLE user_schema.pets
            ADD CONSTRAINT fk_pets_user
            FOREIGN KEY (user_id)
            REFERENCES auth_schema.users(id)
            ON DELETE CASCADE;
            """,
            reverse_sql="ALTER TABLE user_schema.pets DROP CONSTRAINT IF EXISTS fk_pets_user;"
        ),

        # Add indexes
        migrations.AddIndex(
            model_name='userprofile',
            index=models.Index(fields=['user_id'], name='userprofile_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='userprofile',
            index=models.Index(fields=['created_at'], name='userprofile_created_idx'),
        ),
        migrations.AddIndex(
            model_name='pet',
            index=models.Index(fields=['user_id', 'created_at'], name='pet_user_created_idx'),
        ),
        migrations.AddIndex(
            model_name='pet',
            index=models.Index(fields=['species'], name='pet_species_idx'),
        ),
        migrations.AddIndex(
            model_name='petanalysis',
            index=models.Index(fields=['pet_id', 'created_at'], name='petanalysis_pet_created_idx'),
        ),
        migrations.AddIndex(
            model_name='petanalysis',
            index=models.Index(fields=['user_id', 'created_at'], name='petanalysis_user_created_idx'),
        ),
    ]
```

**Step 3: Commit migration**

```bash
git add srcs/user-service/apps/profiles/migrations/
git commit -m "feat(user-service): add initial database migration

- Create user_schema
- Create user_profiles, pets, pet_analyses tables
- Add cross-schema FK constraints to auth_schema.users
- Add indexes for performance"
```

---

## Task 21: Run All Tests Before Docker

**Step 1: Run complete test suite**

Run: `cd srcs/user-service && python -m pytest tests/ -v`

Expected: PASS (~53 tests total)
- Models: 12 tests
- Middleware: 4 tests
- Permissions: 5 tests
- Serializers: 11 tests
- Views: 9 tests
- Additional integration tests: ~12 tests

**Step 2: Verify no failures**

If any tests fail, fix them before proceeding to Docker integration.

**Step 3: Commit if any fixes were needed**

```bash
git add .
git commit -m "fix(user-service): resolve test failures before Docker integration"
```

---

## Task 22: Docker Integration

**Files:**
- Modify: `docker-compose.yml`
- Modify: `srcs/api-gateway/.env`
- Modify: `srcs/api-gateway/config.py`

**Step 1: Add user-service to docker-compose.yml**

Add after auth-service:

```yaml
user-service:
  build:
    context: ./srcs/user-service
    dockerfile: Dockerfile
  container_name: ft_transcendence_user_service
  ports:
    - "3002:3002"
  environment:
    - DEBUG=True
  env_file:
    - ./srcs/user-service/.env
  volumes:
    - ./srcs/user-service:/app
  networks:
    - backend-network
  depends_on:
    - db
    - auth-service
  restart: unless-stopped
```

**Step 2: Update API Gateway .env**

Add to `srcs/api-gateway/.env`:

```bash
USER_SERVICE_URL=http://user-service:3002
```

**Step 3: Update API Gateway config.py**

Add to `srcs/api-gateway/config.py`:

```python
USER_SERVICE_URL: str = Field(default="http://user-service:3002")
```

**Step 4: Build and start services**

Run: `make build && make up`

**Step 5: Apply migrations**

Run: `docker exec ft_transcendence_user_service python manage.py migrate`

Expected: Creates user_schema and tables

**Step 6: Verify service health**

Run: `docker compose ps user-service`

Expected: State = Up

**Step 7: Commit**

```bash
git add docker-compose.yml srcs/api-gateway/.env srcs/api-gateway/config.py
git commit -m "feat: integrate user-service into Docker Compose

- Add user-service container
- Configure API Gateway proxy
- Service running on port 3002"
```

---

## Task 23: Integration Testing

**Step 1: Test user-service through API Gateway**

Test /users/me endpoint:

```bash
# Create test user via auth-service first
curl -X POST http://localhost:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}' \
  -c cookies.txt

# Get profile (should auto-create)
curl http://localhost:8001/api/v1/users/me \
  -b cookies.txt
```

Expected: 200 OK with profile data

**Step 2: Test pet creation**

```bash
curl -X POST http://localhost:8001/api/v1/pets \
  -H "Content-Type: application/json" \
  -d '{"name":"Buddy","species":"dog"}' \
  -b cookies.txt
```

Expected: 201 Created with pet data

**Step 3: Test pet listing**

```bash
curl http://localhost:8001/api/v1/pets \
  -b cookies.txt
```

Expected: 200 OK with array of pets

**Step 4: Document integration test results**

Note any issues and fix before final commit.

---

## Task 24: Documentation

**Files:**
- Create: `srcs/user-service/CLAUDE.md`
- Modify: `CLAUDE.md` (root)

**Step 1: Create service-specific CLAUDE.md**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Service Overview

Django REST Framework microservice handling user profiles and pet management. Part of the SmartBreeds platform's microservices architecture.

**Port:** 3002 (internal, accessed via API Gateway)

## Commands

### Testing
```bash
# Run all tests (~53 tests)
docker compose run --rm user-service python -m pytest tests/ -v

# Run specific test file
docker exec ft_transcendence_user_service python -m pytest tests/test_models.py -v

# With coverage
docker exec ft_transcendence_user_service python -m pytest tests/ --cov=apps --cov-report=html
```

### Database Migrations
```bash
docker exec ft_transcendence_user_service python manage.py makemigrations
docker exec ft_transcendence_user_service python manage.py migrate
```

### Development Server
```bash
docker exec ft_transcendence_user_service python manage.py runserver 0.0.0.0:3002
```

## Architecture

### Project Structure
```
config/          # Django settings and root URL config
apps/
  profiles/
    models.py      # UserProfile, Pet, PetAnalysis models
    serializers.py # DRF serializers
    views.py       # ViewSet endpoints
    permissions.py # IsOwnerOrAdmin permission
    middleware.py  # UserContextMiddleware (X-User-ID extraction)
    utils.py       # Standardized API responses
tests/           # pytest-django tests
```

### Models

**UserProfile**: Extended user data (phone, address, preferences)
**Pet**: Pet profiles (name, breed, species, age, weight, health_conditions)
**PetAnalysis**: History of breed identification analyses

### API Endpoints

**User Profiles:**
- GET/PUT/PATCH /api/v1/users/me

**Pets:**
- GET /api/v1/pets - List user's pets
- POST /api/v1/pets - Create pet
- GET /api/v1/pets/{id} - Get pet details
- PUT/PATCH /api/v1/pets/{id} - Update pet
- DELETE /api/v1/pets/{id} - Delete pet
- GET /api/v1/pets/{id}/analyses - Get analysis history

**Pet Analyses:**
- GET /api/v1/analyses - List analyses
- POST /api/v1/analyses - Create analysis record
- GET /api/v1/analyses/{id} - Get specific analysis

### Authentication Flow

User-service receives pre-authenticated requests from API Gateway:
- `X-User-ID` header: Authenticated user UUID
- `X-User-Role` header: User role (user/admin)
- UserContextMiddleware extracts headers and attaches to request
- IsOwnerOrAdmin permission checks ownership or admin role

### Database Schema

**user_schema** (PostgreSQL):
- `user_profiles` - Extended user data
- `pets` - Pet profiles
- `pet_analyses` - Breed identification history

**Cross-schema FK constraints:**
- user_profiles.user_id → auth_schema.users.id
- pets.user_id → auth_schema.users.id

## Configuration

Environment variables loaded via `python-decouple` from `.env`:

| Variable | Default | Notes |
|----------|---------|-------|
| `DB_NAME` | smartbreeds | Shared database |
| `DB_USER` | smartbreeds_user | |
| `DB_PASSWORD` | smartbreeds_password | |
| `DB_HOST` | db | Docker service name |

## Current State

**Status:** Fully implemented with 53 passing tests

**Completed:**
- UserProfile, Pet, PetAnalysis models
- 6 serializers with validation
- 3 ViewSets with full CRUD operations
- IsOwnerOrAdmin permission class
- UserContextMiddleware
- Database migrations with cross-schema FKs
- Docker integration
- Comprehensive test suite
```

**Step 2: Update root CLAUDE.md**

Change user-service status from "stub" to "Complete":

```markdown
**User Service (Django - port 3002):** [Complete]
- User profile management
- Pet profiles (name, breed, age, weight, health conditions)
- Pet analysis history
- Location: `srcs/user-service/`
```

**Step 3: Commit documentation**

```bash
git add srcs/user-service/CLAUDE.md CLAUDE.md
git commit -m "docs(user-service): add service documentation

- Create service-specific CLAUDE.md
- Update root CLAUDE.md status
- Document all endpoints and architecture"
```

---

## Task 25: Final Verification

**Step 1: Run all tests in Docker**

Run: `docker compose run --rm user-service python -m pytest tests/ -v`

Expected: PASS (~53 tests)

**Step 2: Verify service health**

Run: `docker compose ps`

Expected: All services Up and healthy

**Step 3: Test end-to-end flow**

1. Register user
2. Create profile
3. Create pet
4. List pets
5. Get pet details
6. Update pet
7. Delete pet

All should work through API Gateway.

**Step 4: Review commit history**

Run: `git log --oneline`

Expected: ~25 commits following TDD pattern

---

## Implementation Complete!

**Final Status:**
- ✅ 53 tests passing
- ✅ Full CRUD operations
- ✅ Permission enforcement
- ✅ Database migrations applied
- ✅ Docker integration complete
- ✅ API Gateway proxy configured
- ✅ Documentation complete

**Next Steps:**
- Merge feature branch to develop
- Deploy to staging environment
- Integration testing with AI service (for PetAnalysis creation)

---

**Execution Options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with @superpowers:executing-plans, batch execution with checkpoints

**Which approach?**
