/*!
 * XadCarousel v2.0.0
 * Carousel Ads — mix images + ad slots in any order
 *
 * ── ASYNC-SAFE SETUP ──────────────────────────────────────────────────────
 * Put this stub in <head> BEFORE any XadCarousel() call:
 *
 *   <script>
 *     window.XadCarousel = window.XadCarousel || function(){
 *       (window._xadQ = window._xadQ||[]).push(Array.prototype.slice.call(arguments));
 *     };
 *   </script>
 *   <script async src="https://cdn.jsdelivr.net/gh/USER/REPO@latest/xad-carousel.js"></script>
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────
 *
 *   XadCarousel(adUnit, slides, height, duration, mode, adSize)
 *
 *   @param {string}        adUnit    GPT ad unit path, e.g. "/1234/my-ad"
 *   @param {number|Array}  slides    • number  → all-ad slides (legacy)
 *                                    • Array   → mixed slides:
 *                                        "ad"           = GPT ad slot
 *                                        "https://…"    = image slide
 *   @param {number}        height    Carousel height in px  (default 300)
 *   @param {number}        duration  Seconds per slide      (default 5)
 *   @param {string}        mode      "auto"|"manual"|"both" (default "auto")
 *   @param {Array}         adSize    GPT size               (default [300,250])
 *
 * ── EXAMPLES ──────────────────────────────────────────────────────────────
 *
 *   // All ads — legacy API still works
 *   XadCarousel("/1234/ad", 4, 300, 5, "auto")
 *
 *   // Mixed: 2 images + 2 ads + 1 image
 *   XadCarousel("/1234/ad",
 *     ["https://img1.jpg", "https://img2.jpg", "ad", "ad", "https://img5.jpg"],
 *     300, 5, "auto"
 *   )
 *
 *   // All images (no GPT needed)
 *   XadCarousel(null,
 *     ["https://a.jpg", "https://b.jpg", "https://c.jpg"],
 *     300, 5, "auto"
 *   )
 */

