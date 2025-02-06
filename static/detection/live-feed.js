document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById("videoFeed");
    const canvas = document.getElementById("detectionCanvas");
    let previousFrame = null;
    let darkFrameCount = 0;
    let lastImageData = null;
    let movements = [];
    
    let blockingStartTime = null;
    let blockingAlertSent = false;
    const BLOCKING_THRESHOLD_MS = 7000;
    
    let currentMetrics = {
        anger: 0,
        fear: 0,
        stress: 0,
        sound: 0,
        crowd: 0,
        cameraBlocked: 0,
        cameraCovered: 0,
        quickMovements: 0
    };

    async function loadModels() {
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/static/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/static/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/static/models'),
                faceapi.nets.faceExpressionNet.loadFromUri('/static/models')
            ]);
            startVideo();
        } catch (err) {
            console.error("Error loading models:", err);
        }
    }

    function startVideo() {
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(stream => {
                video.srcObject = stream;
            })
            .catch(err => console.error("Error accessing webcam:", err));
    }

    function captureSnapshot() {
        const snapshotCanvas = document.createElement('canvas');
        snapshotCanvas.width = video.videoWidth;
        snapshotCanvas.height = video.videoHeight;
        const ctx = snapshotCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        return snapshotCanvas.toDataURL('image/jpeg', 0.8);
    }

    function detectCameraInterference(ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let totalBrightness = 0;
        let darkPixels = 0;
        
        for (let i = 0; i < data.length; i += 16) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            totalBrightness += brightness;
            if (brightness < 40) darkPixels++;
        }
        
        const avgBrightness = totalBrightness / (data.length / 16);
        const darkPixelRatio = (darkPixels / (data.length / 16)) * 4;
        
        currentMetrics.cameraCovered = darkPixelRatio > 0.85 ? 1 : 
                                     darkPixelRatio > 0.7 ? 0.8 :
                                     darkPixelRatio > 0.5 ? 0.5 : 0;
        
        const isCurrentlyBlocked = avgBrightness < 30;
        
        if (isCurrentlyBlocked) {
            if (!blockingStartTime) {
                blockingStartTime = Date.now();
            }
            
            const blockingDuration = Date.now() - blockingStartTime;
            currentMetrics.cameraBlocked = Math.min(blockingDuration / BLOCKING_THRESHOLD_MS, 1);
            
            if (blockingDuration >= BLOCKING_THRESHOLD_MS && !blockingAlertSent) {
                const snapshot = captureSnapshot();
                sendSustainedBlockingAlert(blockingDuration, snapshot);
                blockingAlertSent = true;
            }
        } else {
            blockingStartTime = null;
            blockingAlertSent = false;
            currentMetrics.cameraBlocked = Math.max(0, currentMetrics.cameraBlocked - 0.2);
        }

        return imageData;
    }

    async function sendSustainedBlockingAlert(duration, snapshot) {
        try {
            const response = await fetch('/process-emotion/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    ...currentMetrics,
                    alert_type: 'sustained_blocking',
                    blocking_duration: duration,
                    snapshot: snapshot,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();
            console.log('Alert sent successfully:', result);
        } catch (error) {
            console.error('Error sending blocking alert:', error);
        }
    }

    function detectQuickMovements(currentFrame, ctx) {
        if (!lastImageData) {
            lastImageData = currentFrame;
            return;
        }

        const currentData = currentFrame.data;
        const lastData = lastImageData.data;
        let totalDiff = 0;
        let significantChanges = 0;

        for (let i = 0; i < currentData.length; i += 16) {
            const diff = Math.abs(currentData[i] - lastData[i]) +
                        Math.abs(currentData[i + 1] - lastData[i + 1]) +
                        Math.abs(currentData[i + 2] - lastData[i + 2]);
            
            totalDiff += diff;
            if (diff > 100) {
                significantChanges++;
            }
        }

        const avgDiff = totalDiff / (currentData.length / 16);
        const changeRatio = significantChanges / (currentData.length / 16);

        movements.push({
            timestamp: Date.now(),
            intensity: changeRatio
        });

        const now = Date.now();
        movements = movements.filter(m => now - m.timestamp < 1000);

        const recentMovementAverage = movements.reduce((sum, m) => sum + m.intensity, 0) / movements.length;
        currentMetrics.quickMovements = Math.min(recentMovementAverage * 15, 1);

        if (currentMetrics.quickMovements > 0.3) {
            ctx.fillStyle = `rgba(255, 0, 0, ${currentMetrics.quickMovements * 0.3})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        lastImageData = currentFrame;
    }

    function updateMetricsDisplay() {
        const emotionMetrics = document.getElementById('emotionMetrics');
        const envMetrics = document.getElementById('envMetrics');
        const interferenceMetrics = document.getElementById('interferenceMetrics');
        const crimeLikelihood = document.getElementById('crimeLikelihood');

        emotionMetrics.innerHTML = `
            <div class="d-flex justify-content-between">
                <span>Anger:</span>
                <span>${(currentMetrics.anger * 100).toFixed(1)}%</span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Fear:</span>
                <span>${(currentMetrics.fear * 100).toFixed(1)}%</span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Stress:</span>
                <span>${(currentMetrics.stress * 100).toFixed(1)}%</span>
            </div>
        `;

        envMetrics.innerHTML = `
            <div class="d-flex justify-content-between">
                <span>Sound Level:</span>
                <span>${(currentMetrics.sound * 100).toFixed(1)}%</span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Crowd Density:</span>
                <span>${(currentMetrics.crowd * 100).toFixed(1)}%</span>
            </div>
        `;

        interferenceMetrics.innerHTML = `
            <div class="d-flex justify-content-between">
                <span>Camera Blocked:</span>
                <span>${(currentMetrics.cameraBlocked * 100).toFixed(1)}%</span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Camera Covered:</span>
                <span>${(currentMetrics.cameraCovered * 100).toFixed(1)}%</span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Quick Movements:</span>
                <span>${(currentMetrics.quickMovements * 100).toFixed(1)}%</span>
            </div>
        `;

        const likelihood = (
            currentMetrics.anger * 0.1 + 
            currentMetrics.fear * 0.1 + 
            currentMetrics.stress * 0.1 + 
            currentMetrics.sound * 0.05 + 
            currentMetrics.crowd * 0.05 +
            currentMetrics.cameraBlocked * 0.3 +
            currentMetrics.cameraCovered * 0.15 + 
            currentMetrics.quickMovements * 0.15
        );

        crimeLikelihood.innerHTML = `${(likelihood * 100).toFixed(1)}%`;
        crimeLikelihood.className = `text-center fs-4 fw-bold ${
            likelihood > 0.6 ? 'text-danger' : 
            likelihood > 0.3 ? 'text-warning' : 
            'text-success'
        }`;

        if (likelihood > 0.6) {
            sendDataToServer({
                ...currentMetrics,
                snapshot: captureSnapshot(),
                timestamp: new Date().toISOString()
            });
        }
    }

    async function sendDataToServer(data) {
        try {
            const response = await fetch('/process-emotion/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            console.log('Server response:', result);
        } catch (error) {
            console.error('Error sending data to server:', error);
        }
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    video.addEventListener('play', () => {
        const displaySize = { width: video.clientWidth, height: video.clientHeight };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = detectCameraInterference(ctx);
            detectQuickMovements(imageData, ctx);

            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            if (detections.length > 0) {
                currentMetrics = {
                    ...currentMetrics,
                    anger: detections[0].expressions.angry,
                    fear: detections[0].expressions.fearful,
                    stress: (detections[0].expressions.sad + detections[0].expressions.disgusted) / 2,
                    sound: Math.random(),
                    crowd: detections.length / 10
                };
            }
            
            updateMetricsDisplay();

            resizedDetections.forEach(detection => {
                const box = detection.detection.box;
                const drawBox = new faceapi.draw.DrawBox(box, {
                    label: 'Human Face',
                    lineWidth: 2,
                    boxColor: 'green',
                });
                drawBox.draw(canvas);
            });
            
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
        }, 100);
    });

    const socket = new WebSocket("ws://127.0.0.1:8000/ws/alerts/");
    
    socket.onopen = function () {
        console.log("WebSocket connection established.");
    };
    
    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        const toastHTML = `
            <div class="toast show position-fixed top-0 end-0 m-3" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header bg-danger text-white">
                    <strong class="me-auto">Alert</strong>
                    <small>${new Date().toLocaleTimeString()}</small>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${data.message}
                </div>
            </div>
        `;
        const toastContainer = document.createElement('div');
        toastContainer.innerHTML = toastHTML;
        document.body.appendChild(toastContainer);
        
        setTimeout(() => {
            toastContainer.remove();
        }, 5000);
    };
    
    socket.onerror = function (error) {
        console.error("WebSocket error:", error);
    };
    
    socket.onclose = function () {
        console.log("WebSocket connection closed.");
    };

    loadModels();
});