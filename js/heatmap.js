/* ============================================
   GÖZ-İZİ - Gaussian Isı Haritası (heatmap.js)
   Kernel Density Estimation ile profesyonel 
   ısı haritası oluşturma
   ============================================ */

const HeatmapRenderer = {
    // Color gradient stops (cool → hot)
    COLORS: [
        { r: 0, g: 0, b: 0, a: 0 },        // transparent
        { r: 0, g: 0, b: 255, a: 0.4 },     // blue
        { r: 0, g: 255, b: 255, a: 0.6 },   // cyan
        { r: 0, g: 255, b: 0, a: 0.7 },     // green
        { r: 255, g: 255, b: 0, a: 0.8 },   // yellow
        { r: 255, g: 128, b: 0, a: 0.85 },  // orange
        { r: 255, g: 0, b: 0, a: 0.9 },     // red
    ],

    /**
     * Render a combined heatmap from all test results
     */
    renderCombined(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;

        // Set canvas size from container
        const rect = container.getBoundingClientRect();
        canvas.width = Math.max(400, rect.width);
        canvas.height = Math.max(300, rect.width * 0.6);

        // Collect all gaze data, normalized to canvas dimensions
        const allGaze = [];

        Object.keys(App.state.testResults).forEach(type => {
            const data = App.state.testResults[type];
            if (!data || !data.gazeData) return;

            const scaleX = canvas.width / (data.canvasWidth || window.innerWidth);
            const scaleY = canvas.height / (data.canvasHeight || window.innerHeight);

            data.gazeData.forEach(g => {
                allGaze.push({
                    x: g.x * scaleX,
                    y: g.y * scaleY
                });
            });
        });

        if (allGaze.length === 0) {
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Göz verisi bulunamadı', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Generate Gaussian heatmap
        this.renderGaussianHeatmap(ctx, canvas.width, canvas.height, allGaze);

        // Draw fixation points if available
        this.drawFixationOverlay(ctx, canvas);
    },

    /**
     * Render for a specific test
     */
    renderForTest(canvasId, testType) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = App.state.testResults[testType];
        if (!data || !data.gazeData) return;

        canvas.width = Math.max(400, canvas.parentElement.getBoundingClientRect().width);
        canvas.height = canvas.width * 0.6;

        const scaleX = canvas.width / (data.canvasWidth || window.innerWidth);
        const scaleY = canvas.height / (data.canvasHeight || window.innerHeight);

        const gazePoints = data.gazeData.map(g => ({
            x: g.x * scaleX,
            y: g.y * scaleY
        }));

        this.renderGaussianHeatmap(ctx, canvas.width, canvas.height, gazePoints);
    },

    /**
     * Gaussian Kernel Density Estimation Heatmap
     */
    renderGaussianHeatmap(ctx, width, height, points) {
        // Background
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, width, height);

        // Grid border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        if (points.length === 0) return;

        // Adaptive kernel radius based on screen and data density
        const density = points.length / (width * height);
        const baseRadius = Math.max(20, Math.min(60, 40 / Math.sqrt(density * 10000)));

        // Create density grid (lower resolution for performance)
        const GRID_SCALE = 4; // 1 cell = 4x4 pixels
        const gridW = Math.ceil(width / GRID_SCALE);
        const gridH = Math.ceil(height / GRID_SCALE);
        const densityGrid = new Float32Array(gridW * gridH);

        // Accumulate Gaussian kernels
        const sigma = baseRadius / GRID_SCALE;
        const sigmaSquare2 = 2 * sigma * sigma;
        const kernelRadius = Math.ceil(sigma * 3);

        points.forEach(p => {
            const gx = Math.floor(p.x / GRID_SCALE);
            const gy = Math.floor(p.y / GRID_SCALE);

            const startX = Math.max(0, gx - kernelRadius);
            const endX = Math.min(gridW - 1, gx + kernelRadius);
            const startY = Math.max(0, gy - kernelRadius);
            const endY = Math.min(gridH - 1, gy + kernelRadius);

            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const dx = x - gx;
                    const dy = y - gy;
                    const dist2 = dx * dx + dy * dy;
                    const weight = Math.exp(-dist2 / sigmaSquare2);
                    densityGrid[y * gridW + x] += weight;
                }
            }
        });

        // Find max density for normalization
        let maxDensity = 0;
        for (let i = 0; i < densityGrid.length; i++) {
            if (densityGrid[i] > maxDensity) maxDensity = densityGrid[i];
        }

        if (maxDensity === 0) return;

        // Render density grid to canvas
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                const normalizedValue = densityGrid[gy * gridW + gx] / maxDensity;
                if (normalizedValue < 0.01) continue; // Skip near-zero

                const color = this.getGradientColor(normalizedValue);

                // Paint GRID_SCALE × GRID_SCALE block
                for (let dy = 0; dy < GRID_SCALE && (gy * GRID_SCALE + dy) < height; dy++) {
                    for (let dx = 0; dx < GRID_SCALE && (gx * GRID_SCALE + dx) < width; dx++) {
                        const px = gx * GRID_SCALE + dx;
                        const py = gy * GRID_SCALE + dy;
                        const idx = (py * width + px) * 4;

                        // Alpha blending over existing dark background
                        const alpha = color.a;
                        data[idx] = Math.round(10 * (1 - alpha) + color.r * alpha);
                        data[idx + 1] = Math.round(14 * (1 - alpha) + color.g * alpha);
                        data[idx + 2] = Math.round(26 * (1 - alpha) + color.b * alpha);
                        data[idx + 3] = 255;
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Add subtle glow effect via canvas compositing
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = 'blur(8px)';
        ctx.globalAlpha = 0.3;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = 'none';
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Draw color scale legend
        this.drawLegend(ctx, width, height);
    },

    /**
     * Interpolate gradient color from normalized value 0..1
     */
    getGradientColor(t) {
        const stops = this.COLORS;
        const pos = t * (stops.length - 1);
        const i = Math.floor(pos);
        const f = pos - i;

        if (i >= stops.length - 1) return stops[stops.length - 1];

        const c1 = stops[i];
        const c2 = stops[i + 1];

        return {
            r: c1.r + (c2.r - c1.r) * f,
            g: c1.g + (c2.g - c1.g) * f,
            b: c1.b + (c2.b - c1.b) * f,
            a: c1.a + (c2.a - c1.a) * f
        };
    },

    /**
     * Draw fixation points as circles on the heatmap
     */
    drawFixationOverlay(ctx, canvas) {
        const allFixations = [];
        const results = Analysis.results.fixations || {};

        Object.keys(results).forEach(type => {
            const data = App.state.testResults[type];
            if (!data) return;

            const scaleX = canvas.width / (data.canvasWidth || window.innerWidth);
            const scaleY = canvas.height / (data.canvasHeight || window.innerHeight);

            (results[type] || []).forEach(f => {
                allFixations.push({
                    x: f.x * scaleX,
                    y: f.y * scaleY,
                    duration: f.duration
                });
            });
        });

        if (allFixations.length === 0) return;

        // Find max duration for sizing
        const maxDur = Math.max(...allFixations.map(f => f.duration));

        allFixations.forEach(f => {
            const radius = 3 + (f.duration / maxDur) * 12;

            ctx.beginPath();
            ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw scanpath lines between fixations
        if (allFixations.length > 1) {
            ctx.beginPath();
            ctx.moveTo(allFixations[0].x, allFixations[0].y);
            for (let i = 1; i < allFixations.length; i++) {
                ctx.lineTo(allFixations[i].x, allFixations[i].y);
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([3, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    },

    /**
     * Draw color scale legend on heatmap
     */
    drawLegend(ctx, w, h) {
        const legendW = 120;
        const legendH = 12;
        const x = w - legendW - 15;
        const y = h - legendH - 20;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x - 8, y - 18, legendW + 16, legendH + 32);

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Bakış Yoğunluğu', x + legendW / 2, y - 5);

        // Gradient bar
        const grd = ctx.createLinearGradient(x, y, x + legendW, y);
        grd.addColorStop(0, 'rgba(0, 0, 255, 0.6)');
        grd.addColorStop(0.25, 'rgba(0, 255, 255, 0.7)');
        grd.addColorStop(0.5, 'rgba(0, 255, 0, 0.7)');
        grd.addColorStop(0.75, 'rgba(255, 255, 0, 0.8)');
        grd.addColorStop(1, 'rgba(255, 0, 0, 0.9)');

        ctx.fillStyle = grd;
        ctx.fillRect(x, y, legendW, legendH);

        // Labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Az', x, y + legendH + 10);
        ctx.textAlign = 'right';
        ctx.fillText('Çok', x + legendW, y + legendH + 10);
    }
};
