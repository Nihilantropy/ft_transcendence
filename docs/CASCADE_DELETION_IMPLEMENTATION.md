# Cascade User Deletion Implementation

**Date:** 2026-01-28  
**Status:** ✅ Implemented and Tested

## Overview

Implemented cascade user deletion across microservices, ensuring when a user deletes their account via `/api/v1/auth/delete`, all related data is removed from both **auth-service** and **user-service**.

## Implementation Details

### 1. Configuration Changes

**File:** `srcs/auth-service/.env`
- Added: `USER_SERVICE_URL=http://user-service:3002`

**File:** `srcs/auth-service/config/settings.py`
- Added: `USER_SERVICE_URL = config('USER_SERVICE_URL', default='http://user-service:3002')`

### 2. Cascade Deletion Helper Function

**File:** `srcs/auth-service/apps/authentication/utils.py`

Added `delete_user_cascade()` async function:

```python
async def delete_user_cascade(user_id, user_role='user'):
    """
    Delete user data across all microservices in cascade.
    
    Flow:
    1. Delete user profile data from user-service (profiles, pets, analyses)
    2. Delete auth data from auth-service (user, refresh tokens)
    
    Returns:
        dict: Deletion summary with counts from each service
        
    Raises:
        Exception: If user-service deletion fails
    """
```

**Key Features:**
- **Service-to-service communication:** Uses httpx to call user-service deletion endpoint
- **Error handling:** Raises exception if user-service deletion fails (prevents orphaned auth data)
- **Detailed summary:** Returns counts of deleted records from both services
- **Headers:** Passes X-User-ID, X-User-Role, X-Request-ID headers for proper authentication

### 3. Updated Delete Endpoint

**File:** `srcs/auth-service/apps/authentication/views.py`

Enhanced `DeleteUserView` to use cascade deletion:

```python
class DeleteUserView(APIView):
    def delete(self, request):
        # ... authentication and validation ...
        
        # Perform cascade deletion across microservices
        try:
            deletion_summary = async_to_sync(delete_user_cascade)(user_id, user_role)
        except Exception as e:
            return error_response(
                code='DELETION_FAILED',
                message=f'Failed to delete user account: {str(e)}',
                status=500
            )
        
        # Return success with deletion summary
        response = success_response(
            data={
                'message': f'User account {email} deleted successfully',
                'deleted': deletion_summary
            },
            status=200
        )
        clear_auth_cookies(response)
        return response
```

**Changes:**
- Uses `async_to_sync()` wrapper to call async `delete_user_cascade()`
- Returns detailed deletion summary in response
- Handles errors gracefully with proper error codes

### 4. Integration Test

**File:** `scripts/jupyter/test_user_service.ipynb`

Added **Test 12: Cascade User Deletion** with comprehensive testing:

**Test Flow:**
1. Create new test user via `/api/v1/auth/register`
2. Create user profile via `/api/v1/users/me`
3. Create multiple pets via `/api/v1/users/me/pets`
4. Delete user account via `/api/v1/auth/delete`
5. Verify deletion summary contains correct counts
6. Verify user cannot login after deletion

**Assertions:**
- ✅ Deletion returns 200 status
- ✅ Deletion summary includes both services
- ✅ user-service: 1 profile, N pets deleted
- ✅ auth-service: 1 user, M refresh tokens deleted
- ✅ Login fails with 401/403 after deletion

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "message": "User account user@example.com deleted successfully",
    "deleted": {
      "user_service": {
        "profiles": 1,
        "pets": 2,
        "analyses": 5
      },
      "auth_service": {
        "users": 1,
        "refresh_tokens": 2
      }
    }
  },
  "error": null,
  "timestamp": "2026-01-28T10:30:00.000000Z"
}
```

### Error Response (500)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DELETION_FAILED",
    "message": "Failed to delete user account: User-service deletion failed with status 500: ...",
    "details": {}
  },
  "timestamp": "2026-01-28T10:30:00.000000Z"
}
```

## Architecture Flow

```
User Request
    ↓
API Gateway (JWT validation)
    ↓
Auth Service: DELETE /api/v1/auth/delete
    ↓
    ├─→ User Service: DELETE /api/v1/users/delete (via HTTP)
    │       ↓
    │   Delete profile, pets, analyses (atomic transaction)
    │       ↓
    │   Return deletion counts
    ↓
Delete user & refresh tokens
    ↓
Clear auth cookies
    ↓
Return success with full deletion summary
```

## Error Handling

**If user-service deletion fails:**
- Exception raised by `delete_user_cascade()`
- Auth data NOT deleted (prevents orphaned auth records)
- 500 error returned to client
- User can retry deletion

**If auth-service deletion fails:**
- User-service data already deleted
- Requires manual cleanup or compensating transaction
- Consider implementing saga pattern for true distributed transactions

## Security Considerations

1. **Authentication Required:** Only authenticated users can delete their own account
2. **Network Isolation:** user-service only accessible via internal Docker network
3. **Service-to-Service Auth:** Headers (X-User-ID, X-Request-ID) passed for audit trail
4. **Cookie Clearing:** HTTP-only cookies cleared after successful deletion

## Testing

### Unit Tests
All existing auth-service tests pass (77 tests):
```bash
docker compose run --rm auth-service python -m pytest tests/ -v
```

### Integration Tests
Run cascade deletion test in Jupyter notebook:
```bash
jupyter notebook scripts/jupyter/test_user_service.ipynb
# Run "Test 12: Cascade User Deletion" cell
```

## Dependencies

- **httpx==0.27.0:** Already in `srcs/auth-service/requirements.txt`
- **asgiref:** Included with Django (for `async_to_sync()`)

## Future Enhancements

1. **Saga Pattern:** Implement compensating transactions for true distributed ACID
2. **Soft Delete:** Add `is_deleted` flag instead of hard delete (GDPR retention period)
3. **Async Queue:** Use message queue (RabbitMQ/Celery) for cascade deletion
4. **Audit Log:** Record deletion events in separate audit service
5. **AI Service Integration:** Extend cascade to delete AI recommendations/analyses

## Related Documentation

- User deletion endpoint: `docs/USER_DELETE_ENDPOINT.md`
- Architecture overview: `ARCHITECTURE.md`
- API testing guide: `docs/API_TESTING_GUIDE.md`

## Verification Checklist

- [x] Configuration added (USER_SERVICE_URL)
- [x] Helper function implemented (delete_user_cascade)
- [x] View updated to use cascade deletion
- [x] Integration test added to notebook
- [x] All unit tests passing (77 tests)
- [x] Services rebuilt and running
- [x] Error handling implemented
- [x] Documentation created
