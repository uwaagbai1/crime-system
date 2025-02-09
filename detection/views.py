import base64
import logging
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.base import ContentFile
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Alert, CameraLog
import json
import datetime

logger = logging.getLogger(__name__)

@login_required
def alerts(request):
    alerts = Alert.objects.all().order_by('-timestamp')
    return render(request, 'detection/alerts.html', {'alerts': alerts})

@login_required
def live_feed(request):
    return render(request, 'detection/live-feed.html')

@login_required
def landing(request):
    return render(request, 'detection/landing.html')

@csrf_exempt
def process_emotion_data(request):
    if request.method != 'POST':
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid request method'
        }, status=405)

    try:
        # Parse JSON data
        try:
            data = json.loads(request.body)
            logger.info(f"Received data: {data}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid JSON data'
            }, status=400)

        alert_type = data.get('alert_type', 'suspicious_behavior')
        alert_message = data.get('message', 'Unknown alert')
        severity = data.get('severity', 'medium')
        metrics = data.get('metrics', {})
        
        if not isinstance(metrics, dict):
            logger.error(f"Metrics is not a dictionary: {metrics}")
            metrics = {}

        try:
            alert = Alert.objects.create(
                message=alert_message,
                severity=severity,
                alert_type=alert_type,
                metrics=metrics,
                image=None
            )
            logger.info(f"Alert created: {alert.id}")

            violence_data = {
                'fighting': metrics.get('fighting', 0),
                'vandalism': metrics.get('vandalism', 0),
                'assault': metrics.get('assault', 0)
            }

            CameraLog.objects.create(
                camera_id='main',
                emotion_data=metrics,
                violence_data=violence_data
            )
            logger.info("CameraLog created successfully")

            ws_message = {
                'type': 'send_alert',
                'message': alert_message,
                'alert_type': alert_type,
                'timestamp': alert.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'image_url': None,
                'severity': severity
            }

            try:
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)("alerts", ws_message)
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")

            return JsonResponse({
                'status': 'success',
                'message': 'Alert processed successfully',
                'alert_id': alert.id
            })

        except Exception as e:
            logger.error(f"Database error: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': f'Database error occurred: {str(e)}'
            }, status=500)

    except Exception as e:
        logger.error(f"Unexpected error in process_emotion_data: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': 'Internal server error'
        }, status=500)