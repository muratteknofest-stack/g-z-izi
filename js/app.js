/* ============================================
   GÖZ-İZİ - Ana Uygulama (app.js)
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
    isMobile: false
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
        // Pause test if screen goes off
        Tests.isRunning = false;
      }
    });
  },

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (window.innerWidth <= 768 && 'ontouchstart' in window);
  },

  handleOrientation() {
    // Handled by CSS media queries, this just forces layout recalc
    if (Tests.isRunning && Tests.canvas) {
      Tests.resizeCanvas();
    }
  },

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
      // Scroll to top on mobile
      window.scrollTo(0, 0);
    }
  },

  showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  async startCalibration() {
    const name = document.getElementById('childName').value.trim();
    const age = document.getElementById('childAge').value;
    const grade = document.getElementById('childGrade').value;
    const tester = document.getElementById('testerName').value.trim();

    if (!name) {
      this.showToast('Lütfen çocuğun adını girin.', 'error');
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

    this.showScreen('calibrationScreen');

    // Try fullscreen on mobile for better experience
    this.requestFullscreen();

    try {
      await this.initWebGazer();
      Calibration.start();
    } catch (err) {
      console.error('WebGazer başlatılamadı:', err);
      this.showToast('Kamera erişimi sağlanamadı. Lütfen kamera iznini verin.', 'error');
      setTimeout(() => this.showScreen('infoScreen'), 2000);
    }
  },

  async initWebGazer() {
    if (this.state.webgazerReady) return;

    await webgazer
      .setRegression('ridge')
      .setGazeListener((data, timestamp) => {
        if (data == null) return;
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

    // Show camera preview
    const video = webgazer.getVideoElementCanvas();
    if (video) {
      const preview = document.getElementById('cameraPreview');
      const cameraVideo = document.getElementById('cameraVideo');

      const webgazerVideo = document.getElementById('webgazerVideoFeed');
      if (webgazerVideo && webgazerVideo.srcObject) {
        cameraVideo.srcObject = webgazerVideo.srcObject;
      }
      preview.classList.remove('hidden');
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
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
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
      this.showToast(`Test tamamlandı! (${this.state.completedTests.length}/3)`, 'success');
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
      document.getElementById(id).classList.remove('completed');
    });
    document.getElementById('showResultsBtn').style.display = 'none';

    this.exitFullscreen();
    this.unlockBodyScroll();
    this.showScreen('welcomeScreen');
    this.showToast('Yeni test oturumu başlatıldı.', 'info');
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => App.init());
