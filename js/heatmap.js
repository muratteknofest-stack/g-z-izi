/* ============================================
   GÖZ-İZİ - Isı Haritası (heatmap.js)
   ============================================ */

const HeatmapRenderer = {
    /**
     * Draw a heatmap on the given canvas from gaze data
     */
    render(canvasId, gazeData, width, height) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        canvas.width = width || canvas.parentElement.clientWidth;
        canvas.height = height || canvas.parentElement.clientHeight;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Scale factors (gaze data was recorded at original canvas size)
        const scaleX = w / (gazeData.canvasWidth || window.innerWidth);
        const scaleY = h / (gazeData.canvasHeight || window.innerHeight);

        // Clear
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, w, h);

        // Create grid for accumulation
        const gridSize = 10; // pixels per cell
        const cols = Math.ceil(w / gridSize);
        const rows = Math.ceil(h / gridSize);
        const grid = new Array(cols * rows).fill(0);

        // Accumulate gaze points into grid
        const points = gazeData.gazeData || gazeData;
        points.forEach(point => {
            const gx = Math.floor((point.x * scaleX) / gridSize);
            const gy = Math.floor((point.y * scaleY) / gridSize);

            // Apply gaussian spread
            const radius = 3; // cells
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = gx + dx;
                    const ny = gy + dy;
                    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const weight = Math.exp(-(dist * dist) / (2 * 1.5 * 1.5));
                        grid[ny * cols + nx] += weight;
                    }
                }
            }
        });

        // Find max value
        let maxVal = 0;
        for (let i = 0; i < grid.length; i++) {
            if (grid[i] > maxVal) maxVal = grid[i];
        }
        if (maxVal === 0) maxVal = 1;

        // Create image data
        const imageData = ctx.createImageData(w, h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const gx = Math.floor(x / gridSize);
                const gy = Math.floor(y / gridSize);
                const val = grid[gy * cols + gx] || 0;
                const normalized = val / maxVal;

                const [r, g, b, a] = this.getHeatColor(normalized);

                const idx = (y * w + x) * 4;
                imageData.data[idx] = r;
                imageData.data[idx + 1] = g;
                imageData.data[idx + 2] = b;
                imageData.data[idx + 3] = a;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Apply blur for smoother look
        ctx.filter = 'blur(8px)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';

        // Re-draw slightly transparent to lighten the blur
        ctx.globalAlpha = 0.3;
        ctx.drawImage(canvas, 0, 0);
        ctx.globalAlpha = 1;
    },

    /**
     * Color mapping: normalized value 0-1 -> RGBA
     */
    getHeatColor(value) {
        if (value < 0.01) return [10, 14, 26, 255]; // Background

        let r, g, b;
        const alpha = Math.min(255, value * 255 + 50);

        if (value < 0.25) {
            // Blue to Cyan
            const t = value / 0.25;
            r = 0;
            g = Math.floor(t * 180);
            b = Math.floor(59 + t * 150);
        } else if (value < 0.5) {
            // Cyan to Green
            const t = (value - 0.25) / 0.25;
            r = 0;
            g = Math.floor(180 + t * 75);
            b = Math.floor(209 - t * 209);
        } else if (value < 0.75) {
            // Green to Yellow
            const t = (value - 0.5) / 0.25;
            r = Math.floor(t * 245);
            g = 255;
            b = 0;
        } else {
            // Yellow to Red
            const t = (value - 0.75) / 0.25;
            r = 245;
            g = Math.floor(255 - t * 200);
            b = 0;
        }

        return [r, g, b, alpha];
    },

    /**
     * Render combined heatmap from all tests
     */
    renderCombined(canvasId) {
        const allGaze = [];
        let cw = window.innerWidth;
        let ch = window.innerHeight;

        Object.keys(App.state.testResults).forEach(testType => {
            const result = App.state.testResults[testType];
            if (result && result.gazeData) {
                allGaze.push(...result.gazeData);
                cw = result.canvasWidth || cw;
                ch = result.canvasHeight || ch;
            }
        });

        if (allGaze.length > 0) {
            this.render(canvasId, {
                gazeData: allGaze,
                canvasWidth: cw,
                canvasHeight: ch
            });
        }
    },

    /**
     * Render heatmap for a specific test
     */
    renderForTest(canvasId, testType) {
        const result = App.state.testResults[testType];
        if (result) {
            this.render(canvasId, result);
        }
    }
};
