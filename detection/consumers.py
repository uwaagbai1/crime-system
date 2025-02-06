import json
from channels.generic.websocket import AsyncWebsocketConsumer

class AlertConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def send_alert(self, event):
        data = {
            'message': event['message'],
            'timestamp': event.get('timestamp'),
            'image_url': event.get('image_url')
        }
        await self.send(text_data=json.dumps(data))