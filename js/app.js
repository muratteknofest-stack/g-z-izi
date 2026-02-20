/* ============================================
   GÖZ-İZİ - Ana Uygulama (app.js)
   Raspberry Pi NoIR + IR LED Edition
   Mobil ve masaüstü uyumlu
   ============================================ */

const App = {
  state: {
    childName: '',
    childAge: '',
    childGrade: '',
    testerName: '',
    testDate: '',
    completedTests: [],
    testResults: {},
    webgazerReady: false,
    gazeData: [],
    isMobile: false,
    gazeActive: false
  },

  init() {
    this.state.testDate = new Date().toLocaleDateString('tr-TR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Detect mobile
    this.state.isMobile = this.detectMobile();

    // Prevent pull-to-refresh on mobile
    document.addEventListener('touchmove', (e) => {
      if (document.body.classList.contains('test-active')) {
        e.preventDefault();
      }
    }, { passive: false });

    // Handle orientation changes
    window.addEventListener('orientationchange', () => this.handleOrientation());
    window.addEventListener('resize', () => this.handleOrientation());

    // Handle visibility change (phone screen off/on)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Tests.isRunning) {
        Tests.isRunning = false;
      }
    });

    // Gaze activity indicator
    this._gazeTimeout = null;
  },

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (window.innerWidth <= 768 && 'ontouchstart' in window);
  },

  handleOrientation() {
    if (Tests.isRunning && Tests.canvas) {
      Tests.resizeCanvas();
    }
  },

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
      window.scrollTo(0, 0);
    }
  },

  showLoading(text) {
    const overlay = document.getElementById('loadingOverlay');
    const textEl = document.getElementById('loadingText');
    if (text) textEl.textContent = text;
    overlay.style.display = 'flex';
  },

  hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
  },

  showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || ''} ${message}</span>`;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  },

  async startCalibration() {
    const name = document.getElementById('childName').value.trim();
    const age = document.getElementById('childAge').value;
    const grade = document.getElementById('childGrade').value;
    const tester = document.getElementById('testerName').value.trim();

    if (!name) {
      this.showToast('Lütfen çocuğun adını girin.', 'error');
      document.getElementById('childName').focus();
      return;
    }
    if (!age) {
      this.showToast('Lütfen yaş seçin.', 'error');
      return;
    }

    this.state.childName = name;
    this.state.childAge = age;
    this.state.childGrade = grade || '-';
    this.state.testerName = tester || 'Belirtilmedi';

    // Show loading while WebGazer initializes
    this.showLoading('NoIR kamera başlatılıyor...');

    try {
      await this.initWebGazer();
      this.hideLoading();
      this.showScreen('calibrationScreen');
      this.requestFullscreen();
      Calibration.start();
    } catch (err) {
      this.hideLoading();
      console.error('WebGazer başlatılamadı:', err);
      this.showToast('Kamera erişimi sağlanamadı. Lütfen kamera iznini verin ve sayfayı yenileyin.', 'error');
    }
  },

  async initWebGazer() {
    if (this.state.webgazerReady) return;

    try {
      await webgazer
        .setRegression('ridge')
        .setGazeListener((data, timestamp) => {
          if (data == null) {
            this.state.gazeActive = false;
            return;
          }
          this.state.gazeActive = true;

          // Update gaze indicator
          this.updateGazeIndicator(true);

          if (Tests.isRunning) {
            Tests.recordGaze(data.x, data.y, timestamp);
          }
        })
        .begin();

      webgazer.showVideoPreview(false)
        .showPredictionPoints(false)
        .showFaceOverlay(false)
        .showFaceFeedbackBox(false);

      this.state.webgazerReady = true;

      // Show camera preview using the stream from webgazer
      this.setupCameraPreview();

    } catch (err) {
      throw new Error('Kamera erişimi reddedildi: ' + err.message);
    }
  },

  setupCameraPreview() {
    const cameraVideo = document.getElementById('cameraVideo');
    const preview = document.getElementById('cameraPreview');

    // Try to get the stream from webgazer's video element
    const webgazerVideo = document.getElementById('webgazerVideoFeed');
    if (webgazerVideo && webgazerVideo.srcObject) {
      cameraVideo.srcObject = webgazerVideo.srcObject;
      preview.classList.remove('hidden');
      return;
    }

    // Fallback: try to find any video element created by webgazer
    const videos = document.querySelectorAll('video');
    for (const v of videos) {
      if (v.id !== 'cameraVideo' && v.srcObject) {
        cameraVideo.srcObject = v.srcObject;
        preview.classList.remove('hidden');
        return;
      }
    }

    // Last fallback: direct getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          cameraVideo.srcObject = stream;
          preview.classList.remove('hidden');
        })
        .catch(() => {
          console.warn('Camera preview unavailable');
        });
    }
  },

  updateGazeIndicator(active) {
    const dot = document.getElementById('hudGazeDot');
    if (!dot) return;

    if (active) {
      dot.classList.add('active');
      clearTimeout(this._gazeTimeout);
      this._gazeTimeout = setTimeout(() => {
        dot.classList.remove('active');
      }, 500);
    } else {
      dot.classList.remove('active');
    }
  },

  requestFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => { });
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  },

  exitFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  },

  lockBodyScroll() {
    document.body.classList.add('test-active');
  },

  unlockBodyScroll() {
    document.body.classList.remove('test-active');
  },

  onCalibrationComplete() {
    this.showScreen('testSelectScreen');
    this.showToast('Kalibrasyon tamamlandı! Testlere başlayabilirsiniz.', 'success');
  },

  onTestComplete(testType) {
    this.unlockBodyScroll();

    if (!this.state.completedTests.includes(testType)) {
      this.state.completedTests.push(testType);
    }

    const cardMap = { star: 'testCard1', ball: 'testCard2', free: 'testCard3' };
    const card = document.getElementById(cardMap[testType]);
    if (card) card.classList.add('completed');

    this.showScreen('testSelectScreen');

    if (this.state.completedTests.length >= 3) {
      document.getElementById('showResultsBtn').style.display = '';
      this.showToast('Tüm testler tamamlandı! Sonuçları görebilirsiniz.', 'success');
    } else {
      const remaining = 3 - this.state.completedTests.length;
      this.showToast(`Test tamamlandı! ${remaining} test kaldı.`, 'success');
    }
  },

  showResults() {
    Analysis.calculateAll();
    this.showScreen('resultsScreen');
    Analysis.renderResults();
    HeatmapRenderer.renderCombined('heatmapCanvas');
  },

  resetAll() {
    this.state.completedTests = [];
    this.state.testResults = {};
    this.state.gazeData = [];

    document.getElementById('childName').value = '';
    document.getElementById('childAge').value = '';
    document.getElementById('childGrade').value = '';
    document.getElementById('testerName').value = '';

    ['testCard1', 'testCard2', 'testCard3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('completed');
    });

    const btn = document.getElementById('showResultsBtn');
    if (btn) btn.style.display = 'none';

    this.exitFullscreen();
    this.unlockBodyScroll();
    this.showScreen('welcomeScreen');
    this.showToast('Yeni test oturumu başlatıldı.', 'info');
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => App.init());
