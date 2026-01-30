# User Data Deletion Endpoint

## Overview

The user-service now provides a `DELETE /api/v1/users/delete` endpoint that allows users to delete all their profile data. This endpoint is called by the auth-service when a user account is deleted to ensure cascade deletion across microservices.

## Endpoint Details

**URL:** `DELETE /api/v1/users/delete`

**Authentication:** Required (via X-User-ID header from API Gateway)

**Description:** Deletes all user data from user-service database:
- User profile
- All pets owned by the user
- All pet analysis history

## Implementation

### Location
- **File:** `srcs/user-service/apps/profiles/views.py`
- **Method:** `UserProfileViewSet.delete_user_data()`

### Key Features

1. **Atomic Transaction:** All deletions occur in a single transaction - either all succeed or all fail
2. **User Isolation:** Only deletes data belonging to the authenticated user (verified via X-User-ID header)
3. **Cascade Deletion:** Automatically removes:
   - User profile (`UserProfile` model)
   - All pets (`Pet` model)
   - All analyses (`PetAnalysis` model)
4. **Response Details:** Returns count of deleted records for each model type

### Request

```bash
# Via API Gateway (recommended - production path)
curl -X DELETE http://localhost:8001/api/v1/users/delete \
  -H "Authorization: Bearer <access_token>" \
  -b cookies.txt

# Direct call with headers (internal service-to-service)
curl -X DELETE http://user-service:3002/api/v1/users/delete \
  -H "X-User-ID: <uuid>" \
  -H "X-User-Role: user"
```

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "message": "User data deleted successfully",
    "deleted": {
      "profiles": 1,
      "pets": 2,
      "analyses": 5
    }
  },
  "error": null,
  "timestamp": "2026-01-28T09:30:00.000000Z"
}
```

**Unauthorized (401):**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User ID not found in request",
    "details": {}
  },
  "timestamp": "2026-01-28T09:30:00.000000Z"
}
```

**Internal Error (500):**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete user data: <error details>",
    "details": {}
  },
  "timestamp": "2026-01-28T09:30:00.000000Z"
}
```

## Usage from Auth Service

When implementing user deletion in auth-service (`POST /api/v1/auth/delete`), you should:

1. **Call user-service first** to delete profile data:
   ```python
   import httpx
   
   async def delete_user_account(user_id: str):
       # Step 1: Delete user data from user-service
       user_service_url = settings.USER_SERVICE_URL
       headers = {
           "X-User-ID": str(user_id),
           "X-User-Role": "user",
           "X-Request-ID": str(uuid.uuid4())
       }
       
       async with httpx.AsyncClient() as client:
           response = await client.delete(
               f"{user_service_url}/api/v1/users/delete",
               headers=headers,
               timeout=10.0
           )
           
           if response.status_code != 200:
               raise Exception(f"Failed to delete user data: {response.text}")
       
       # Step 2: Delete user and refresh tokens from auth-service database
       # (RefreshToken has CASCADE delete, so will auto-delete)
       user = await User.objects.filter(id=user_id).adelete()
       
       return {"message": "User account deleted successfully"}
   ```

2. **Handle errors gracefully:**
   - If user-service deletion fails, don't delete the auth user
   - Log the error for investigation
   - Consider retry logic or manual cleanup procedures

3. **Transaction considerations:**
   - User-service deletion is atomic (transaction-safe)
   - Auth-service deletion is separate (RefreshToken cascade delete via ForeignKey)
   - For cross-service atomicity, consider implementing compensating transactions

## Testing

Tests are located in `srcs/user-service/tests/test_views.py`:

```bash
# Run all delete endpoint tests
docker compose run --rm user-service python -m pytest \
  tests/test_views.py::TestUserProfileViewSet::test_delete_user_data_removes_all_user_records \
  tests/test_views.py::TestUserProfileViewSet::test_delete_user_data_without_user_id \
  tests/test_views.py::TestUserProfileViewSet::test_delete_user_data_only_deletes_own_data \
  -v
```

### Test Coverage

1. **test_delete_user_data_removes_all_user_records:** Verifies all related data is deleted
2. **test_delete_user_data_without_user_id:** Validates authentication requirement
3. **test_delete_user_data_only_deletes_own_data:** Ensures user isolation (no cross-user deletion)

## Database Cascade Behavior

### Auth Service (auth_schema)
- `User` model deletion → `RefreshToken` auto-deletes (ForeignKey with CASCADE)
- Database-level cascade ensures consistency

### User Service (user_schema)
- Uses **soft references** (UUID fields, not ForeignKeys)
- Cascade deletion handled at **application level** (in view logic)
- No database-level foreign key constraints across schemas

## Security Considerations

1. **Authentication Required:** X-User-ID header must be present (set by API Gateway after JWT validation)
2. **User Isolation:** Only deletes data matching the authenticated user's ID
3. **No Admin Override:** Even admins can only delete their own data via this endpoint (by design)
4. **Atomic Operation:** Uses Django transaction.atomic() to prevent partial deletions
5. **Network Isolation:** User-service is NOT exposed to localhost - only accessible via API Gateway or internal Docker network

## Next Steps

To complete the user deletion feature:

1. **Implement auth-service DELETE endpoint** (`/api/v1/auth/delete`)
2. **Add HTTP client call** from auth-service to user-service
3. **Update API Gateway** routing (if needed - already proxies `/api/*`)
4. **Add integration tests** for full deletion flow
5. **Document deletion policy** (GDPR compliance, data retention, etc.)

## Related Files

- Implementation: `srcs/user-service/apps/profiles/views.py`
- Models: `srcs/user-service/apps/profiles/models.py`
- Tests: `srcs/user-service/tests/test_views.py`
- URL routing: `srcs/user-service/apps/profiles/urls.py`
