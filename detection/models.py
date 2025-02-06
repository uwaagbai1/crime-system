from django.db import models

class Alert(models.Model):
    message = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    severity = models.CharField(max_length=50)

    def __str__(self):
        return self.message

class CameraLog(models.Model):
    camera_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    emotion_data = models.JSONField()

    def __str__(self):
        return f"Camera {self.camera_id} at {self.timestamp}"