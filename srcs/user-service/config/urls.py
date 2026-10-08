from django.urls import path, include
from apps.profiles.views import health_check
from apps.profiles.readiness import readiness

urlpatterns = [
    path('health', health_check, name='health'),
    path('health/ready', readiness, name='health-ready'),
    path('api/v1/', include('apps.profiles.urls')),
]
