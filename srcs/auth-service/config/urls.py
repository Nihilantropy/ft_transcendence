"""
URL configuration for auth-service
"""
from django.urls import path, include
from apps.authentication.views import HealthView

urlpatterns = [
    path('health', HealthView.as_view(), name='health'),
    path('api/v1/auth/', include('apps.authentication.urls')),
]
