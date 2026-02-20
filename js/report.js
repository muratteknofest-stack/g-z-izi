/* ============================================
   GÖZ-İZİ - Rapor Oluşturma (report.js)
   ============================================ */

const Report = {
  generate() {
    const state = App.state;
    const r = Analysis.results;
    const avgMetrics = Analysis.getAverageMetrics();

    const testNames = { star: 'Yıldız Takibi', ball: 'Top Takibi', free: 'Serbest Bakış' };

    const reportContent = document.getElementById('reportContent');

    // Build report HTML
    reportContent.innerHTML = `
      <!-- Report Header -->
      <div class="report-header">
        <h1>👁️ Göz-İzi Tarama Raporu</h1>
        <p>Raspberry Pi NoIR + IR LED Donanım Tabanlı Göz Takibi Analiz Sonuçları</p>
      </div>

      <div class="report-body">
        <!-- Participant Info -->
        <div class="report-section">
          <h3>📋 Katılımcı Bilgileri</h3>
          <div class="report-info-grid">
            <div class="report-info-item">
              <span class="report-info-label">Ad:</span>
              <span class="report-info-value">${state.childName}</span>
            </div>
            <div class="report-info-item">
              <span class="report-info-label">Yaş:</span>
              <span class="report-info-value">${state.childAge} yaş</span>
            </div>
            <div class="report-info-item">
              <span class="report-info-label">Sınıf:</span>
              <span class="report-info-value">${state.childGrade}. Sınıf</span>
            </div>
            <div class="report-info-item">
              <span class="report-info-label">Test Eden:</span>
              <span class="report-info-value">${state.testerName}</span>
            </div>
            <div class="report-info-item">
              <span class="report-info-label">Tarih:</span>
              <span class="report-info-value">${state.testDate}</span>
            </div>
            <div class="report-info-item">
              <span class="report-info-label">Genel Skor:</span>
              <span class="report-info-value" style="color:${this.getScoreColor(r.overall)};font-size:1.1rem;">
                ${r.overall}/100
              </span>
            </div>
          </div>
        </div>

        <!-- Test Results -->
        <div class="report-section">
          <h3>📊 Test Sonuçları</h3>
          <div class="report-metrics">
            ${Object.keys(r.tests).map(type => `
              <div class="report-metric">
                <div class="report-metric-value" style="color:${this.getScoreColor(r.tests[type].overallScore)}">
                  ${r.tests[type].overallScore}
                </div>
                <div class="report-metric-name">${testNames[type] || type}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Detailed Metrics -->
        <div class="report-section">
          <h3>📈 Detaylı Metrikler</h3>
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Metrik</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Değer</th>
                <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Durum</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">Odaklanma Skoru</td>
                <td style="padding:10px;text-align:center;font-weight:600;">${avgMetrics.focusScore}%</td>
                <td style="padding:10px;text-align:center;">${this.getStatusBadge(avgMetrics.focusScore)}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">Stabilite Skoru</td>
                <td style="padding:10px;text-align:center;font-weight:600;">${avgMetrics.stabilityScore}%</td>
                <td style="padding:10px;text-align:center;">${this.getStatusBadge(avgMetrics.stabilityScore)}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">Takip Başarısı</td>
                <td style="padding:10px;text-align:center;font-weight:600;">${avgMetrics.trackingSuccess}%</td>
                <td style="padding:10px;text-align:center;">${this.getStatusBadge(avgMetrics.trackingSuccess)}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">Dikkat Kaybı Sayısı</td>
                <td style="padding:10px;text-align:center;font-weight:600;">${avgMetrics.attentionLossCount}</td>
                <td style="padding:10px;text-align:center;">${this.getAttentionBadge(avgMetrics.attentionLossCount)}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">Ortalama Tepki Süresi</td>
                <td style="padding:10px;text-align:center;font-weight:600;">${avgMetrics.avgReactionTime} ms</td>
                <td style="padding:10px;text-align:center;">—</td>
              </tr>
              <tr>
                <td style="padding:10px;">Toplam Veri Noktası</td>
                <td style="padding:10px;text-align:center;font-weight:600;">${avgMetrics.gazePointCount}</td>
                <td style="padding:10px;text-align:center;">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Heatmap -->
        <div class="report-section">
          <h3>🗺️ Göz Bakış Isı Haritası</h3>
          <div class="report-heatmap">
            <canvas id="reportHeatmap"></canvas>
          </div>
          <p style="font-size:0.75rem;color:#94a3b8;text-align:center;">
            Kırmızı alanlar yoğun bakış bölgelerini, mavi alanlar az bakılan bölgeleri gösterir.
          </p>
        </div>

        <!-- Assessment -->
        <div class="report-section">
          <h3>🩺 Genel Değerlendirme</h3>
          <div class="report-assessment ${r.assessmentLevel}">
            <strong style="font-size:1.2rem;">${this.getAssessmentIcon(r.assessmentLevel)} ${r.assessment}</strong>
            <p style="margin-top:8px;font-size:0.9rem;">
              ${this.getAssessmentText(r.assessmentLevel, state.childName)}
            </p>
          </div>
        </div>

        <!-- Recommendations -->
        <div class="report-section">
          <h3>💡 Öneriler</h3>
          ${this.getRecommendations(r.assessmentLevel)}
        </div>
      </div>

      <!-- Footer / Disclaimer -->
      <div class="report-footer">
        <p class="report-disclaimer">
          <strong>⚠️ Önemli Uyarı:</strong> Bu rapor, Raspberry Pi NoIR kamera ve IR LED aydınlatma sistemi 
          kullanılarak oluşturulmuş bir ön tarama sonucudur. 
          Kesin teşhis koymaz ve tıbbi bir değerlendirme yerine geçmez. 
          Sonuçlar yalnızca ön tarama amacıyla sunulmakta olup, herhangi bir endişe durumunda 
          mutlaka bir <strong>çocuk gelişim uzmanı</strong> veya <strong>göz doktoruna</strong> danışılması tavsiye edilir.
          <br><br>
          <strong>Donanım:</strong> Raspberry Pi 4B + NoIR Camera V2 + 850nm IR LED Aydınlatma<br>
          <strong>Göz-İzi | TEKNOFEST 2026 • Sağlık ve İyi Yaşam Teknolojileri</strong>
        </p>
      </div>
    `;

    App.showScreen('reportScreen');

    // Render heatmap in report after a brief delay (for DOM to be ready)
    setTimeout(() => {
      HeatmapRenderer.renderCombined('reportHeatmap');
    }, 200);
  },

  getScoreColor(score) {
    if (score >= 70) return '#059669';
    if (score >= 40) return '#d97706';
    return '#dc2626';
  },

  getStatusBadge(score) {
    if (score >= 70) return '<span style="background:#ecfdf5;color:#065f46;padding:2px 10px;border-radius:12px;font-size:0.75rem;">İyi</span>';
    if (score >= 40) return '<span style="background:#fffbeb;color:#92400e;padding:2px 10px;border-radius:12px;font-size:0.75rem;">Orta</span>';
    return '<span style="background:#fef2f2;color:#991b1b;padding:2px 10px;border-radius:12px;font-size:0.75rem;">Düşük</span>';
  },

  getAttentionBadge(count) {
    if (count <= 3) return '<span style="background:#ecfdf5;color:#065f46;padding:2px 10px;border-radius:12px;font-size:0.75rem;">Normal</span>';
    if (count <= 8) return '<span style="background:#fffbeb;color:#92400e;padding:2px 10px;border-radius:12px;font-size:0.75rem;">Sık</span>';
    return '<span style="background:#fef2f2;color:#991b1b;padding:2px 10px;border-radius:12px;font-size:0.75rem;">Çok Sık</span>';
  },

  getAssessmentIcon(level) {
    return { normal: '✅', warning: '⚠️', alert: '🔴' }[level] || '📊';
  },

  getAssessmentText(level, name) {
    const texts = {
      normal: `${name}'in göz takip performansı yaşına uygun normal aralıkta değerlendirilmiştir. Odaklanma, stabilite ve hedef takibi parametreleri beklenen düzeydedir. Düzenli kontroller önerilmekle birlikte, şu an için herhangi bir uzmana yönlendirme gerekli görülmemektedir.`,
      warning: `${name}'in göz takip testlerinde bazı parametreler yaşa göre beklenenin altında çıkmıştır. Bu durum; dikkatsizlik, yorgunluk, test ortamı koşulları veya gelişimsel bir farklılık gibi birçok nedenden kaynaklanabilir. Sonuçların uzman bir gözle değerlendirilmesi ve gerekirse bir çocuk gelişim uzmanına danışılması önerilir.`,
      alert: `${name}'in göz takip parametreleri önemli düzeyde sapma göstermektedir. Odaklanma, stabilite ve/veya hedef takibi skorları beklenen aralığın belirgin altındadır. Bu sonuçlar, bir çocuk gelişim uzmanı, psikolog veya göz doktoru tarafından kapsamlı bir değerlendirme yapılmasını gerektirmektedir. Erken müdahale, çocuğun gelişimi için büyük önem taşır.`
    };
    return texts[level] || '';
  },

  getRecommendations(level) {
    const recs = {
      normal: `
        <ul style="padding-left:20px;color:#374151;font-size:0.85rem;line-height:2;">
          <li>Yılda bir kez göz kontrolü yaptırın</li>
          <li>Ekran süresini yaşa uygun şekilde sınırlandırın</li>
          <li>Okuma ve yazma etkinliklerinde doğal ışık tercih edin</li>
          <li>6 ay sonra testi tekrar uygulamayı düşünebilirsiniz</li>
        </ul>
      `,
      warning: `
        <ul style="padding-left:20px;color:#374151;font-size:0.85rem;line-height:2;">
          <li><strong>Bir çocuk gelişim uzmanına danışmanızda fayda olabilir</strong></li>
          <li>Göz sağlığı kontrolü yaptırın</li>
          <li>Dikkat ve odaklanmayı destekleyen aktiviteler planlayın</li>
          <li>Testi farklı saatlerde ve ortamlarda tekrar uygulayarak karşılaştırın</li>
          <li>Öğretmen gözlemlerini bu raporla birlikte değerlendirin</li>
        </ul>
      `,
      alert: `
        <ul style="padding-left:20px;color:#374151;font-size:0.85rem;line-height:2;">
          <li><strong>Mutlaka bir çocuk gelişim uzmanına başvurun</strong></li>
          <li><strong>Kapsamlı bir göz muayenesi yaptırın</strong></li>
          <li>Bu raporu uzman ile paylaşın</li>
          <li>Okul rehberlik servisi ile iletişime geçin</li>
          <li>Erken müdahale programlarını araştırın</li>
          <li>Testi 2 hafta sonra tekrar uygulayarak sonuçları karşılaştırın</li>
        </ul>
      `
    };
    return recs[level] || '';
  }
};
