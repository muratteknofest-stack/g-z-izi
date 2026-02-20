/* ============================================
   GÖZ-İZİ - Göz Takip Testleri (tests.js)
   Event leak fix + mobile improvements
   ============================================ */

const Tests = {
    isRunning: false,
    currentTest: null,
    canvas: null,
    ctx: null,
    animationId: null,
    startTime: 0,
    duration: 0,
    gazeLog: [],
    targetLog: [],

    // Target object state
    target: { x: 0, y: 0, vx: 0, vy: 0, size: 30 },

    // Free gaze scene objects
    sceneObjects: [],

    // Bound event handlers (for proper cleanup)
    _resizeHandler: null,
    _touchStartHandler: null,
    _touchMoveHandler: null,

    testConfig: {
        star: {
            name: 'Yıldız Takibi',
            duration: 30,
            icon: '⭐',
            speed: 1.5,
            description: 'Yıldızı gözlerinizle takip edin'
        },
        ball: {
            name: 'Top Takibi',
            duration: 30,
            icon: '⚽',
            speed: 3.5,
            description: 'Topu gözlerinizle izleyin'
        },
        free: {
            name: 'Serbest Bakış',
            duration: 20,
            icon: '🔍',
            description: 'Resimlere serbestçe bakın'
        }
    },

    startTest(type) {
        this.currentTest = type;
        this.gazeLog = [];
        this.targetLog = [];
        this.isRunning = false;

        const config = this.testConfig[type];
        this.duration = config.duration;

        // Update HUD
        document.getElementById('hudTestName').textContent = config.name;

        // Lock scroll on mobile
        App.lockBodyScroll();
        App.showScreen('testRunScreen');

        // Setup canvas
        this.canvas = document.getElementById('testCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        // Handle resize and orientation change — store reference for cleanup
        this._resizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', this._resizeHandler);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this._resizeHandler);
        }

        // Prevent touch scrolling on canvas — store references for cleanup
        this._touchStartHandler = (e) => e.preventDefault();
        this._touchMoveHandler = (e) => e.preventDefault();
        this.canvas.addEventListener('touchstart', this._touchStartHandler, { passive: false });
        this.canvas.addEventListener('touchmove', this._touchMoveHandler, { passive: false });

        // Countdown then start
        this.showCountdown(() => {
            this.isRunning = true;
            this.startTime = performance.now();

            // Reset cognitive logs for this test
            if (Cognitive.isReady) {
                Cognitive.resetLogs();
            }

            if (type === 'free') {
                this.initFreeScene();
            } else {
                this.initTarget(type);
            }

            this.animate();
        });
    },

    resizeCanvas() {
        if (!this.canvas) return;
        if (window.visualViewport) {
            this.canvas.width = window.visualViewport.width;
            this.canvas.height = window.visualViewport.height;
        } else {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    },

    showCountdown(callback) {
        const overlay = document.getElementById('countdownOverlay');
        const numEl = document.getElementById('countdownNum');
        overlay.classList.remove('hidden');

        let count = 3;
        numEl.textContent = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                numEl.textContent = count;
                numEl.style.animation = 'none';
                numEl.offsetHeight; // Trigger reflow
                numEl.style.animation = 'countPop 1s ease';
            } else {
                clearInterval(interval);
                overlay.classList.add('hidden');
                callback();
            }
        }, 1000);
    },

    initTarget(type) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const config = this.testConfig[type];

        // Scale target size based on screen
        const screenScale = Math.min(w, h) / 600;
        const baseSize = type === 'star' ? 35 : 28;
        const scaledSize = Math.max(baseSize, baseSize * screenScale);

        // Scale speed relative to screen size
        const speedScale = Math.min(w, h) / 800;

        this.target = {
            x: w / 2,
            y: h / 2,
            vx: config.speed * speedScale * (Math.random() > 0.5 ? 1 : -1),
            vy: config.speed * speedScale * (Math.random() > 0.5 ? 1 : -1),
            size: scaledSize,
            type: type
        };
    },

    initFreeScene() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        const scale = Math.min(w, h) / 700;
        const sz = (base) => Math.max(30, Math.round(base * scale));

        this.sceneObjects = [
            { emoji: '🏠', x: w * 0.15, y: h * 0.25, size: sz(60) },
            { emoji: '🌳', x: w * 0.35, y: h * 0.7, size: sz(55) },
            { emoji: '🚗', x: w * 0.65, y: h * 0.6, size: sz(50) },
            { emoji: '☀️', x: w * 0.8, y: h * 0.15, size: sz(65) },
            { emoji: '🐕', x: w * 0.5, y: h * 0.45, size: sz(50) },
            { emoji: '🎈', x: w * 0.25, y: h * 0.5, size: sz(45) },
            { emoji: '🌈', x: w * 0.75, y: h * 0.35, size: sz(55) },
            { emoji: '🦋', x: w * 0.45, y: h * 0.2, size: sz(40) },
            { emoji: '🌻', x: w * 0.9, y: h * 0.75, size: sz(48) },
            { emoji: '⛅', x: w * 0.1, y: h * 0.8, size: sz(52) },
        ];
    },

    recordGaze(x, y, timestamp) {
        if (!this.isRunning) return;

        this.gazeLog.push({
            x: x,
            y: y,
            time: timestamp || performance.now()
        });
    },

    animate() {
        if (!this.isRunning) return;

        const elapsed = (performance.now() - this.startTime) / 1000;
        const remaining = Math.max(0, this.duration - elapsed);

        // Update timer
        const secs = Math.ceil(remaining);
        document.getElementById('hudTimer').textContent =
            `00:${secs.toString().padStart(2, '0')}`;

        // Timer bar
        const progress = remaining / this.duration;
        document.getElementById('timerBar').style.width = (progress * 100) + '%';

        // Timer bar color change when time is low
        const timerBar = document.getElementById('timerBar');
        if (remaining < 5) {
            timerBar.style.background = 'var(--accent-red)';
        } else if (remaining < 10) {
            timerBar.style.background = 'var(--accent-yellow)';
        } else {
            timerBar.style.background = '';
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        this.drawBackground();

        if (this.currentTest === 'free') {
            this.drawFreeScene();
        } else {
            this.updateTarget();
            this.drawTarget();

            // Log target position
            this.targetLog.push({
                x: this.target.x,
                y: this.target.y,
                time: performance.now()
            });
        }

        // Check if time is up
        if (remaining <= 0) {
            this.endTest();
            return;
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    },

    drawBackground() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Dark background with subtle grid
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        const gridSize = 60;
        for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    },

    updateTarget() {
        const t = this.target;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const margin = 80;

        if (this.currentTest === 'ball') {
            t.vx += (Math.random() - 0.5) * 0.5;
            t.vy += (Math.random() - 0.5) * 0.5;

            const maxSpeed = 5;
            const speed = Math.sqrt(t.vx * t.vx + t.vy * t.vy);
            if (speed > maxSpeed) {
                t.vx = (t.vx / speed) * maxSpeed;
                t.vy = (t.vy / speed) * maxSpeed;
            }
            if (speed < 1.5) {
                t.vx *= 1.5;
                t.vy *= 1.5;
            }
        }

        t.x += t.vx;
        t.y += t.vy;

        // Bounce off walls
        if (t.x < margin || t.x > w - margin) {
            t.vx *= -1;
            t.x = Math.max(margin, Math.min(w - margin, t.x));
        }
        if (t.y < margin || t.y > h - margin) {
            t.vy *= -1;
            t.y = Math.max(margin, Math.min(h - margin, t.y));
        }
    },

    drawTarget() {
        const ctx = this.ctx;
        const t = this.target;
        const time = performance.now() / 1000;

        if (this.currentTest === 'star') {
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(time * 0.5);

            // Glow
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, t.size * 2);
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, t.size * 2, 0, Math.PI * 2);
            ctx.fill();

            // Star shape
            this.drawStarShape(ctx, 0, 0, 5, t.size, t.size * 0.5);
            ctx.fillStyle = '#FFD700';
            ctx.fill();
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner glow
            this.drawStarShape(ctx, 0, 0, 5, t.size * 0.6, t.size * 0.3);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();

            ctx.restore();

            // Trail particles
            for (let i = 0; i < 3; i++) {
                const angle = time * 2 + (i * Math.PI * 2 / 3);
                const px = t.x + Math.cos(angle) * (t.size + 10 + i * 5);
                const py = t.y + Math.sin(angle) * (t.size + 10 + i * 5);
                ctx.beginPath();
                ctx.arc(px, py, 3 - i, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 215, 0, ${0.6 - i * 0.2})`;
                ctx.fill();
            }

        } else if (this.currentTest === 'ball') {
            ctx.save();

            // Shadow
            ctx.beginPath();
            ctx.ellipse(t.x + 3, t.y + t.size + 5, t.size * 0.8, 6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fill();

            // Ball
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            const ballGrad = ctx.createRadialGradient(t.x - 8, t.y - 8, 2, t.x, t.y, t.size);
            ballGrad.addColorStop(0, '#ffffff');
            ballGrad.addColorStop(1, '#cccccc');
            ctx.fillStyle = ballGrad;
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Pentagon pattern
            const pentagons = 5;
            const rotation = time * 2;
            for (let i = 0; i < pentagons; i++) {
                const angle = (i / pentagons) * Math.PI * 2 + rotation;
                const px = t.x + Math.cos(angle) * t.size * 0.55;
                const py = t.y + Math.sin(angle) * t.size * 0.55;

                ctx.beginPath();
                for (let j = 0; j < 5; j++) {
                    const a = (j / 5) * Math.PI * 2 + angle;
                    const r = t.size * 0.2;
                    if (j === 0) ctx.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
                    else ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
                }
                ctx.closePath();
                ctx.fillStyle = '#1a1a2e';
                ctx.fill();
            }

            ctx.restore();
        }
    },

    drawStarShape(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = (Math.PI / 2) * 3;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
            rot += step;
            ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
            rot += step;
        }
        ctx.closePath();
    },

    drawFreeScene() {
        const ctx = this.ctx;
        const time = performance.now() / 1000;

        this.sceneObjects.forEach((obj, i) => {
            ctx.save();
            ctx.font = `${obj.size}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const floatY = Math.sin(time + i * 0.7) * 5;

            ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
            ctx.shadowBlur = 15;

            ctx.fillText(obj.emoji, obj.x, obj.y + floatY);
            ctx.restore();
        });

        // Instruction
        ctx.save();
        ctx.font = '16px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.textAlign = 'center';
        ctx.fillText('Resimlere serbestçe bakabilirsiniz', this.canvas.width / 2, this.canvas.height - 40);
        ctx.restore();

        // For free gaze, log center as "target"
        this.targetLog.push({
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            time: performance.now()
        });
    },

    endTest() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Remove resize listeners (proper cleanup — no leaks)
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', this._resizeHandler);
            }
            this._resizeHandler = null;
        }

        // Remove touch listeners (proper cleanup — no leaks)
        if (this.canvas) {
            if (this._touchStartHandler) {
                this.canvas.removeEventListener('touchstart', this._touchStartHandler);
                this._touchStartHandler = null;
            }
            if (this._touchMoveHandler) {
                this.canvas.removeEventListener('touchmove', this._touchMoveHandler);
                this._touchMoveHandler = null;
            }
        }

        // Reset timer bar color
        const timerBar = document.getElementById('timerBar');
        if (timerBar) timerBar.style.background = '';

        // Store results
        App.state.testResults[this.currentTest] = {
            gazeData: [...this.gazeLog],
            targetData: [...this.targetLog],
            duration: this.duration,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height
        };

        // Collect cognitive data for this test
        if (Cognitive.isReady) {
            App.state.cognitiveData = Cognitive.getTestResults();
        }

        // Cleanup
        this.gazeLog = [];
        this.targetLog = [];

        App.onTestComplete(this.currentTest);
    }
};
