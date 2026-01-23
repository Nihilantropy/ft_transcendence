# User-Service Implementation Design

**Date:** 2026-01-23
**Status:** Design Complete, Ready for Implementation
**Author:** Claude Code + User Collaboration

## Executive Summary

This document defines the implementation plan for the user-service microservice, a Django REST Framework service handling user profiles and pet management. The service mirrors the completed auth-service architecture and integrates into the SmartBreeds microservices platform.

## Design Decisions

### Data Model Strategy
- **UserProfile model**: Separate from auth-service User, references via UUID foreign key
- **Ownership**: User-service owns user_schema with three tables (user_profiles, pets, pet_analyses)
- **Cross-schema FK**: Database-level foreign key constraints to auth_schema.users for referential integrity
- **Pet analyses**: Stored in user-service (users own their pet data and history)

### Permissions Strategy
- **Option C**: Admin role can view all, regular users see only their own data
- **IsOwnerOrAdmin**: Custom permission class with X-User-ID and X-User-Role validation
- **Public profiles**: Deferred to backlog (is_public field for pets)

### Image Storage Strategy
- **Option D**: No image upload initially, image_url nullable
- **Backlog**: S3-like storage service as separate container

### Architecture Alignment
- Mirrors auth-service structure (Django 6.0.1, DRF, pytest, same settings pattern)
- Uses user_schema in shared PostgreSQL instance
- Receives X-User-ID and X-User-Role headers from API Gateway
- Standardized response format (success_response/error_response from utils.py)

## Project Structure

```
srcs/user-service/
├── config/                    # Django project settings
│   ├── __init__.py
│   ├── settings.py           # Database, REST framework, CORS, schema config
│   ├── urls.py               # Root URL config
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   └── profiles/             # Main app
│       ├── __init__.py
│       ├── models.py         # UserProfile, Pet, PetAnalysis
│       ├── serializers.py    # 7 serializers (create/update variants)
│       ├── views.py          # 3 ViewSets (UserProfile, Pet, PetAnalysis)
│       ├── urls.py           # DRF router config
│       ├── permissions.py    # IsOwnerOrAdmin, IsOwner
│       ├── middleware.py     # UserContextMiddleware (X-User-ID extraction)
│       ├── utils.py          # success_response, error_response
│       ├── apps.py
│       ├── admin.py          # Django admin config
│       └── migrations/
│           └── __init__.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py           # pytest fixtures
│   ├── test_models.py
│   ├── test_serializers.py
│   ├── test_views.py
│   └── test_permissions.py
├── manage.py
├── requirements.txt          # Django 6.0.1, DRF, psycopg2
├── Dockerfile                # Mirrors auth-service pattern
├── .env                      # DB credentials, service config
├── pytest.ini
└── CLAUDE.md                 # Service documentation
```

## Database Models

### UserProfile Model

```python
class UserProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(unique=True, db_index=True)
    # FK to auth_schema.users.id via migration SQL

    phone = models.CharField(max_length=20, blank=True)
    address = models.JSONField(null=True, blank=True)
    # Structure: {"street": "", "city": "", "state": "", "zip": "", "country": ""}

    preferences = models.JSONField(default=dict, blank=True)
    # Structure: {"notifications": true, "theme": "light", "language": "en"}

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_profiles'
        indexes = [
            models.Index(fields=['user_id']),
            models.Index(fields=['created_at']),
        ]
```

### Pet Model

```python
class Pet(models.Model):
    SPECIES_CHOICES = [
        ('dog', 'Dog'),
        ('cat', 'Cat'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)  # Owner

    name = models.CharField(max_length=100)
    breed = models.CharField(max_length=100, blank=True)
    breed_confidence = models.FloatField(null=True, blank=True)  # 0.0 to 1.0
    species = models.CharField(max_length=10, choices=SPECIES_CHOICES, default='dog')

    age = models.IntegerField(null=True, blank=True)  # in months
    weight = models.FloatField(null=True, blank=True)  # in kg
    health_conditions = models.JSONField(default=list, blank=True)
    # Structure: ["hip dysplasia", "allergies"]

    image_url = models.CharField(max_length=500, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pets'
        indexes = [
            models.Index(fields=['user_id', 'created_at']),
            models.Index(fields=['species']),
        ]
```

### PetAnalysis Model

```python
class PetAnalysis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pet_id = models.UUIDField(db_index=True)
    user_id = models.UUIDField(db_index=True)

    image_url = models.CharField(max_length=500)
    breed_detected = models.CharField(max_length=100)
    confidence = models.FloatField()  # 0.0 to 1.0
    traits = models.JSONField(default=dict)
    # Structure: {"size": "large", "energy": "high", "temperament": "friendly"}

    raw_response = models.JSONField(null=True, blank=True)
    # Full AI service response for debugging/audit

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pet_analyses'
        indexes = [
            models.Index(fields=['pet_id', 'created_at']),
            models.Index(fields=['user_id', 'created_at']),
        ]
        ordering = ['-created_at']
```

