from django.db import models

class Alert(models.Model):
    ALERT_TYPES = [
        ('fighting', 'Fighting'),
        ('vandalism', 'Vandalism'),
        ('assault', 'Assault'),
        ('camera_interference', 'Camera Interference'),
        ('suspicious_behavior', 'Suspicious Behavior')
    ]
    
    message = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(upload_to='alerts/', null=True, blank=True)
    severity = models.CharField(max_length=50)
    alert_type = models.CharField(max_length=50, choices=ALERT_TYPES, null=True)
    metrics = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.alert_type}: {self.message}"

class CameraLog(models.Model):
    camera_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    emotion_data = models.JSONField()
    violence_data = models.JSONField(default=dict)
    
    def __str__(self):
        return f"Camera {self.camera_id} at {self.timestamp}"