/*
 * rcj-motion.js — RCJ Motion Engine
 * GSAP-based brand motion library. Self-hosted vendor (gsap / ScrollTrigger / SplitText),
 * no third-party CDN. Exposes window.RCJMotion with 6 atomic effect APIs.
 *
 * Requires, loaded BEFORE this file:
 *   <script src="vendor/gsap.min.js"></script>
 *   <script src="vendor/ScrollTrigger.min.js"></script>
 *   <script src="vendor/SplitText.min.js"></script>
 *
 * Every API degrades gracefully:
 *   - if GSAP is missing -> elements are simply shown (no animation)
 *   - if prefers-reduced-motion: reduce -> elements are shown, no motion
 */
(function (global) {
  'use strict';

  var hasGsap = !!global.gsap;
  var prefersReduced = !!(global.matchMedia &&
    global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Register plugins if present
  var plugins = [];
  if (global.ScrollTrigger) plugins.push(global.ScrollTrigger);
  if (global.SplitText) plugins.push(global.SplitText);
  if (hasGsap && plugins.length) {
    try { global.gsap.registerPlugin.apply(global.gsap, plugins); } catch (e) {}
  }

  var RCJ = {};

  function toArray(target) {
    if (!target) return [];
    if (typeof target === 'string') return Array.prototype.slice.call(document.querySelectorAll(target));
    if (target.nodeType) return [target];
    if (target.length !== undefined) return Array.prototype.slice.call(target);
    return [target];
  }

  function showAll(els) {
    toArray(els).forEach(function (el) {
      el.style.opacity = 1;
      el.style.transform = 'none';
      el.style.filter = 'none';
    });
  }

  /* ============================================================
   * 1) ENTRANCE — fade + slight rise + optional scale
   *    Grounded in rcj-hub hero h1/eyebrow entrance.
   * ============================================================ */
  RCJ.entrance = function (target, opts) {
    opts = opts || {};
    var els = toArray(target);
    if (!hasGsap || prefersReduced) { showAll(els); return; }
    var from = {
      y: opts.y != null ? opts.y : 28,
      opacity: 0,
      scale: opts.scale != null ? opts.scale : 1,
      duration: opts.duration || 0.85,
      ease: opts.ease || 'back.out(1.6)',
      delay: opts.delay || 0,
      stagger: opts.stagger || 0.08,
      clearProps: 'opacity,transform'
    };
    if (opts.from) Object.assign(from, opts.from);
    if (opts.clearProps === false) delete from.clearProps;
    global.gsap.from(els, from);
  };

  /* ============================================================
   * 2) TEXT — SplitText line-mask reveal
   *    Grounded in rcj-hub hero h1 SplitText(lines, mask:'lines').
   *    Falls back to plain fade when SplitText is unavailable.
   * ============================================================ */
  RCJ.textReveal = function (el, opts) {
    opts = opts || {};
    el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!el) return;
    if (!hasGsap || prefersReduced) { el.style.opacity = 1; return; }
    if (!global.SplitText) {
      global.gsap.from(el, { y: 24, opacity: 0, duration: 0.8, ease: 'power3.out', clearProps: 'opacity,transform' });
      return;
    }
    try {
      var split = new global.SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'rcj-split-line' });
      global.gsap.from(split.lines, {
        yPercent: opts.yPercent != null ? opts.yPercent : 118,
        duration: opts.duration || 1.05,
        ease: opts.ease || 'power4.out',
        stagger: opts.stagger || 0.12,
        delay: opts.delay || 0.2,
        clearProps: 'transform'
      });
    } catch (e) {
      global.gsap.from(el, { y: 24, opacity: 0, duration: 0.8, ease: 'power3.out', clearProps: 'opacity,transform' });
    }
  };

  /* ============================================================
   * 3) SCROLL — reveal-on-scroll (y + opacity + blur), ScrollTrigger
   *    Grounded in rcj-hub .reveal fromTo with blur(10px).
   * ============================================================ */
  RCJ.revealOnScroll = function (target, opts) {
    opts = opts || {};
    var els = toArray(target);
    if (!hasGsap || prefersReduced || !global.ScrollTrigger) { showAll(els); return; }
    els.forEach(function (el) {
      global.gsap.fromTo(el,
        { y: opts.y != null ? opts.y : 42, opacity: 0, filter: 'blur(' + (opts.blur != null ? opts.blur : 10) + 'px)' },
        {
          y: 0, opacity: 1, filter: 'blur(0px)',
          duration: opts.duration || 0.9, ease: opts.ease || 'power3.out',
          scrollTrigger: { trigger: el, start: opts.start || 'top 85%', once: true },
          // 动画结束后打 is-visible 标记并清内联样式：
          // 即使后续 JS 异常，CSS 门控(.is-visible)仍保证内容可见，杜绝“动画完反而消失”的残留坑。
          onComplete: function () {
            el.classList.add('is-visible');
            global.gsap.set(el, { clearProps: 'opacity,transform,filter' });
          }
        });
    });
  };

  /* 3b) PARALLAX — scrub parallax tied to scroll position
   *     Grounded in rcj-hub hero-inner yPercent:-26 scrub. */
  RCJ.parallax = function (el, opts) {
    opts = opts || {};
    el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!el || !hasGsap || prefersReduced || !global.ScrollTrigger) return;
    global.gsap.to(el, {
      yPercent: opts.yPercent != null ? opts.yPercent : -26,
      opacity: opts.opacity != null ? opts.opacity : 0.1,
      ease: 'none',
      scrollTrigger: {
        trigger: opts.trigger ? (typeof opts.trigger === 'string' ? document.querySelector(opts.trigger) : opts.trigger) : el,
        start: opts.start || 'top top',
        end: opts.end || 'bottom top',
        scrub: true
      }
    });
  };

  /* ============================================================
   * 4) INTERACTION — magnetic pointer follow
   *    Grounded in rcj-hub magnetic button (gsap.quickTo x/y).
   * ============================================================ */
  RCJ.magnetic = function (el, opts) {
    opts = opts || {};
    el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!el || !hasGsap || prefersReduced) return;
    var dur = opts.duration || 0.5, ease = opts.ease || 'power3';
    var xTo = global.gsap.quickTo(el, 'x', { duration: dur, ease: ease });
    var yTo = global.gsap.quickTo(el, 'y', { duration: dur, ease: ease });
    var strength = opts.strength != null ? opts.strength : 0.35;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
  };

  /* 4b) PRESS — tactile scale on pointer down/up
   *     Grounded in rcj-hub pointerdown scale:0.97 / up scale:1. */
  RCJ.press = function (el, opts) {
    opts = opts || {};
    el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!el || !hasGsap || prefersReduced) return;
    el.addEventListener('pointerdown', function () { global.gsap.to(el, { scale: opts.down || 0.96, duration: 0.16 }); });
    function up() { global.gsap.to(el, { scale: 1, duration: 0.28, ease: 'power2.out' }); }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
  };

  /* 4c) SPOTLIGHT — radial glow follows pointer inside a container */
  RCJ.spotlight = function (container, opts) {
    opts = opts || {};
    container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!container || !hasGsap || prefersReduced) return;
    var spot = document.createElement('span');
    spot.className = 'rcj-spotlight';
    container.appendChild(spot);
    var half = spot.offsetWidth / 2 || 130;
    var xTo = global.gsap.quickTo(spot, 'x', { duration: 0.7, ease: 'power3' });
    var yTo = global.gsap.quickTo(spot, 'y', { duration: 0.7, ease: 'power3' });
    container.addEventListener('pointermove', function (e) {
      var r = container.getBoundingClientRect();
      xTo(e.clientX - r.left - half);
      yTo(e.clientY - r.top - half);
    });
    container.addEventListener('pointerenter', function () { global.gsap.to(spot, { opacity: 1, duration: 0.4 }); });
    container.addEventListener('pointerleave', function () { global.gsap.to(spot, { opacity: 0, duration: 0.4 }); xTo(-half); yTo(-half); });
  };

  /* ============================================================
   * 5) TIMELINE — orchestrate a hero/section sequence
   *    Grounded in rcj-hub staggered hero entrance chain.
   * ============================================================ */
  RCJ.sequence = function (map, opts) {
    opts = opts || {};
    if (!hasGsap || prefersReduced) {
      Object.keys(map).forEach(function (k) {
        var e = document.querySelector(map[k]);
        if (e) { e.style.opacity = 1; e.style.transform = 'none'; }
      });
      return null;
    }
    var tl = global.gsap.timeline({ delay: opts.delay || 0.15 });
    (opts.steps || []).forEach(function (s) {
      var t = map[s.target];
      if (!t) return;
      var from = s.from || { y: 26, opacity: 0 };
      var to = Object.assign({ duration: s.duration || 0.7, ease: s.ease || 'power3.out', clearProps: 'opacity,transform' }, s.to || {});
      tl.fromTo(t, from, to, s.pos || '>');
    });
    return tl;
  };

  /* ============================================================
   * 6) PAGE TRANSITION — curtain wipe overlay
   *    For SPA-ish nav / section switches. onMid fires at full cover
   *    (swap content there), onDone after the curtain lifts.
   * ============================================================ */
  RCJ.pageWipe = function (opts) {
    opts = opts || {};
    if (!hasGsap || prefersReduced) {
      if (opts.onMid) opts.onMid();
      if (opts.onDone) opts.onDone();
      return null;
    }
    var overlay = document.createElement('div');
    overlay.className = 'rcj-wipe';
    if (opts.color) overlay.style.background = opts.color;
    document.body.appendChild(overlay);
    var tl = global.gsap.timeline({
      onComplete: function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (opts.onDone) opts.onDone();
      }
    });
    tl.set(overlay, { transformOrigin: 'bottom center', scaleY: 0 })
      .to(overlay, { scaleY: 1, duration: opts.in || 0.5, ease: 'power3.inOut' })
      .add(function () { if (opts.onMid) opts.onMid(); }, '+=0.02')
      .set(overlay, { transformOrigin: 'top center' })
      .to(overlay, { scaleY: 0, duration: opts.out || 0.5, ease: 'power3.inOut' }, '+=0.05');
    return tl;
  };

  // Replay helper — run fn after DOM ready (handy for demo replay buttons)
  RCJ.ready = function (fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };

  global.RCJMotion = RCJ;
})(window);
