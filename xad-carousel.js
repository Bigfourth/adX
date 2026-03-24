/*!
 * XadCarousel v1.2.0
 * Carousel Ads — maximize revenue without new placements
 *
 * Faithfully implements the PDF spec:
 *  - AUTO  : @keyframes on animation-wrapper  → translateX(-100%, -200%…)
 *  - MANUAL: radio-button hack on carousel-track → translateX(-slideW% each)
 *  - BOTH  : auto plays, stops when user clicks an arrow/dot
 *
 * Usage:
 *   XadCarousel(adUnit, slideCount, height, duration, mode, adSize)
 *
 * @param {string} adUnit      GPT ad unit path, e.g. "/1234/my-ad"
 * @param {number} slideCount  Number of slides 2–10  (default 3)
 * @param {number} height      Carousel height in px  (default 300)
 * @param {number} duration    Seconds per slide      (default 5)
 * @param {string} mode        "auto" | "manual" | "both"  (default "auto")
 * @param {Array}  adSize      GPT size array         (default [300,250])
 *
 * Examples:
 *   XadCarousel("/1234/ad", 4, 300, 5)
 *   XadCarousel("/1234/ad", 3, 250, 7, "both")
 *   XadCarousel("/1234/ad", 3, 100, 6, "auto", [728,90])
 */

