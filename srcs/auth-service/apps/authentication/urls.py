"""
URL configuration for authentication app
"""
from django.urls import path
from apps.authentication.views import (
    LoginView, RegisterView, RefreshView, LogoutView, VerifyView, DeleteUserView,
    ChangePasswordView, UpdateProfileView, TwoFactorLoginView,
    TwoFactorSetupView, TwoFactorEnableView, TwoFactorDisableView
)

urlpatterns = [
    path('register', RegisterView.as_view(), name='register'),
    path('login', LoginView.as_view(), name='login'),
    path('login/2fa', TwoFactorLoginView.as_view(), name='login-2fa'),
    path('refresh', RefreshView.as_view(), name='refresh'),
    path('logout', LogoutView.as_view(), name='logout'),
    path('verify', VerifyView.as_view(), name='verify'),
    path('delete', DeleteUserView.as_view(), name='delete'),
    path('change-password', ChangePasswordView.as_view(), name='change-password'),
    path('me', UpdateProfileView.as_view(), name='update-profile'),
    path('2fa/setup', TwoFactorSetupView.as_view(), name='2fa-setup'),
    path('2fa/enable', TwoFactorEnableView.as_view(), name='2fa-enable'),
    path('2fa/disable', TwoFactorDisableView.as_view(), name='2fa-disable'),
]
