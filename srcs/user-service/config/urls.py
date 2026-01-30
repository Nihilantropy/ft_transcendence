from django.urls import path, include
from apps.profiles.views import health_check

urlpatterns = [
    path('health', health_check, name='health'),
    path('api/v1/', include('apps.profiles.urls')),
]
