"""
URL configuration for auth-service
"""
from django.contrib import admin
from django.urls import path, include
from apps.authentication.views import HealthView

urlpatterns = [
    path('health', HealthView.as_view(), name='health'),
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.authentication.urls')),
]
