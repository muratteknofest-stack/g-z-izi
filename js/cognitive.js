/* ============================================
   GÖZ-İZİ - Bilişsel Analiz Motoru (cognitive.js)
   Raspberry Pi NoIR + IR LED Edition
   
   MediaPipe Face Mesh kullanarak:
   1. Pupillometri (Göz bebeği çapı → Bilişsel yük)
   2. Göz Kırpma Frekansı (Blink Rate → Yorgunluk/DEHB)
   3. Baş Pozisyonu (Head Pose → Kaçınma davranışı)
   4. Mikro-İfade Analizi (Duygu durumu tespiti)
   ============================================ */

const Cognitive = {
    // ── State ──
    faceMesh: null,
    isReady: false,
    isProcessing: false,
    videoElement: null,
    analysisInterval: null,

    // ── Data Logs ──
    pupilLog: [],        // { time, leftDiameter, rightDiameter, avgDiameter }
    blinkLog: [],        // { time, blinked }
    headPoseLog: [],     // { time, yaw, pitch, roll }
    expressionLog: [],   // { time, emotion, confidence }

    // ── Live Metrics ──
    live: {
        pupilDiameter: 0,
        pupilChange: 0,       // % change from baseline
        blinkCount: 0,
        blinkRate: 0,          // blinks per minute
        lastBlinkTime: 0,
        eyeOpenness: 1,
        headYaw: 0,
        headPitch: 0,
        headRoll: 0,
        isLookingAway: false,
        avoidanceCount: 0,
        emotion: 'nötr',
        emotionConfidence: 0,
        stressLevel: 0,        // 0-100
        cognitiveLoad: 0,      // 0-100
        fatigueLevel: 0        // 0-100
    },

    // ── Baselines (set during first 3 seconds) ──
    baseline: {
        pupilDiameter: 0,
        samples: [],
        isCalibrated: false
    },

    // ── Blink Detection State ──
    _blinkState: {
        wasEyeClosed: false,
        closedFrames: 0,
        EAR_THRESHOLD: 0.21,   // Eye Aspect Ratio threshold for blink
        MIN_CLOSED_FRAMES: 2
    },

    // ── MediaPipe Face Mesh Landmark Indices ──
    // Left eye landmarks
    LEFT_EYE: {
        upper: [159, 145, 160, 161, 158, 157, 173],
        lower: [144, 153, 154, 155, 133, 163, 7],
        outer: 33,
        inner: 133,
        top: 159,
        bottom: 145,
        iris: [468, 469, 470, 471, 472]  // Iris landmarks (if available)
    },

    // Right eye landmarks
    RIGHT_EYE: {
        upper: [386, 374, 387, 388, 385, 384, 398],
        lower: [373, 380, 381, 382, 362, 390, 249],
        outer: 263,
        inner: 362,
        top: 386,
        bottom: 374,
        iris: [473, 474, 475, 476, 477]  // Iris landmarks (if available)
    },

    // Face contour for head pose
    FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],

    // Key points for head pose estimation
    POSE_POINTS: {
        noseTip: 1,
        chin: 152,
        leftEyeOuter: 33,
        rightEyeOuter: 263,
        leftMouth: 61,
        rightMouth: 291
    },

    // Eyebrow landmarks for expression
    LEFT_EYEBROW: [70, 63, 105, 66, 107],
    RIGHT_EYEBROW: [300, 293, 334, 296, 336],

    // Mouth landmarks for expression
    MOUTH: {
        upper: 13,
        lower: 14,
        left: 61,
        right: 291,
        upperOuter: 0,
        lowerOuter: 17
    },

    /* ════════════════════════════════════════
       INITIALIZATION
       ════════════════════════════════════════ */

    async init() {
        try {
            // Load MediaPipe Face Mesh via CDN
            if (typeof FaceMesh === 'undefined') {
                console.warn('MediaPipe FaceMesh not loaded yet');
                return false;
            }

            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });

            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,   // Enable iris tracking!
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.faceMesh.onResults((results) => this.onFaceMeshResults(results));

            this.isReady = true;
            console.log('✅ Bilişsel Analiz Motoru hazır');
            return true;

        } catch (err) {
            console.error('Cognitive init error:', err);
            return false;
        }
    },

    /* ════════════════════════════════════════
       START / STOP ANALYSIS
       ════════════════════════════════════════ */

    startAnalysis(videoElement) {
        if (!this.isReady || !videoElement) return;

        this.videoElement = videoElement;
        this.resetLogs();

        // Start processing frames at ~10 FPS (lightweight)
        this.analysisInterval = setInterval(() => {
            if (!this.isProcessing && this.videoElement && this.videoElement.readyState >= 2) {
                this.processFrame();
            }
        }, 100);

        console.log('🧠 Bilişsel analiz başladı');
    },

    stopAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        this.isProcessing = false;
        console.log('🧠 Bilişsel analiz durduruldu');
    },

    resetLogs() {
        this.pupilLog = [];
        this.blinkLog = [];
        this.headPoseLog = [];
        this.expressionLog = [];
        this.live.blinkCount = 0;
        this.live.avoidanceCount = 0;
        this.baseline.isCalibrated = false;
        this.baseline.samples = [];
        this._blinkState.wasEyeClosed = false;
    },

    async processFrame() {
        if (!this.faceMesh || !this.videoElement) return;
        this.isProcessing = true;

        try {
            await this.faceMesh.send({ image: this.videoElement });
        } catch (e) {
            // Silently ignore frame processing errors
        }

        this.isProcessing = false;
    },

    /* ════════════════════════════════════════
       FACE MESH RESULTS CALLBACK
       ════════════════════════════════════════ */

    onFaceMeshResults(results) {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return;
        }

        const landmarks = results.multiFaceLandmarks[0];
        const time = performance.now();
        const w = this.videoElement.videoWidth || 640;
        const h = this.videoElement.videoHeight || 480;

        // ── 1. Pupillometry ──
        this.analyzePupil(landmarks, time, w, h);

        // ── 2. Blink Detection ──
        this.analyzeBlink(landmarks, time, w, h);

        // ── 3. Head Pose ──
        this.analyzeHeadPose(landmarks, time, w, h);

        // ── 4. Micro-Expressions ──
        this.analyzeExpression(landmarks, time, w, h);

        // ── Update composite scores ──
        this.updateCompositeScores(time);

        // ── Update HUD ──
        this.updateHUD();
    },

    /* ════════════════════════════════════════
       1. PUPILLOMETRY
       ════════════════════════════════════════ */

    analyzePupil(landmarks, time, w, h) {
        // Calculate iris diameter from iris landmarks (indices 468-477)
        const leftIris = this.LEFT_EYE.iris.map(i => landmarks[i]).filter(Boolean);
        const rightIris = this.RIGHT_EYE.iris.map(i => landmarks[i]).filter(Boolean);

        if (leftIris.length < 4 || rightIris.length < 4) return;

        // Iris diameter = distance between opposing iris points
        const leftDiameter = this.distance(leftIris[1], leftIris[3], w, h);
        const rightDiameter = this.distance(rightIris[1], rightIris[3], w, h);
        const avgDiameter = (leftDiameter + rightDiameter) / 2;

        // Calibrate baseline during first 3 seconds
        if (!this.baseline.isCalibrated) {
            this.baseline.samples.push(avgDiameter);
            if (this.baseline.samples.length >= 30) { // ~3 seconds at 10fps
                this.baseline.pupilDiameter = this.baseline.samples.reduce((a, b) => a + b, 0) / this.baseline.samples.length;
                this.baseline.isCalibrated = true;
                console.log('📏 Pupil baseline:', this.baseline.pupilDiameter.toFixed(2));
            }
        }

        // Calculate change from baseline
        let change = 0;
        if (this.baseline.isCalibrated && this.baseline.pupilDiameter > 0) {
            change = ((avgDiameter - this.baseline.pupilDiameter) / this.baseline.pupilDiameter) * 100;
        }

        this.live.pupilDiameter = avgDiameter;
        this.live.pupilChange = change;

        this.pupilLog.push({
            time,
            leftDiameter,
            rightDiameter,
            avgDiameter,
            change
        });
    },

    /* ════════════════════════════════════════
       2. BLINK DETECTION
       ════════════════════════════════════════ */

    analyzeBlink(landmarks, time, w, h) {
        // Eye Aspect Ratio (EAR)
        const leftEAR = this.calculateEAR(landmarks, this.LEFT_EYE, w, h);
        const rightEAR = this.calculateEAR(landmarks, this.RIGHT_EYE, w, h);
        const avgEAR = (leftEAR + rightEAR) / 2;

        this.live.eyeOpenness = Math.min(1, avgEAR / 0.3);

        const isClosed = avgEAR < this._blinkState.EAR_THRESHOLD;

        if (isClosed) {
            this._blinkState.closedFrames++;
        } else {
            if (this._blinkState.wasEyeClosed && this._blinkState.closedFrames >= this._blinkState.MIN_CLOSED_FRAMES) {
                // Blink detected!
                this.live.blinkCount++;
                this.live.lastBlinkTime = time;

                this.blinkLog.push({ time, blinked: true });
            }
            this._blinkState.closedFrames = 0;
        }

        this._blinkState.wasEyeClosed = isClosed;

        // Calculate blinks per minute
        const elapsed = this.pupilLog.length > 0 ?
            (time - this.pupilLog[0].time) / 60000 : 0;
        this.live.blinkRate = elapsed > 0.1 ? Math.round(this.live.blinkCount / elapsed) : 0;
    },

    calculateEAR(landmarks, eyeIndices, w, h) {
        // EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
        const top = landmarks[eyeIndices.top];
        const bottom = landmarks[eyeIndices.bottom];
        const outer = landmarks[eyeIndices.outer];
        const inner = landmarks[eyeIndices.inner];

        if (!top || !bottom || !outer || !inner) return 0.3;

        const vertical = this.distance(top, bottom, w, h);
        const horizontal = this.distance(outer, inner, w, h);

        return horizontal > 0 ? vertical / horizontal : 0.3;
    },

    /* ════════════════════════════════════════
       3. HEAD POSE ESTIMATION
       ════════════════════════════════════════ */

    analyzeHeadPose(landmarks, time, w, h) {
        const pp = this.POSE_POINTS;

        const nose = landmarks[pp.noseTip];
        const chin = landmarks[pp.chin];
        const leftEye = landmarks[pp.leftEyeOuter];
        const rightEye = landmarks[pp.rightEyeOuter];
        const leftMouth = landmarks[pp.leftMouth];
        const rightMouth = landmarks[pp.rightMouth];

        if (!nose || !chin || !leftEye || !rightEye) return;

        // Simplified head pose from landmark geometry
        // Yaw (left-right rotation)
        const eyeMidX = (leftEye.x + rightEye.x) / 2;
        const yaw = (nose.x - eyeMidX) * 180 * 2; // Approximate degrees

        // Pitch (up-down rotation)
        const eyeMidY = (leftEye.y + rightEye.y) / 2;
        const faceHeight = Math.abs(chin.y - eyeMidY);
        const noseRelative = (nose.y - eyeMidY) / (faceHeight || 0.1);
        const pitch = (noseRelative - 0.4) * 180; // Approximate degrees

        // Roll (head tilt)
        const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

        this.live.headYaw = yaw;
        this.live.headPitch = pitch;
        this.live.headRoll = roll;

        // Detect avoidance behavior (looking away)
        const wasLookingAway = this.live.isLookingAway;
        this.live.isLookingAway = Math.abs(yaw) > 25 || Math.abs(pitch) > 20;

        if (this.live.isLookingAway && !wasLookingAway) {
            this.live.avoidanceCount++;
        }

        this.headPoseLog.push({
            time,
            yaw: Math.round(yaw * 10) / 10,
            pitch: Math.round(pitch * 10) / 10,
            roll: Math.round(roll * 10) / 10,
            isLookingAway: this.live.isLookingAway
        });
    },

    /* ════════════════════════════════════════
       4. MICRO-EXPRESSION ANALYSIS
       ════════════════════════════════════════ */

    analyzeExpression(landmarks, time, w, h) {
        // Analyze facial features for emotion detection

        // Eyebrow raise (surprise/confusion)
        const leftBrowHeight = this.getAvgY(landmarks, this.LEFT_EYEBROW);
        const leftEyeHeight = landmarks[this.LEFT_EYE.top].y;
        const browRaise = (leftEyeHeight - leftBrowHeight) * h;

        // Mouth openness (surprise)
        const mouthUpper = landmarks[this.MOUTH.upper];
        const mouthLower = landmarks[this.MOUTH.lower];
        const mouthOpen = this.distance(mouthUpper, mouthLower, w, h);

        // Mouth width (smile)
        const mouthLeft = landmarks[this.MOUTH.left];
        const mouthRight = landmarks[this.MOUTH.right];
        const mouthWidth = this.distance(mouthLeft, mouthRight, w, h);

        // Lip corner height relative to mouth center (smile detection)
        const mouthCenterY = (mouthUpper.y + mouthLower.y) / 2;
        const lipCornerAvgY = (mouthLeft.y + mouthRight.y) / 2;
        const smileScore = (mouthCenterY - lipCornerAvgY) * h;

        // Eyebrow squeeze (anger/frustration)
        const leftBrowInner = landmarks[this.LEFT_EYEBROW[4]]; // inner
        const rightBrowInner = landmarks[this.RIGHT_EYEBROW[4]]; // inner
        const browSqueeze = rightBrowInner && leftBrowInner ?
            this.distance(leftBrowInner, rightBrowInner, w, h) : 50;

        // Determine emotion
        let emotion = 'nötr';
        let confidence = 0.5;

        if (browRaise > 25 && mouthOpen > 15) {
            emotion = 'şaşkın';
            confidence = Math.min(0.9, (browRaise / 40 + mouthOpen / 20) / 2);
        } else if (smileScore > 3) {
            emotion = 'mutlu';
            confidence = Math.min(0.9, smileScore / 8);
        } else if (browSqueeze < 25 && browRaise < 15) {
            emotion = 'sinirli/kaşları çatık';
            confidence = Math.min(0.8, (30 - browSqueeze) / 20);
        } else if (lipCornerAvgY > mouthCenterY + 0.005) {
            emotion = 'üzgün/zorlanan';
            confidence = 0.5;
        } else {
            emotion = 'nötr';
            confidence = 0.6;
        }

        this.live.emotion = emotion;
        this.live.emotionConfidence = Math.round(confidence * 100);

        this.expressionLog.push({
            time,
            emotion,
            confidence: Math.round(confidence * 100),
            browRaise: Math.round(browRaise),
            mouthOpen: Math.round(mouthOpen),
            smileScore: Math.round(smileScore * 10) / 10
        });
    },

    /* ════════════════════════════════════════
       COMPOSITE SCORES
       ════════════════════════════════════════ */

    updateCompositeScores(time) {
        // Cognitive Load (based on pupil dilation)
        if (this.baseline.isCalibrated) {
            const pupilChange = Math.abs(this.live.pupilChange);
            this.live.cognitiveLoad = Math.min(100, Math.round(pupilChange * 5));
        }

        // Stress Level (pupil dilation + blink rate + expression)
        let stress = 0;
        if (this.live.pupilChange > 10) stress += 30;
        if (this.live.blinkRate > 25) stress += 25;
        if (this.live.blinkRate < 8 && this.live.blinkRate > 0) stress += 15;
        if (this.live.emotion === 'sinirli/kaşları çatık') stress += 20;
        if (this.live.isLookingAway) stress += 15;
        this.live.stressLevel = Math.min(100, stress);

        // Fatigue Level (based on blink rate decrease and eye openness)
        let fatigue = 0;
        if (this.live.blinkRate < 10 && this.live.blinkRate > 0) fatigue += 30;
        if (this.live.eyeOpenness < 0.6) fatigue += 40;
        if (this.live.eyeOpenness < 0.4) fatigue += 30;
        this.live.fatigueLevel = Math.min(100, fatigue);
    },

    /* ════════════════════════════════════════
       HUD UPDATE
       ════════════════════════════════════════ */

    updateHUD() {
        // Update cognitive metrics in the HUD
        const pupilEl = document.getElementById('hudPupil');
        const blinkEl = document.getElementById('hudBlink');
        const headEl = document.getElementById('hudHead');
        const emotionEl = document.getElementById('hudEmotion');

        if (pupilEl) {
            const change = this.live.pupilChange;
            const arrow = change > 5 ? '▲' : change < -5 ? '▼' : '●';
            const cls = change > 10 ? 'high' : change > 5 ? 'med' : 'low';
            pupilEl.textContent = `${arrow} ${Math.abs(change).toFixed(0)}%`;
            pupilEl.className = `hud-cognitive-value ${cls}`;
        }

        if (blinkEl) {
            blinkEl.textContent = `${this.live.blinkRate}/dk`;
            const cls = this.live.blinkRate > 25 || (this.live.blinkRate < 8 && this.live.blinkRate > 0) ? 'high' : 'low';
            blinkEl.className = `hud-cognitive-value ${cls}`;
        }

        if (headEl) {
            headEl.textContent = this.live.isLookingAway ? '⚠ Kaçınma' : '✓ Odakta';
            headEl.className = `hud-cognitive-value ${this.live.isLookingAway ? 'high' : 'low'}`;
        }

        if (emotionEl) {
            emotionEl.textContent = this.live.emotion;
        }
    },

    /* ════════════════════════════════════════
       FINAL ANALYSIS (called when test ends)
       ════════════════════════════════════════ */

    getTestResults() {
        const duration = this.pupilLog.length > 0 ?
            (this.pupilLog[this.pupilLog.length - 1].time - this.pupilLog[0].time) / 1000 : 0;

        // Pupillometry stats
        const pupilChanges = this.pupilLog.map(p => p.change).filter(c => c !== 0);
        const avgPupilChange = pupilChanges.length > 0 ?
            pupilChanges.reduce((a, b) => a + b, 0) / pupilChanges.length : 0;
        const maxPupilDilation = pupilChanges.length > 0 ?
            Math.max(...pupilChanges) : 0;

        // Cognitive load spikes (>15% dilation for >0.5s)
        let cognitiveSpikes = 0;
        let spikeActive = false;
        this.pupilLog.forEach(p => {
            if (p.change > 15 && !spikeActive) {
                cognitiveSpikes++;
                spikeActive = true;
            } else if (p.change <= 10) {
                spikeActive = false;
            }
        });

        // Head pose avoidance total time
        const avoidanceTime = this.headPoseLog.filter(h => h.isLookingAway).length * 0.1; // seconds

        // Expression distribution
        const emotionCounts = {};
        this.expressionLog.forEach(e => {
            emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
        });
        const dominantEmotion = Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            duration: Math.round(duration),
            pupillometry: {
                baselineDiameter: Math.round(this.baseline.pupilDiameter * 100) / 100,
                avgChange: Math.round(avgPupilChange * 10) / 10,
                maxDilation: Math.round(maxPupilDilation * 10) / 10,
                cognitiveSpikes,
                cognitiveLoadAvg: Math.round(pupilChanges.length > 0 ?
                    (pupilChanges.map(c => Math.min(100, Math.abs(c) * 5))
                        .reduce((a, b) => a + b, 0) / pupilChanges.length) : 0)
            },
            blinkAnalysis: {
                totalBlinks: this.live.blinkCount,
                blinkRate: this.live.blinkRate,
                isNormal: this.live.blinkRate >= 8 && this.live.blinkRate <= 25,
                assessment: this.live.blinkRate < 8 ? 'Düşük (Aşırı odaklanma/ekran yorgunluğu)' :
                    this.live.blinkRate > 25 ? 'Yüksek (Stres/dikkat kaybı)' : 'Normal'
            },
            headPose: {
                avoidanceCount: this.live.avoidanceCount,
                avoidanceTime: Math.round(avoidanceTime * 10) / 10,
                avoidancePercent: duration > 0 ?
                    Math.round((avoidanceTime / duration) * 100) : 0
            },
            expression: {
                dominant: dominantEmotion ? dominantEmotion[0] : 'nötr',
                distribution: emotionCounts,
                stressLevel: this.live.stressLevel,
                fatigueLevel: this.live.fatigueLevel
            },
            rawDataCounts: {
                pupilSamples: this.pupilLog.length,
                blinkEvents: this.blinkLog.length,
                headPoseSamples: this.headPoseLog.length,
                expressionSamples: this.expressionLog.length
            }
        };
    },

    /* ════════════════════════════════════════
       UTILITY FUNCTIONS
       ════════════════════════════════════════ */

    distance(p1, p2, w, h) {
        const dx = (p1.x - p2.x) * w;
        const dy = (p1.y - p2.y) * h;
        return Math.sqrt(dx * dx + dy * dy);
    },

    getAvgY(landmarks, indices) {
        let sum = 0;
        let count = 0;
        indices.forEach(i => {
            if (landmarks[i]) {
                sum += landmarks[i].y;
                count++;
            }
        });
        return count > 0 ? sum / count : 0;
    }
};
