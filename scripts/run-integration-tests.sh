#!/bin/bash
# Integration tests for SmartBreeds microservices via API Gateway

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
FAILED_TESTS=0

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SmartBreeds Integration Test Suite      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if services are running
echo -e "${YELLOW}Checking service health...${NC}"
if ! curl -s http://localhost:8001/health > /dev/null 2>&1; then
  echo -e "${RED}✗ API Gateway not accessible${NC}"
  echo "Please ensure services are running: docker compose up -d"
  exit 1
fi
echo -e "${GREEN}✓ API Gateway accessible${NC}"
echo ""

# Test 1: User Registration
echo -e "${YELLOW}[1/6] Testing user registration...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@smartbreeds.com",
    "password": "SecurePass123",
    "password_confirm": "SecurePass123"
  }')

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ User registration successful${NC}"
  USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo "  User ID: $USER_ID"
else
  echo -e "${YELLOW}⚠ User already exists or registration failed (may be expected)${NC}"
  echo "  Response: $REGISTER_RESPONSE"
fi
echo ""

# Test 2: User Login
echo -e "${YELLOW}[2/6] Testing user login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c /tmp/smartbreeds_cookies.txt \
  -d '{
    "email": "testuser@smartbreeds.com",
    "password": "SecurePass123"
  }')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ User login successful${NC}"
  echo "  Cookies saved to /tmp/smartbreeds_cookies.txt"
else
  echo -e "${RED}✗ User login failed${NC}"
  echo "  Response: $LOGIN_RESPONSE"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test 3: Get User Profile (auto-creates if not exists)
echo -e "${YELLOW}[3/6] Testing get user profile...${NC}"
PROFILE_RESPONSE=$(curl -s -X GET http://localhost:8001/api/v1/users/me \
  -b /tmp/smartbreeds_cookies.txt)

if echo "$PROFILE_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ User profile retrieved${NC}"
  echo "  Response: $PROFILE_RESPONSE"
else
  echo -e "${RED}✗ User profile retrieval failed${NC}"
  echo "  Response: $PROFILE_RESPONSE"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test 4: Update User Profile
echo -e "${YELLOW}[4/6] Testing update user profile...${NC}"
UPDATE_PROFILE_RESPONSE=$(curl -s -X PATCH http://localhost:8001/api/v1/users/me \
  -H "Content-Type: application/json" \
  -b /tmp/smartbreeds_cookies.txt \
  -d '{
    "phone": "+1234567890",
    "address": {
      "street": "123 Pet Lane",
      "city": "Dogville",
      "country": "USA"
    },
    "preferences": {
      "newsletter": true,
      "notifications": true
    }
  }')

if echo "$UPDATE_PROFILE_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ User profile updated${NC}"
  echo "  Response: $UPDATE_PROFILE_RESPONSE"
else
  echo -e "${RED}✗ User profile update failed${NC}"
  echo "  Response: $UPDATE_PROFILE_RESPONSE"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test 5: Create Pet
echo -e "${YELLOW}[5/6] Testing create pet...${NC}"
CREATE_PET_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/pets \
  -H "Content-Type: application/json" \
  -b /tmp/smartbreeds_cookies.txt \
  -d '{
    "name": "Max",
    "species": "dog",
    "breed": "Golden Retriever",
    "age": 3,
    "weight": 30.5,
    "health_conditions": ["hip dysplasia"]
  }')

if echo "$CREATE_PET_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Pet created${NC}"
  PET_ID=$(echo "$CREATE_PET_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo "  Pet ID: $PET_ID"
else
  echo -e "${RED}✗ Pet creation failed${NC}"
  echo "  Response: $CREATE_PET_RESPONSE"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test 6: List User's Pets
echo -e "${YELLOW}[6/6] Testing list user pets...${NC}"
LIST_PETS_RESPONSE=$(curl -s -X GET http://localhost:8001/api/v1/pets \
  -b /tmp/smartbreeds_cookies.txt)

if echo "$LIST_PETS_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Pets list retrieved${NC}"
  PET_COUNT=$(echo "$LIST_PETS_RESPONSE" | grep -o '"name":"' | wc -l)
  echo "  Found $PET_COUNT pet(s)"
else
  echo -e "${RED}✗ Pets list retrieval failed${NC}"
  echo "  Response: $LIST_PETS_RESPONSE"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test 7: Token Refresh
echo -e "${YELLOW}[7/7] Testing token refresh...${NC}"
REFRESH_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/auth/refresh \
  -b /tmp/smartbreeds_cookies.txt \
  -c /tmp/smartbreeds_cookies.txt)

if echo "$REFRESH_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Token refresh successful${NC}"
else
  echo -e "${RED}✗ Token refresh failed${NC}"
  echo "  Response: $REFRESH_RESPONSE"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test 8: Logout
echo -e "${YELLOW}[8/8] Testing logout...${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/auth/logout \
  -b /tmp/smartbreeds_cookies.txt)

if echo "$LOGOUT_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Logout successful${NC}"
else
  echo -e "${YELLOW}⚠ Logout response: $LOGOUT_RESPONSE${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Integration Tests Summary             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Integration Tests: ${GREEN}8 scenarios${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✓ All integration tests completed successfully${NC}"
  exit 0
else
  echo -e "${RED}✗ $FAILED_TESTS integration test(s) failed${NC}"
  exit 1
fi
