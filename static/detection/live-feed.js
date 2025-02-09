document.addEventListener('DOMContentLoaded', function () {
    const video = document.getElementById("videoFeed");
    const canvas = document.getElementById("detectionCanvas");
    let previousFrame = null;
    let movements = [];
    let lastImageData = null;
    let quickMovementStartTime = null;

    const THRESHOLDS = {
        CAMERA_COVERED: 0.85,
        CAMERA_BLOCKED: 0.75,
        QUICK_MOVEMENT: 0.4,
        ANGER: 0.5,
        FIGHTING: 0.6,
        ALERT: 0.7,
        ALERT_COOLDOWN: 5000,
        COMPLETE_DARKNESS: 0.98,
        SUSTAINED_MOVEMENT_DURATION: 7000
    };

    let lastAlertTime = 0;
    let consecutiveDarkFrames = 0;
    const DARK_FRAME_THRESHOLD = 3;

    let currentMetrics = {
        anger: 0,
        fear: 0,
        stress: 0,
        sound: 0,
        crowd: 0,
        cameraBlocked: 0,
        cameraCovered: 0,
        quickMovements: 0,
        fighting: 0,
        assault: 0,
        crimeLikelihoodModifier: 0,
        sustainedMovementDuration: 0
    };

    const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/alerts/`);

    socket.onopen = function() {
        console.log("WebSocket connection established");
    };

    socket.onerror = function(error) {
        console.error("WebSocket error:", error);
        showError("WebSocket connection error");
    };

    function showError(message, severity = 'danger') {
        const errorDisplay = document.createElement('div');
        errorDisplay.className = `alert alert-${severity} position-fixed top-0 start-50 translate-middle-x mt-3`;
        errorDisplay.style.zIndex = '1000';
        errorDisplay.textContent = message;
        document.body.appendChild(errorDisplay);
        setTimeout(() => errorDisplay.remove(), 5000);
    }

    function detectCameraInterference(ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let darkPixels = 0;
        let totalPixels = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (brightness < 30) darkPixels++;
        }

        const darkRatio = darkPixels / totalPixels;
        
        currentMetrics.cameraCovered = darkRatio;
        currentMetrics.cameraBlocked = darkRatio;

        if (darkRatio >= THRESHOLDS.COMPLETE_DARKNESS) {
            currentMetrics.crimeLikelihoodModifier = 1.0;
            sendAlert('camera_covered', 'CRITICAL: Camera completely covered - Emergency Response Required', 'critical');
            showError('EMERGENCY: Camera Feed Compromised', 'danger');
            return null;
        }
        
        if (darkRatio > THRESHOLDS.CAMERA_COVERED) {
            consecutiveDarkFrames++;
            if (consecutiveDarkFrames >= DARK_FRAME_THRESHOLD) {
                currentMetrics.crimeLikelihoodModifier = 0.6;
                sendAlert('camera_covered', 'CRITICAL: Camera has been covered - potential criminal activity', 'high');
            }
        } else if (darkRatio > THRESHOLDS.CAMERA_BLOCKED) {
            consecutiveDarkFrames++;
            if (consecutiveDarkFrames >= DARK_FRAME_THRESHOLD) {
                currentMetrics.crimeLikelihoodModifier = 0.3;
                sendAlert('camera_blocked', 'Warning: Camera has been blocked', 'medium');
            }
        } else {
            consecutiveDarkFrames = 0;
            currentMetrics.crimeLikelihoodModifier = Math.max(0, currentMetrics.crimeLikelihoodModifier - 0.1);
        }

        return imageData;
    }

    function detectQuickMovements(currentFrame, ctx) {
        if (!lastImageData) {
            lastImageData = currentFrame;
            return;
        }

        const currentData = currentFrame.data;
        const lastData = lastImageData.data;
        let significantChanges = 0;

        for (let i = 0; i < currentData.length; i += 16) {
            const diff = Math.abs(currentData[i] - lastData[i]) +
                        Math.abs(currentData[i + 1] - lastData[i + 1]) +
                        Math.abs(currentData[i + 2] - lastData[i + 2]);
            
            if (diff > 100) significantChanges++;
        }

        const changeRatio = significantChanges / (currentData.length / 16);
        currentMetrics.quickMovements = Math.min(changeRatio * 15, 1);

        if (currentMetrics.quickMovements >= 0.95) {
            if (!quickMovementStartTime) {
                quickMovementStartTime = Date.now();
            } else {
                const duration = Date.now() - quickMovementStartTime;
                currentMetrics.sustainedMovementDuration = duration;

                if (duration >= THRESHOLDS.SUSTAINED_MOVEMENT_DURATION) {
                    sendAlert(
                        'sustained_movement',
                        'ALERT: Sustained rapid movement detected - Possible violence or emergency',
                        'high'
                    );
                    quickMovementStartTime = null;
                }
            }
        } else {
            quickMovementStartTime = null;
            currentMetrics.sustainedMovementDuration = 0;
        }

        lastImageData = currentFrame;
    }

    function updateMetricsDisplay() {
        const emotionMetrics = document.getElementById('emotionMetrics');
        const envMetrics = document.getElementById('envMetrics');
        const interferenceMetrics = document.getElementById('interferenceMetrics');
        const violenceMetrics = document.getElementById('violenceMetrics');
        const crimeLikelihood = document.getElementById('crimeLikelihood');

        const getWarningClass = (value, threshold) => 
            value > threshold ? 'text-danger fw-bold' : '';

        emotionMetrics.innerHTML = `
            <div class="d-flex justify-content-between">
                <span>Anger:</span>
                <span class="${getWarningClass(currentMetrics.anger, THRESHOLDS.ANGER)}">
                    ${(currentMetrics.anger * 100).toFixed(1)}%
                </span>
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
            <div class="d-flex justify-content-between">
                <span>Sustained Movement:</span>
                <span class="${currentMetrics.sustainedMovementDuration > 5000 ? 'text-warning' : ''}">
                    ${(currentMetrics.sustainedMovementDuration / 1000).toFixed(1)}s
                </span>
            </div>
        `;

        interferenceMetrics.innerHTML = `
            <div class="d-flex justify-content-between">
                <span>Camera Blocked:</span>
                <span class="${getWarningClass(currentMetrics.cameraBlocked, THRESHOLDS.CAMERA_BLOCKED)}">
                    ${(currentMetrics.cameraBlocked * 100).toFixed(1)}%
                </span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Camera Covered:</span>
                <span class="${getWarningClass(currentMetrics.cameraCovered, THRESHOLDS.CAMERA_COVERED)}">
                    ${(currentMetrics.cameraCovered * 100).toFixed(1)}%
                </span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Quick Movements:</span>
                <span class="${currentMetrics.quickMovements > 0.95 ? 'text-danger fw-bold' : ''}">
                    ${(currentMetrics.quickMovements * 100).toFixed(1)}%
                </span>
            </div>
        `;

        violenceMetrics.innerHTML = `
            <div class="d-flex justify-content-between">
                <span>Fighting:</span>
                <span class="${getWarningClass(currentMetrics.fighting, THRESHOLDS.FIGHTING)}">
                    ${(currentMetrics.fighting * 100).toFixed(1)}%
                </span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Assault:</span>
                <span>${(currentMetrics.assault * 100).toFixed(1)}%</span>
            </div>
        `;

        const likelihood = calculateCrimeLikelihood();
        crimeLikelihood.innerHTML = `${(likelihood * 100).toFixed(1)}%`;
        crimeLikelihood.className = `text-center fs-4 fw-bold ${
            likelihood > 0.6 ? 'text-danger' : 
            likelihood > 0.3 ? 'text-warning' : 
            'text-success'
        }`;
    }

    function calculateCrimeLikelihood() {
        const baselikelihood = (
            currentMetrics.anger * 0.15 + 
            currentMetrics.fear * 0.15 + 
            currentMetrics.stress * 0.1 + 
            currentMetrics.sound * 0.05 + 
            currentMetrics.crowd * 0.05 +
            currentMetrics.cameraBlocked * 0.2 +
            currentMetrics.cameraCovered * 0.2 +
            currentMetrics.quickMovements * 0.1
        );

        return Math.min(1.0, baselikelihood + currentMetrics.crimeLikelihoodModifier);
    }

    async function sendAlert(alertType, message, severity) {
        const now = Date.now();
        if (now - lastAlertTime < THRESHOLDS.ALERT_COOLDOWN) {
            return;
        }
    
        try {
            const alertData = {
                alert_type: alertType,
                message: message,
                metrics: currentMetrics,
                severity: severity,
                timestamp: new Date().toISOString()
            };
    
            const response = await fetch('/process-emotion/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(alertData)
            });
    
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
    
            lastAlertTime = now;
            showLocalAlert(message, severity);
    
        } catch (error) {
            console.error('Error sending alert:', error);
            showError('Failed to send alert');
        }
    }

    function showLocalAlert(message, severity) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${severity === 'critical' ? 'danger' : 'warning'} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        document.getElementById('toastContainer').appendChild(alertDiv);
        
        if (severity === 'critical') {
            const audio = new Audio('/static/detection/alert.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
        }
        
        setTimeout(() => alertDiv.remove(), severity === 'critical' ? 10000 : 5000);
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
            showError("Error loading face detection models");
        }
    }

    function startVideo() {
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(stream => {
                video.srcObject = stream;
            })
            .catch(err => {
                console.error("Error accessing webcam:", err);
                showError("Error accessing webcam");
            });
    }

    video.addEventListener('play', () => {
        const displaySize = { width: video.clientWidth, height: video.clientHeight };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = detectCameraInterference(ctx);
            if (!imageData) {
                return;
            }
            
            detectQuickMovements(imageData, ctx);

            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            if (detections.length > 0) {
                const avgAnger = detections.reduce((sum, det) => sum + det.expressions.angry, 0) / detections.length;
                const avgFear = detections.reduce((sum, det) => sum + det.expressions.fearful, 0) / detections.length;
                const avgStress = detections.reduce((sum, det) => 
                    sum + (det.expressions.sad + det.expressions.disgusted) / 2, 0
                ) / detections.length;

                currentMetrics = {
                    ...currentMetrics,
                    anger: avgAnger,
                    fear: avgFear,
                    stress: avgStress,
                    crowd: detections.length / 10
                };
            }
            
            updateMetricsDisplay();
            drawDetections(resizedDetections, ctx);
        }, 100);
    });

    loadModels();
});