(function (global) {
  "use strict";

  /* ── state ─────────────────────────────────────────── */
  var _count         = 0;
  var _gptLoaded     = false;
  var _svcEnabled    = false;   // enableServices() called once globally

  /* ── tiny helpers ──────────────────────────────────── */
  function uid()  { return "xadc-" + (++_count) + "-" + Math.random().toString(36).slice(2,6); }
  function px(n)  { return n + "px"; }
  function pct(n) { return n.toFixed(4) + "%"; }

  function addStyle(css, id) {
    if (document.getElementById(id)) return;
    var s = document.createElement("style");
    s.id = id; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  function onReady(fn) {
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn)
      : fn();
  }

  /* ══════════════════════════════════════════════════════
   * BASE CSS  — injected once per page
   * ══════════════════════════════════════════════════════ */
  addStyle([
    /* carousel-container */
    ".xadc-wrap{",
      "width:100%;overflow:hidden;position:relative;box-sizing:border-box;",
    "}",

    /* animation-wrapper  (PDF: display:flex; flex:1 1 100%; width:100%) */
    ".xadc-anim{display:flex;flex:1 1 100%;width:100%;}",

    /* carousel-track  (PDF: display:flex; flex-shrink:0; width:N*100%) */
    ".xadc-track{",
      "display:flex;flex-shrink:0;",
      "transition:transform .5s ease-in-out;",
    "}",

    /* carousel-slide  (PDF: flex-shrink:0; display:flex; align/justify center) */
    /* ── CENTERING FIX ───────────────────────────────────────────────
       The slide is a flex container so its single child (the GPT div)
       is centred on both axes.
       text-align:center  catches inline-block fallback.
       overflow:visible   lets the GPT iframe breathe — never clip it. */
    ".xadc-slide{",
      "flex-shrink:0;",
      "display:flex;align-items:center;justify-content:center;",
      "text-align:center;overflow:visible;",
      "box-sizing:border-box;background:#f8f8f8;",
    "}",

    /* GPT injects  <div id="…__container__" style="width:Xpx;height:Ypx">
       margin:0 auto centres it when the parent is display:flex          */
    ".xadc-slide>div{display:block;margin:0 auto;line-height:0;}",

    /* arrows */
    ".xadc-arrow{",
      "position:absolute;top:50%;transform:translateY(-50%);",
      "font-size:1.8rem;line-height:1;color:rgba(0,0,0,.55);",
      "background:rgba(255,255,255,.8);border:none;",
      "padding:6px 11px;border-radius:4px;",
      "cursor:pointer;z-index:20;user-select:none;",
      "transition:background .2s;",
    "}",
    ".xadc-arrow:hover{background:#fff;}",
    ".xadc-prev{left:8px;} .xadc-next{right:8px;}",

    /* dots */
    ".xadc-dots{display:flex;justify-content:center;gap:6px;padding:8px 0;}",
    ".xadc-dot{width:7px;height:7px;border-radius:50%;background:#ccc;",
      "border:none;padding:0;cursor:pointer;transition:background .25s,transform .25s;}",
    ".xadc-dot.is-active{background:#555;transform:scale(1.35);}",
  ].join(""), "xad-carousel-base");


  /* ══════════════════════════════════════════════════════
   * INSTANCE CSS
   * ══════════════════════════════════════════════════════ */
  function buildInstanceCSS(id, n, height, duration, mode) {
    var lines    = [];
    var slideW   = 100 / n;          // % width of one slide  (inside track)
    var trackW   = 100 * n;          // % total width of track
    var totalDur = duration * n;     // total animation duration in seconds
    var anim     = id + "-scroll";

    /* track & slide sizing */
    lines.push(
      /* track width = N * 100%  (PDF: "width: 500%" for 5 slides) */
      "#" + id + " .xadc-track{width:" + pct(trackW) + ";}",

      /* slide width = 100% / N  (PDF: "width: 20%" for 5 slides)
         Inline height so GPT reads a non-zero pixel size immediately  */
      "#" + id + " .xadc-slide{",
        "width:"      + pct(slideW) + ";",
        "height:"     + px(height) + ";",
        "min-height:" + px(height) + ";",
      "}"
    );

    /* ── AUTO keyframes (applied to animation-wrapper) ─────────────
       PDF example for 5 slides at 15s total (3s per slide):
         0%,  20% { translateX(0)     }   ← hold slide 1
        25%,  45% { translateX(-100%) }   ← hold slide 2
        50%,  70% { translateX(-200%) }   ← hold slide 3
        75%,  95% { translateX(-300%) }   ← hold slide 4
       100%       { translateX(-400%) }   ← end on slide 5 (then loops)

       Pattern: each slide occupies (100/n)% of timeline.
         holdStart = i * (100/n)
         holdEnd   = i * (100/n) + (100/n)*0.8   ← hold 80%, travel 20%
         translateX = -i * 100%  (one container-width per step)
    ─────────────────────────────────────────────────────────────── */
    if (mode !== "manual") {
      var slot   = 100 / n;          // % of total timeline per slide
      var hold   = slot * 0.80;      // 80% hold, 20% travel
      var kf     = "@keyframes " + anim + "{";

      for (var i = 0; i < n; i++) {
        var hs  = (i * slot).toFixed(2);
        var he  = (i * slot + hold).toFixed(2);
        /* translateX is -i*100% of animation-wrapper (= container width) */
        var tx  = (i === 0) ? "0" : "-" + (i * 100) + "%";
        kf += hs + "%," + he + "%{transform:translateX(" + tx + ");}";
      }
      /* final frame */
      kf += "100%{transform:translateX(-" + ((n-1)*100) + "%);}";
      kf += "}";
      lines.push(kf);

      lines.push(
        "#" + id + " .xadc-anim{animation:" + anim + " " + totalDur + "s infinite;}",
        /* pause on hover */
        "#" + id + ":hover .xadc-anim{animation-play-state:paused;}"
      );
    }

    return lines.join("\n");
  }


  /* ══════════════════════════════════════════════════════
   * MANUAL / BOTH CSS  — radio-button hack
   * ══════════════════════════════════════════════════════ */
  function buildManualCSS(id, n, mode) {
    if (mode === "auto") return "";

    var slideW = 100 / n;   // % of track per slide
    var lines  = [];

    /* hide all arrows by default */
    lines.push("#" + id + " .xadc-nav label{display:none;}");

    for (var i = 1; i <= n; i++) {
      /* PDF manual translateX formula:
           -100% / N * (i-1)   where N = total slides, i-1 = zero-based index
         Example 5 slides:  i=1→0%  i=2→-20%  i=3→-40%  i=4→-60%  i=5→-80% */
      var tx = ((i-1) * slideW).toFixed(4);
      var txStr = (i === 1) ? "0" : "-" + tx + "%";

      /* show arrows for active slide */
      lines.push(
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-nav-" + i + "{display:block;}"
      );

      /* translate track (applied to carousel-track, NOT animation-wrapper) */
      lines.push(
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-track{" +
          "transform:translateX(" + txStr + ")!important;}"
      );

      /* sync dot */
      lines.push(
        "#" + id + "-ad-" + i + ":checked~#" + id +
          " .xadc-dot:nth-child(" + i + "){background:#555!important;transform:scale(1.35)!important;}"
      );

      /* stop auto-rotate when user picks slide (both mode) */
      if (mode === "both") {
        lines.push(
          "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-anim{animation:none!important;}"
        );
      }
    }

    /* reset all dots (placed after so specifics above win) */
    lines.push("#" + id + " .xadc-dot{background:#ccc;transform:none;}");

    return lines.join("\n");
  }


  /* ══════════════════════════════════════════════════════
   * HTML
   * ══════════════════════════════════════════════════════ */
  function buildHTML(id, n, height, mode) {
    var h = "";

    /* radio inputs (manual / both) */
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

    /* animation-wrapper (auto/both) wraps carousel-track */
    var wO = mode !== "manual" ? '<div class="xadc-anim">' : "";
    var wC = mode !== "manual" ? "</div>"                  : "";

    h += wO + '<div class="xadc-track">';
    for (var s = 1; s <= n; s++) {
      /* inline height = concrete pixels for GPT at render time */
      h += '<div class="xadc-slide"'
         + ' id="' + id + '-slide-' + s + '"'
         + ' style="height:' + height + 'px;min-height:' + height + 'px;">'
         + '</div>';
    }
    h += '</div>' + wC;

    /* dots */
    h += '<div class="xadc-dots">';
    for (var d = 1; d <= n; d++) {
      if (mode !== "auto") {
        h += '<label for="' + id + '-ad-' + d + '" class="xadc-dot' + (d===1?" is-active":"") + '"></label>';
      } else {
        h += '<button class="xadc-dot' + (d===1?" is-active":"") + '" data-idx="' + (d-1) + '"></button>';
      }
    }
    h += '</div>';

    h += '</div>'; /* .xadc-wrap */
    return h;
  }


  /* ══════════════════════════════════════════════════════
   * GPT
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

  function initSlots(id, adUnit, n, adSize) {
    loadGPT(function () {
      var gt = window.googletag;

      for (var i = 1; i <= n; i++) {
        gt.defineSlot(adUnit, adSize, id + "-slide-" + i)
          .addService(gt.pubads());
      }

      /* enableSingleRequest + enableServices only once globally */
      if (!_svcEnabled) {
        _svcEnabled = true;
        gt.pubads().enableSingleRequest();
        gt.enableServices();
      }

      for (var j = 1; j <= n; j++) {
        gt.display(id + "-slide-" + j);
      }
    });
  }


  /* ══════════════════════════════════════════════════════
   * DOT SYNC  (auto/both mode)
   * ══════════════════════════════════════════════════════ */
  function syncDots(id, n, duration) {
    var dots  = document.querySelectorAll("#" + id + " .xadc-dot");
    var cur   = 0;

    function activate(idx) {
      cur = ((idx % n) + n) % n;
      dots.forEach(function(d, i) { d.classList.toggle("is-active", i === cur); });
    }

    var timer = setInterval(function() { activate(cur + 1); }, duration * 1000);

    /* dot click — highlight immediately */
    dots.forEach(function(dot, i) {
      dot.addEventListener("click", function() { activate(i); });
    });

    /* pause when tab hidden */
    document.addEventListener("visibilitychange", function() {
      if (document.hidden) { clearInterval(timer); }
      else { timer = setInterval(function() { activate(cur+1); }, duration*1000); }
    });
  }


  /* ══════════════════════════════════════════════════════
   * MAIN API
   * ══════════════════════════════════════════════════════ */
  function XadCarousel(adUnit, slideCount, height, duration, mode, adSize) {

    /* defaults */
    slideCount = Math.max(2, Math.min(parseInt(slideCount,10)||3, 10));
    height     = parseInt(height,  10) || 300;
    duration   = parseInt(duration,10) || 5;
    mode       = (["auto","manual","both"].indexOf((mode||"").toLowerCase()) !== -1)
               ? mode.toLowerCase() : "auto";
    adSize     = Array.isArray(adSize) ? adSize : [300, 250];

    var id = uid();

    /* 1. CSS */
    addStyle(
      buildInstanceCSS(id, slideCount, height, duration, mode) +
      buildManualCSS(id, slideCount, mode),
      id + "-css"
    );

    /* 2. HTML — insert after the calling <script> tag */
    var html      = buildHTML(id, slideCount, height, mode);
    var curScript = document.currentScript || (function(){
      var s = document.querySelectorAll("script"); return s[s.length-1];
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

    /* 3. GPT slots */
    onReady(function() { initSlots(id, adUnit, slideCount, adSize); });

    /* 4. dot sync */
    if (mode !== "manual") {
      onReady(function() { syncDots(id, slideCount, duration); });
    }

    return { id:id, adUnit:adUnit, slideCount:slideCount,
             height:height, duration:duration, mode:mode, adSize:adSize };
  }

  global.XadCarousel = XadCarousel;

}(typeof window !== "undefined" ? window : this));