## Serializers

### UserProfile Serializers

1. **UserProfileSerializer** - Full profile data (read operations)
2. **UserProfileUpdateSerializer** - Update operations (excludes user_id)

### Pet Serializers

3. **PetSerializer** - Full pet data (read/update operations)
4. **PetCreateSerializer** - Create operations (minimal: name, species)

### PetAnalysis Serializers

5. **PetAnalysisSerializer** - Full analysis data
6. **PetAnalysisCreateSerializer** - Create analysis records (from AI service)

**Validation:**
- Phone: digit-only validation
- Address: allowed keys validation
- Age/Weight: positive number validation
- Confidence: 0.0 to 1.0 range validation

## API Endpoints

### User Profiles

```
GET    /api/v1/users/me           - Get my profile (auto-create if not exists)
PUT    /api/v1/users/me           - Update profile (full)
PATCH  /api/v1/users/me           - Update profile (partial)
```

### Pets

```
GET    /api/v1/pets               - List my pets (admin: all pets)
POST   /api/v1/pets               - Create new pet
GET    /api/v1/pets/{id}          - Get specific pet (ownership check)
PUT    /api/v1/pets/{id}          - Update pet (full)
PATCH  /api/v1/pets/{id}          - Update pet (partial)
DELETE /api/v1/pets/{id}          - Delete pet
GET    /api/v1/pets/{id}/analyses - Get pet's analysis history
```

### Pet Analyses

```
GET    /api/v1/analyses           - List my analyses (admin: all)
POST   /api/v1/analyses           - Create analysis record
GET    /api/v1/analyses/{id}      - Get specific analysis
```

**Note:** API Gateway proxies these as:
- `https://localhost/api/v1/users/me` → `http://user-service:3002/api/v1/users/me`
- `https://localhost/api/v1/pets` → `http://user-service:3002/api/v1/pets`

## Permissions and Middleware

### UserContextMiddleware

Extracts API Gateway headers and attaches to request:

```python
class UserContextMiddleware:
    def __call__(self, request):
        request.user_id = request.headers.get('X-User-ID')
        request.user_role = request.headers.get('X-User-Role', 'user')
        # ...
```

### IsOwnerOrAdmin Permission

```python
class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        # Admin can access everything
        if request.user_role == 'admin':
            return True
        # Owner can access their own resources
        return str(obj.user_id) == str(request.user_id)
```

## ViewSets

### UserProfileViewSet

- Custom `@action(detail=False)` for `/me` endpoint
- Auto-creates profile on first GET if not exists
- Restricts to own profile only (no list endpoint)

### PetViewSet

- Standard CRUD operations
- `get_queryset()` filters by user_id (admin sees all)
- Custom `@action(detail=True)` for `/pets/{id}/analyses`
- Ownership enforcement via IsOwnerOrAdmin

### PetAnalysisViewSet

- Read + Create only (no update/delete)
- `http_method_names = ['get', 'post']`
- Filtered by user_id automatically

## Database Configuration

### Schema Setup

```python
# config/settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'smartbreeds',
        'USER': 'smartbreeds_user',
        'PASSWORD': 'smartbreeds_password',
        'HOST': 'db',
        'PORT': '5432',
        'OPTIONS': {
            'options': '-c search_path=user_schema,public'
        },
    }
}
```

### Migration Strategy

**0001_initial.py** (customized):
1. Create `user_schema` if not exists
2. Create tables (user_profiles, pets, pet_analyses)
3. Add cross-schema FK constraints via `migrations.RunSQL`:
   - `user_profiles.user_id → auth_schema.users.id ON DELETE CASCADE`
   - `pets.user_id → auth_schema.users.id ON DELETE CASCADE`
4. Add indexes

**Execution order:**
1. Ensure auth-service migrations applied (users table exists)
2. Run user-service migrations
3. Verify schema: `\dt user_schema.*`

## Docker Configuration

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl postgresql-client && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 userservice && chown -R userservice:userservice /app
USER userservice

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD curl -f http://localhost:3002/api/v1/users/me/ || exit 1

EXPOSE 3002

CMD ["python", "manage.py", "runserver", "0.0.0.0:3002"]
```

### docker-compose.yml

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
  restart: unless-stopped
```

### API Gateway Integration

Update `srcs/api-gateway/.env`:
```bash
USER_SERVICE_URL=http://user-service:3002
```

Update `srcs/api-gateway/config.py`:
```python
USER_SERVICE_URL: str = Field(default="http://user-service:3002")
```

API Gateway auto-proxies `/api/v1/users/*` and `/api/v1/pets/*` to user-service.

## Testing Strategy

