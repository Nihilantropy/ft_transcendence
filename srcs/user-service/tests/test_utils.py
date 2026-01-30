"""
Tests for utility functions (success_response, error_response)
"""
import pytest
from apps.profiles.utils import success_response, error_response
from datetime import datetime


class TestSuccessResponse:
    """Test success_response utility"""
    
    def test_success_response_structure(self):
        """Test success response has correct structure"""
        response = success_response({'key': 'value'})
        
        assert response.status_code == 200
        assert 'success' in response.data
        assert 'data' in response.data
        assert 'error' in response.data
        assert 'timestamp' in response.data
    
    def test_success_response_values(self):
        """Test success response has correct values"""
        test_data = {'user_id': '123', 'name': 'Test'}
        response = success_response(test_data)
        
        assert response.data['success'] is True
        assert response.data['data'] == test_data
        assert response.data['error'] is None
    
    def test_success_response_custom_status(self):
        """Test success response with custom status code"""
        response = success_response({'created': True}, status=201)
        
        assert response.status_code == 201
        assert response.data['success'] is True
    
    def test_success_response_timestamp_format(self):
        """Test timestamp is in ISO8601 format with Z suffix"""
        response = success_response({'test': 'data'})
        
        timestamp = response.data['timestamp']
        assert timestamp.endswith('Z')
        # Should be parseable as ISO8601
        datetime.fromisoformat(timestamp.rstrip('Z'))
    
    def test_success_response_empty_data(self):
        """Test success response with empty data"""
        response = success_response({})
        
        assert response.data['success'] is True
        assert response.data['data'] == {}


class TestErrorResponse:
    """Test error_response utility"""
    
    def test_error_response_structure(self):
        """Test error response has correct structure"""
        response = error_response('TEST_ERROR', 'Test message')
        
        assert response.status_code == 400
        assert 'success' in response.data
        assert 'data' in response.data
        assert 'error' in response.data
        assert 'timestamp' in response.data
    
    def test_error_response_values(self):
        """Test error response has correct values"""
        response = error_response('NOT_FOUND', 'Resource not found', status=404)
        
        assert response.data['success'] is False
        assert response.data['data'] is None
        assert response.data['error']['code'] == 'NOT_FOUND'
        assert response.data['error']['message'] == 'Resource not found'
        assert response.status_code == 404
    
    def test_error_response_with_details(self):
        """Test error response includes details dict"""
        details = {'field': 'email', 'reason': 'invalid'}
        response = error_response('VALIDATION_ERROR', 'Invalid input', details=details)
        
        assert response.data['error']['details'] == details
    
    def test_error_response_without_details(self):
        """Test error response defaults to empty details dict"""
        response = error_response('ERROR', 'Message')
        
        assert response.data['error']['details'] == {}
    
    def test_error_response_timestamp_format(self):
        """Test timestamp is in ISO8601 format with Z suffix"""
        response = error_response('ERROR', 'Test')
        
        timestamp = response.data['timestamp']
        assert timestamp.endswith('Z')
        # Should be parseable as ISO8601
        datetime.fromisoformat(timestamp.rstrip('Z'))
    
    def test_error_response_custom_status(self):
        """Test error response with various status codes"""
        test_cases = [
            ('VALIDATION_ERROR', 422),
            ('UNAUTHORIZED', 401),
            ('FORBIDDEN', 403),
            ('INTERNAL_ERROR', 500)
        ]
        
        for code, status in test_cases:
            response = error_response(code, 'Test message', status=status)
            assert response.status_code == status
