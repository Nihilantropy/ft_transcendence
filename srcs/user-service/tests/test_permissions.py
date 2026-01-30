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
