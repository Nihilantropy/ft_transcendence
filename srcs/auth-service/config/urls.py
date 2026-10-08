"""
URL configuration for auth-service
"""
from django.urls import path, include
from apps.authentication.views import HealthView
from apps.authentication.readiness import readiness

urlpatterns = [
    path('health', HealthView.as_view(), name='health'),
    path('health/ready', readiness, name='health-ready'),
    path('api/v1/auth/', include('apps.authentication.urls')),
]
