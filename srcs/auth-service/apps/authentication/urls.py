"""
URL configuration for authentication app
"""
from django.urls import path
from apps.authentication.views import LoginView, RegisterView, RefreshView

urlpatterns = [
    path('register', RegisterView.as_view(), name='register'),
    path('login', LoginView.as_view(), name='login'),
    path('refresh', RefreshView.as_view(), name='refresh'),
]
