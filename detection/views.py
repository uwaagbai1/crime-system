import base64
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Alert, CameraLog
from .fuzzy_logic import evaluate_crime_likelihood
import datetime
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.core.files.base import ContentFile
import os
import json

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
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            alert_type = None
            alert_message = None

            if data.get('fighting', 0) > 0.6:
                alert_type = 'fighting'
                alert_message = 'Potential fighting detected'
            elif data.get('vandalism', 0) > 0.6:
                alert_type = 'vandalism'
                alert_message = 'Potential vandalism detected'
            elif data.get('assault', 0) > 0.6:
                alert_type = 'assault'
                alert_message = 'Potential assault detected'
            elif data.get('cameraBlocked', 0) > 0.8:
                alert_type = 'camera_interference'
                alert_message = 'Camera interference detected'

            if alert_type:
                try:
                    alert = Alert.objects.create(
                        message=alert_message,
                        severity='high',
                        alert_type=alert_type,
                        metrics=data
                    )

                    if 'snapshot' in data:
                        try:
                            image_data = data['snapshot']
                            if ',' in image_data:
                                image_data = image_data.split(',')[1]
                            
                            image_content = ContentFile(base64.b64decode(image_data))
                            alert.image.save(f'alert_{alert.id}.jpg', image_content)
                        except Exception as e:
                            print(f"Error processing image: {e}")

                    CameraLog.objects.create(
                        camera_id="Camera_1",
                        emotion_data={
                            'anger': data.get('anger', 0),
                            'fear': data.get('fear', 0),
                            'stress': data.get('stress', 0)
                        },
                        violence_data={
                            'fighting': data.get('fighting', 0),
                            'vandalism': data.get('vandalism', 0),
                            'assault': data.get('assault', 0)
                        }
                    )

                    channel_layer = get_channel_layer()
                    async_to_sync(channel_layer.group_send)(
                        "alerts",
                        {
                            'type': 'send_alert',
                            'message': alert_message,
                            'alert_type': alert_type,
                            'timestamp': alert.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                            'image_url': alert.image.url if alert.image else None,
                            'severity': alert.severity
                        }
                    )

                    return JsonResponse({
                        'status': 'success',
                        'alert_id': alert.id,
                        'message': alert_message
                    })

                except Exception as e:
                    return JsonResponse({
                        'status': 'error',
                        'message': f'Error creating alert: {str(e)}'
                    }, status=500)

            return JsonResponse({'status': 'success', 'message': 'No alert triggered'})

        except json.JSONDecodeError:
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid JSON data'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'status': 'error',
                'message': f'Unexpected error: {str(e)}'
            }, status=500)

    return JsonResponse({
        'status': 'error',
        'message': 'Invalid request method'
    }, status=405)