(function (global) {
  "use strict";

  /* ── state ─────────────────────────────────────────── */
  var _count      = 0;
  var _gptLoaded  = false;
  var _svcEnabled = false;

  /* ── helpers ───────────────────────────────────────── */
  function uid() { return "xadc-" + (++_count) + "-" + Math.random().toString(36).slice(2,6); }
  function px(n) { return n + "px"; }
  function isAdSlot(val) { return !val || val === "ad" || val === 0; }

  function addStyle(css, styleId) {
    if (document.getElementById(styleId)) return;
    var el = document.createElement("style");
    el.id = styleId; el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function onReady(fn) {
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn)
      : fn();
  }

  /* ── normalize slides param ──────────────────────────
     Input:  number (legacy) OR mixed array
     Output: array of {type:"ad"|"img", src:string|null}
  ──────────────────────────────────────────────────── */
  function normalizeSlides(slides) {
    if (!Array.isArray(slides)) {
      var n = Math.max(2, Math.min(parseInt(slides, 10) || 3, 20));
      var out = [];
      for (var i = 0; i < n; i++) out.push({ type: "ad", src: null });
      return out;
    }
    return slides.map(function (s) {
      if (isAdSlot(s)) return { type: "ad",  src: null };
      return              { type: "img", src: String(s) };
    });
  }

  /* ══════════════════════════════════════════════════════
   * BASE CSS
   * ══════════════════════════════════════════════════════ */
  addStyle([
    ".xadc-wrap{width:100%;overflow:hidden;position:relative;box-sizing:border-box;}",
    ".xadc-anim{display:flex;flex:1 1 100%;width:100%;}",
    ".xadc-track{display:flex;flex-shrink:0;transition:transform .5s ease-in-out;}",

    /* all slides */
    ".xadc-slide{",
      "flex-shrink:0;display:flex;align-items:center;justify-content:center;",
      "text-align:center;overflow:visible;box-sizing:border-box;background:#f0f0f0;",
    "}",

    /* ad slide: position:relative so label can anchor inside */
    ".xadc-slide.is-ad{position:relative;}",
    /* GPT injects <div style="width:Xpx;height:Ypx"> → center it */
    ".xadc-slide.is-ad>div{display:block;margin:0 auto;line-height:0;}",

    /* ── vertical "Advertisement" label ── */
    ".xadc-ad-label{",
      "position:absolute;",
      "right:0;top:0;bottom:0;",        /* full height of slide */
      "width:16px;",
      "display:flex;align-items:center;justify-content:center;",
      "writing-mode:vertical-rl;",       /* rotate text 90° */
      "text-orientation:mixed;",
      "font-family:Arial,sans-serif;",
      "font-size:9px;",
      "font-weight:600;",
      "letter-spacing:1.5px;",
      "text-transform:uppercase;",
      "color:rgba(0,0,0,.28);",
      "background:rgba(0,0,0,.04);",
      "border-left:1px solid rgba(0,0,0,.07);",
      "pointer-events:none;",
      "user-select:none;",
      "z-index:5;",
    "}",

    /* image slide */
    ".xadc-slide.is-img{overflow:hidden;background:#000;padding:0;}",
    ".xadc-slide.is-img img{",
      "width:100%;height:100%;",
      "object-fit:cover;object-position:center;",
      "display:block;pointer-events:none;",
    "}",

    /* image badge */
    ".xadc-img-badge{",
      "position:absolute;bottom:8px;right:8px;",
      "background:rgba(0,0,0,.45);color:#fff;",
      "font-family:sans-serif;font-size:10px;letter-spacing:.5px;",
      "padding:2px 8px;border-radius:4px;pointer-events:none;",
      "backdrop-filter:blur(4px);",
    "}",

    /* arrows */
    ".xadc-arrow{",
      "position:absolute;top:50%;transform:translateY(-50%);",
      "font-size:1.8rem;line-height:1;color:rgba(0,0,0,.55);",
      "background:rgba(255,255,255,.8);border:none;padding:6px 11px;",
      "border-radius:4px;cursor:pointer;z-index:20;user-select:none;transition:background .2s;",
    "}",
    ".xadc-arrow:hover{background:#fff;}",
    ".xadc-prev{left:8px;}.xadc-next{right:8px;}",

    /* dots — colour differs for img vs ad */
    ".xadc-dots{display:flex;justify-content:center;gap:6px;padding:8px 0;}",
    ".xadc-dot{width:7px;height:7px;border-radius:50%;background:#ccc;border:none;padding:0;cursor:pointer;transition:background .25s,transform .25s;}",
    ".xadc-dot.is-active{background:#555;transform:scale(1.35);}",
    ".xadc-dot.dot-img{background:#aaa;}",
    ".xadc-dot.dot-img.is-active{background:#222;}",
    ".xadc-dot.dot-ad{background:#a0a0cc;}",
    ".xadc-dot.dot-ad.is-active{background:#6c63ff;}",
  ].join(""), "xad-carousel-base");

  /* ══════════════════════════════════════════════════════
   * INSTANCE CSS
   * ══════════════════════════════════════════════════════ */
  function buildInstanceCSS(id, n, height, duration, mode) {
    var lines    = [];
    var slideW   = 100 / n;
    var trackW   = 100 * n;
    var totalDur = duration * n;
    var anim     = id + "-scroll";

    lines.push(
      "#" + id + " .xadc-track{width:" + trackW.toFixed(4) + "%;}",
      "#" + id + " .xadc-slide{width:" + slideW.toFixed(4) + "%;height:" + px(height) + ";min-height:" + px(height) + ";}"
    );

    if (mode !== "manual") {
      var slot = 100 / n;
      var hold = slot * 0.80;
      var kf   = "@keyframes " + anim + "{";
      for (var i = 0; i < n; i++) {
        var hs = (i * slot).toFixed(2);
        var he = (i * slot + hold).toFixed(2);
        var tx = i === 0 ? "0" : "-" + (i * 100) + "%";
        kf += hs + "%," + he + "%{transform:translateX(" + tx + ");}";
      }
      kf += "100%{transform:translateX(-" + ((n-1)*100) + "%);}";
      kf += "}";
      lines.push(
        kf,
        "#" + id + " .xadc-anim{animation:" + anim + " " + totalDur + "s infinite;}",
        "#" + id + ":hover .xadc-anim{animation-play-state:paused;}"
      );
    }
    return lines.join("\n");
  }

  /* ══════════════════════════════════════════════════════
   * MANUAL / BOTH CSS
   * ══════════════════════════════════════════════════════ */
  function buildManualCSS(id, n, mode) {
    if (mode === "auto") return "";
    var slideW = 100 / n;
    var lines  = [];

    lines.push("#" + id + " .xadc-nav label{display:none;}");
    for (var i = 1; i <= n; i++) {
      var tx    = ((i-1) * slideW).toFixed(4);
      var txStr = i === 1 ? "0" : "-" + tx + "%";
      lines.push(
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-nav-" + i + "{display:block;}",
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-track{transform:translateX(" + txStr + ")!important;}",
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-dot:nth-child(" + i + "){background:#555!important;transform:scale(1.35)!important;}"
      );
      if (mode === "both") {
        lines.push("#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-anim{animation:none!important;}");
      }
    }
    lines.push("#" + id + " .xadc-dot{background:#ccc;transform:none;}");
    return lines.join("\n");
  }

  /* ══════════════════════════════════════════════════════
   * HTML
   * ══════════════════════════════════════════════════════ */
  function buildHTML(id, slides, height, mode) {
    var n = slides.length;
    var h = "";

    /* radio inputs */
    if (mode !== "auto") {
      for (var r = 1; r <= n; r++) {
        h += '<input type="radio" name="' + id + '-ads" id="' + id + '-ad-' + r + '"'
           + (r === 1 ? " checked" : "") + " hidden>";
      }
    }

    h += '<div class="xadc-wrap" id="' + id + '">';

    /* nav arrows */
    if (mode !== "auto") {
      h += '<div class="xadc-nav">';
      for (var a = 1; a <= n; a++) {
        var prev = a === 1 ? n : a - 1;
        var next = a === n ? 1 : a + 1;
        h += '<label for="' + id + '-ad-' + prev + '" class="xadc-arrow xadc-prev xadc-nav-' + a + '">&#10094;</label>';
        h += '<label for="' + id + '-ad-' + next + '" class="xadc-arrow xadc-next xadc-nav-' + a + '">&#10095;</label>';
      }
      h += '</div>';
    }

    /* track */
    var wO = mode !== "manual" ? '<div class="xadc-anim">' : "";
    var wC = mode !== "manual" ? "</div>"                  : "";

    h += wO + '<div class="xadc-track">';
    for (var s = 0; s < n; s++) {
      var slide   = slides[s];
      var slotNum = s + 1;

      if (slide.type === "img") {
        /* ── IMAGE SLIDE ── */
        h += '<div class="xadc-slide is-img"'
           + ' style="height:' + px(height) + ';min-height:' + px(height) + ';">'
           + '<img src="' + slide.src + '" alt="slide ' + slotNum + '" loading="lazy">'
           + '</div>';
      } else {
        /* ── AD SLIDE ── */
        h += '<div class="xadc-slide is-ad"'
           + ' id="' + id + '-slide-' + slotNum + '"'
           + ' style="height:' + px(height) + ';min-height:' + px(height) + ';">'
           + '<span class="xadc-ad-label">Advertisement</span>'
           + '</div>';
      }
    }
    h += '</div>' + wC;

    /* dots — colour-coded by type */
    h += '<div class="xadc-dots">';
    for (var d = 0; d < n; d++) {
      var typeClass = slides[d].type === "img" ? "dot-img" : "dot-ad";
      var activeClass = d === 0 ? " is-active" : "";
      if (mode !== "auto") {
        h += '<label for="' + id + '-ad-' + (d+1) + '" class="xadc-dot ' + typeClass + activeClass + '" title="' + (slides[d].type === "img" ? "Image" : "Ad") + '"></label>';
      } else {
        h += '<button class="xadc-dot ' + typeClass + activeClass + '" data-idx="' + d + '" title="' + (slides[d].type === "img" ? "Image" : "Ad") + '"></button>';
      }
    }
    h += '</div>';

    h += '</div>';
    return h;
  }

  /* ══════════════════════════════════════════════════════
   * GPT — only define/display ad slides
   * ══════════════════════════════════════════════════════ */
  function loadGPT(cb) {
    window.googletag = window.googletag || { cmd: [] };
    if (window.googletag.apiReady) { cb(); return; }
    if (!_gptLoaded) {
      _gptLoaded = true;
      var s = document.createElement("script");
      s.async = true; s.crossOrigin = "anonymous";
      s.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
      (document.head || document.documentElement).appendChild(s);
    }
    window.googletag.cmd.push(cb);
  }

  function initSlots(id, adUnit, slides, adSize) {
    /* count ad slots */
    var adSlots = [];
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].type === "ad") adSlots.push(i + 1); // 1-based slot num
    }
    if (!adSlots.length || !adUnit) return; /* no ads, skip GPT entirely */

    loadGPT(function () {
      var gt = window.googletag;

      for (var j = 0; j < adSlots.length; j++) {
        gt.defineSlot(adUnit, adSize, id + "-slide-" + adSlots[j])
          .addService(gt.pubads());
      }

      if (!_svcEnabled) {
        _svcEnabled = true;
        gt.pubads().enableSingleRequest();
        gt.enableServices();
      }

      for (var k = 0; k < adSlots.length; k++) {
        gt.display(id + "-slide-" + adSlots[k]);
      }
    });
  }

  /* ══════════════════════════════════════════════════════
   * DOT SYNC
   * ══════════════════════════════════════════════════════ */
  function syncDots(id, n, duration) {
    var dots  = document.querySelectorAll("#" + id + " .xadc-dot");
    var cur   = 0;

    function activate(idx) {
      cur = ((idx % n) + n) % n;
      dots.forEach(function (d, i) { d.classList.toggle("is-active", i === cur); });
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () { activate(i); });
    });

    var timer = setInterval(function () { activate(cur + 1); }, duration * 1000);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { clearInterval(timer); }
      else { timer = setInterval(function () { activate(cur+1); }, duration*1000); }
    });
  }

  /* ══════════════════════════════════════════════════════
   * CORE RENDER
   * ══════════════════════════════════════════════════════ */
  function _render(adUnit, slidesRaw, height, duration, mode, adSize, anchor) {
    var slides   = normalizeSlides(slidesRaw);
    var n        = slides.length;
    height       = parseInt(height,   10) || 300;
    duration     = parseInt(duration, 10) || 5;
    mode         = (["auto","manual","both"].indexOf((mode||"").toLowerCase()) !== -1)
                 ? mode.toLowerCase() : "auto";
    adSize       = Array.isArray(adSize) ? adSize : [300, 250];

    var id = uid();

    /* CSS */
    addStyle(
      buildInstanceCSS(id, n, height, duration, mode) +
      buildManualCSS(id, n, mode),
      id + "-css"
    );

    /* HTML */
    var html = buildHTML(id, slides, height, mode);
    var tmp  = document.createElement("div");
    tmp.innerHTML = html;
    var frag = document.createDocumentFragment();
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(frag, anchor.nextSibling);
    } else {
      onReady(function () { document.body.appendChild(frag); });
    }

    /* GPT + dots */
    onReady(function () {
      initSlots(id, adUnit, slides, adSize);
      if (mode !== "manual") syncDots(id, n, duration);
    });

    return {
      id: id, adUnit: adUnit, slides: slides,
      height: height, duration: duration, mode: mode, adSize: adSize
    };
  }

  /* ══════════════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════════════ */
  function XadCarousel(adUnit, slides, height, duration, mode, adSize) {
    var anchor = document.currentScript || (function () {
      var s = document.querySelectorAll("script"); return s[s.length - 1];
    }());
    return _render(adUnit, slides, height, duration, mode, adSize, anchor);
  }

  /* drain queue from async-safe stub */
  function _drainQueue() {
    var q = global._xadQ;
    if (!Array.isArray(q) || !q.length) return;
    for (var i = 0; i < q.length; i++) {
      var a = q[i];
      _render(a[0], a[1], a[2], a[3], a[4], a[5], null);
    }
    global._xadQ = [];
  }

  global.XadCarousel = XadCarousel;
  global._xadQ = global._xadQ || [];
  _drainQueue();
  onReady(_drainQueue);

}(typeof window !== "undefined" ? window : this));
