/*
 * RCJ Voice Orb —— 声纹球（呼吸式同心波纹）
 * 替代「柱状频谱」的音频可视化，统一各产品的录音设计语言。
 *
 * 用法（UMD：普通 <script> 或 CommonJS 均可）：
 *   <script src="voice-orb.js"></script>
 *   const orb = RCJVoiceOrb.createVoiceOrb(containerEl, '#b54846');
 *   orb.start(analyserNode);   // 录音开始，传入 Web Audio AnalyserNode
 *   orb.stop();                // 录音结束，复位静止态
 *
 * 设计原则：结构/DOM/逻辑全产品统一，仅 accent 颜色随产品换。
 */
(function (global) {
  'use strict';

  function createVoiceOrb(container, accent) {
    accent = accent || '#ea4335';
    var svgNS = 'http://www.w3.org/2000/svg';

    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 160 160');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '声纹可视化');

    // 中心核
    var core = document.createElementNS(svgNS, 'circle');
    core.setAttribute('cx', '80');
    core.setAttribute('cy', '80');
    core.setAttribute('r', '18');
    core.setAttribute('fill', accent);
    core.style.transition = 'r .15s ease';

    // 三层同心波纹
    var rings = [];
    for (var i = 0; i < 3; i++) {
      var r = document.createElementNS(svgNS, 'circle');
      r.setAttribute('cx', '80');
      r.setAttribute('cy', '80');
      r.setAttribute('r', '24');
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', accent);
      r.setAttribute('stroke-width', '1.5');
      r.setAttribute('opacity', String(0.4 - i * 0.12));
      rings.push({ el: r, phase: i * 2.1, speed: 1.8 + i * 0.4 });
      svg.appendChild(r);
    }
    svg.appendChild(core);
    container.appendChild(svg);

    var raf = null;
    var data = null;

    function frame(analyser) {
      analyser.getByteFrequencyData(data);
      var sum = 0;
      for (var i = 0; i < data.length; i++) sum += data[i];
      var level = Math.min(1, (sum / data.length / 255) * 2.2); // 放大，反应更灵敏

      core.setAttribute('r', String(16 + level * 10));

      var t = Date.now() / 1000;
      rings.forEach(function (o, idx) {
        var breathe = 24 + Math.sin(t * o.speed + o.phase) * (6 + level * 20);
        var pulse = 24 + level * (18 + idx * 10);
        o.el.setAttribute('r', String(Math.max(22, breathe * 0.45 + pulse * 0.55)));
        o.el.setAttribute('opacity', String((0.35 - idx * 0.1) * (0.4 + level * 0.6)));
        o.el.setAttribute('stroke-width', String(1 + level * 1.5));
      });

      raf = requestAnimationFrame(function () { frame(analyser); });
    }

    return {
      start: function (analyser) {
        if (!analyser) return;
        data = new Uint8Array(analyser.frequencyBinCount);
        if (raf) cancelAnimationFrame(raf);
        frame(analyser);
      },
      stop: function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        core.setAttribute('r', '18');
        rings.forEach(function (o, idx) {
          o.el.setAttribute('r', '24');
          o.el.setAttribute('opacity', String(0.4 - idx * 0.12));
          o.el.setAttribute('stroke-width', '1.5');
        });
      }
    };
  }

  var api = { createVoiceOrb: createVoiceOrb };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCJVoiceOrb = api;
})(typeof window !== 'undefined' ? window : this);
