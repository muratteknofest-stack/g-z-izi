/* ============================================
   GÖZ-İZİ - Kalibrasyon Modülü (calibration.js)
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

            point.addEventListener('click', (e) => this.onPointClick(e, index, point));

            area.appendChild(point);
            this.points.push(point);
            this.clickCounts[index] = 0;
        });
    },

    onPointClick(event, index, point) {
        this.clickCounts[index] = (this.clickCounts[index] || 0) + 1;
        this.totalClicks++;

        // Visual feedback
        point.style.transform = `translate(-50%, -50%) scale(${0.9 - this.clickCounts[index] * 0.05})`;
        point.style.opacity = 1 - (this.clickCounts[index] / this.requiredClicksPerPoint) * 0.3;

        if (this.clickCounts[index] >= this.requiredClicksPerPoint) {
            point.classList.add('clicked');
            point.style.pointerEvents = 'none';
        }

        // Update progress
        const completedPoints = Object.values(this.clickCounts)
            .filter(c => c >= this.requiredClicksPerPoint).length;

        const progress = (completedPoints / this.totalPoints) * 100;
        document.getElementById('calibProgress').style.width = progress + '%';
        document.getElementById('calibProgressText').textContent =
            `${completedPoints} / ${this.totalPoints} nokta`;

        // Check if all done
        if (completedPoints >= this.totalPoints) {
            setTimeout(() => this.onComplete(), 500);
        }
    },

    onComplete() {
        // Clean up
        const area = document.getElementById('calibrationArea');
        area.querySelectorAll('.calibration-point').forEach(p => p.remove());

        App.onCalibrationComplete();
    }
};
