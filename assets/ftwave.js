// ftwave.js — FaceTalk 复用 rcj-audio-core 的实时频谱柱状图（非模块全局版）
// 暴露 window.RCJWave = { mountLiveBars, fitCanvas, lerpHex }
// v2：在 v1 单色基础上，新增 colorFn / gradient / wobble / pulse 情绪化着色与动效
// v3：onLevel 音量回调节点 / bloom 外发光 / floorGlow 地面光（驱动页面环境光呼吸）
// v4：感知升级（默认开，纯算法）—— logScale 对数频率映射 + aWeight A计权 + bands/bars/onBands
// v5：视觉冲击 —— mirror 镜像反射 + centerGlow 中心辉光 + radialBg 径向背景（播放器手动开）
// v6：情绪性格化 —— barWidthRatio / capStyle(hard|soft) / wobbleKind(sine|random) / mirrorAsym
//     （与 Speak Series 共享波形模块同代算法，API 完全向后兼容，旧调用不破）
(function (global) {
  function fitCanvas(canvas, cssHeight) {
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 320;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round((cssHeight || 60) * dpr);
    canvas.style.width = '100%';
    canvas.style.height = (cssHeight || 60) + 'px';
  }

  function roundRect(ctx, x, y, w, h, r) {
    var maxR = Math.min(Math.abs(w), Math.abs(h)) / 2;
    var tr = Math.min(r.tr || 0, maxR), br = Math.min(r.br || 0, maxR), bl = Math.min(r.bl || 0, maxR), tl = Math.min(r.tl || 0, maxR);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    if (h.length !== 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  // 两个 #rrggbb 按比例 t(0..1) 插值，用于 gradient / colorFn 音量着色
  function lerpHex(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    var pa = hexToRgb(a), pb = hexToRgb(b);
    if (!pa || !pb) return a;
    var r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    var g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    var bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function hexToRgba(h, a) {
    var p = hexToRgb(h);
    if (!p) return h;
    return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + Math.max(0, Math.min(1, a)) + ')';
  }

  function mountLiveBars(canvas, analyser, opts) {
    opts = opts || {};
    var color = opts.color || '#7b8fc4';        // FaceTalk 默认（青蓝）
    var colorFn = opts.colorFn || null;          // (v, i, n) => cssColor，优先于 color / gradient
    var gradient = opts.gradient || null;        // [c1, c2] 跨整片场由 c1→c2 渐变
    var barGap = opts.barGap != null ? opts.barGap : 1.5;
    var smoothing = opts.smoothing != null ? opts.smoothing : 0.7;
    var minBarHeight = opts.minBarHeight != null ? opts.minBarHeight : 2;
    var alpha = opts.alpha != null ? opts.alpha : 0.85;
    var capAlpha = opts.capAlpha != null ? opts.capAlpha : 0.4;
    var capDecay = opts.capDecay != null ? opts.capDecay : 0.96;
    var borderRadius = opts.borderRadius != null ? opts.borderRadius : 2;
    var wobble = opts.wobble != null ? opts.wobble : 0;     // 0..1 随机高度抖动（急躁/颤抖）
    var pulse = opts.pulse != null ? opts.pulse : 0;        // 0..1 整体呼吸律动
    // v3
    var onLevel = opts.onLevel || null;          // (level 0..1) => void，每帧平滑音量
    var bloom = opts.bloom != null ? opts.bloom : 0;        // 0..1 柱体外发光强度
    var floorGlow = opts.floorGlow || null;      // cssHex 底部地面光晕色
    var levelFps = opts.levelFps != null ? opts.levelFps : 15;
    // v4 — 感知升级（默认开，纯算法）
    var logScale = opts.logScale != null ? opts.logScale : true;     // 对数频率映射：人声/低频占更多柱
    var aWeight = opts.aWeight != null ? opts.aWeight : true;        // A 计权(IEC 61672)：按人耳感知重塑频谱
    var bands = opts.bands || [50, 8000];        // 显示频率范围 [Hz]
    var bars = opts.bars != null ? opts.bars : 64;                  // 屏幕柱数
    var onBands = opts.onBands || null;          // (bass,mid,treble)=>void 各频段能量 0..1
    // v5 — 视觉冲击（播放器手动开）
    var mirror = opts.mirror != null ? opts.mirror : false;         // 镜像反射：柱子从中心轴向上下对称展开
    var centerGlow = opts.centerGlow || null;     // 中心轴辉光线（随音量呼吸，仅 mirror）
    var radialBg = opts.radialBg || null;         // 径向背景渐变 [centerHex, edgeHex]
    // v6 — 情绪性格化（P0-3）：用「形状」区分情绪，不只靠颜色
    var barWidthRatio = opts.barWidthRatio != null ? opts.barWidthRatio : 1;     // 柱宽倍率（>1 粗壮 / <1 纤细）
    var capStyle = opts.capStyle || 'soft';       // 'soft' 圆润帽 | 'hard' 实心尖顶（爆发感）
    var wobbleKind = opts.wobbleKind || 'random'; // 'random' 抖动 | 'sine' 缓慢正弦摇摆（呼吸感）
    var mirrorAsym = opts.mirrorAsym != null ? opts.mirrorAsym : 0; // 0..1 镜像上下不对称（>0 上半更高=更躁动）

    var ctx = canvas.getContext('2d');
    analyser.smoothingTimeConstant = smoothing;
    var freqCount = analyser.frequencyBinCount;
    var data = new Uint8Array(freqCount);

    // ── 预计算（仅一次）：采样率、A 计权曲线、频段 bin 边界 ──
    var sampleRate = (analyser.context && analyser.context.sampleRate) || 44100;
    var fftSize = analyser.fftSize || (freqCount * 2);
    var binToFreq = function (b) { return (b * sampleRate) / fftSize; };

    // IEC 61672 A 计权（dB）→ 归一化为 0..1 乘子（重塑频谱以贴合人耳）
    var aWeightDb = function (f) {
      var f2 = f * f, f4 = f2 * f2;
      var num = 12200 * 12200 * f2 * f4;
      var den = (f2 + 424.36) * Math.sqrt((f2 + 11592.09) * (f2 + 544332.84)) * (f2 + 148840000);
      return 2.0 + 20 * Math.log10(num / den);
    };
    var awMax = -Infinity;
    for (var f = bands[0]; f <= bands[1]; f *= 1.005) awMax = Math.max(awMax, aWeightDb(f));
    var awBin = new Float32Array(freqCount);
    for (var b = 0; b < freqCount; b++) {
      awBin[b] = aWeight ? Math.pow(10, (aWeightDb(binToFreq(b)) - awMax) / 20) : 1;
    }

    // 每根显示柱覆盖的 bin 范围：logScale→对数（人声/低频占更多柱），否则线性均分
    var N = Math.max(16, Math.min(120, bars | 0));
    var binRanges = [];
    if (logScale) {
      var edges = new Float32Array(N + 1);
      for (var k = 0; k <= N; k++) edges[k] = bands[0] * Math.pow(bands[1] / bands[0], k / N);
      for (var k2 = 0; k2 < N; k2++) {
        var s = Math.max(1, Math.round((edges[k2] * fftSize) / sampleRate));
        var e = Math.max(s, Math.round((edges[k2 + 1] * fftSize) / sampleRate));
        binRanges.push([s, Math.min(freqCount - 1, e)]);
      }
    } else {
      var span = freqCount - 2;
      for (var k3 = 0; k3 < N; k3++) {
        var s2 = 1 + Math.floor((span * k3) / N);
        var e2 = Math.max(s2, 1 + Math.floor((span * (k3 + 1)) / N) - 1);
        binRanges.push([s2, Math.min(freqCount - 1, e2)]);
      }
    }
    // 防御：每根柱至少覆盖 1 个 bin（避免极低频段塌成 0 宽 → 死柱）
    for (var k4 = 0; k4 < N; k4++) {
      if (binRanges[k4][1] < binRanges[k4][0] + 1) binRanges[k4][1] = binRanges[k4][0] + 1;
    }
    // 统计各频段柱数（子带归一用）
    var bassBars = 0, midBars = 0, treBars = 0;
    for (var k5 = 0; k5 < N; k5++) {
      var fc = binToFreq((binRanges[k5][0] + binRanges[k5][1]) / 2);
      if (fc < 250) bassBars++; else if (fc < 2000) midBars++; else treBars++;
    }

    var raf, caps = new Float32Array(N);
    var level = 0;
    var lastEmit = 0, lastSent = -1;
    var emitGap = 1000 / Math.max(1, levelFps);

    function draw() {
      analyser.getByteFrequencyData(data);
      var w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      var beat = pulse ? (1 + pulse * 0.35 * Math.sin(Date.now() / 170)) : 1;

      // ── 逐柱聚合：对数频段 + A 计权（peak 偏置，更有冲击力）──
      var vals = new Float32Array(N);
      var bassSum = 0, midSum = 0, treSum = 0;
      for (var k = 0; k < N; k++) {
        var range = binRanges[k], ps = range[0], pe = range[1];
        var peak = 0, acc = 0, n = 0;
        for (var bi = ps; bi <= pe; bi++) {
          var val = data[bi] * awBin[bi];
          if (val > peak) peak = val;
          acc += val; n++;
        }
        var v = (peak * 0.7 + (acc / Math.max(1, n)) * 0.3) / 255;
        vals[k] = v;
        var fcv = binToFreq((ps + pe) / 2);
        if (fcv < 250) bassSum += v; else if (fcv < 2000) midSum += v; else treSum += v;
      }
      // 子带能量 0..1（按柱数归一 + 轻放大让小声也可见）
      var bassLevel = bassBars ? Math.min(1, (bassSum / bassBars) * 1.35) : 0;
      var midLevel = midBars ? Math.min(1, (midSum / midBars) * 1.15) : 0;
      var treLevel = treBars ? Math.min(1, (treSum / treBars) * 1.6) : 0;

      // 整体音量以「人声主体 mid」为准 → 环境光呼吸更贴说话强度
      var raw = Math.min(1, midLevel);
      level = level * 0.78 + raw * 0.22;

      // ── 径向背景（mirror 模式：从中心向外扩散的呼吸光晕）──
      if (radialBg && level > 0.02) {
        var cx = w / 2, cy = h / 2, r = Math.max(w, h) * 0.65;
        var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        var bgA = Math.min(0.18, level * 0.28);
        rg.addColorStop(0, hexToRgba(radialBg[0], bgA));
        rg.addColorStop(0.6, hexToRgba(radialBg[1], bgA * 0.35));
        rg.addColorStop(1, hexToRgba(radialBg[1], 0));
        ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
      }
      // 底部地面光（非 mirror 模式：由低频驱动；mirror 模式跳过，用径向背景替代）
      if (!mirror && floorGlow && bassLevel > 0.02) {
        var g = ctx.createLinearGradient(0, h, 0, h * 0.45);
        g.addColorStop(0, hexToRgba(floorGlow, Math.min(0.42, bassLevel * 0.55)));
        g.addColorStop(1, hexToRgba(floorGlow, 0));
        ctx.fillStyle = g; ctx.fillRect(0, h * 0.45, w, h * 0.55);
      }

      var slot = w / N;
      var barW = Math.max(1.5, Math.min(slot * 1.06, slot * barWidthRatio - barGap));
      var maxH = mirror ? h * 0.46 : h * 0.9;
      var baseY = mirror ? h / 2 : h;

      for (var k = 0; k < N; k++) {
        var v = vals[k];
        if (pulse) v = v * beat;
        if (wobble) {
          if (wobbleKind === 'sine') v = v * (1 + wobble * 0.5 * Math.sin(Date.now() / 620 + k * 0.35));
          else v = v * (1 + wobble * (Math.random() - 0.5));
        }
        v = Math.max(0, Math.min(1, v));

        var barH = Math.max(minBarHeight, v * maxH);
        var x = k * slot + barGap / 2;

        if (v * maxH > caps[k]) caps[k] = v * maxH; else caps[k] *= capDecay;

        var col = color;
        if (colorFn) col = colorFn(v, k, N);
        else if (gradient) col = lerpHex(gradient[0], gradient[1], k / N);

        var drawBar = function (y, ht, rTop, rBot) {
          if (bloom > 0 && v > 0.08) {
            ctx.globalAlpha = alpha * bloom * 0.35 * Math.min(1, v * 1.8);
            ctx.fillStyle = col;
            var pad = 2 + bloom * 3.5;
            roundRect(ctx, x - pad, y - pad, barW + pad * 2, ht + pad * 2,
              { tl: rTop + pad, tr: rTop + pad, br: rBot + pad, bl: rBot + pad });
            ctx.fill();
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = col;
          roundRect(ctx, x, y, barW, ht, { tl: rTop, tr: rTop, br: rBot, bl: rBot });
          ctx.fill();
        };

        if (mirror) {
          var asym = mirrorAsym || 0;
          var topH = barH * (1 + asym * 0.5);
          var botH = barH * (1 - asym * 0.5);
          drawBar(baseY - topH, topH, borderRadius, 0);
          drawBar(baseY, botH * 0.92, 0, borderRadius);
        } else {
          drawBar(baseY - barH, barH, borderRadius, 0);
        }

        if (caps[k] > minBarHeight + 1) {
          ctx.globalAlpha = capAlpha;
          ctx.fillStyle = col;
          if (capStyle === 'hard') {
            var ch = Math.max(2, minBarHeight + 1.5);
            if (mirror) {
              ctx.fillRect(x, baseY - caps[k] - ch, barW, ch);
              ctx.fillRect(x, baseY + caps[k], barW, ch);
            } else {
              ctx.fillRect(x, baseY - caps[k] - ch, barW, ch);
            }
          } else if (mirror) {
            ctx.fillRect(x, baseY - caps[k], barW, 1.2);
          } else {
            ctx.fillRect(x, baseY - caps[k], barW, 1.5);
          }
        }
      }

      ctx.globalAlpha = 1;

      if (mirror && centerGlow && level > 0.03) {
        var lineA = Math.min(0.7, level * 0.9 + 0.15);
        var lineW = Math.max(1, 1.5 + level * 2.5);
        ctx.globalAlpha = lineA;
        ctx.fillStyle = centerGlow;
        ctx.fillRect(0, h / 2 - lineW / 2, w, lineW);
        ctx.globalAlpha = lineA * 0.25;
        ctx.fillRect(0, h / 2 - lineW * 3, w, lineW * 1.5);
        ctx.fillRect(0, h / 2 + lineW * 1.5, w, lineW * 1.5);
        ctx.globalAlpha = 1;
      }

      if (onLevel) {
        var now = Date.now();
        if (now - lastEmit >= emitGap) {
          var q = Math.round(level * 100) / 100;
          if (q !== lastSent) { onLevel(q); lastSent = q; }
          lastEmit = now;
        }
      }
      if (onBands) onBands(bassLevel, midLevel, treLevel);

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return function () { cancelAnimationFrame(raf); };
  }

  global.RCJWave = { mountLiveBars: mountLiveBars, fitCanvas: fitCanvas, lerpHex: lerpHex };
})(window);
