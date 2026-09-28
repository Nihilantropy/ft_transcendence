#!/bin/bash
# Create the test admin (test_admin@example.com / Password123!) that the
# recommendation-service integration tests hardcode.
# No `-it`: --no-input reads nothing from stdin, and a TTY makes docker exec fail
# outside an interactive terminal (CI, piped `make init`).
out=$(docker exec ft_transcendence_auth_service env \
    DJANGO_SUPERUSER_PASSWORD='Password123!' \
    DJANGO_SUPERUSER_EMAIL=test_admin@example.com \
    python manage.py createsuperuser --no-input 2>&1)
status=$?
echo "$out"

# Re-running is fine: an existing admin must not abort `make init` before `rag`.
if [ $status -ne 0 ] && [[ "$out" == *"already taken"* ]]; then
    echo "Superuser already exists, skipping."
    exit 0
fi
exit $status
