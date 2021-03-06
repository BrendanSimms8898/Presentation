from django.contrib.auth.decorators import login_required
from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.LoginView.as_view(), name="index"), # /app
    path('game/<host_game>', views.GameView.as_view(), name="game"),
    path('', views.LoginView.as_view(), name="index"), # /app
    path('game/<host_name>', views.GameView.as_view(), name="game"),
    path('profile/<profile_user>', login_required(views.ProfileView.as_view()), name="profile"),
    path('join/<user_name>', login_required(views.JoinView.as_view()), name="join"),
    path('register/', views.CaUserSignupView.as_view(), name='confirm'),

]
