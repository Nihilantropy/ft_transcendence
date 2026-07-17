"""
URL configuration for authentication app
"""
from django.urls import path
from apps.authentication.views import (
    LoginView, RegisterView, RefreshView, LogoutView, VerifyView, DeleteUserView,
    ChangePasswordView
)

urlpatterns = [
    path('register', RegisterView.as_view(), name='register'),
    path('login', LoginView.as_view(), name='login'),
    path('refresh', RefreshView.as_view(), name='refresh'),
    path('logout', LogoutView.as_view(), name='logout'),
    path('verify', VerifyView.as_view(), name='verify'),
    path('delete', DeleteUserView.as_view(), name='delete'),
    path('change-password', ChangePasswordView.as_view(), name='change-password'),
]
