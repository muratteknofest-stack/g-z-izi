/* ============================================
   GÖZ-İZİ - Kalibrasyon Modülü (calibration.js)
   Dokunmatik ve fare desteği 
   ============================================ */

const Calibration = {
    points: [],
    clickCounts: {},
    totalClicks: 0,
    requiredClicksPerPoint: 3,
    totalPoints: 9,

    // 9-point calibration grid positions (percentage-based)
    positions: [
        { x: 10, y: 10 },  // Top-left
        { x: 50, y: 10 },  // Top-center
        { x: 90, y: 10 },  // Top-right
        { x: 10, y: 50 },  // Middle-left
        { x: 50, y: 50 },  // Center
        { x: 90, y: 50 },  // Middle-right
        { x: 10, y: 90 },  // Bottom-left
        { x: 50, y: 90 },  // Bottom-center
        { x: 90, y: 90 },  // Bottom-right
    ],

    start() {
        this.totalClicks = 0;
        this.clickCounts = {};
        this.points = [];

        const area = document.getElementById('calibrationArea');

        // Remove old points
        area.querySelectorAll('.calibration-point').forEach(p => p.remove());

        // Show instructions briefly then show points
        const instructions = document.getElementById('calibInstructions');
        instructions.style.display = 'block';

        setTimeout(() => {
            instructions.style.display = 'none';
            this.showAllPoints(area);
        }, 2500);
    },

    showAllPoints(area) {
        this.positions.forEach((pos, index) => {
            const point = document.createElement('div');
            point.className = 'calibration-point';
            point.style.left = pos.x + '%';
            point.style.top = pos.y + '%';
            point.dataset.index = index;

            // Support both click AND touch
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.onPointClick(e, index, point);
            };

            point.addEventListener('click', handler);
            point.addEventListener('touchend', handler, { passive: false });

            area.appendChild(point);
            this.points.push(point);
            this.clickCounts[index] = 0;
        });
    },

    onPointClick(event, index, point) {
        // Prevent double-firing from touch + click
        if (this.clickCounts[index] >= this.requiredClicksPerPoint) return;

        this.clickCounts[index] = (this.clickCounts[index] || 0) + 1;
        this.totalClicks++;

        // Visual feedback - pulse animation
        point.classList.add('pulse');
        setTimeout(() => point.classList.remove('pulse'), 200);

        // Shrink as clicks accumulate
        const progress = this.clickCounts[index] / this.requiredClicksPerPoint;
        const scale = 1 - progress * 0.3;
        point.style.transform = `translate(-50%, -50%) scale(${scale})`;

        if (this.clickCounts[index] >= this.requiredClicksPerPoint) {
            point.classList.add('clicked');
            point.style.pointerEvents = 'none';

            // Sound-like visual feedback
            this.showCheckmark(point);
        }

        // Update progress bar
        const completedPoints = Object.values(this.clickCounts)
            .filter(c => c >= this.requiredClicksPerPoint).length;

        const progressPct = (completedPoints / this.totalPoints) * 100;
        document.getElementById('calibProgress').style.width = progressPct + '%';
        document.getElementById('calibProgressText').textContent =
            `${completedPoints} / ${this.totalPoints} nokta`;

        // Check if all done
        if (completedPoints >= this.totalPoints) {
            setTimeout(() => this.onComplete(), 600);
        }
    },

    showCheckmark(point) {
        const check = document.createElement('span');
        check.className = 'calib-check';
        check.textContent = '✓';
        point.appendChild(check);
    },

    onComplete() {
        // Clean up
        const area = document.getElementById('calibrationArea');
        area.querySelectorAll('.calibration-point').forEach(p => p.remove());

        App.onCalibrationComplete();
    }
};
