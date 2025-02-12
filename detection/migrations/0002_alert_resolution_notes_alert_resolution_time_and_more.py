# Generated by Django 5.1.5 on 2025-02-09 17:35

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('detection', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='alert',
            name='resolution_notes',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='alert',
            name='resolution_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='alert',
            name='resolved',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='cameralog',
            name='alert_triggered',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='cameralog',
            name='camera_coverage_percentage',
            field=models.FloatField(default=0.0),
        ),
        migrations.AddField(
            model_name='cameralog',
            name='camera_status',
            field=models.CharField(default='active', max_length=50),
        ),
        migrations.AddField(
            model_name='cameralog',
            name='sustained_movement_duration',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='alert',
            name='alert_type',
            field=models.CharField(choices=[('fighting', 'Fighting'), ('vandalism', 'Vandalism'), ('assault', 'Assault'), ('camera_interference', 'Camera Interference'), ('suspicious_behavior', 'Suspicious Behavior'), ('sustained_movement', 'Sustained Movement'), ('camera_covered', 'Camera Covered'), ('complete_darkness', 'Complete Darkness'), ('emergency', 'Emergency')], default='suspicious_behavior', max_length=50),
        ),
    ]
