/*!
 * XadCarousel v1.3.0
 * Carousel Ads — maximize revenue without new placements
 *
 * ASYNC-SAFE: works even when loaded with async/defer or from CDN.
 * Add stub BEFORE loading the library:
 *
 *   <script>window.XadCarousel=window.XadCarousel||function(){(window._xadQ=window._xadQ||[]).push(arguments);}</script>
 *   <script async src="https://cdn.jsdelivr.net/gh/USER/REPO@latest/xad-carousel.js"></script>
 *
 * Usage (same as before):
 *   XadCarousel("/1234/my-ad", 4, 300, 5)
 *   XadCarousel("/1234/my-ad", 3, 250, 7, "both")
 *   XadCarousel("/1234/my-ad", 3, 100, 6, "auto", [728, 90])
 */

(function (global) {
  "use strict";

  /* ── state ─────────────────────────────────────────── */
  var _count      = 0;
  var _gptLoaded  = false;
  var _svcEnabled = false;

  /* ── helpers ───────────────────────────────────────── */
  function uid()  { return "xadc-" + (++_count) + "-" + Math.random().toString(36).slice(2,6); }
  function px(n)  { return n + "px"; }

  function addStyle(css, styleId) {
    if (document.getElementById(styleId)) return;
    var el = document.createElement("style");
    el.id = styleId; el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  /* ══════════════════════════════════════════════════════
   * BASE CSS — injected once per page
   * ══════════════════════════════════════════════════════ */
  addStyle([
    ".xadc-wrap{width:100%;overflow:hidden;position:relative;box-sizing:border-box;}",
    ".xadc-anim{display:flex;flex:1 1 100%;width:100%;}",
    ".xadc-track{display:flex;flex-shrink:0;transition:transform .5s ease-in-out;}",
    /* slide: flex center + text-align for GPT inline-block fallback */
    ".xadc-slide{",
      "flex-shrink:0;display:flex;align-items:center;justify-content:center;",
      "text-align:center;overflow:visible;box-sizing:border-box;background:#f8f8f8;",
    "}",
    /* GPT injects <div style="width:Xpx;height:Ypx"> — center it */
    ".xadc-slide>div{display:block;margin:0 auto;line-height:0;}",
    /* arrows */
    ".xadc-arrow{",
      "position:absolute;top:50%;transform:translateY(-50%);",
      "font-size:1.8rem;line-height:1;color:rgba(0,0,0,.55);",
      "background:rgba(255,255,255,.8);border:none;padding:6px 11px;",
      "border-radius:4px;cursor:pointer;z-index:20;user-select:none;transition:background .2s;",
    "}",
    ".xadc-arrow:hover{background:#fff;}",
    ".xadc-prev{left:8px;}.xadc-next{right:8px;}",
    /* dots */
    ".xadc-dots{display:flex;justify-content:center;gap:6px;padding:8px 0;}",
    ".xadc-dot{",
      "width:7px;height:7px;border-radius:50%;background:#ccc;",
      "border:none;padding:0;cursor:pointer;transition:background .25s,transform .25s;",
    "}",
    ".xadc-dot.is-active{background:#555;transform:scale(1.35);}",
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
      /* keyframes on animation-wrapper: each step = -100% of container width */
      var slot = 100 / n;
      var hold = slot * 0.80;
      var kf   = "@keyframes " + anim + "{";
      for (var i = 0; i < n; i++) {
        var hs = (i * slot).toFixed(2);
        var he = (i * slot + hold).toFixed(2);
        var tx = i === 0 ? "0" : "-" + (i * 100) + "%";
        kf += hs + "%," + he + "%{transform:translateX(" + tx + ");}";
      }
      kf += "100%{transform:translateX(-" + ((n - 1) * 100) + "%);}";
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
   * MANUAL / BOTH CSS — radio-button hack
   * ══════════════════════════════════════════════════════ */
  function buildManualCSS(id, n, mode) {
    if (mode === "auto") return "";
    var slideW = 100 / n;
    var lines  = [];

    lines.push("#" + id + " .xadc-nav label{display:none;}");

    for (var i = 1; i <= n; i++) {
      var tx    = ((i - 1) * slideW).toFixed(4);
      var txStr = i === 1 ? "0" : "-" + tx + "%";
      lines.push(
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-nav-" + i + "{display:block;}",
        "#" + id + "-ad-" + i + ":checked~#" + id + " .xadc-track{transform:translateX(" + txStr + ")!important;}",
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

  /* ══════════════════════════════════════════════════════
   * HTML
   * ══════════════════════════════════════════════════════ */
  function buildHTML(id, n, height, mode) {
    var h = "";

    if (mode !== "auto") {
      for (var r = 1; r <= n; r++) {
        h += '<input type="radio" name="' + id + '-ads" id="' + id + '-ad-' + r + '"'
           + (r === 1 ? " checked" : "") + " hidden>";
      }
    }

    h += '<div class="xadc-wrap" id="' + id + '">';

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

    var wO = mode !== "manual" ? '<div class="xadc-anim">' : "";
    var wC = mode !== "manual" ? "</div>"                  : "";

    h += wO + '<div class="xadc-track">';
    for (var s = 1; s <= n; s++) {
      h += '<div class="xadc-slide" id="' + id + '-slide-' + s + '"'
         + ' style="height:' + px(height) + ';min-height:' + px(height) + ';">'
         + '</div>';
    }
    h += '</div>' + wC;

    h += '<div class="xadc-dots">';
    for (var d = 1; d <= n; d++) {
      if (mode !== "auto") {
        h += '<label for="' + id + '-ad-' + d + '" class="xadc-dot' + (d === 1 ? " is-active" : "") + '"></label>';
      } else {
        h += '<button class="xadc-dot' + (d === 1 ? " is-active" : "") + '" data-idx="' + (d - 1) + '"></button>';
      }
    }
    h += '</div>';

    h += '</div>';
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
      else { timer = setInterval(function () { activate(cur + 1); }, duration * 1000); }
    });
  }

  /* ══════════════════════════════════════════════════════
   * CORE — render one carousel instance
   * ══════════════════════════════════════════════════════ */
  function _render(adUnit, slideCount, height, duration, mode, adSize, anchor) {
    slideCount = Math.max(2, Math.min(parseInt(slideCount, 10) || 3, 10));
    height     = parseInt(height,   10) || 300;
    duration   = parseInt(duration, 10) || 5;
    mode       = (["auto","manual","both"].indexOf((mode || "").toLowerCase()) !== -1)
               ? mode.toLowerCase() : "auto";
    adSize     = Array.isArray(adSize) ? adSize : [300, 250];

    var id = uid();

    /* CSS */
    addStyle(
      buildInstanceCSS(id, slideCount, height, duration, mode) +
      buildManualCSS(id, slideCount, mode),
      id + "-css"
    );

    /* HTML — insert after anchor <script> tag if provided, else append to body */
    var html = buildHTML(id, slideCount, height, mode);
    var tmp  = document.createElement("div");
    tmp.innerHTML = html;
    var frag = document.createDocumentFragment();
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(frag, anchor.nextSibling);
    } else {
      /* async/defer fallback: append to body */
      onReady(function () { document.body.appendChild(frag); });
    }

    /* GPT + dots */
    onReady(function () {
      initSlots(id, adUnit, slideCount, adSize);
      if (mode !== "manual") syncDots(id, slideCount, duration);
    });

    return { id: id, adUnit: adUnit, slideCount: slideCount,
             height: height, duration: duration, mode: mode, adSize: adSize };
  }

  /* ══════════════════════════════════════════════════════
   * PUBLIC API — XadCarousel(adUnit, n, h, dur, mode, size)
   *
   * ASYNC-SAFE QUEUE DRAIN:
   * If the stub was set up before the library loaded, any calls
   * queued in window._xadQ[] are replayed now in order.
   * ══════════════════════════════════════════════════════ */
  function XadCarousel(adUnit, slideCount, height, duration, mode, adSize) {
    var anchor = document.currentScript || (function () {
      var s = document.querySelectorAll("script"); return s[s.length - 1];
    }());
    return _render(adUnit, slideCount, height, duration, mode, adSize, anchor);
  }

  /* drain any queued calls from the stub */
  function _drainQueue() {
    var q = global._xadQ;
    if (!Array.isArray(q)) return;
    /* each item in queue is an arguments array: [adUnit, n, h, dur, mode, size] */
    for (var i = 0; i < q.length; i++) {
      var args = q[i];
      /* queued calls have no live script anchor — append to body */
      _render(args[0], args[1], args[2], args[3], args[4], args[5], null);
    }
    global._xadQ = [];   /* clear queue */
  }

  /* expose */
  global.XadCarousel = XadCarousel;
  global._xadQ = global._xadQ || [];

  /* drain immediately (library arrived after calls were queued) */
  _drainQueue();

  /* also drain on DOMContentLoaded in case queue was filled very early */
  onReady(_drainQueue);

}(typeof window !== "undefined" ? window : this));
