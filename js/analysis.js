/* ============================================
   GÖZ-İZİ - Analiz Motoru (analysis.js)
   ============================================ */

const Analysis = {
    results: {
        overall: 0,
        tests: {},
        assessment: '',
        assessmentLevel: '' // 'normal', 'warning', 'alert'
    },

    /**
     * Calculate all metrics for all completed tests
     */
    calculateAll() {
        const testTypes = Object.keys(App.state.testResults);
        let totalScore = 0;
        let testCount = 0;

        testTypes.forEach(type => {
            const data = App.state.testResults[type];
            if (!data || !data.gazeData || data.gazeData.length === 0) return;

            const metrics = this.calculateTestMetrics(type, data);
            this.results.tests[type] = metrics;
            totalScore += metrics.overallScore;
            testCount++;
        });

        this.results.overall = testCount > 0 ? Math.round(totalScore / testCount) : 0;

        // Assessment
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

    /**
     * Calculate metrics for a single test
     */
    calculateTestMetrics(testType, data) {
        const gaze = data.gazeData;
        const targets = data.targetData;
        const cw = data.canvasWidth || window.innerWidth;
        const ch = data.canvasHeight || window.innerHeight;
        const diagonal = Math.sqrt(cw * cw + ch * ch);

        // 1. Focus Score (target deviation)
        let focusScore = 100;
        if (testType !== 'free' && targets.length > 0) {
            let totalDeviation = 0;
            let matchCount = 0;

            gaze.forEach(g => {
                // Find closest target point by time
                const closest = this.findClosestByTime(targets, g.time);
                if (closest) {
                    const dx = g.x - closest.x;
                    const dy = g.y - closest.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    totalDeviation += dist;
                    matchCount++;
                }
            });

            const avgDeviation = matchCount > 0 ? totalDeviation / matchCount : diagonal * 0.5;
            // Normalize: 0 deviation = 100, diagonal/4 deviation = 0
            focusScore = Math.max(0, Math.min(100, 100 - (avgDeviation / (diagonal * 0.15)) * 100));
        } else if (testType === 'free') {
            // For free gaze, measure distribution (spread is good)
            focusScore = this.calculateDistribution(gaze, cw, ch);
        }

        // 2. Stability Score (jitter measurement)
        let stabilityScore = 100;
        if (gaze.length > 2) {
            let totalJitter = 0;
            for (let i = 2; i < gaze.length; i++) {
                const dx1 = gaze[i].x - gaze[i - 1].x;
                const dy1 = gaze[i].y - gaze[i - 1].y;
                const dx2 = gaze[i - 1].x - gaze[i - 2].x;
                const dy2 = gaze[i - 1].y - gaze[i - 2].y;
                // Direction change magnitude
                const jitter = Math.sqrt((dx1 - dx2) ** 2 + (dy1 - dy2) ** 2);
                totalJitter += jitter;
            }
            const avgJitter = totalJitter / (gaze.length - 2);
            stabilityScore = Math.max(0, Math.min(100, 100 - (avgJitter / 15) * 100));
        }

        // 3. Tracking Success (% time within threshold)
        let trackingSuccess = 100;
        if (testType !== 'free' && targets.length > 0) {
            const threshold = diagonal * 0.08; // ~8% of screen diagonal
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

        // 4. Attention Loss Count (breakaway moments)
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

        // 5. Reaction Time (average time to re-acquire target after loss)
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

        // Overall test score (weighted average)
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
            gazePointCount: gaze.length
        };
    },

    /**
     * Find the closest target point by timestamp
     */
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

    /**
     * Calculate gaze distribution score for free gaze test
     * Good distribution = eyes explored many areas = higher score
     */
    calculateDistribution(gaze, width, height) {
        const gridCols = 5;
        const gridRows = 4;
        const grid = new Array(gridCols * gridRows).fill(0);
        const cellW = width / gridCols;
        const cellH = height / gridRows;

        gaze.forEach(g => {
            const col = Math.min(gridCols - 1, Math.floor(g.x / cellW));
            const row = Math.min(gridRows - 1, Math.floor(g.y / cellH));
            if (col >= 0 && row >= 0) {
                grid[row * gridCols + col]++;
            }
        });

        const filledCells = grid.filter(v => v > 0).length;
        const coverage = filledCells / (gridCols * gridRows);
        return Math.round(coverage * 100);
    },

    /**
     * Render results to the results screen
     */
    renderResults() {
        const r = this.results;
        const state = App.state;

        // Child name
        document.getElementById('resultChildName').textContent =
            `${state.childName} • ${state.childAge} yaş`;

        // Score circles
        const scoreDisplay = document.getElementById('scoreDisplay');
        scoreDisplay.innerHTML = '';

        // Overall score circle
        scoreDisplay.innerHTML += this.createScoreCircle(
            r.overall, 'Genel Skor', this.getScoreClass(r.overall)
        );

        // Per-test scores
        const testNames = { star: 'Yıldız', ball: 'Top', free: 'Serbest' };
        Object.keys(r.tests).forEach(type => {
            scoreDisplay.innerHTML += this.createScoreCircle(
                r.tests[type].overallScore,
                testNames[type] || type,
                this.getScoreClass(r.tests[type].overallScore)
            );
        });

        // Metrics grid
        const metricsGrid = document.getElementById('metricsGrid');
        metricsGrid.innerHTML = '';

        // Average metrics across tests
        const avgMetrics = this.getAverageMetrics();

        const metricItems = [
            { value: avgMetrics.focusScore + '%', name: 'Odaklanma', color: 'var(--accent-cyan)' },
            { value: avgMetrics.stabilityScore + '%', name: 'Stabilite', color: 'var(--accent-blue)' },
            { value: avgMetrics.trackingSuccess + '%', name: 'Takip Başarısı', color: 'var(--accent-green)' },
            { value: avgMetrics.attentionLossCount, name: 'Dikkat Kaybı', color: 'var(--accent-yellow)' },
            { value: avgMetrics.gazePointCount, name: 'Veri Noktası', color: 'var(--accent-purple)' },
            { value: avgMetrics.avgReactionTime + 'ms', name: 'Tepki Süresi', color: 'var(--accent-pink)' },
        ];

        metricItems.forEach(m => {
            metricsGrid.innerHTML += `
        <div class="metric-card">
          <div class="metric-value" style="color:${m.color}">${m.value}</div>
          <div class="metric-name">${m.name}</div>
        </div>
      `;
        });

        // Assessment card
        const assessmentCard = document.getElementById('assessmentCard');
        const icons = { normal: '✅', warning: '⚠️', alert: '🔴' };
        const descs = {
            normal: 'Göz takip parametreleri normal aralıkta. Çocuğun odaklanma ve dikkat becerileri yaşına uygun görünmektedir.',
            warning: 'Bazı parametrelerde yaşa göre beklenenin altında değerler gözlenmiştir. Düzenli takip ve gerekirse bir uzman görüşü alınması önerilir.',
            alert: 'Göz takip parametreleri önemli sapmalar göstermektedir. Bir çocuk gelişim uzmanına veya göz doktoruna danışmanız tavsiye edilir.'
        };

        assessmentCard.innerHTML = `
      <div class="assessment-card ${r.assessmentLevel}">
        <span class="assessment-icon">${icons[r.assessmentLevel]}</span>
        <div class="assessment-title">${r.assessment}</div>
        <div class="assessment-desc">${descs[r.assessmentLevel]}</div>
      </div>
    `;

        // Result icon
        document.getElementById('resultIcon').textContent = icons[r.assessmentLevel];
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
            attentionLossCount: 0, avgReactionTime: 0, gazePointCount: 0
        };

        const sum = (key) => tests.reduce((s, t) => s + (t[key] || 0), 0);
        const avg = (key) => Math.round(sum(key) / tests.length);

        return {
            focusScore: avg('focusScore'),
            stabilityScore: avg('stabilityScore'),
            trackingSuccess: avg('trackingSuccess'),
            attentionLossCount: sum('attentionLossCount'),
            avgReactionTime: avg('avgReactionTime'),
            gazePointCount: sum('gazePointCount')
        };
    }
};
