from django.db import models
import os

def alert_image_path(instance, filename):
    base_name, extension = os.path.splitext(filename)
    timestamp = instance.timestamp.strftime('%Y%m%d_%H%M%S') if instance.timestamp else 'unknown'
    return os.path.join('alerts', f'alert_{timestamp}{extension}')

class Alert(models.Model):
    ALERT_TYPES = [
        ('fighting', 'Fighting'),
        ('vandalism', 'Vandalism'),
        ('assault', 'Assault'),
        ('camera_interference', 'Camera Interference'),
        ('suspicious_behavior', 'Suspicious Behavior'),
        ('sustained_movement', 'Sustained Movement'),
        ('camera_covered', 'Camera Covered'),
        ('complete_darkness', 'Complete Darkness'),
        ('emergency', 'Emergency')
    ]
    
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical')
    ]
    
    message = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(
        upload_to=alert_image_path,
        null=True,
        blank=True,
        max_length=255
    )
    severity = models.CharField(
        max_length=50,
        choices=SEVERITY_CHOICES,
        default='medium'
    )
    alert_type = models.CharField(
        max_length=50,
        choices=ALERT_TYPES,
        default='suspicious_behavior'
    )
    metrics = models.JSONField(default=dict)
    resolved = models.BooleanField(default=False)
    resolution_time = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.alert_type}: {self.message} ({self.severity})"

    def save(self, *args, **kwargs):
        if self.metrics is None:
            self.metrics = {}
        elif not isinstance(self.metrics, dict):
            try:
                self.metrics = dict(self.metrics)
            except (TypeError, ValueError):
                self.metrics = {}
        super().save(*args, **kwargs)

class CameraLog(models.Model):
    camera_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    emotion_data = models.JSONField(default=dict)
    violence_data = models.JSONField(default=dict)
    camera_status = models.CharField(max_length=50, default='active')
    sustained_movement_duration = models.IntegerField(default=0)
    camera_coverage_percentage = models.FloatField(default=0.0)
    alert_triggered = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if self.emotion_data is None:
            self.emotion_data = {}
        if self.violence_data is None:
            self.violence_data = {}
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Camera {self.camera_id} at {self.timestamp}"