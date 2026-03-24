/*!
 * XadCarousel v1.0.0
 * Carousel Ads — maximize revenue without new placements
 * Usage: XadCarousel(adUnit, slideCount, height, duration, mode)
 *
 * @param {string}  adUnit      - GPT Ad Unit path e.g. "/1234/my-ad"
 * @param {number}  slideCount  - Number of slides (2–10), default 3
 * @param {number}  height      - Carousel height in px, default 300
 * @param {number}  duration    - Seconds per slide (auto/both only), default 5
 * @param {string}  mode        - "auto" | "manual" | "both", default "auto"
 *
 * Example:
 *   XadCarousel("/1234/my-ad", 4, 300, 5, "auto")
 *   XadCarousel("/1234/my-ad", 3, 250, 7, "both")
 */

(function (global) {
  "use strict";

  /* ─────────────────────────────────────────────
   * Helpers
   * ───────────────────────────────────────────── */

  var _instanceCount = 0;

  function _uid() {
    return "xadc-" + (++_instanceCount) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function _injectStyle(css, id) {
    if (document.getElementById(id)) return;
    var el = document.createElement("style");
    el.id = id;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  /* ─────────────────────────────────────────────
   * Base CSS (injected once per page)
   * ───────────────────────────────────────────── */

  var BASE_CSS = [
    ".xadc-wrap{width:100%;position:relative;overflow:hidden;box-sizing:border-box;}",
    ".xadc-track{display:flex;flex-shrink:0;transition:transform .5s ease-in-out;}",
    ".xadc-slide{flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#f8f8f8;box-sizing:border-box;}",

    /* arrow buttons */
    ".xadc-arrow{position:absolute;top:50%;transform:translateY(-50%);",
    "  font-size:1.8rem;line-height:1;color:rgba(0,0,0,.55);",
    "  background:rgba(255,255,255,.75);border:none;padding:6px 10px;",
    "  cursor:pointer;z-index:20;user-select:none;backdrop-filter:blur(4px);",
    "  border-radius:4px;transition:background .2s;}",
    ".xadc-arrow:hover{background:rgba(255,255,255,.95);}",
    ".xadc-prev{left:8px;}",
    ".xadc-next{right:8px;}",

    /* dots */
    ".xadc-dots{display:flex;justify-content:center;gap:6px;padding:8px 0;background:transparent;}",
    ".xadc-dot{width:7px;height:7px;border-radius:50%;background:#ccc;cursor:pointer;",
    "  transition:background .25s,transform .25s;border:none;padding:0;}",
    ".xadc-dot.is-active{background:#555;transform:scale(1.35);}",
  ].join("");

  _injectStyle(BASE_CSS, "xad-carousel-base");

  /* ─────────────────────────────────────────────
   * Build dynamic CSS for this instance
   * ───────────────────────────────────────────── */

  function _buildCSS(id, slideCount, slideW, totalW, height, duration, mode) {
    var totalDur = duration * slideCount;
    var lines = [];

    lines.push(
      "#" + id + " .xadc-track{width:" + totalW + "%;height:" + height + "px;}",
      "#" + id + " .xadc-slide{width:" + slideW.toFixed(4) + "%;height:" + height + "px;}"
    );

    /* auto-rotate */
    if (mode !== "manual") {
      var animName = id + "-scroll";
      var kf = "@keyframes " + animName + "{";
      var step = 100 / slideCount;
      for (var i = 0; i < slideCount; i++) {
        var pctStart = (i * step).toFixed(2);
        var pctEnd   = ((i + 1) * step - 100 / (totalDur * 2)).toFixed(2);
        var tx       = (i * slideW).toFixed(4);
        kf += pctStart + "%," + pctEnd + "%{transform:translateX(-" + tx + "%);}";
      }
      kf += "100%{transform:translateX(-" + ((slideCount - 1) * slideW).toFixed(4) + "%);}";
      kf += "}";
      lines.push(kf);

      lines.push(
        "#" + id + " .xadc-anim{",
        "  animation:" + animName + " " + totalDur + "s infinite;",
        "  display:flex;width:100%;}"
      );

      /* pause on hover */
      lines.push(
        "#" + id + ":hover .xadc-anim{animation-play-state:paused;}"
      );
    }

    return lines.join("\n");
  }

  /* ─────────────────────────────────────────────
   * Build HTML
   * ───────────────────────────────────────────── */

  function _buildHTML(id, slideCount, mode) {
    var html = "";

    /* radio inputs for manual/both */
    if (mode !== "auto") {
      for (var r = 1; r <= slideCount; r++) {
        html += '<input type="radio" name="' + id + '-ads" id="' + id + '-ad-' + r + '"'
             + (r === 1 ? " checked" : "") + ' hidden>';
      }
    }

    html += '<div class="xadc-wrap" id="' + id + '">';

    /* nav arrows — manual/both */
    if (mode !== "auto") {
      html += '<div class="xadc-nav">';
      for (var n = 1; n <= slideCount; n++) {
        var prevIdx = n === 1 ? slideCount : n - 1;
        var nextIdx = n === slideCount ? 1 : n + 1;
        html += '<label for="' + id + '-ad-' + prevIdx + '" class="xadc-arrow xadc-prev xadc-nav-' + n + '">&#10094;</label>';
        html += '<label for="' + id + '-ad-' + nextIdx + '" class="xadc-arrow xadc-next xadc-nav-' + n + '">&#10095;</label>';
      }
      html += '</div>';
    }

    /* track wrapper */
    var wrapOpen  = mode !== "manual" ? '<div class="xadc-anim">' : "";
    var wrapClose = mode !== "manual" ? "</div>" : "";

    html += wrapOpen + '<div class="xadc-track">';
    for (var s = 1; s <= slideCount; s++) {
      html += '<div class="xadc-slide" id="' + id + '-slide-' + s + '"></div>';
    }
    html += "</div>" + wrapClose;

    /* dots */
    html += '<div class="xadc-dots">';
    for (var d = 1; d <= slideCount; d++) {
      if (mode !== "auto") {
        html += '<label for="' + id + '-ad-' + d + '" class="xadc-dot' + (d === 1 ? " is-active" : "") + '"></label>';
      } else {
        html += '<button class="xadc-dot' + (d === 1 ? " is-active" : "") + '" data-idx="' + (d - 1) + '"></button>';
      }
    }
    html += "</div>";

    html += "</div>"; /* .xadc-wrap */
    return html;
  }

  /* ─────────────────────────────────────────────
   * Manual-mode CSS (radio-button hack)
   * ───────────────────────────────────────────── */

  function _buildManualCSS(id, slideCount, slideW, mode) {
    if (mode === "auto") return "";
    var lines = [];

    /* show correct arrows */
    for (var i = 1; i <= slideCount; i++) {
      lines.push(
        "#" + id + "-ad-" + i + ":checked ~ #" + id + " .xadc-nav-" + i + "{display:block;}"
      );
    }

    /* hide all arrows by default */
    lines.push("#" + id + " .xadc-nav label{display:none;}");

    /* translate track */
    for (var j = 1; j <= slideCount; j++) {
      var tx = ((j - 1) * slideW).toFixed(4);
      lines.push(
        "#" + id + "-ad-" + j + ":checked ~ #" + id + " .xadc-track{transform:translateX(-" + tx + "%);}",
      );
    }

    /* kill auto animation when user interacts (both mode) */
    if (mode === "both") {
      for (var k = 1; k <= slideCount; k++) {
        lines.push(
          "#" + id + "-ad-" + k + ":checked ~ #" + id + " .xadc-anim{animation:none;}"
        );
      }
    }

    /* keep dots in sync */
    for (var m = 1; m <= slideCount; m++) {
      lines.push(
        "#" + id + "-ad-" + m + ":checked ~ #" + id + " .xadc-dot:nth-child(" + m + "){background:#555;transform:scale(1.35);}"
      );
    }
    /* deactivate all dots first */
    lines.push("#" + id + " .xadc-dot{background:#ccc;transform:none;}");

    return lines.join("\n");
  }

  /* ─────────────────────────────────────────────
   * GPT — load library once, define + display slots
   * ───────────────────────────────────────────── */

  var _gptLoaded = false;

  function _loadGPT(callback) {
    if (window.googletag && window.googletag.apiReady) {
      callback();
      return;
    }
    if (!_gptLoaded) {
      _gptLoaded = true;
      var s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
      (document.head || document.documentElement).appendChild(s);
    }
    window.googletag = window.googletag || { cmd: [] };
    window.googletag.cmd.push(callback);
  }

  function _defineAndDisplaySlots(id, adUnit, slideCount, adSize) {
    _loadGPT(function () {
      var gt = window.googletag;

      /* define all slots */
      for (var i = 1; i <= slideCount; i++) {
        var divId = id + "-slide-" + i;
        gt.defineSlot(adUnit, adSize, divId).addService(gt.pubads());
      }

      gt.pubads().enableSingleRequest();
      gt.enableServices();

      /* display all slots */
      for (var j = 1; j <= slideCount; j++) {
        gt.display(id + "-slide-" + j);
      }
    });
  }

  /* ─────────────────────────────────────────────
   * Dot sync for auto-mode (JS driven)
   * ───────────────────────────────────────────── */

  function _syncAutoDots(id, slideCount, duration) {
    var dots     = document.querySelectorAll("#" + id + " .xadc-dots .xadc-dot");
    var track    = document.querySelector("#" + id + " .xadc-track");
    var current  = 0;
    var total    = slideCount;
    var slideW   = 100 / total; /* % of track per slide */

    function activate(idx) {
      current = (idx + total) % total;
      dots.forEach(function (d, i) {
        d.classList.toggle("is-active", i === current);
      });
    }

    /* manual jump via dot click */
    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        activate(i);
        /* override auto animation by temporarily applying inline transform */
        if (track) {
          track.style.transform = "translateX(-" + (i * slideW).toFixed(4) + "%)";
          /* re-enable after a moment to let animation resume */
          setTimeout(function () { track.style.transform = ""; }, duration * 1000 * 0.9);
        }
      });
    });

    /* advance dot on animation iteration */
    var anim = document.querySelector("#" + id + " .xadc-anim");
    if (!anim) return;

    var stepDur = duration * 1000;
    var timer   = setInterval(function () {
      activate(current + 1);
    }, stepDur);

    /* pause timer when tab is hidden */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        timer = setInterval(function () { activate(current + 1); }, stepDur);
      }
    });
  }

  /* ─────────────────────────────────────────────
   * Main export
   * ───────────────────────────────────────────── */

  /**
   * XadCarousel(adUnit, slideCount, height, duration, mode)
   *
   * Writes carousel HTML + CSS into the current script tag's position,
   * then initialises GPT ad slots.
   *
   * @param {string}  adUnit      GPT ad unit path
   * @param {number}  [slideCount=3]
   * @param {number}  [height=300]   px
   * @param {number}  [duration=5]   seconds per slide
   * @param {string}  [mode="auto"]  "auto" | "manual" | "both"
   * @param {Array}   [adSize=[300,250]]
   */
  function XadCarousel(adUnit, slideCount, height, duration, mode, adSize) {
    /* defaults */
    slideCount = Math.max(2, Math.min(parseInt(slideCount, 10) || 3, 10));
    height     = parseInt(height,   10) || 300;
    duration   = parseInt(duration, 10) || 5;
    mode       = (mode || "auto").toLowerCase();
    adSize     = Array.isArray(adSize) ? adSize : [300, 250];

    if (["auto", "manual", "both"].indexOf(mode) === -1) mode = "auto";

    var id     = _uid();
    var slideW = 100 / slideCount;   /* % width of one slide inside track */
    var totalW = 100 * slideCount;   /* % total width of track             */

    /* 1. Inject instance CSS */
    var instCSS = _buildCSS(id, slideCount, slideW, totalW, height, duration, mode)
                + _buildManualCSS(id, slideCount, slideW, mode);
    _injectStyle(instCSS, id + "-css");

    /* 2. Write HTML into the page at current script position */
    var html = _buildHTML(id, slideCount, mode);

    /* Find the currently-executing script tag and insert after it,
       or fall back to document.write during parse time. */
    var scripts = document.querySelectorAll("script");
    var currentScript = scripts[scripts.length - 1];
    if (document.currentScript) {
      currentScript = document.currentScript;
    }

    if (currentScript && currentScript.parentNode) {
      var tmp = document.createElement("div");
      tmp.innerHTML = html;
      /* move all children (radio inputs + wrapper) after the script */
      var frag = document.createDocumentFragment();
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      currentScript.parentNode.insertBefore(frag, currentScript.nextSibling);
    } else {
      /* fallback — called after DOMContentLoaded */
      document.write(html);
    }

    /* 3. GPT slots */
    _defineAndDisplaySlots(id, adUnit, slideCount, adSize);

    /* 4. Dot sync for auto mode */
    if (mode !== "manual") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          _syncAutoDots(id, slideCount, duration);
        });
      } else {
        _syncAutoDots(id, slideCount, duration);
      }
    }

    /* 5. Return instance info (optional chaining) */
    return {
      id:         id,
      adUnit:     adUnit,
      slideCount: slideCount,
      height:     height,
      duration:   duration,
      mode:       mode,
      adSize:     adSize
    };
  }

  /* ─────────────────────────────────────────────
   * Expose globally
   * ───────────────────────────────────────────── */
  global.XadCarousel = XadCarousel;

}(typeof window !== "undefined" ? window : this));
