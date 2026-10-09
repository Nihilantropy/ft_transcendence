from unittest import mock

import pytest
from django.db import OperationalError


@pytest.mark.django_db
class TestReadiness:
    def test_ready_when_db_answers(self, client):
        response = client.get('/health/ready')
        assert response.status_code == 200
        body = response.json()
        assert body['status'] == 'ready'
        assert body['checks']['db']['ok'] is True

    def test_503_when_db_is_down(self, client):
        # Mock the whole connection: closing the real one would break the test's transaction.
        with mock.patch('apps.profiles.readiness.connection') as conn:
            conn.cursor.side_effect = OperationalError('could not connect')
            response = client.get('/health/ready')
        assert response.status_code == 503
        assert response.json() == {
            'status': 'unavailable',
            'checks': {'db': {'ok': False, 'error': 'OperationalError'}},
        }
        conn.close.assert_called_once()
