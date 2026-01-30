from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission: User can access their own resources, or admin can access all.
    Expects request.user_id and request.user_role set by middleware.
    """

    def has_object_permission(self, request, view, obj):
        # Admin can access everything
        if getattr(request, 'user_role', None) == 'admin':
            return True

        # Owner can access their own resources
        user_id = getattr(request, 'user_id', None)
        return str(obj.user_id) == str(user_id)


class IsOwner(permissions.BasePermission):
    """
    Permission: User can only access their own resources (no admin override).
    """

    def has_object_permission(self, request, view, obj):
        user_id = getattr(request, 'user_id', None)
        return str(obj.user_id) == str(user_id)