### Test Coverage (~50-60 tests)

**test_models.py:**
- UserProfile creation and validation
- Pet model with all fields
- PetAnalysis creation
- JSON field validation (address, preferences, health_conditions, traits)
- Model string representations
- Unique constraints and indexes

**test_serializers.py:**
- UserProfileSerializer validation
- PetSerializer field validation (age, weight, confidence ranges)
- Address/preferences JSON structure validation
- Create vs Update serializer differences
- Error messages for invalid data

**test_permissions.py:**
- IsOwnerOrAdmin: owner access allowed
- IsOwnerOrAdmin: admin access allowed
- IsOwnerOrAdmin: other user denied
- IsOwner: strict ownership enforcement

**test_views.py:**
- GET /users/me (auto-create profile)
- PATCH /users/me (update fields)
- GET /pets (list filtering by user_id)
- POST /pets (create with user_id from header)
- GET /pets/{id} (ownership check)
- DELETE /pets/{id} (ownership enforcement)
- GET /pets/{id}/analyses (history retrieval)
- Admin access to all resources
- 404 handling for non-existent resources
- 403 handling for unauthorized access

### Test Fixtures (conftest.py)

```python
@pytest.fixture
def user_id():
    return uuid.uuid4()

@pytest.fixture
@pytest.mark.django_db
def user_profile(user_id):
    return UserProfile.objects.create(user_id=user_id, ...)

@pytest.fixture
@pytest.mark.django_db
def pet(user_id):
    return Pet.objects.create(user_id=user_id, ...)

@pytest.fixture
@pytest.mark.django_db
def pet_analysis(user_id, pet):
    return PetAnalysis.objects.create(...)
```

## Implementation Steps

1. **Setup** (20 min)
   - Create directory structure
   - Copy utils.py from auth-service
   - Create requirements.txt, Dockerfile, .env, pytest.ini

2. **Models** (30 min)
   - Implement UserProfile, Pet, PetAnalysis models
   - Write test_models.py

3. **Serializers** (30 min)
   - Implement 7 serializers with validation
   - Write test_serializers.py

4. **Permissions & Middleware** (20 min)
   - Implement IsOwnerOrAdmin, IsOwner
   - Implement UserContextMiddleware
   - Write test_permissions.py

5. **Views** (45 min)
   - Implement 3 ViewSets
   - Configure DRF router
   - Write test_views.py

6. **Configuration** (20 min)
   - Configure settings.py (database, middleware, REST framework)
   - Configure urls.py
   - Create admin.py

7. **Migrations** (30 min)
   - Generate initial migration
   - Customize for schema creation and FK constraints
   - Test migration execution

8. **Docker Integration** (15 min)
   - Update docker-compose.yml
   - Update API Gateway config
   - Test service startup

9. **Testing** (30 min)
   - Run full test suite
   - Fix any issues
   - Verify coverage

10. **Documentation** (15 min)
    - Write CLAUDE.md
    - Update root CLAUDE.md with user-service status

**Total estimated time:** ~4 hours

## Response Format

All endpoints use standardized response format from utils.py:

**Success:**
```json
{
  "success": true,
  "data": { /* payload */ },
  "error": null,
  "timestamp": "2026-01-23T12:00:00.000000"
}
```

**Error:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {}
  },
  "timestamp": "2026-01-23T12:00:00.000000"
}
```

## Backlog Items

1. **Public Pet Profiles**
   - Add `is_public` boolean field to Pet model
   - Update permissions to allow public access if is_public=true
   - Add privacy toggle in API

2. **S3-like Image Storage Service**
   - Create separate microservice for image uploads
   - Docker container with object storage (MinIO or custom)
   - Integration with pet and analysis image_url fields
   - Signed URL generation for secure access

3. **Pet Image Upload Endpoints**
   - POST /api/v1/pets/{id}/image (multipart/form-data)
   - Integration with AI service for breed analysis
   - Automatic creation of PetAnalysis records

4. **Data Export**
   - GET /api/v1/users/me/export (JSON/CSV format)
   - Export all user data (profile + pets + analyses)
   - GDPR compliance

## Success Criteria

- [ ] All models created with proper validation
- [ ] All serializers implemented with field validation
- [ ] All ViewSets with CRUD operations
- [ ] Permissions enforce ownership and admin access
- [ ] Middleware extracts X-User-ID and X-User-Role
- [ ] Database schema created with FK constraints
- [ ] ~50-60 tests passing
- [ ] Docker container builds and runs
- [ ] API Gateway successfully proxies requests
- [ ] Admin interface accessible and functional
- [ ] Standardized response format consistent with auth-service

## References

- Auth-service implementation: `srcs/auth-service/`
- Architecture document: `ARCHITECTURE.md`
- API Gateway: `srcs/api-gateway/`
- Database schema: ARCHITECTURE.md lines 669-716
