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
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">
                  <strong>🎯 Sabitleme (Fixation)</strong><br>
                  <small style="color:#94a3b8;">I-DT Algoritması</small>
                </td>
                <td style="padding:10px;text-align:center;font-weight:600;">
                  ${avgMetrics.fixationCount} adet<br>
                  <small>Ort: ${avgMetrics.avgFixationDuration}ms</small>
                </td>
                <td style="padding:10px;text-align:center;">
                  ${this.getFixationBadge(avgMetrics.avgFixationDuration)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">
                  <strong>⚡ Sıçrama (Saccade)</strong><br>
                  <small style="color:#94a3b8;">Genlik & Hız</small>
                </td>
                <td style="padding:10px;text-align:center;font-weight:600;">
                  ${avgMetrics.saccadeCount} adet<br>
                  <small>${avgMetrics.avgSaccadeAmplitude}° / ${avgMetrics.avgSaccadeVelocity}°/sn</small>
                </td>
                <td style="padding:10px;text-align:center;">
                  ${this.getSaccadeBadge(avgMetrics.avgSaccadeAmplitude)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">
                  <strong>🎯 Takip Kazancı (Gain)</strong><br>
                  <small style="color:#94a3b8;">Göz hızı / Hedef hızı</small>
                </td>
                <td style="padding:10px;text-align:center;font-weight:600;">
                  ${avgMetrics.pursuitGain}
                </td>
                <td style="padding:10px;text-align:center;">
                  ${this.getPursuitBadge(avgMetrics.pursuitGain)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;">
                  <strong>🧭 Scanpath Entropy</strong><br>
                  <small style="color:#94a3b8;">Bakış dağılımı homojenliği</small>
                </td>
                <td style="padding:10px;text-align:center;font-weight:600;">
                  ${avgMetrics.scanpathEntropy}
                </td>
                <td style="padding:10px;text-align:center;">
                  ${avgMetrics.scanpathEntropy > 0.6 ? '✅ İyi' : '⚠️ Dar odak'}
                </td>
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

        <!-- Cognitive Analysis Section -->
        ${this.getCognitiveReportSection()}
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
  },

  getFixationBadge(duration) {
    const norms = Analysis.results.ageNorms || { fixDuration: 260 };
    const ratio = duration / norms.fixDuration;
    if (ratio >= 0.7 && ratio <= 1.5) {
      return '<span style="background:#22c55e;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">✅ Normal</span>';
    } else if (ratio >= 0.5) {
      return '<span style="background:#f59e0b;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">⚠️ Sınırda</span>';
    }
    return '<span style="background:#ef4444;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">🔴 Anormal</span>';
  },

  getSaccadeBadge(amplitude) {
    const norms = Analysis.results.ageNorms || { saccadeAmp: 4 };
    if (amplitude <= norms.saccadeAmp * 1.3) {
      return '<span style="background:#22c55e;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">✅ Normal</span>';
    } else if (amplitude <= norms.saccadeAmp * 2) {
      return '<span style="background:#f59e0b;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">⚠️ Büyük</span>';
    }
    return '<span style="background:#ef4444;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">🔴 Aşırı</span>';
  },

  getPursuitBadge(gain) {
    if (gain >= 0.8 && gain <= 1.2) {
      return '<span style="background:#22c55e;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">✅ İdeal</span>';
    } else if (gain >= 0.5) {
      return '<span style="background:#f59e0b;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">⚠️ Zayıf</span>';
    }
    return '<span style="background:#ef4444;color:white;padding:3px 8px;border-radius:10px;font-size:0.72rem;">🔴 Yetersiz</span>';
  },

  getCognitiveReportSection() {
    const cog = App.state.cognitiveData;
    if (!cog) return '';

    const blinkColor = cog.blinkAnalysis.isNormal ? '#22c55e' : '#ef4444';
    const loadColor = cog.pupillometry.cognitiveLoadAvg > 50 ? '#ef4444' :
      cog.pupillometry.cognitiveLoadAvg > 25 ? '#f59e0b' : '#22c55e';
    const avoidColor = cog.headPose.avoidancePercent > 20 ? '#ef4444' :
      cog.headPose.avoidancePercent > 10 ? '#f59e0b' : '#22c55e';

    return `
      <div class="report-section">
        <h3>🧠 Bilişsel Analiz (Cognitive Analysis)</h3>
        <p style="font-size:0.8rem;color:#94a3b8;margin-bottom:14px;">
          MediaPipe Face Mesh ile gerçek zamanlı yüz landmark analizi kullanılarak elde edilmiştir.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-bottom:16px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;">Bilişsel Metrik</th>
              <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Değer</th>
              <th style="padding:10px;text-align:center;border-bottom:2px solid #e2e8f0;">Durum</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:10px;border-bottom:1px solid #f1f5f9;">
                <strong>👁️ Pupillometri</strong><br>
                <small style="color:#94a3b8;">Göz bebeği çapı değişimi → Bilişsel yük</small>
              </td>
              <td style="padding:10px;text-align:center;font-weight:600;">
                Ort. %${cog.pupillometry.avgChange} değişim<br>
                <small>Maks: %${cog.pupillometry.maxDilation}</small>
              </td>
              <td style="padding:10px;text-align:center;">
                <span style="background:${loadColor};color:white;padding:4px 10px;border-radius:12px;font-size:0.72rem;">
                  Yük: %${cog.pupillometry.cognitiveLoadAvg}
                </span><br>
                <small>${cog.pupillometry.cognitiveSpikes} zorluk anı</small>
              </td>
            </tr>
            <tr>
              <td style="padding:10px;border-bottom:1px solid #f1f5f9;">
                <strong>🙈 Göz Kırpma Frekansı</strong><br>
                <small style="color:#94a3b8;">EAR (Eye Aspect Ratio) tabanlı</small>
              </td>
              <td style="padding:10px;text-align:center;font-weight:600;">
                ${cog.blinkAnalysis.blinkRate} kırpma/dk<br>
                <small>Toplam: ${cog.blinkAnalysis.totalBlinks}</small>
              </td>
              <td style="padding:10px;text-align:center;">
                <span style="background:${blinkColor};color:white;padding:4px 10px;border-radius:12px;font-size:0.72rem;">
                  ${cog.blinkAnalysis.isNormal ? 'Normal' : 'Anormal'}
                </span><br>
                <small>${cog.blinkAnalysis.assessment}</small>
              </td>
            </tr>
            <tr>
              <td style="padding:10px;border-bottom:1px solid #f1f5f9;">
                <strong>🗣️ Baş Pozisyonu</strong><br>
                <small style="color:#94a3b8;">Yaw/Pitch/Roll → Kaçınma davranışı</small>
              </td>
              <td style="padding:10px;text-align:center;font-weight:600;">
                ${cog.headPose.avoidanceCount} kaçınma<br>
                <small>${cog.headPose.avoidanceTime}sn süre</small>
              </td>
              <td style="padding:10px;text-align:center;">
                <span style="background:${avoidColor};color:white;padding:4px 10px;border-radius:12px;font-size:0.72rem;">
                  %${cog.headPose.avoidancePercent} kaçınma
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:10px;">
                <strong>🎭 Duygu Durumu</strong><br>
                <small style="color:#94a3b8;">Mikro-ifade analizi</small>
              </td>
              <td style="padding:10px;text-align:center;font-weight:600;">
                ${cog.expression.dominant}
              </td>
              <td style="padding:10px;text-align:center;">
                Stres: %${cog.expression.stressLevel}<br>
                Yorgunluk: %${cog.expression.fatigueLevel}
              </td>
            </tr>
          </tbody>
        </table>

        <p style="font-size:0.72rem;color:#94a3b8;font-style:italic;">
          ℹ️ Pupillometri: Göz bebeği çapındaki %10+ artış bilişsel zorlanma gösterir. 
          Normal göz kırpma frekansı 8-25/dk arasıdır. Baş kaçınması %20'yi aşarsa 
          dikkat eksikliği veya otizm spektrumu açısından değerlendirme önerilir.
          Veri toplama: ${cog.rawDataCounts.pupilSamples} pupil, ${cog.rawDataCounts.expressionSamples} ifade örneği.
        </p>
      </div>
    `;
  }
};
