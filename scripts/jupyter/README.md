# ft_transcendence Integration Testing with Jupyter

This directory contains Jupyter notebooks for interactive integration testing of the ft_transcendence microservices.

## Overview

Three Jupyter notebooks are provided to test each service through the API Gateway:

1. **`test_auth_service.ipynb`** - Authentication service testing (login, register, token refresh, logout)
2. **`test_user_service.ipynb`** - User service testing (profile management, pet CRUD operations)
3. **`test_ai_service.ipynb`** - TODO needs to be recreated based on the refactor of the ai-service, described in docs/plans/2026-01-28-multi-stage-vision-pipeline-design.md

All tests send HTTP requests through the API Gateway (`http://localhost:8001`) or Nginx (`https://localhost`), following the microservices architecture security boundaries.

## Prerequisites

1. **Docker services must be running:**
   ```bash
   # From project root
   make up
   # Or
   docker compose up -d
   ```

2. **Verify services are healthy:**
   ```bash
   curl http://localhost:8001/health
   ```

## Setup

### 1. Create Virtual Environment

```bash
# From this directory (scripts/jupyter)
python3 -m venv .venv
```

### 2. Activate Virtual Environment

**Linux/macOS:**
```bash
source .venv/bin/activate
```

**Windows:**
```cmd
.venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Start Jupyter Notebook

```bash
jupyter notebook
```

This will open your browser with the Jupyter interface showing the three test notebooks.

## Usage

### Running the Notebooks

1. **Start with Authentication Testing:**
   - Open `test_auth_service.ipynb`
   - Run cells sequentially (Shift+Enter)
   - Successful login will save cookies for subsequent requests

2. **Test User Service:**
   - Open `test_user_service.ipynb`
   - Ensure you have a valid authentication token from auth testing
   - Test profile management and pet CRUD operations

3. **Test AI Service:**
   - Open `test_ai_service.ipynb`
   - Requires authentication
   - Upload test images for breed detection

### Notebook Features

Each notebook includes:
- **Interactive cells** for sending API requests
- **Pretty-printed responses** using rich formatting
- **Error handling** with detailed debugging information
- **Data visualization** for response analysis
- **Reusable functions** for common operations
- **Test data generation** for realistic scenarios

### Testing Workflow

```python
# Typical flow in notebooks:

# 1. Test service health
response = requests.get(f"{BASE_URL}/health")

# 2. Authenticate (auth service)
login_response = login(email, password)

# 3. Use authenticated session for protected endpoints
profile = get_user_profile(session)
pets = create_pet(session, pet_data)

# 4. Clean up test data
delete_pet(session, pet_id)
logout(session)
```

## Configuration

### Environment Variables

You can customize the base URL by setting environment variables:

```python
# In notebook cells
import os
BASE_URL = os.getenv("API_GATEWAY_URL", "http://localhost:8001")
```

### Test Data

Sample test data is included in each notebook. You can modify:
- User credentials
- Profile information
- Pet details
- Test images for AI analysis

## Troubleshooting

### Connection Refused

**Problem:** `requests.exceptions.ConnectionError: Connection refused`

**Solution:**
```bash
# Check if API Gateway is running
docker compose ps api-gateway

# Restart if needed
docker compose restart api-gateway

# Check logs
docker compose logs api-gateway
```

### Authentication Failures

**Problem:** `401 Unauthorized` errors

**Solution:**
1. Re-run authentication cells in `test_auth_service.ipynb`
2. Verify JWT_SECRET_KEY matches between services
3. Check cookie persistence in requests session

### Rate Limiting

**Problem:** `429 Too Many Requests`

**Solution:**
- Wait 1 minute for rate limit window to reset
- Reduce request frequency in loops
- Check Redis: `docker exec ft_transcendence_redis redis-cli ping`

### AI Service Timeouts

**Problem:** Vision analysis requests timeout

**Solution:**
```bash
# Check if Ollama is running and model is loaded
docker compose logs ollama

# Verify GPU access
docker exec ft_transcendence_ollama ollama list

# Pull model if missing
docker exec ft_transcendence_ollama ollama pull qwen3-vl:8b
```

## Architecture Notes

### Request Flow

```
Jupyter Notebook → API Gateway (localhost:8001)
                    ↓ (validates JWT, adds user headers)
                    → Backend Service (auth:3001, user:3002, ai:3003)
                    ↓
                    ← Response
                    ← API Gateway
Jupyter Notebook ←
```

### Authentication

- JWT tokens stored in **HTTP-only cookies** (automatically managed by `requests.Session`)
- Access token: 24 hours validity
- Refresh token: 7 days validity
- Cookies sent automatically with each request

### Network Isolation

Backend services are **NOT** directly accessible:
- ❌ `http://localhost:3001` (auth-service) - WILL FAIL
- ❌ `http://localhost:3002` (user-service) - WILL FAIL
- ❌ `http://localhost:3003` (ai-service) - WILL FAIL
- ✅ `http://localhost:8001/api/v1/auth/*` - CORRECT
- ✅ `http://localhost:8001/api/v1/users/*` - CORRECT
- ✅ `http://localhost:8001/api/v1/vision/*` - CORRECT

## Development Tips

### Modifying Test Cases

1. **Add new test scenarios:**
   - Create new cells in notebooks
   - Follow existing patterns for request/response handling
   - Use assertions to validate responses

2. **Debug API issues:**
   - Enable verbose logging: `response.text`
   - Inspect headers: `response.headers`
   - Check timing: `response.elapsed.total_seconds()`

3. **Export test results:**
   ```python
   import pandas as pd

   # Create DataFrame from responses
   df = pd.DataFrame(test_results)
   df.to_csv("test_results.csv")
   ```

### Reusing Code

Extract common functions to a shared module:

```bash
# Create shared utilities
touch scripts/jupyter/test_utils.py
```

Then import in notebooks:
```python
from test_utils import authenticate, make_request, format_response
```

## Best Practices

1. **Always clean up test data** - Delete created resources at end of testing
2. **Use fresh sessions** - Create new `requests.Session()` for each test suite
3. **Handle errors gracefully** - Wrap requests in try/except blocks
4. **Log request/response pairs** - Helps debug integration issues
5. **Test error cases** - Not just happy paths

## Additional Resources

- **API Documentation:** See `docs/API_TESTING_GUIDE.md`
- **Architecture:** See `ARCHITECTURE.md`
- **Service Details:** See `CLAUDE.md`

## Contributing

When adding new test notebooks:

1. Follow naming convention: `test_<service>_service.ipynb`
2. Include clear markdown explanations
3. Add error handling and cleanup
4. Update this README with new notebook description
5. Add any new dependencies to `requirements.txt`
