/*!
 * XadCarousel v1.1.0
 * Carousel Ads — maximize revenue without new placements
 *
 * Usage: XadCarousel(adUnit, slideCount, height, duration, mode, adSize)
 *
 * @param {string}  adUnit      - GPT Ad Unit path  e.g. "/1234/my-ad"
 * @param {number}  slideCount  - Number of slides (2–10), default 3
 * @param {number}  height      - Carousel height in px, default 300
 * @param {number}  duration    - Seconds per slide (auto/both), default 5
 * @param {string}  mode        - "auto" | "manual" | "both", default "auto"
 * @param {Array}   adSize      - GPT ad size, default [300, 250]
 *
 * Examples:
 *   XadCarousel("/1234/my-ad", 4, 300, 5)
 *   XadCarousel("/1234/my-ad", 3, 250, 7, "both")
 *   XadCarousel("/1234/my-ad", 3, 100, 6, "auto", [728, 90])
 */

(function (global) {
  "use strict";

  /* ─────────────────────────────────
   * State
   * ───────────────────────────────── */
  var _instanceCount = 0;
  var _gptLoaded     = false;
  var _singleReqDone = false;   // enableSingleRequest called once globally

  /* ─────────────────────────────────
   * Utilities
   * ───────────────────────────────── */
  function _uid() {
    return "xadc-" + (++_instanceCount) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function _injectStyle(css, styleId) {
    if (document.getElementById(styleId)) return;
    var el = document.createElement("style");
    el.id  = styleId;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function _ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  /* ─────────────────────────────────
   * Base CSS  (injected once per page)
   * ───────────────────────────────── */
  var BASE_CSS = [
    /* wrap: clips the sliding track; position:relative for arrows */
    ".xadc-wrap{width:100%;overflow:hidden;position:relative;box-sizing:border-box;}",

    /* anim container (auto/both) */
    ".xadc-anim{display:flex;width:100%;}",

    /* track */
    ".xadc-track{display:flex;flex-shrink:0;transition:transform .5s ease-in-out;}",

    /* ── FIX: center ad inside slide ──────────────────────────────────────
       display:flex + align/justify  → centers block children
       text-align:center             → centers inline/inline-block GPT div
       overflow:visible              → never clip the expanding iframe      */
    ".xadc-slide{",
      "flex-shrink:0;",
      "display:flex;align-items:center;justify-content:center;",
      "text-align:center;",
      "overflow:visible;",
      "box-sizing:border-box;",
      "background:#f8f8f8;",
    "}",

    /* ── FIX: force GPT __container__ div to self-center ──────────────────
       GPT injects  <div id="…__container__" style="width:Xpx;height:Ypx">
       margin:0 auto centres it when the parent is display:flex             */
    ".xadc-slide>div{display:block;margin:0 auto;line-height:0;}",

    /* arrows */
    ".xadc-arrow{position:absolute;top:50%;transform:translateY(-50%);",
      "font-size:1.8rem;line-height:1;color:rgba(0,0,0,.55);",
      "background:rgba(255,255,255,.8);border:none;padding:6px 11px;border-radius:4px;",
      "cursor:pointer;z-index:20;user-select:none;backdrop-filter:blur(4px);transition:background .2s;}",
    ".xadc-arrow:hover{background:#fff;}",
    ".xadc-prev{left:8px;}",
    ".xadc-next{right:8px;}",

    /* dots */
    ".xadc-dots{display:flex;justify-content:center;gap:6px;padding:8px 0;}",
    ".xadc-dot{width:7px;height:7px;border-radius:50%;background:#ccc;border:none;padding:0;cursor:pointer;transition:background .25s,transform .25s;}",
    ".xadc-dot.is-active{background:#555;transform:scale(1.35);}",
  ].join("");

  _injectStyle(BASE_CSS, "xad-carousel-base");

  /* ─────────────────────────────────
   * Build instance CSS
   * ───────────────────────────────── */
  function _buildInstanceCSS(id, n, slideW, totalW, height, duration, mode) {
    var lines    = [];
    var totalDur = duration * n;
    var animName = id + "-scroll";

    lines.push(
      "#" + id + " .xadc-track{width:" + totalW + "%;}",
      /* explicit pixel height so GPT reads a non-zero size */
      "#" + id + " .xadc-slide{width:" + slideW.toFixed(6) + "%;height:" + height + "px;min-height:" + height + "px;}"
    );

    if (mode !== "manual") {
      /* keyframes: hold 85% of each slot, transition 15% */
      var hold   = 85 / n;
      var travel = 15 / n;
      var kf     = "@keyframes " + animName + "{";
      for (var i = 0; i < n; i++) {
        var hs = (i * (hold + travel)).toFixed(3);
        var he = (i * (hold + travel) + hold).toFixed(3);
        var tx = (i * slideW).toFixed(6);
        kf += hs + "%," + he + "%{transform:translateX(-" + tx + "%);}";
      }
      kf += "100%{transform:translateX(-" + ((n - 1) * slideW).toFixed(6) + "%);}";
      kf += "}";
      lines.push(kf);
      lines.push(
        "#" + id + " .xadc-anim{animation:" + animName + " " + totalDur + "s infinite;}",
        "#" + id + ":hover .xadc-anim{animation-play-state:paused;}"
      );
    }

    return lines.join("\n");
  }

  /* ─────────────────────────────────
   * Build manual/both CSS  (radio-button hack)
   * ───────────────────────────────── */
  function _buildManualCSS(id, n, slideW, mode) {
    if (mode === "auto") return "";
    var lines = [];

    lines.push("#" + id + " .xadc-nav label{display:none;}");

    for (var i = 1; i <= n; i++) {
      var tx = ((i - 1) * slideW).toFixed(6);
      lines.push(
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-nav-" + i + "{display:block;}",
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-track{transform:translateX(-" + tx + "%)!important;}",
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-dot:nth-child(" + i + "){background:#555!important;transform:scale(1.35)!important;}"
      );
      if (mode === "both") {
        lines.push(
          "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-anim{animation:none!important;}"
        );
      }
    }
    lines.push("#" + id + " .xadc-dot{background:#ccc;transform:none;}");

    return lines.join("\n");
  }

  /* ─────────────────────────────────
   * Build HTML
   * ───────────────────────────────── */
  function _buildHTML(id, n, height, mode) {
    var html = "";

    if (mode !== "auto") {
      for (var r = 1; r <= n; r++) {
        html += '<input type="radio" name="' + id + '-ads" id="' + id + '-ad-' + r + '"'
              + (r === 1 ? " checked" : "") + " hidden>";
      }
    }

    html += '<div class="xadc-wrap" id="' + id + '">';

    if (mode !== "auto") {
      html += '<div class="xadc-nav">';
      for (var a = 1; a <= n; a++) {
        var prev = a === 1 ? n : a - 1;
        var next = a === n ? 1 : a + 1;
        html += '<label for="' + id + '-ad-' + prev + '" class="xadc-arrow xadc-prev xadc-nav-' + a + '">&#10094;</label>';
        html += '<label for="' + id + '-ad-' + next + '" class="xadc-arrow xadc-next xadc-nav-' + a + '">&#10095;</label>';
      }
      html += "</div>";
    }

    var wO = mode !== "manual" ? '<div class="xadc-anim">' : "";
    var wC = mode !== "manual" ? "</div>"                  : "";

    html += wO + '<div class="xadc-track">';
    for (var s = 1; s <= n; s++) {
      /* ── FIX: inline style gives GPT a concrete pixel size immediately ── */
      html += '<div class="xadc-slide"'
            + ' id="' + id + '-slide-' + s + '"'
            + ' style="height:' + height + 'px;min-height:' + height + 'px;">'
            + "</div>";
    }
    html += "</div>" + wC;

    html += '<div class="xadc-dots">';
    for (var d = 1; d <= n; d++) {
      if (mode !== "auto") {
        html += '<label for="' + id + '-ad-' + d + '" class="xadc-dot' + (d === 1 ? " is-active" : "") + '"></label>';
      } else {
        html += '<button class="xadc-dot' + (d === 1 ? " is-active" : "") + '" data-idx="' + (d - 1) + '"></button>';
      }
    }
    html += "</div>";

    html += "</div>";
    return html;
  }

  /* ─────────────────────────────────
   * GPT  (load once, define + display)
   * ───────────────────────────────── */
  function _loadGPT(cb) {
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

  function _initSlots(id, adUnit, n, adSize) {
    _loadGPT(function () {
      var gt = window.googletag;

      for (var i = 1; i <= n; i++) {
        gt.defineSlot(adUnit, adSize, id + "-slide-" + i)
          .addService(gt.pubads());
      }

      /* ── FIX: enableSingleRequest / enableServices only once globally ── */
      if (!_singleReqDone) {
        _singleReqDone = true;
        gt.pubads().enableSingleRequest();
        gt.enableServices();
      }

      for (var j = 1; j <= n; j++) {
        gt.display(id + "-slide-" + j);
      }
    });
  }

  /* ─────────────────────────────────
   * Auto-mode dot sync  (JS timer)
   * ───────────────────────────────── */
  function _syncDots(id, n, duration) {
    var dots    = document.querySelectorAll("#" + id + " .xadc-dots .xadc-dot");
    var track   = document.querySelector("#" + id + " .xadc-track");
    var current = 0;
    var slideW  = 100 / n;

    function activate(idx) {
      current = ((idx % n) + n) % n;
      dots.forEach(function (d, i) {
        d.classList.toggle("is-active", i === current);
      });
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        activate(i);
        if (track) {
          track.style.transition = "none";
          track.style.transform  = "translateX(-" + (i * slideW).toFixed(6) + "%)";
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              track.style.transition = "";
              setTimeout(function () { track.style.transform = ""; }, 200);
            });
          });
        }
      });
    });

    var timer = setInterval(function () { activate(current + 1); }, duration * 1000);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { clearInterval(timer); }
      else { timer = setInterval(function () { activate(current + 1); }, duration * 1000); }
    });
  }

  /* ─────────────────────────────────
   * Main API
   * ───────────────────────────────── */
  function XadCarousel(adUnit, slideCount, height, duration, mode, adSize) {

    slideCount = Math.max(2, Math.min(parseInt(slideCount, 10) || 3, 10));
    height     = parseInt(height,   10) || 300;
    duration   = parseInt(duration, 10) || 5;
    mode       = (["auto","manual","both"].indexOf((mode || "").toLowerCase()) !== -1)
               ? mode.toLowerCase() : "auto";
    adSize     = Array.isArray(adSize) ? adSize : [300, 250];

    var id     = _uid();
    var slideW = 100 / slideCount;
    var totalW = 100 * slideCount;

    /* 1. CSS */
    _injectStyle(
      _buildInstanceCSS(id, slideCount, slideW, totalW, height, duration, mode) +
      _buildManualCSS(id, slideCount, slideW, mode),
      id + "-css"
    );

    /* 2. HTML */
    var html      = _buildHTML(id, slideCount, height, mode);
    var curScript = document.currentScript || (function () {
      var s = document.querySelectorAll("script"); return s[s.length - 1];
    }());

    if (curScript && curScript.parentNode) {
      var tmp = document.createElement("div");
      tmp.innerHTML = html;
      var frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      curScript.parentNode.insertBefore(frag, curScript.nextSibling);
    } else {
      document.write(html);
    }

    /* 3. GPT (wait for DOM so slot divs exist in the page) */
    _ready(function () { _initSlots(id, adUnit, slideCount, adSize); });

    /* 4. dot sync */
    if (mode !== "manual") {
      _ready(function () { _syncDots(id, slideCount, duration); });
    }

    return { id: id, adUnit: adUnit, slideCount: slideCount,
             height: height, duration: duration, mode: mode, adSize: adSize };
  }

  /* ─────────────────────────────────
   * Expose
   * ───────────────────────────────── */
  global.XadCarousel = XadCarousel;

}(typeof window !== "undefined" ? window : this));
