from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from .models import Alert, CameraLog
from .fuzzy_logic import evaluate_crime_likelihood
import datetime
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.core.files.base import ContentFile
import os

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

def process_emotion_data(request):
    if request.method == 'POST':
        anger_score = float(request.POST.get('anger_score', 0))
        fear_score = float(request.POST.get('fear_score', 0))
        stress_score = float(request.POST.get('stress_score', 0))
        sound_intensity = float(request.POST.get('sound_intensity', 0))
        crowd_density = float(request.POST.get('crowd_density', 0))
        
        time_of_day = datetime.datetime.now().hour
        likelihood = evaluate_crime_likelihood(
            anger_score, fear_score, stress_score,
            sound_intensity, crowd_density, time_of_day
        )
        
        snapshot = request.FILES.get('snapshot')
        snapshot_path = None
        
        if snapshot:
            snapshot_dir = os.path.join('media', 'crime_snapshots')
            os.makedirs(snapshot_dir, exist_ok=True)
            
            filename = f"snapshot_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            snapshot_path = os.path.join(snapshot_dir, filename)
            
            # Save the file
            with open(snapshot_path, 'wb+') as destination:
                for chunk in snapshot.chunks():
                    destination.write(chunk)
        
        alert_message = "Camera blocking detected" if 'blocking_duration' in request.POST else f"High crime likelihood detected: {likelihood:.2f}"
        
        alert = Alert.objects.create(
            message=alert_message,
            severity="high",
            image=snapshot_path if snapshot_path else None
        )
        
        CameraLog.objects.create(
            camera_id="Camera_1",
            emotion_data={
                "anger": anger_score,
                "fear": fear_score,
                "stress": stress_score
            },
            sound_intensity=sound_intensity,
            crowd_density=crowd_density
        )
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'alerts',
            {
                'type': 'send_alert',
                'message': alert_message,
                'timestamp': alert.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'image_url': snapshot_path if snapshot_path else None
            }
        )
        
        return JsonResponse({'status': 'success', 'likelihood': likelihood})
    
    return JsonResponse({'status': 'error'}, status=400)