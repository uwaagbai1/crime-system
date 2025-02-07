document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById("videoFeed");
    const canvas = document.getElementById("detectionCanvas");
    let previousFrame = null;
    let darkFrameCount = 0;
    let lastImageData = null;
    let movements = [];
    let movementHistory = [];
    
    let blockingStartTime = null;
    let blockingAlertSent = false;
    const BLOCKING_THRESHOLD_MS = 7000;
    const MOVEMENT_HISTORY_DURATION = 2000;
    const ALERT_THRESHOLD = 0.6;
    const ALERT_COOLDOWN = 10000;
    let lastAlertTime = 0;
    
    const VIOLENCE_THRESHOLDS = {
        PROXIMITY: 150,
        QUICK_MOVEMENT: 0.4,
        ANGER: 0.5,
        FIGHTING: 0.6,
        ALERT: 0.7
    };
    
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
        vandalism: 0,
        assault: 0
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
        
        const previousCoverageLevel = currentMetrics.cameraCovered;
        currentMetrics.cameraCovered = darkPixelRatio > 0.85 ? 1 : 
                                     darkPixelRatio > 0.7 ? 0.8 :
                                     darkPixelRatio > 0.5 ? 0.5 : 0;
        
        if (currentMetrics.cameraCovered >= 0.85 && previousCoverageLevel < 0.85) {
            const now = Date.now();
            if (now - lastAlertTime > ALERT_COOLDOWN) {
                sendAlert(
                    'camera_covered',
                    'Warning: Camera has been covered or obstructed',
                    captureSnapshot()
                );
                lastAlertTime = now;
            }
        }
        
        const isCurrentlyBlocked = avgBrightness < 30;
        
        if (isCurrentlyBlocked) {
            if (!blockingStartTime) {
                blockingStartTime = Date.now();
            }
            
            const blockingDuration = Date.now() - blockingStartTime;
            currentMetrics.cameraBlocked = Math.min(blockingDuration / BLOCKING_THRESHOLD_MS, 1);
            
            if (blockingDuration >= BLOCKING_THRESHOLD_MS && !blockingAlertSent) {
                const snapshot = captureSnapshot();
                sendAlert(
                    'sustained_blocking',
                    'Camera has been blocked for an extended period',
                    snapshot
                );
                blockingAlertSent = true;
            }
        } else {
            blockingStartTime = null;
            blockingAlertSent = false;
            currentMetrics.cameraBlocked = Math.max(0, currentMetrics.cameraBlocked - 0.2);
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
        let totalDiff = 0;
        let significantChanges = 0;

        for (let i = 0; i < currentData.length; i += 16) {
            const diff = Math.abs(currentData[i] - lastData[i]) +
                        Math.abs(currentData[i + 1] - lastData[i + 1]) +
                        Math.abs(currentData[i + 2] - lastData[i + 2]);
            
            totalDiff += diff;
            if (diff > 100) significantChanges++;
        }

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

    function detectViolentBehavior(detections, ctx) {
        currentMetrics.fighting = 0;
        currentMetrics.vandalism = 0;
        currentMetrics.assault = 0;

        if (detections.length >= 2) {
            let maxFightingScore = 0;
            let maxAssaultScore = 0;

            for (let i = 0; i < detections.length; i++) {
                for (let j = i + 1; j < detections.length; j++) {
                    const face1 = detections[i].detection.box;
                    const face2 = detections[j].detection.box;
                    
                    const center1 = {
                        x: face1.x + face1.width / 2,
                        y: face1.y + face1.height / 2
                    };
                    const center2 = {
                        x: face2.x + face2.width / 2,
                        y: face2.y + face2.height / 2
                    };
                    
                    const distance = Math.sqrt(
                        Math.pow(center1.x - center2.x, 2) + 
                        Math.pow(center1.y - center2.y, 2)
                    );
                    
                    const anger1 = detections[i].expressions.angry;
                    const anger2 = detections[j].expressions.angry;
                    const fear1 = detections[i].expressions.fearful;
                    const fear2 = detections[j].expressions.fearful;
                    
                    const proximityFactor = Math.max(0, 1 - (distance / VIOLENCE_THRESHOLDS.PROXIMITY));
                    const emotionFactor = Math.max(anger1, anger2);
                    const movementFactor = currentMetrics.quickMovements;
                    
                    const fightingScore = (
                        proximityFactor * 0.4 +
                        emotionFactor * 0.4 +
                        movementFactor * 0.2
                    );
                    
                    maxFightingScore = Math.max(maxFightingScore, fightingScore);

                    const victimFear = Math.max(fear1, fear2);
                    const assaultScore = (
                        fightingScore * 0.6 +
                        victimFear * 0.4
                    );
                    
                    maxAssaultScore = Math.max(maxAssaultScore, assaultScore);

                    if (fightingScore > VIOLENCE_THRESHOLDS.FIGHTING) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(255, 0, 0, ${fightingScore})`;
                        ctx.lineWidth = 2;
                        ctx.moveTo(center1.x, center1.y);
                        ctx.lineTo(center2.x, center2.y);
                        ctx.stroke();
                    }
                }
            }

            currentMetrics.fighting = maxFightingScore;
            currentMetrics.assault = maxAssaultScore;

            if (maxFightingScore > VIOLENCE_THRESHOLDS.ALERT || maxAssaultScore > VIOLENCE_THRESHOLDS.ALERT) {
                const now = Date.now();
                if (now - lastAlertTime > ALERT_COOLDOWN) {
                    sendAlert('violence_detected', 'High levels of violent behavior detected', captureSnapshot());
                    lastAlertTime = now;
                }
            }
        }

        detectVandalism();
    }

    function detectVandalism() {
        const now = Date.now();
        movementHistory = movementHistory.filter(m => now - m.timestamp < MOVEMENT_HISTORY_DURATION);
        movementHistory.push({
            timestamp: now,
            intensity: currentMetrics.quickMovements
        });

        if (movementHistory.length > 5) {
            const recentMovements = movementHistory.slice(-5);
            const repetitiveMotion = recentMovements.filter(m => m.intensity > VIOLENCE_THRESHOLDS.QUICK_MOVEMENT).length >= 3;
            const sustainedMotion = (now - movementHistory[0].timestamp) > 1000;
            
            if (repetitiveMotion && sustainedMotion) {
                const vandalismScore = Math.min(
                    (currentMetrics.quickMovements * 0.7 +
                    currentMetrics.anger * 0.3) * 
                    (repetitiveMotion ? 1.5 : 1),
                    1
                );
                
                currentMetrics.vandalism = vandalismScore;

                if (vandalismScore > VIOLENCE_THRESHOLDS.ALERT) {
                    const now = Date.now();
                    if (now - lastAlertTime > ALERT_COOLDOWN) {
                        sendAlert('vandalism_detected', 'Potential vandalism activity detected', captureSnapshot());
                        lastAlertTime = now;
                    }
                }
            }
        }
    }

    function updateMetricsDisplay() {
        const emotionMetrics = document.getElementById('emotionMetrics');
        const envMetrics = document.getElementById('envMetrics');
        const interferenceMetrics = document.getElementById('interferenceMetrics');
        const violenceMetrics = document.getElementById('violenceMetrics');
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

        violenceMetrics.innerHTML = `
            <div class="d-flex justify-content-between">
                <span>Fighting:</span>
                <span>${(currentMetrics.fighting * 100).toFixed(1)}%</span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Vandalism:</span>
                <span>${(currentMetrics.vandalism * 100).toFixed(1)}%</span>
            </div>
            <div class="d-flex justify-content-between">
                <span>Assault:</span>
                <span>${(currentMetrics.assault * 100).toFixed(1)}%</span>
            </div>
        `;

        const likelihood = (
            currentMetrics.anger * 0.05 + 
            currentMetrics.fear * 0.05 + 
            currentMetrics.stress * 0.05 + 
            currentMetrics.sound * 0.05 + 
            currentMetrics.crowd * 0.05 +
            currentMetrics.cameraBlocked * 0.15 +
            currentMetrics.cameraCovered * 0.1 + 
            currentMetrics.quickMovements * 0.1 +
            currentMetrics.fighting * 0.2 +   
            currentMetrics.vandalism * 0.1 +
            currentMetrics.assault * 0.1      
        );

        crimeLikelihood.innerHTML = `${(likelihood * 100).toFixed(1)}%`;
        crimeLikelihood.className = `text-center fs-4 fw-bold ${
            likelihood > 0.6 ? 'text-danger' : 
            likelihood > 0.3 ? 'text-warning' : 
            'text-success'
        }`;

        checkHighRiskSituation(likelihood);
    }

    function checkHighRiskSituation(likelihood) {
        const now = Date.now();
        if (likelihood > ALERT_THRESHOLD && now - lastAlertTime > ALERT_COOLDOWN) {
            sendAlert('high_risk', 'High-risk situation detected - multiple indicators present', captureSnapshot());
            lastAlertTime = now;
        }
    }

    async function sendAlert(alertType, message, snapshot) {
        try {
            const alertData = {
                alert_type: alertType,
                message: message,
                metrics: currentMetrics,
                snapshot: snapshot,
                timestamp: new Date().toISOString()
            };

            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(alertData));
            }

            const response = await fetch('/process-alert/', {
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

            showLocalAlert(message);

        } catch (error) {
            console.error('Error sending alert:', error);
        }
    }

    function showLocalAlert(message) {
        const toastHTML = `
            <div class="toast show position-fixed top-0 end-0 m-3" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header bg-danger text-white">
                    <strong class="me-auto">Security Alert</strong>
                    <small>${new Date().toLocaleTimeString()}</small>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        const toastContainer = document.createElement('div');
        toastContainer.innerHTML = toastHTML;
        document.body.appendChild(toastContainer);
        
        setTimeout(() => {
            toastContainer.remove();
        }, 5000);
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
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = detectCameraInterference(ctx);
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
                
                detectViolentBehavior(detections, ctx);
            }
            
            updateMetricsDisplay();
            drawDetections(resizedDetections, ctx);
        }, 100);
    });

    function drawDetections(detections, ctx) {
        detections.forEach(detection => {
            const box = detection.detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, {
                label: `Face (Anger: ${(detection.expressions.angry * 100).toFixed(1)}%)`,
                lineWidth: 2,
                boxColor: detection.expressions.angry > VIOLENCE_THRESHOLDS.ANGER ? 'red' : 'green',
            });
            drawBox.draw(canvas);
        });
        
        faceapi.draw.drawFaceLandmarks(canvas, detections);
        faceapi.draw.drawFaceExpressions(canvas, detections);
    }

    const socket = new WebSocket("ws://127.0.0.1:8000/ws/alerts/");
    
    socket.onopen = function() {
        console.log("WebSocket connection established");
    };
    
    socket.onerror = function(error) {
        console.error("WebSocket error:", error);
    };
    
    socket.onclose = function() {
        console.log("WebSocket connection closed");
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    };

    loadModels();
});