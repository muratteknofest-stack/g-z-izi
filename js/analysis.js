/* ============================================
   GÖZ-İZİ - Gelişmiş Analiz Motoru (analysis.js)
   Bilimsel Düzey Göz Takip Analizi
   
   İçerik:
   1. Fixation (Sabitleme) Tespiti — I-DT Algoritması
   2. Saccade (Sıçrama) Analizi — Hız, Genlik, Latency
   3. Smooth Pursuit Kalitesi (Gain)
   4. Scanpath Analizi — Entropy, Uzunluk
   5. Zaman Serisi — Dikkat Düşüş Trendi
   6. Yaşa Göre Normalleştirme (4-18 yaş)
   7. Gelişmiş Skorlama
   ============================================ */

const Analysis = {
    results: {
        overall: 0,
        tests: {},
        assessment: '',
        assessmentLevel: '', // 'normal', 'warning', 'alert'
        fixations: {},       // per-test fixation data
        saccades: {},        // per-test saccade data
        pursuitQuality: {},  // per-test smooth pursuit
        scanpath: {},        // per-test scanpath
        timeSeries: {},      // per-test attention over time
        ageNorms: null       // age-based normalization
    },

    /* ── Yaşa Göre Normlar ── */
    AGE_NORMS: {
        // { focusThreshold, stabilityThreshold, reactionTimeNorm, fixationDurationNorm, saccadeAmplitudeNorm }
        '4': { focus: 45, stability: 40, reactionTime: 600, fixDuration: 180, saccadeAmp: 6, blinkRate: [8, 20] },
        '5': { focus: 50, stability: 45, reactionTime: 550, fixDuration: 200, saccadeAmp: 5.5, blinkRate: [10, 22] },
        '6': { focus: 55, stability: 50, reactionTime: 500, fixDuration: 220, saccadeAmp: 5, blinkRate: [10, 22] },
        '7': { focus: 58, stability: 52, reactionTime: 480, fixDuration: 230, saccadeAmp: 4.8, blinkRate: [12, 22] },
        '8': { focus: 60, stability: 55, reactionTime: 450, fixDuration: 240, saccadeAmp: 4.5, blinkRate: [12, 22] },
        '9': { focus: 63, stability: 58, reactionTime: 420, fixDuration: 250, saccadeAmp: 4.2, blinkRate: [12, 24] },
        '10': { focus: 65, stability: 60, reactionTime: 400, fixDuration: 260, saccadeAmp: 4, blinkRate: [14, 24] },
        '11': { focus: 68, stability: 62, reactionTime: 380, fixDuration: 270, saccadeAmp: 3.8, blinkRate: [14, 24] },
        '12': { focus: 70, stability: 65, reactionTime: 360, fixDuration: 280, saccadeAmp: 3.5, blinkRate: [15, 25] },
        '13': { focus: 72, stability: 67, reactionTime: 340, fixDuration: 290, saccadeAmp: 3.3, blinkRate: [15, 25] },
        '14': { focus: 74, stability: 70, reactionTime: 320, fixDuration: 300, saccadeAmp: 3, blinkRate: [15, 25] },
        '15': { focus: 75, stability: 72, reactionTime: 300, fixDuration: 310, saccadeAmp: 2.8, blinkRate: [15, 25] },
        '16': { focus: 76, stability: 73, reactionTime: 290, fixDuration: 310, saccadeAmp: 2.5, blinkRate: [15, 25] },
        '17': { focus: 77, stability: 74, reactionTime: 280, fixDuration: 320, saccadeAmp: 2.5, blinkRate: [15, 25] },
        '18': { focus: 78, stability: 75, reactionTime: 270, fixDuration: 320, saccadeAmp: 2.5, blinkRate: [15, 25] },
    },

    /* ════════════════════════════════════════
       ANA HESAPLAMA
       ════════════════════════════════════════ */

    calculateAll() {
        const testTypes = Object.keys(App.state.testResults);
        let totalScore = 0;
        let testCount = 0;

        // Get age norms
        const age = App.state.childAge || '8';
        this.results.ageNorms = this.AGE_NORMS[age] || this.AGE_NORMS['8'];

        testTypes.forEach(type => {
            const data = App.state.testResults[type];
            if (!data || !data.gazeData || data.gazeData.length === 0) return;

            // Core metrics
            const metrics = this.calculateTestMetrics(type, data);
            this.results.tests[type] = metrics;

            // Advanced: Fixation & Saccade
            const fixSac = this.detectFixationsAndSaccades(data.gazeData, data.canvasWidth, data.canvasHeight);
            this.results.fixations[type] = fixSac.fixations;
            this.results.saccades[type] = fixSac.saccades;
            metrics.fixationCount = fixSac.fixations.length;
            metrics.avgFixationDuration = fixSac.avgFixationDuration;
            metrics.saccadeCount = fixSac.saccades.length;
            metrics.avgSaccadeAmplitude = fixSac.avgSaccadeAmplitude;
            metrics.avgSaccadeVelocity = fixSac.avgSaccadeVelocity;

            // Advanced: Smooth Pursuit (star & ball only)
            if (type !== 'free' && data.targetData.length > 0) {
                const pursuit = this.calculatePursuitGain(data.gazeData, data.targetData, data.canvasWidth, data.canvasHeight);
                this.results.pursuitQuality[type] = pursuit;
                metrics.pursuitGain = pursuit.gain;
                metrics.pursuitRMSE = pursuit.rmse;
            }

            // Advanced: Scanpath
            const scanpath = this.analyzeScanpath(fixSac.fixations, data.canvasWidth, data.canvasHeight);
            this.results.scanpath[type] = scanpath;
            metrics.scanpathLength = scanpath.totalLength;
            metrics.scanpathEntropy = scanpath.entropy;

            // Advanced: Time Series
            const timeSeries = this.calculateTimeSeries(data.gazeData, data.targetData, type, data.duration, data.canvasWidth, data.canvasHeight);
            this.results.timeSeries[type] = timeSeries;
            metrics.attentionDecay = timeSeries.decayRate;

            // Age-normalized scoring
            metrics.ageNormalizedScore = this.calculateAgeNormalizedScore(metrics, type);

            totalScore += metrics.ageNormalizedScore;
            testCount++;
        });

        this.results.overall = testCount > 0 ? Math.round(totalScore / testCount) : 0;

        // Assessment with age context
        const norms = this.results.ageNorms;
        if (this.results.overall >= 70) {
            this.results.assessment = 'Normal';
            this.results.assessmentLevel = 'normal';
        } else if (this.results.overall >= 40) {
            this.results.assessment = 'Takip Gerekir';
            this.results.assessmentLevel = 'warning';
        } else {
            this.results.assessment = 'Uzman Değerlendirmesi Önerilir';
            this.results.assessmentLevel = 'alert';
        }
    },

    /* ════════════════════════════════════════
       TEMEL METRİKLER
       ════════════════════════════════════════ */

    calculateTestMetrics(testType, data) {
        const gaze = data.gazeData;
        const targets = data.targetData;
        const cw = data.canvasWidth || window.innerWidth;
        const ch = data.canvasHeight || window.innerHeight;
        const diagonal = Math.sqrt(cw * cw + ch * ch);

        // 1. Focus Score
        let focusScore = 100;
        if (testType !== 'free' && targets.length > 0) {
            let totalDeviation = 0;
            let matchCount = 0;

            gaze.forEach(g => {
                const closest = this.findClosestByTime(targets, g.time);
                if (closest) {
                    const dist = Math.sqrt((g.x - closest.x) ** 2 + (g.y - closest.y) ** 2);
                    totalDeviation += dist;
                    matchCount++;
                }
            });

            const avgDeviation = matchCount > 0 ? totalDeviation / matchCount : diagonal * 0.5;
            focusScore = Math.max(0, Math.min(100, 100 - (avgDeviation / (diagonal * 0.15)) * 100));
        } else if (testType === 'free') {
            focusScore = this.calculateDistribution(gaze, cw, ch);
        }

        // 2. Stability Score (jitter — direction change magnitude)
        let stabilityScore = 100;
        if (gaze.length > 2) {
            let totalJitter = 0;
            for (let i = 2; i < gaze.length; i++) {
                const dx1 = gaze[i].x - gaze[i - 1].x;
                const dy1 = gaze[i].y - gaze[i - 1].y;
                const dx2 = gaze[i - 1].x - gaze[i - 2].x;
                const dy2 = gaze[i - 1].y - gaze[i - 2].y;
                const jitter = Math.sqrt((dx1 - dx2) ** 2 + (dy1 - dy2) ** 2);
                totalJitter += jitter;
            }
            const avgJitter = totalJitter / (gaze.length - 2);
            stabilityScore = Math.max(0, Math.min(100, 100 - (avgJitter / 15) * 100));
        }

        // 3. Tracking Success
        let trackingSuccess = 100;
        if (testType !== 'free' && targets.length > 0) {
            const threshold = diagonal * 0.08;
            let withinCount = 0;
            gaze.forEach(g => {
                const closest = this.findClosestByTime(targets, g.time);
                if (closest) {
                    const dist = Math.sqrt((g.x - closest.x) ** 2 + (g.y - closest.y) ** 2);
                    if (dist <= threshold) withinCount++;
                }
            });
            trackingSuccess = gaze.length > 0 ? (withinCount / gaze.length) * 100 : 0;
        }

        // 4. Attention Loss Count
        let attentionLossCount = 0;
        if (testType !== 'free' && targets.length > 0) {
            const lossThreshold = diagonal * 0.12;
            let wasLost = false;
            gaze.forEach(g => {
                const closest = this.findClosestByTime(targets, g.time);
                if (closest) {
                    const dist = Math.sqrt((g.x - closest.x) ** 2 + (g.y - closest.y) ** 2);
                    if (dist > lossThreshold && !wasLost) {
                        attentionLossCount++;
                        wasLost = true;
                    } else if (dist <= lossThreshold) {
                        wasLost = false;
                    }
                }
            });
        }

        // 5. Reaction Time
        let avgReactionTime = 0;
        if (testType === 'ball' && targets.length > 0) {
            const reactionThreshold = diagonal * 0.1;
            let reactionTimes = [];
            let lostAt = null;

            gaze.forEach(g => {
                const closest = this.findClosestByTime(targets, g.time);
                if (closest) {
                    const dist = Math.sqrt((g.x - closest.x) ** 2 + (g.y - closest.y) ** 2);
                    if (dist > reactionThreshold && lostAt === null) {
                        lostAt = g.time;
                    } else if (dist <= reactionThreshold && lostAt !== null) {
                        reactionTimes.push(g.time - lostAt);
                        lostAt = null;
                    }
                }
            });

            if (reactionTimes.length > 0) {
                avgReactionTime = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
            }
        }

        // Overall test score (weighted)
        let overallScore;
        if (testType === 'free') {
            overallScore = Math.round(focusScore * 0.6 + stabilityScore * 0.4);
        } else {
            overallScore = Math.round(
                focusScore * 0.3 +
                stabilityScore * 0.25 +
                trackingSuccess * 0.3 +
                Math.max(0, 100 - attentionLossCount * 8) * 0.15
            );
        }

        return {
            focusScore: Math.round(focusScore),
            stabilityScore: Math.round(stabilityScore),
            trackingSuccess: Math.round(trackingSuccess),
            attentionLossCount,
            avgReactionTime: Math.round(avgReactionTime),
            overallScore,
            gazePointCount: gaze.length,
            // Placeholders for advanced metrics (filled later)
            fixationCount: 0,
            avgFixationDuration: 0,
            saccadeCount: 0,
            avgSaccadeAmplitude: 0,
            avgSaccadeVelocity: 0,
            pursuitGain: 0,
            pursuitRMSE: 0,
            scanpathLength: 0,
            scanpathEntropy: 0,
            attentionDecay: 0,
            ageNormalizedScore: overallScore
        };
    },

    /* ════════════════════════════════════════
       1. FIXATION & SACCADE DETECTION (I-DT)
       Dispersion-Threshold Identification
       ════════════════════════════════════════ */

    detectFixationsAndSaccades(gazeData, cw, ch) {
        const fixations = [];
        const saccades = [];

        if (gazeData.length < 5) {
            return { fixations, saccades, avgFixationDuration: 0, avgSaccadeAmplitude: 0, avgSaccadeVelocity: 0 };
        }

        const diagonal = Math.sqrt(cw * cw + ch * ch);
        const DISP_THRESHOLD = diagonal * 0.03;   // 3% of screen diagonal
        const MIN_FIXATION_MS = 100;               // minimum 100ms for a fixation

        let windowStart = 0;

        while (windowStart < gazeData.length) {
            let windowEnd = windowStart;

            // Expand window while dispersion is below threshold
            while (windowEnd < gazeData.length - 1) {
                windowEnd++;
                const windowPoints = gazeData.slice(windowStart, windowEnd + 1);
                const disp = this.calculateDispersion(windowPoints);

                if (disp > DISP_THRESHOLD) {
                    windowEnd--;
                    break;
                }
            }

            // Check if window meets minimum duration
            const duration = gazeData[windowEnd].time - gazeData[windowStart].time;

            if (duration >= MIN_FIXATION_MS && windowEnd > windowStart) {
                // This is a fixation
                const fixPoints = gazeData.slice(windowStart, windowEnd + 1);
                const cx = fixPoints.reduce((s, p) => s + p.x, 0) / fixPoints.length;
                const cy = fixPoints.reduce((s, p) => s + p.y, 0) / fixPoints.length;

                fixations.push({
                    x: cx,
                    y: cy,
                    startTime: gazeData[windowStart].time,
                    endTime: gazeData[windowEnd].time,
                    duration: duration,
                    pointCount: fixPoints.length,
                    dispersion: this.calculateDispersion(fixPoints)
                });

                windowStart = windowEnd + 1;
            } else {
                windowStart++;
            }
        }

        // Detect saccades between fixations
        for (let i = 1; i < fixations.length; i++) {
            const prev = fixations[i - 1];
            const curr = fixations[i];

            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const amplitude = Math.sqrt(dx * dx + dy * dy);
            const amplitudeDeg = (amplitude / diagonal) * 40; // approximate visual degrees
            const saccadeDuration = curr.startTime - prev.endTime;
            const velocity = saccadeDuration > 0 ? (amplitudeDeg / (saccadeDuration / 1000)) : 0;

            // Direction in degrees
            const direction = Math.atan2(dy, dx) * (180 / Math.PI);

            saccades.push({
                startTime: prev.endTime,
                endTime: curr.startTime,
                duration: saccadeDuration,
                amplitude: amplitude,
                amplitudeDeg: Math.round(amplitudeDeg * 10) / 10,
                velocity: Math.round(velocity),
                direction: Math.round(direction),
                fromX: prev.x, fromY: prev.y,
                toX: curr.x, toY: curr.y
            });
        }

        // Stats
        const avgFixDur = fixations.length > 0 ?
            fixations.reduce((s, f) => s + f.duration, 0) / fixations.length : 0;
        const avgSacAmp = saccades.length > 0 ?
            saccades.reduce((s, s2) => s + s2.amplitudeDeg, 0) / saccades.length : 0;
        const avgSacVel = saccades.length > 0 ?
            saccades.reduce((s, s2) => s + s2.velocity, 0) / saccades.length : 0;

        return {
            fixations,
            saccades,
            avgFixationDuration: Math.round(avgFixDur),
            avgSaccadeAmplitude: Math.round(avgSacAmp * 10) / 10,
            avgSaccadeVelocity: Math.round(avgSacVel)
        };
    },

    calculateDispersion(points) {
        if (points.length < 2) return 0;
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
    },

    /* ════════════════════════════════════════
       2. SMOOTH PURSUIT QUALITY (Gain + RMSE)
       Gain = eye velocity / target velocity
       ════════════════════════════════════════ */

    calculatePursuitGain(gazeData, targetData, cw, ch) {
        if (gazeData.length < 3 || targetData.length < 3) {
            return { gain: 0, rmse: 0, segments: [] };
        }

        const diagonal = Math.sqrt(cw * cw + ch * ch);
        let eyeVelocities = [];
        let targetVelocities = [];
        let positionErrors = [];
        const segments = [];

        // Sample every 5 frames
        for (let i = 2; i < gazeData.length; i += 3) {
            const g1 = gazeData[i - 2];
            const g2 = gazeData[i];

            const t1 = this.findClosestByTime(targetData, g1.time);
            const t2 = this.findClosestByTime(targetData, g2.time);
            if (!t1 || !t2) continue;

            const dt = (g2.time - g1.time) / 1000; // seconds
            if (dt <= 0) continue;

            // Eye velocity (px/s)
            const eyeSpeed = Math.sqrt((g2.x - g1.x) ** 2 + (g2.y - g1.y) ** 2) / dt;

            // Target velocity (px/s)
            const targetSpeed = Math.sqrt((t2.x - t1.x) ** 2 + (t2.y - t1.y) ** 2) / dt;

            if (targetSpeed > 5) { // Only count when target is moving
                eyeVelocities.push(eyeSpeed);
                targetVelocities.push(targetSpeed);

                // Position error at this instant
                const error = Math.sqrt((g2.x - t2.x) ** 2 + (g2.y - t2.y) ** 2);
                positionErrors.push(error);

                segments.push({
                    time: g2.time,
                    gain: targetSpeed > 0 ? eyeSpeed / targetSpeed : 0,
                    error: error
                });
            }
        }

        // Calculate Gain
        let gain = 0;
        if (targetVelocities.length > 0) {
            const avgEyeVel = eyeVelocities.reduce((a, b) => a + b, 0) / eyeVelocities.length;
            const avgTargetVel = targetVelocities.reduce((a, b) => a + b, 0) / targetVelocities.length;
            gain = avgTargetVel > 0 ? avgEyeVel / avgTargetVel : 0;
        }

        // Calculate RMSE
        let rmse = 0;
        if (positionErrors.length > 0) {
            const sumSq = positionErrors.reduce((s, e) => s + e * e, 0);
            rmse = Math.sqrt(sumSq / positionErrors.length);
        }

        return {
            gain: Math.round(gain * 100) / 100,
            rmse: Math.round(rmse * 10) / 10,
            rmsePct: Math.round((rmse / diagonal) * 10000) / 100, // % of screen
            segments,
            sampleCount: segments.length
        };
    },

    /* ════════════════════════════════════════
       3. SCANPATH ANALYSIS
       Toplam uzunluk + Spatial Entropy
       ════════════════════════════════════════ */

    analyzeScanpath(fixations, cw, ch) {
        if (fixations.length < 2) {
            return { totalLength: 0, entropy: 0, efficiency: 0, fixationDensity: [] };
        }

        // Total scanpath length
        let totalLength = 0;
        for (let i = 1; i < fixations.length; i++) {
            const dx = fixations[i].x - fixations[i - 1].x;
            const dy = fixations[i].y - fixations[i - 1].y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
        }

        // Spatial Entropy (8x6 grid)
        const gridCols = 8;
        const gridRows = 6;
        const grid = new Array(gridCols * gridRows).fill(0);
        const cellW = cw / gridCols;
        const cellH = ch / gridRows;

        fixations.forEach(f => {
            const col = Math.min(gridCols - 1, Math.max(0, Math.floor(f.x / cellW)));
            const row = Math.min(gridRows - 1, Math.max(0, Math.floor(f.y / cellH)));
            grid[row * gridCols + col] += f.duration; // weight by duration
        });

        const totalDuration = grid.reduce((s, v) => s + v, 0);
        let entropy = 0;
        if (totalDuration > 0) {
            grid.forEach(v => {
                if (v > 0) {
                    const p = v / totalDuration;
                    entropy -= p * Math.log2(p);
                }
            });
        }
        const maxEntropy = Math.log2(gridCols * gridRows);
        const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

        // Efficiency: direct path length / actual scanpath length
        const directDist = fixations.length >= 2 ?
            Math.sqrt((fixations[fixations.length - 1].x - fixations[0].x) ** 2 +
                (fixations[fixations.length - 1].y - fixations[0].y) ** 2) : 0;
        const efficiency = totalLength > 0 ? directDist / totalLength : 0;

        // Fixation density map (for visualization)
        const fixationDensity = grid.map((v, i) => ({
            row: Math.floor(i / gridCols),
            col: i % gridCols,
            duration: v
        })).filter(d => d.duration > 0);

        return {
            totalLength: Math.round(totalLength),
            entropy: Math.round(normalizedEntropy * 100) / 100,
            entropyRaw: Math.round(entropy * 100) / 100,
            maxEntropy: Math.round(maxEntropy * 100) / 100,
            efficiency: Math.round(efficiency * 100) / 100,
            fixationDensity,
            transitCount: fixations.length - 1
        };
    },

    /* ════════════════════════════════════════
       4. TIME SERIES — DİKKAT DÜŞÜŞ TRENDİ
       5 saniyelik pencereler
       ════════════════════════════════════════ */

    calculateTimeSeries(gazeData, targetData, testType, duration, cw, ch) {
        const WINDOW_SIZE = 5000; // 5 seconds
        const diagonal = Math.sqrt(cw * cw + ch * ch);
        const windows = [];

        if (gazeData.length === 0) {
            return { windows: [], decayRate: 0, trend: 'stable' };
        }

        const startTime = gazeData[0].time;
        const endTime = gazeData[gazeData.length - 1].time;
        const totalDuration = endTime - startTime;

        for (let t = startTime; t < endTime; t += WINDOW_SIZE) {
            const windowEnd = t + WINDOW_SIZE;
            const windowGaze = gazeData.filter(g => g.time >= t && g.time < windowEnd);

            if (windowGaze.length < 3) continue;

            let windowScore = 100;

            if (testType !== 'free' && targetData.length > 0) {
                const threshold = diagonal * 0.08;
                let withinCount = 0;
                windowGaze.forEach(g => {
                    const closest = this.findClosestByTime(targetData, g.time);
                    if (closest) {
                        const dist = Math.sqrt((g.x - closest.x) ** 2 + (g.y - closest.y) ** 2);
                        if (dist <= threshold) withinCount++;
                    }
                });
                windowScore = windowGaze.length > 0 ? (withinCount / windowGaze.length) * 100 : 0;
            } else {
                // For free gaze, measure exploration coverage in this window
                windowScore = this.calculateDistribution(windowGaze, cw, ch);
            }

            windows.push({
                startSec: Math.round((t - startTime) / 1000),
                endSec: Math.round((windowEnd - startTime) / 1000),
                score: Math.round(windowScore),
                gazeCount: windowGaze.length
            });
        }

        // Calculate decay rate (linear regression slope)
        let decayRate = 0;
        let trend = 'stable';

        if (windows.length >= 2) {
            const n = windows.length;
            const xs = windows.map((_, i) => i);
            const ys = windows.map(w => w.score);
            const meanX = xs.reduce((a, b) => a + b, 0) / n;
            const meanY = ys.reduce((a, b) => a + b, 0) / n;

            let num = 0, den = 0;
            for (let i = 0; i < n; i++) {
                num += (xs[i] - meanX) * (ys[i] - meanY);
                den += (xs[i] - meanX) ** 2;
            }
            decayRate = den > 0 ? num / den : 0;

            if (decayRate < -3) trend = 'declining';
            else if (decayRate > 3) trend = 'improving';
            else trend = 'stable';
        }

        return {
            windows,
            decayRate: Math.round(decayRate * 10) / 10,
            trend
        };
    },

    /* ════════════════════════════════════════
       5. YAŞA GÖRE NORMALLEŞTİRME
       ════════════════════════════════════════ */

    calculateAgeNormalizedScore(metrics, testType) {
        const norms = this.results.ageNorms;
        if (!norms) return metrics.overallScore;

        let score = 0;
        let weights = 0;

        // Focus: compare to age norm
        const focusRatio = metrics.focusScore / norms.focus;
        score += Math.min(100, focusRatio * 70) * 0.25;
        weights += 0.25;

        // Stability
        const stabRatio = metrics.stabilityScore / norms.stability;
        score += Math.min(100, stabRatio * 70) * 0.2;
        weights += 0.2;

        // Tracking
        if (testType !== 'free') {
            score += metrics.trackingSuccess * 0.25;
            weights += 0.25;
        }

        // Fixation duration comparison
        if (metrics.avgFixationDuration > 0) {
            const fixRatio = metrics.avgFixationDuration / norms.fixDuration;
            // Too short or too long fixations are bad
            const fixScore = fixRatio >= 0.7 && fixRatio <= 1.5 ? 80 : fixRatio >= 0.5 ? 60 : 40;
            score += fixScore * 0.15;
            weights += 0.15;
        }

        // Attention loss penalty
        score += Math.max(0, 100 - metrics.attentionLossCount * 10) * 0.15;
        weights += 0.15;

        return weights > 0 ? Math.round(score / weights) : metrics.overallScore;
    },

    /* ════════════════════════════════════════
       YARDIMCI FONKSİYONLAR
       ════════════════════════════════════════ */

    findClosestByTime(targets, time) {
        let closest = null;
        let minDiff = Infinity;
        for (let i = 0; i < targets.length; i++) {
            const diff = Math.abs(targets[i].time - time);
            if (diff < minDiff) {
                minDiff = diff;
                closest = targets[i];
            }
        }
        return closest;
    },

    calculateDistribution(gaze, width, height) {
        const gridCols = 5;
        const gridRows = 4;
        const grid = new Array(gridCols * gridRows).fill(0);
        const cellW = width / gridCols;
        const cellH = height / gridRows;

        gaze.forEach(g => {
            const col = Math.min(gridCols - 1, Math.max(0, Math.floor(g.x / cellW)));
            const row = Math.min(gridRows - 1, Math.max(0, Math.floor(g.y / cellH)));
            grid[row * gridCols + col]++;
        });

        const filledCells = grid.filter(v => v > 0).length;
        return Math.round((filledCells / (gridCols * gridRows)) * 100);
    },

    /* ════════════════════════════════════════
       RENDER RESULTS
       ════════════════════════════════════════ */

    renderResults() {
        const r = this.results;
        const state = App.state;

        // Child name
        document.getElementById('resultChildName').textContent =
            `${state.childName} • ${state.childAge} yaş`;

        // Score circles
        const scoreDisplay = document.getElementById('scoreDisplay');
        scoreDisplay.innerHTML = '';

        scoreDisplay.innerHTML += this.createScoreCircle(
            r.overall, 'Genel Skor', this.getScoreClass(r.overall)
        );

        const testNames = { star: 'Yıldız', ball: 'Top', free: 'Serbest' };
        Object.keys(r.tests).forEach(type => {
            scoreDisplay.innerHTML += this.createScoreCircle(
                r.tests[type].ageNormalizedScore,
                testNames[type] || type,
                this.getScoreClass(r.tests[type].ageNormalizedScore)
            );
        });

        // Metrics grid — both basic and advanced
        const metricsGrid = document.getElementById('metricsGrid');
        metricsGrid.innerHTML = '';

        const avgMetrics = this.getAverageMetrics();

        const metricItems = [
            { value: avgMetrics.focusScore + '%', name: 'Odaklanma', color: 'var(--accent-cyan)' },
            { value: avgMetrics.stabilityScore + '%', name: 'Stabilite', color: 'var(--accent-blue)' },
            { value: avgMetrics.trackingSuccess + '%', name: 'Takip Başarısı', color: 'var(--accent-green)' },
            { value: avgMetrics.attentionLossCount, name: 'Dikkat Kaybı', color: 'var(--accent-yellow)' },
            { value: avgMetrics.fixationCount, name: 'Sabitleme', color: '#a78bfa' },
            { value: avgMetrics.avgFixationDuration + 'ms', name: 'Ort. Sabit. Süresi', color: '#c084fc' },
            { value: avgMetrics.saccadeCount, name: 'Sıçrama', color: '#f472b6' },
            { value: avgMetrics.avgSaccadeAmplitude + '°', name: 'Sıçrama Genliği', color: '#fb923c' },
            { value: avgMetrics.pursuitGain, name: 'Takip Kazancı', color: '#34d399' },
            { value: avgMetrics.scanpathEntropy, name: 'Entropy', color: '#60a5fa' },
            { value: avgMetrics.avgReactionTime + 'ms', name: 'Tepki Süresi', color: 'var(--accent-pink)' },
            { value: avgMetrics.gazePointCount, name: 'Veri Noktası', color: 'var(--accent-purple)' },
        ];

        metricItems.forEach(m => {
            metricsGrid.innerHTML += `
        <div class="metric-card">
          <div class="metric-value" style="color:${m.color}">${m.value}</div>
          <div class="metric-name">${m.name}</div>
        </div>
      `;
        });

        // Advanced Analysis Section
        this.renderAdvancedAnalysis();

        // Assessment card
        const assessmentCard = document.getElementById('assessmentCard');
        const icons = { normal: '✅', warning: '⚠️', alert: '🔴' };
        const descs = {
            normal: `Göz takip parametreleri ${state.childAge} yaş grubuna göre normal aralıkta. Odaklanma ve dikkat becerileri yaşına uygun.`,
            warning: `${state.childAge} yaş grubu normlarına göre bazı parametrelerde beklenenin altında değerler gözlenmiştir. Takip önerilir.`,
            alert: `Göz takip parametreleri ${state.childAge} yaş grubu için önemli sapmalar göstermektedir. Uzman değerlendirmesi önerilir.`
        };

        assessmentCard.innerHTML = `
      <div class="assessment-card ${r.assessmentLevel}">
        <span class="assessment-icon">${icons[r.assessmentLevel]}</span>
        <div class="assessment-title">${r.assessment}</div>
        <div class="assessment-desc">${descs[r.assessmentLevel]}</div>
      </div>
    `;

        document.getElementById('resultIcon').textContent = icons[r.assessmentLevel];
    },

    renderAdvancedAnalysis() {
        const container = document.getElementById('advancedAnalysis');
        if (!container) return;

        const r = this.results;
        const norms = r.ageNorms;
        const age = App.state.childAge;

        // Time series chart (text-based)
        let timeSeriesHTML = '';
        Object.keys(r.timeSeries).forEach(type => {
            const ts = r.timeSeries[type];
            if (!ts.windows || ts.windows.length === 0) return;
            const testNames = { star: 'Yıldız', ball: 'Top', free: 'Serbest' };
            const trendIcons = { stable: '→', declining: '↘', improving: '↗' };
            const trendColors = { stable: 'var(--accent-cyan)', declining: 'var(--accent-red)', improving: 'var(--accent-green)' };

            timeSeriesHTML += `
        <div class="ts-row">
          <span class="ts-label">${testNames[type]}:</span>
          <div class="ts-bars">
            ${ts.windows.map(w => {
                const h = Math.max(4, w.score * 0.4);
                const color = w.score >= 70 ? 'var(--accent-green)' : w.score >= 40 ? 'var(--accent-yellow)' : 'var(--accent-red)';
                return `<div class="ts-bar" style="height:${h}px;background:${color};" title="${w.startSec}-${w.endSec}sn: %${w.score}"></div>`;
            }).join('')}
          </div>
          <span class="ts-trend" style="color:${trendColors[ts.trend]}">
            ${trendIcons[ts.trend]} ${ts.decayRate > 0 ? '+' : ''}${ts.decayRate}/pencere
          </span>
        </div>
      `;
        });

        // Fixation/Saccade summary
        const avgMetrics = this.getAverageMetrics();
        const fixNormStatus = avgMetrics.avgFixationDuration >= norms.fixDuration * 0.7 &&
            avgMetrics.avgFixationDuration <= norms.fixDuration * 1.5 ? '✅ Normal' : '⚠️ Anormal';
        const sacNormStatus = avgMetrics.avgSaccadeAmplitude <= norms.saccadeAmp * 1.3 ? '✅ Normal' : '⚠️ Büyük';

        container.innerHTML = `
      <div class="advanced-section">
        <h4 style="margin-bottom:12px;font-family:var(--font-display);">
          📊 Fixation & Saccade (${age} yaş normu)
        </h4>
        <div class="advanced-grid">
          <div class="advanced-item">
            <span class="adv-label">Ort. Sabitleme Süresi</span>
            <span class="adv-value">${avgMetrics.avgFixationDuration}ms</span>
            <span class="adv-norm">Norm: ${norms.fixDuration}ms ${fixNormStatus}</span>
          </div>
          <div class="advanced-item">
            <span class="adv-label">Ort. Sıçrama Genliği</span>
            <span class="adv-value">${avgMetrics.avgSaccadeAmplitude}°</span>
            <span class="adv-norm">Norm: ≤${norms.saccadeAmp}° ${sacNormStatus}</span>
          </div>
          <div class="advanced-item">
            <span class="adv-label">Ort. Sıçrama Hızı</span>
            <span class="adv-value">${avgMetrics.avgSaccadeVelocity}°/sn</span>
            <span class="adv-norm">&nbsp;</span>
          </div>
          <div class="advanced-item">
            <span class="adv-label">Scanpath Entropy</span>
            <span class="adv-value">${avgMetrics.scanpathEntropy}</span>
            <span class="adv-norm">${avgMetrics.scanpathEntropy > 0.6 ? '✅ İyi dağılım' : '⚠️ Dar odak'}</span>
          </div>
        </div>
      </div>

      <div class="advanced-section" style="margin-top:16px;">
        <h4 style="margin-bottom:12px;font-family:var(--font-display);">
          📈 Dikkat Zaman Serisi (5sn pencereler)
        </h4>
        <div class="ts-container">
          ${timeSeriesHTML || '<p style="color:var(--text-muted);font-size:0.8rem;">Yeterli veri yok.</p>'}
        </div>
      </div>
    `;
    },

    createScoreCircle(score, label, scoreClass) {
        const circumference = 2 * Math.PI * 65;
        const offset = circumference - (score / 100) * circumference;

        return `
      <div class="score-circle ${scoreClass}">
        <svg viewBox="0 0 160 160">
          <circle class="score-bg" cx="80" cy="80" r="65"/>
          <circle class="score-fg" cx="80" cy="80" r="65"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"/>
        </svg>
        <div class="score-value">
          <div class="score-number">${score}</div>
          <div class="score-label">${label}</div>
        </div>
      </div>
    `;
    },

    getScoreClass(score) {
        if (score >= 70) return 'score-good';
        if (score >= 40) return 'score-warning';
        return 'score-alert';
    },

    getAverageMetrics() {
        const tests = Object.values(this.results.tests);
        if (tests.length === 0) return {
            focusScore: 0, stabilityScore: 0, trackingSuccess: 0,
            attentionLossCount: 0, avgReactionTime: 0, gazePointCount: 0,
            fixationCount: 0, avgFixationDuration: 0, saccadeCount: 0,
            avgSaccadeAmplitude: 0, avgSaccadeVelocity: 0, pursuitGain: 0,
            scanpathEntropy: 0
        };

        const sum = (key) => tests.reduce((s, t) => s + (t[key] || 0), 0);
        const avg = (key) => Math.round(sum(key) / tests.length);
        const avgDec = (key, dec = 10) => Math.round(sum(key) / tests.length * dec) / dec;

        return {
            focusScore: avg('focusScore'),
            stabilityScore: avg('stabilityScore'),
            trackingSuccess: avg('trackingSuccess'),
            attentionLossCount: sum('attentionLossCount'),
            avgReactionTime: avg('avgReactionTime'),
            gazePointCount: sum('gazePointCount'),
            fixationCount: sum('fixationCount'),
            avgFixationDuration: avg('avgFixationDuration'),
            saccadeCount: sum('saccadeCount'),
            avgSaccadeAmplitude: avgDec('avgSaccadeAmplitude'),
            avgSaccadeVelocity: avg('avgSaccadeVelocity'),
            pursuitGain: avgDec('pursuitGain'),
            scanpathEntropy: avgDec('scanpathEntropy')
        };
    }
};
