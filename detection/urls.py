from django.urls import path, re_path
from . import views
from . import consumers

urlpatterns = [
    path('', views.landing, name='landing'),
    path('alerts-page/', views.alerts, name='alerts'),
    path('live-feed/', views.live_feed, name='live_feed'),
    path('process-emotion/', views.process_emotion_data, name='process_emotion'),
]

websocket_urlpatterns = [
    re_path(r'ws/alerts/$', consumers.AlertConsumer.as_asgi()),
]