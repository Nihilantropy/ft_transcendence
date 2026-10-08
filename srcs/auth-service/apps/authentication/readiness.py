"""
GET /health/ready — deep readiness check for the status page (Heartbeat).

Runs SELECT 1 against Postgres. Kept apart from /health on purpose: the Docker healthcheck stays
shallow, so a database outage shows up on the status page instead of marking every container
unhealthy and blocking `docker compose up --wait`. 503 when the database cannot answer.
"""
import time

from django.db import DatabaseError, connection
from django.http import JsonResponse


def readiness(request):
    start = time.monotonic()
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        db = {'ok': True, 'latency_ms': round((time.monotonic() - start) * 1000, 2)}
    except DatabaseError as exc:
        connection.close()  # drop a broken persistent connection so the next probe reconnects
        db = {'ok': False, 'error': exc.__class__.__name__}
    return JsonResponse(
        {'status': 'ready' if db['ok'] else 'unavailable', 'checks': {'db': db}},
        status=200 if db['ok'] else 503,
    )
