/**
 * Config toàn cục — ghi đè bằng AdLibInit()
 * refresh.interval = 0  → tắt refresh
 * frequency.cap    = 0  → không giới hạn impression
 * frequency.cooldown=0  → không có cooldown
 */
var _adlib_config = {
  lazyLoad    : true,
  fetchMargin : 500,   // px
  renderMargin: 200,   // px
  refresh: {
    interval   : 0,    // giây; 0 = tắt
    maxTimes   : 10,
    onlyVisible: true,
    minVisible : 50,   // % 0-100
  },
  frequency: {
    cap     : 0,       // max lần hiển thị / session; 0 = tắt
    cooldown: 0,       // giây; 0 = tắt
  }
};

/**
 * Khởi tạo AdLib
 * @param {object|string} [opts] - object config hoặc string clarityId (backward compat)
 */
function AdLibInit(opts) {
  if (!opts) return;

  // Backward compat: AdLibInit('clarityId')
  if (typeof opts === 'string') { _adlib_loadClarity(opts); return; }

  if (opts.clarityId)  _adlib_loadClarity(opts.clarityId);

  // Deep merge config
  if (opts.lazyLoad    !== undefined) _adlib_config.lazyLoad     = opts.lazyLoad;
  if (opts.fetchMargin !== undefined) _adlib_config.fetchMargin  = opts.fetchMargin;
  if (opts.renderMargin!== undefined) _adlib_config.renderMargin = opts.renderMargin;
  if (opts.refresh)    Object.assign(_adlib_config.refresh,   opts.refresh);
  if (opts.frequency)  Object.assign(_adlib_config.frequency, opts.frequency);

  // Kích hoạt GPT lazy load nếu được bật
  if (_adlib_config.lazyLoad) {
    _checkGPTExists();
    window.googletag = window.googletag || { cmd: [] };
    googletag.cmd.push(function () {
      googletag.pubads().enableLazyLoad({
        fetchMarginPercent : _adlib_config.fetchMargin,
        renderMarginPercent: _adlib_config.renderMargin,
        mobileScaling      : 2.0
      });
    });
  }
}

function _adlib_loadClarity(id) {
  if (!id || document.getElementById('adlib-clarity-js')) return;
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.id = 'adlib-clarity-js';
    t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', id);
}


// ============================================================
// REFRESH ENGINE (private)
// ============================================================

/**
 * Đăng ký slot vào engine tự động refresh
 * @param {object} slot         - GPT slot object
 * @param {string} [containerId]- ID container để kiểm tra viewability
 */
function _adlib_registerRefresh(slot, containerId) {
  var cfg = _adlib_config.refresh;
  if (!cfg.interval || cfg.interval <= 0) return;

  var count = 0;
  var observer = null;
  var isVisible = false;

  // Theo dõi viewability bằng IntersectionObserver
  if (cfg.onlyVisible && containerId && window.IntersectionObserver) {
    var el = document.getElementById(containerId);
    if (el) {
      observer = new IntersectionObserver(function (entries) {
        isVisible = entries[0].intersectionRatio * 100 >= cfg.minVisible;
      }, { threshold: cfg.minVisible / 100 });
      observer.observe(el);
    }
  } else {
    isVisible = true; // Không dùng observer → luôn refresh
  }

  var timer = setInterval(function () {
    if (count >= cfg.maxTimes) { clearInterval(timer); if (observer) observer.disconnect(); return; }

    // Dừng refresh nếu slot bị destroy (container bị xóa)
    if (containerId && !document.getElementById(containerId)) {
      clearInterval(timer); if (observer) observer.disconnect(); return;
    }

    // Chỉ refresh khi visible
    if (cfg.onlyVisible && !isVisible) return;

    try {
      googletag.pubads().refresh([slot]);
      count++;
    } catch (e) {}
  }, cfg.interval * 1000);
}


// ============================================================
// FREQUENCY CAP ENGINE (private)
// ============================================================

/**
 * Kiểm tra frequency cap & cooldown cho một ad format
 * @param {string} key   - tên format, vd: 'catfish', 'firstview'
 * @returns {boolean}    - true = được phép hiển thị
 */
function _adlib_checkFrequency(key) {
  var cfg = _adlib_config.frequency;
  var capKey  = 'adlib_fc_' + key;
  var timeKey = 'adlib_ft_' + key;
  var now     = Date.now();

  // Kiểm tra cooldown (giây)
  if (cfg.cooldown > 0) {
    var lastShown = parseInt(sessionStorage.getItem(timeKey) || '0');
    if (lastShown && (now - lastShown) < cfg.cooldown * 1000) return false;
  }

  // Kiểm tra frequency cap (số lần/session)
  if (cfg.cap > 0) {
    var shown = parseInt(sessionStorage.getItem(capKey) || '0');
    if (shown >= cfg.cap) return false;
    sessionStorage.setItem(capKey, shown + 1);
  }

  // Ghi lại thời điểm hiển thị
  if (cfg.cooldown > 0) sessionStorage.setItem(timeKey, now);

  return true;
}


// ============================================================
// UTILITIES (private)
// ============================================================

var _adlib_ids = [];
function _randomID() {
  var r = Math.random().toString().substring(2);
  while (_adlib_ids.includes(r)) r = Math.random().toString().substring(2);
  _adlib_ids.push(r);
  return 'adlib-gpt-' + r;
}

function _checkGPTExists() {
  if (document.querySelector('script[src*="securepubads.g.doubleclick.net/tag/js/gpt.js"]')) return true;
  var s = document.createElement('script');
  s.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
  s.async = true;
  document.head.appendChild(s);
  return false;
}

function _checkAdsenseExists(clientId) {
  if (document.querySelector('script[src*="adsbygoogle.js?client=' + clientId + '"]')) return true;
  var s = document.createElement('script');
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + clientId;
  s.async = true;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
  return false;
}

/**
 * Kiểm tra & cập nhật page view trong sessionStorage
 * @returns {boolean} true nếu được phép hiển thị
 */
function _checkPageView(adUnit, pageView) {
  var key = 'adlib_pv_' + adUnit.replace(/[^a-zA-Z0-9]/g, '');
  var current = sessionStorage.getItem(key);
  current = (current === null) ? 1 : parseInt(current) + 1;
  sessionStorage.setItem(key, current);
  if (pageView.length > 0 && pageView[0] !== 0) {
    return pageView.indexOf(current) !== -1;
  }
  return true;
}

function _checkDevice(isDisplay) {
  var isMobile = window.innerWidth < 768;
  if (isDisplay === 1 && isMobile) return false;
  if (isDisplay === 2 && !isMobile) return false;
  return true;
}

function _findContentArea(target) {
  if (target) return document.querySelector(target);
  var selectors = [
    'article', '.post-content', '.entry-content',
    '.content-detail', '.detail-content', '.fck_detail', '#content_blog'
  ];
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el && el.querySelectorAll('p').length > 2) return el;
  }
  var best = null, maxP = 0;
  document.querySelectorAll('div').forEach(function (div) {
    var count = div.querySelectorAll(':scope > p').length;
    if (count > maxP) { maxP = count; best = div; }
  });
  return best || document.body;
}


// ============================================================
// CLOSE BUTTON SYSTEM
// ============================================================

function _injectCloseStyles() {
  if (document.getElementById('adlib-close-style')) return;
  var style = document.createElement('style');
  style.id = 'adlib-close-style';
  style.innerHTML = `
    .adlib-close-btn {
      opacity: 0; transition: opacity 0.5s ease-in-out, transform 0.2s;
      z-index: 2147483647; background: rgba(60,60,60,0.95); color: #fff;
      font-family: Arial, sans-serif; font-size: 11px; font-weight: bold;
      padding: 5px 12px; cursor: pointer; border: none;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center; white-space: nowrap;
    }
    .adlib-close-btn:hover { background: #000; transform: scale(1.05); }
    .adlib-close-show { opacity: 1; }
  `;
  document.head.appendChild(style);
}

/**
 * Render nút Close cho wrapper quảng cáo
 * @param {string} targetId  - ID phần tử cha (wrapper)
 * @param {object} slot      - GPT slot object (để destroySlots khi đóng)
 * @param {number} vPos      - 0: nút trên ad | 1: nút dưới ad
 * @param {number} hPos      - 0: trái | 1: phải | 2: giữa
 */
function _renderCloseBtn(targetId, slot, vPos, hPos) {
  _injectCloseStyles();
  var target = document.getElementById(targetId);
  if (!target) return;

  var btn = document.createElement('button');
  btn.className = 'adlib-close-btn';
  btn.innerHTML = 'CLOSE ✕';
  btn.style.position = 'absolute';

  // Vị trí dọc
  if (vPos === 1) { btn.style.top = '100%'; btn.style.borderRadius = '0 0 5px 5px'; }
  else            { btn.style.bottom = '100%'; btn.style.borderRadius = '5px 5px 0 0'; }

  // Vị trí ngang
  if (hPos === 0)      btn.style.left = '0';
  else if (hPos === 2) { btn.style.left = '50%'; btn.style.transform = 'translateX(-50%)'; }
  else                 btn.style.right = '0';

  btn.onclick = function (e) {
    e.preventDefault();
    if (slot) googletag.destroySlots([slot]);
    var root = (targetId.indexOf('container') > -1) ? target : target.parentElement;
    if (root) root.remove();
  };

  target.appendChild(btn);
  setTimeout(function () { btn.classList.add('adlib-close-show'); }, 200);
}

// ============================================================
// ADX — INTERSTITIAL
// ============================================================

/**
 * AdxInterstitial: Quảng cáo toàn màn hình (Out-of-Page Interstitial)
 * @param {string} adUnit
 */
function AdxInterstitial(adUnit) {
  _checkGPTExists();
  window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    var slot = googletag.defineOutOfPageSlot(adUnit, googletag.enums.OutOfPageFormat.INTERSTITIAL);
    if (!slot) return;
    slot.addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
    googletag.display(slot);
  });
}


// ============================================================
// ADX — REWARDED
// ============================================================

/**
 * AdxRewarded: Quảng cáo có thưởng với điều kiện thiết bị & lượt xem
 * @param {string} adUnit
 * @param {number} [isDisplay=0]    - 0:cả hai | 1:PC | 2:Mobile
 * @param {array}  [pageView=[0]]   - [0]:tất cả | [1,3]:chỉ lượt 1 & 3
 */
function AdxRewarded(adUnit, isDisplay, pageView) {
  isDisplay = isDisplay !== undefined ? isDisplay : 0;
  pageView  = pageView  || [0];

  if (sessionStorage.getItem('adlib_rewarded_' + adUnit)) return;
  if (!_checkDevice(isDisplay)) return;
  if (!_checkPageView(adUnit, pageView)) return;

  sessionStorage.setItem('adlib_rewarded_' + adUnit, 'true');
  _checkGPTExists();
  window.googletag = window.googletag || { cmd: [] };

  var rewardedSlot, rewardPayload;
  googletag.cmd.push(function () {
    rewardedSlot = googletag.defineOutOfPageSlot(adUnit, googletag.enums.OutOfPageFormat.REWARDED);
    if (!rewardedSlot) { window.adlib_rewarded_done = true; return; }

    rewardedSlot.addService(googletag.pubads());
    googletag.pubads().addEventListener('rewardedSlotReady',   function (e) { e.makeRewardedVisible(); });
    googletag.pubads().addEventListener('rewardedSlotGranted', function (e) { rewardPayload = e.payload; });
    googletag.pubads().addEventListener('rewardedSlotClosed',  function ()  {
      rewardPayload = null;
      googletag.destroySlots([rewardedSlot]);
      window.adlib_rewarded_done = true;
    });
    googletag.pubads().addEventListener('slotRenderEnded', function (e) {
      if (e.slot === rewardedSlot && e.isEmpty) window.adlib_rewarded_done = true;
    });
    googletag.enableServices();
    googletag.display(rewardedSlot);
  });
}


// ============================================================
// ADX — CATFISH
// ============================================================

/**
 * AdxCatfish: Banner cố định dưới trang — hiện khi cuộn xuống, ẩn khi cuộn lên
 * @param {string} adUnit
 * @param {number} [isDisplay=0]      - 0:cả hai | 1:chỉ PC | 2:chỉ Mobile
 * @param {array}  [pageView=[0]]     - [0]:tất cả | [1,3]:chỉ lượt 1 & 3
 * @param {number} [closeBtnPos=1]    - 0:trái | 1:phải | 2:giữa
 * @param {number} [bottom=0]         - khoảng cách từ đáy trang (px)
 */
function AdxCatfish(adUnit, isDisplay, pageView, closeBtnPos, bottom) {
  isDisplay   = isDisplay   !== undefined ? isDisplay   : 0;
  pageView    = pageView    || [0];
  closeBtnPos = closeBtnPos !== undefined ? closeBtnPos : 1;
  bottom      = bottom      || 0;

  if (!_checkDevice(isDisplay)) return;
  if (!_checkPageView(adUnit, pageView)) return;
  if (!_adlib_checkFrequency('catfish')) return;

  var hasRendered = false, lastST = 0;
  var gpt_id = _randomID();
  var cId    = 'adlib-catfish-' + gpt_id;

  window.addEventListener('scroll', function () {
    var st        = window.pageYOffset || document.documentElement.scrollTop;
    var container = document.getElementById(cId);

    if (st > lastST && st > 100) {
      if (!hasRendered) {
        hasRendered = true;
        _renderCatfishAd(adUnit, gpt_id, cId, closeBtnPos, bottom);
      } else if (container) {
        container.style.display   = 'flex';
        container.style.opacity   = '1';
        container.style.transform = 'translateY(0)';
      }
    } else if (st < lastST && container) {
      container.style.opacity   = '0';
      container.style.transform = 'translateY(100%)';
      setTimeout(function () {
        if (container.style.opacity === '0') container.style.display = 'none';
      }, 400);
    }
    lastST = st <= 0 ? 0 : st;
  }, { passive: true });
}

function _renderCatfishAd(adUnit, gpt_id, cId, closeBtnPos, bottom) {
  _checkGPTExists();
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${cId}" style="position:fixed;bottom:${bottom}px;left:0;width:100%;z-index:2147483646;display:flex;justify-content:center;pointer-events:none;transition:all .4s ease-in-out;opacity:0;transform:translateY(100%);">
      <div id="wrap-cat-${gpt_id}" style="position:relative;pointer-events:auto;background:transparent;line-height:0;">
        <div id="${gpt_id}"></div>
      </div>
    </div>`);

  window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    var mapping = googletag.sizeMapping()
      .addSize([1024, 0], [[728, 90]])
      .addSize([0, 0],    [[300, 100], [300, 50], [320, 100], [320, 50]])
      .build();

    var slot = googletag.defineSlot(adUnit, [[728, 90], [300, 100], [300, 50], [320, 100], [320, 50]], gpt_id)
      .defineSizeMapping(mapping).addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
    googletag.display(gpt_id);

    googletag.pubads().addEventListener('slotRenderEnded', function (e) {
      if (e.slot === slot && !e.isEmpty) {
        var container = document.getElementById(cId);
        var wrapper   = document.getElementById('wrap-cat-' + gpt_id);
        if (container) {
          container.style.display = 'flex';
          setTimeout(function () {
            container.style.opacity   = '1';
            container.style.transform = 'translateY(0)';
          }, 100);
        }
        if (wrapper) {
          wrapper.style.background = '#fff';
          wrapper.style.boxShadow  = '0 -2px 10px rgba(0,0,0,.15)';
          wrapper.style.padding    = '2px';
        }
        _renderCloseBtn('wrap-cat-' + gpt_id, slot, 0, closeBtnPos);
        _adlib_registerRefresh(slot, cId);
      }
    });
  });
}

/**
 * AdxCatfishAuto: Catfish tự động chọn size theo thiết bị, hiện khi cuộn đủ xa
 * @param {string}     adUnit
 * @param {array|null} [adSize=null]   - null = tự chọn theo thiết bị
 * @param {number}     [isDisplay=0]
 * @param {array}      [pageView=[0]]
 * @param {number}     [bottom=0]
 */
function AdxCatfishAuto(adUnit, adSize, isDisplay, pageView, bottom) {
  isDisplay = isDisplay !== undefined ? isDisplay : 0;
  pageView  = pageView  || [0];
  bottom    = bottom    || 0;
  if (!adSize) adSize = window.innerWidth < 768 ? [320, 100] : [728, 90];

  if (!_checkDevice(isDisplay)) return;
  if (!_checkPageView(adUnit, pageView)) return;
  if (!_adlib_checkFrequency('catfish')) return;

  _checkGPTExists();
  var gpt_id = _randomID();
  var cId    = 'adlib-catfish-auto-' + gpt_id;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${cId}" style="display:none;position:fixed;bottom:${bottom}px;left:0;right:0;margin:0 auto;width:${adSize[0]}px;height:${adSize[1]}px;background:#fff;z-index:2147483646;box-shadow:0 -2px 5px rgba(0,0,0,.2);">
      <button onclick="this.parentElement.style.display='none'" style="position:absolute;top:0;right:0;background:#D6DCD9;border:none;color:#BBC4BF;font-size:18px;cursor:pointer;width:20px;height:20px;">×</button>
      <div id="${gpt_id}" style="min-width:${adSize[0]}px;min-height:${adSize[1]}px;"></div>
    </div>`);

  window.googletag = window.googletag || { cmd: [] };
  var isAdLoaded = false, isVisible = false;
  var triggerPos = window.innerHeight * 1.5;

  googletag.cmd.push(function () {
    var slot = googletag.defineSlot(adUnit, adSize, gpt_id).addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
    googletag.pubads().addEventListener('slotRenderEnded', function (e) {
      if      (e.slot === slot && !e.isEmpty) { isAdLoaded = true; _adlib_registerRefresh(slot, cId); }
      else if (e.slot === slot &&  e.isEmpty) { var c = document.getElementById(cId); if (c) c.remove(); }
    });
    googletag.display(gpt_id);
  });

  window.addEventListener('scroll', function () {
    var c = document.getElementById(cId); if (!c) return;
    if (isAdLoaded && window.scrollY > triggerPos && !isVisible) {
      c.style.display = 'flex'; isVisible = true;
    } else if (window.scrollY <= triggerPos && isVisible) {
      c.style.display = 'none'; isVisible = false;
    }
  });
}


// ============================================================
// ADX — FIRSTVIEW (POPUP)
// ============================================================

/**
 * AdxFirstView: Popup giữa màn hình — hỗ trợ cả PC & Mobile
 * @param {string} adUnit
 * @param {number} [isDisplay=0]      - 0:cả hai | 1:chỉ PC | 2:chỉ Mobile
 * @param {array}  [pageView=[0]]     - [0]:tất cả | [1,3]:chỉ lượt 1 & 3
 * @param {number} [closeBtnPos=1]    - 0:trái | 1:phải | 2:giữa
 */
function AdxFirstView(adUnit, isDisplay, pageView, closeBtnPos) {
  isDisplay   = isDisplay   !== undefined ? isDisplay   : 0;
  pageView    = pageView    || [0];
  closeBtnPos = closeBtnPos !== undefined ? closeBtnPos : 1;

  if (!_checkDevice(isDisplay)) return;
  if (!_checkPageView(adUnit, pageView)) return;
  if (!_adlib_checkFrequency('firstview')) return;

  _checkGPTExists();
  var gpt_id = _randomID();
  var cId    = 'adlib-fv-' + gpt_id;

  // Overlay full màn hình, wrapper tự co theo kích thước ad thực tế
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${cId}" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483646;background:rgba(0,0,0,.8);display:flex;justify-content:center;align-items:center;">
      <div id="wrap-fv-${gpt_id}" style="position:relative;background:#fff;line-height:0;box-shadow:0 0 30px rgba(0,0,0,.6);max-width:95vw;max-height:95vh;overflow:visible;display:inline-block;">
        <div id="${gpt_id}"></div>
      </div>
    </div>`);

  window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    var mapping = googletag.sizeMapping()
      // PC ≥ 1024px: ưu tiên size lớn, thêm 640×480 và 580×400
      .addSize([1024, 0], [[640, 480], [580, 400], [300, 600], [300, 400], [336, 280], [300, 250]])
      // Tablet 768–1023px
      .addSize([768, 0],  [[300, 600], [300, 400], [336, 280], [300, 250]])
      // Mobile < 768px: size nhỏ vừa màn hình
      .addSize([0, 0],    [[300, 250], [336, 280], [300, 600]])
      .build();

    var allSizes = [[640, 480], [580, 400], [300, 600], [300, 400], [336, 280], [300, 250]];

    var slot = googletag.defineSlot(adUnit, allSizes, gpt_id)
      .defineSizeMapping(mapping)
      .addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
    googletag.display(gpt_id);

    googletag.pubads().addEventListener('slotRenderEnded', function (e) {
      if (e.slot === slot && !e.isEmpty) {
        _renderCloseBtn('wrap-fv-' + gpt_id, slot, 0, closeBtnPos);
      } else if (e.slot === slot && e.isEmpty) {
        var c = document.getElementById(cId); if (c) c.remove();
      }
    });
  });
}


// ============================================================
// ADX — BANNER (INLINE)
// ============================================================

/**
 * AdxBanner: Chèn banner quảng cáo vào vị trí chỉ định
 * @param {string} adUnit
 * @param {array}  adSize              - [300,250] hoặc [[300,250],[728,90]]
 * @param {array}  [mapping=[]]        - [{breakpoint:[w,h], size:[w,h]}, ...]
 * @param {string} element             - CSS selector phần tử đích
 * @param {number} [insertPosition=0]
 * @param {boolean}[setMin=false]      - true: đặt min-width/height
 */
function AdxBanner(adUnit, adSize, mapping, element, insertPosition, setMin) {
  mapping         = mapping         || [];
  insertPosition  = insertPosition  !== undefined ? insertPosition  : 0;
  setMin          = setMin          || false;

  var el = document.body.querySelector(element);
  if (!el) return;
  _checkGPTExists();
  var gpt_id = _randomID();
  window.googletag = window.googletag || { cmd: [] };

  var adSlot; // hoist ra ngoài để nested cmd.push truy cập được
  googletag.cmd.push(function () {
    adSlot = googletag.defineSlot(adUnit, adSize, gpt_id).addService(googletag.pubads());
    if (mapping.length) {
      var sm = googletag.sizeMapping();
      mapping.forEach(function (m) {
        sm.addSize(m.breakpoint, Array.isArray(m.size[0]) ? m.size : [m.size]);
      });
      adSlot.defineSizeMapping(sm.build());
    }
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
  });

  var minStyle = '';
  if (setMin) {
    var mw = 0, mh = 0;
    if (!Array.isArray(adSize[0])) { mw = adSize[0]; mh = adSize[1]; }
    else adSize.forEach(function (s) {
      mw = (!mw || s[0] < mw) ? s[0] : mw;
      mh = (!mh || s[1] < mh) ? s[1] : mh;
    });
    minStyle = 'min-width:' + mw + 'px;min-height:' + mh + 'px;';
  }

  var html = `<div class="adlib-banner"><center><div id="${gpt_id}" style="${minStyle}"></div></center></div>`;
  if      (insertPosition === 1) el.insertAdjacentHTML('afterbegin',  html);
  else if (insertPosition === 2) el.insertAdjacentHTML('beforebegin', html);
  else if (insertPosition === 3) el.insertAdjacentHTML('afterend',    html);
  else                           el.insertAdjacentHTML('beforeend',   html);

  googletag.cmd.push(function () {
    googletag.display(gpt_id);
    _adlib_registerRefresh(adSlot, gpt_id);
  });
}

/**
 * AdxAutoAds: Tự động chèn nhiều banner theo khoảng cách màn hình
 * @param {string}  adUnit            - Prefix ad unit (sẽ ghép số: adUnit + start, start+1, ...)
 * @param {number}  start             - Số bắt đầu
 * @param {number}  end               - Số kết thúc
 * @param {array}   adSize
 * @param {array}   [mapping=[]]
 * @param {string}  elements          - CSS selector các phần tử
 * @param {number}  [insertPosition=2]
 * @param {boolean} [setMin=false]
 * @param {number}  [minScreen=1]     - Khoảng cách tối thiểu (số màn hình) giữa 2 ad
 */
function AdxAutoAds(adUnit, start, end, adSize, mapping, elements, insertPosition, setMin, minScreen) {
  insertPosition = insertPosition !== undefined ? insertPosition : 2;
  setMin         = setMin         || false;
  minScreen      = minScreen      !== undefined ? minScreen : 1;

  var els = document.querySelectorAll(elements);
  if (!els.length) return;

  var lastSpace = elements.lastIndexOf(' ');
  var elStr = lastSpace === -1 ? elements
    : elements.slice(0, lastSpace).trim() + ' > ' + elements.slice(lastSpace + 1).trim();

  var minAd = 0;
  for (var i = 0; i < els.length; i++) {
    if (start > end) break;
    var sel = elStr + ':nth-of-type(' + (i + 1) + ')';

    if (insertPosition === 0 || insertPosition === 3) {
      if (i === 0 || els[i].offsetTop + els[i].clientHeight - minAd - (screen.height * minScreen) >= 0) {
        AdxBanner(adUnit + (start++), adSize, mapping || [], sel, insertPosition, setMin);
        if (i < els.length - 1) minAd = els[i + 1].offsetTop;
      }
    } else {
      if (i === 0 || els[i].offsetTop - minAd - (screen.height * minScreen) >= 0) {
        AdxBanner(adUnit + (start++), adSize, mapping || [], sel, insertPosition, setMin);
        minAd = els[i].offsetTop;
        if (i < els.length - 1) continue;
      }
      if (i === els.length - 1 && els[i].offsetTop + els[i].clientHeight - minAd - (screen.height * minScreen) >= 0) {
        AdxBanner(adUnit + (start++), adSize, mapping || [], sel, insertPosition === 1 ? 0 : 3, setMin);
      }
    }
  }
}


// ============================================================
// ADX — IN-PAGE (SCROLL AD, mobile only)
// ============================================================

/**
 * AdxInPage: Quảng cáo 300×600 cuộn theo trang (chỉ mobile)
 * @param {string} adUnit
 * @param {string} element   - CSS selector container chứa các thẻ con
 * @param {number} [marginTop=-1]  - -1 = tự tính giữa màn hình
 */
function AdxInPage(adUnit, element, marginTop) {
  if (window.innerWidth >= 768) return;
  marginTop = marginTop !== undefined ? marginTop : -1;

  var gpt_id = _randomID();
  _checkGPTExists();
  window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    googletag.defineSlot(adUnit, [300, 600], gpt_id).addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
  });

  var parent = document.querySelectorAll(element)[0];
  if (!parent || parent.childElementCount < 2) return;
  var mid    = Math.min(Math.floor(parent.childElementCount / 2), 4);
  var anchor = 'adlib-ip-anchor-' + gpt_id;
  parent.children[mid - 1].insertAdjacentHTML('afterend', '<div id="' + anchor + '"></div>');

  var html = `<div id="adlib-ip-wrap-${gpt_id}" style="overflow:hidden;position:relative;z-index:2;width:100%;height:600px;">
    <div id="adlib-ip-ad-${gpt_id}" style="display:none;">
      <div id="${gpt_id}" style="min-width:300px;min-height:600px;"></div>
    </div>
  </div>`;
  document.getElementById(anchor).insertAdjacentHTML('beforeend', html);
  googletag.cmd.push(function () { googletag.display(gpt_id); });

  var mt = marginTop >= 0 ? marginTop : (window.innerHeight - 600) / 2;
  window.addEventListener('scroll', function () {
    var wrap = document.getElementById('adlib-ip-wrap-' + gpt_id);
    var ad   = document.getElementById('adlib-ip-ad-'   + gpt_id);
    if (!wrap || !ad) return;
    var top = wrap.getBoundingClientRect().top - mt;
    var bot = top > 0 ? 600 : 600 + top;
    ad.style.cssText = 'display:block;clip:rect(' + top + 'px,300px,' + bot + 'px,0px);'
      + 'left:' + ((window.innerWidth - 300) / 2) + 'px;top:' + mt + 'px;position:fixed;z-index:10000;';
  });
}


// ============================================================
// ADX — IN-IMAGE
// ============================================================

/**
 * AdxInImage: Chèn quảng cáo đè lên ảnh
 * @param {string} adUnit
 * @param {array}  adSize
 * @param {array}  [mapping=[]]
 * @param {string} element          - CSS selector ảnh
 * @param {number} [imageIndex=1]   - Ảnh thứ mấy (tính từ 1)
 * @param {number} [marginBottom=0]
 */
function AdxInImage(adUnit, adSize, mapping, element, imageIndex, marginBottom) {
  mapping      = mapping      || [];
  imageIndex   = imageIndex   !== undefined ? imageIndex   : 1;
  marginBottom = marginBottom || 0;

  var images = document.body.querySelectorAll(element);
  var image  = images[imageIndex - 1];
  if (!image) return;

  _checkGPTExists();
  var gpt_id = _randomID();
  window.googletag = window.googletag || { cmd: [] };

  googletag.cmd.push(function () {
    var adSlot = googletag.defineSlot(adUnit, adSize, gpt_id).addService(googletag.pubads());
    if (mapping.length) {
      var sm = googletag.sizeMapping();
      mapping.forEach(function (m) { sm.addSize(m.breakpoint, Array.isArray(m.size[0]) ? m.size : [m.size]); });
      adSlot.defineSizeMapping(sm.build());
    }
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
  });

  var wrapper  = document.createElement('div');
  wrapper.className = 'adlib-inimage';
  wrapper.style.cssText = 'position:relative';

  var adLayer  = document.createElement('div');
  adLayer.style.cssText = 'position:absolute;bottom:' + marginBottom + 'px;z-index:10;width:100%;';

  var center   = document.createElement('center');
  var adDiv    = document.createElement('div');
  adDiv.id     = gpt_id;

  var closeBtn = document.createElement('span');
  closeBtn.innerHTML  = '×';
  closeBtn.style.cssText = 'display:none;position:absolute;z-index:1;width:25px;height:25px;right:2px;top:-27px;cursor:pointer;font-size:20px;text-align:center;background:#fff;padding:2px;border-radius:20px;line-height:1;';
  closeBtn.addEventListener('click', function () { wrapper.style.visibility = 'hidden'; });

  center.appendChild(adDiv);
  adLayer.appendChild(center);
  adLayer.appendChild(closeBtn);
  wrapper.appendChild(adLayer);
  image.insertAdjacentElement('afterend', wrapper);
  googletag.cmd.push(function () { googletag.display(gpt_id); });

  var timeout = 0;
  var intv = setInterval(function () {
    var iframe = adDiv.querySelector('iframe');
    if (iframe && iframe.getAttribute('data-load-complete') === 'true') {
      closeBtn.style.display = 'block'; clearInterval(intv);
    }
    if (++timeout > 600) clearInterval(intv);
  }, 1000);
}

/**
 * AdxInImages: Chèn quảng cáo vào nhiều ảnh
 * @param {string} adUnit          - Prefix (ghép số)
 * @param {number} start
 * @param {number} end
 * @param {array}  adSize
 * @param {array}  [mapping=[]]
 * @param {string} element
 * @param {array}  [imageList=[]]  - [] = tất cả | [1,3] = chỉ ảnh 1 và 3
 * @param {number} [marginBottom=0]
 */
function AdxInImages(adUnit, start, end, adSize, mapping, element, imageList, marginBottom) {
  imageList    = imageList    || [];
  marginBottom = marginBottom || 0;
  var images   = document.body.querySelectorAll(element);
  if (!images.length) return;
  for (var i = 1; i <= images.length; i++) {
    if (start > end) break;
    if (imageList.length > 0 && !imageList.includes(i)) continue;
    AdxInImage(adUnit + (start++), adSize, mapping || [], element, i, marginBottom);
  }
}


// ============================================================
// ADX — MULTIPLE SIZE (cuộn nội dung full-height, mobile only)
// ============================================================

/**
 * AdxMultipleSize: Banner dọc 300×600 cuộn dính theo nội dung (chỉ mobile)
 * @param {string} adUnit
 * @param {string} element
 * @param {number} [insertPosition=0]
 * @param {number} [marginTop=0]
 */
function AdxMultipleSize(adUnit, element, insertPosition, marginTop) {
  if (window.innerWidth >= 768) return;
  insertPosition = insertPosition !== undefined ? insertPosition : 0;
  marginTop      = marginTop      || 0;
  _adlib_msAdd(adUnit, element, insertPosition);
  _adlib_msScroll(marginTop);
}

/**
 * AdxMultipleSizes: Tự động chèn nhiều Multiple Size
 * @param {string} adUnit    - Prefix
 * @param {number} start
 * @param {number} end
 * @param {string} elements
 * @param {number} [insertPosition=2]
 * @param {number} [marginTop=0]
 * @param {number} [minScreen=1]
 */
function AdxMultipleSizes(adUnit, start, end, elements, insertPosition, marginTop, minScreen) {
  if (window.innerWidth >= 768) return;
  insertPosition = insertPosition !== undefined ? insertPosition : 2;
  marginTop      = marginTop      || 0;
  minScreen      = minScreen      !== undefined ? minScreen : 1;

  var els = document.querySelectorAll(elements);
  if (!els.length) return;

  var lastSpace = elements.lastIndexOf(' ');
  var elStr = lastSpace === -1 ? elements
    : elements.slice(0, lastSpace).trim() + ' > ' + elements.slice(lastSpace + 1).trim();

  var minAd = 0;
  for (var i = 0; i < els.length; i++) {
    if (start > end) break;
    var sel = elStr + ':nth-of-type(' + (i + 1) + ')';
    if (insertPosition === 0 || insertPosition === 3) {
      if (i === 0 || els[i].offsetTop + els[i].clientHeight - minAd - (screen.height * minScreen) >= 0) {
        _adlib_msAdd(adUnit + (start++), sel, insertPosition);
        if (i < els.length - 1) minAd = els[i + 1].offsetTop;
      }
    } else {
      if (i === 0 || els[i].offsetTop - minAd - (screen.height * minScreen) >= 0) {
        _adlib_msAdd(adUnit + (start++), sel, insertPosition);
        minAd = els[i].offsetTop;
        if (i < els.length - 1) continue;
      }
      if (i === els.length - 1 && els[i].offsetTop + els[i].clientHeight - minAd - (screen.height * minScreen) >= 0) {
        _adlib_msAdd(adUnit + (start++), sel, insertPosition === 1 ? 0 : 3);
      }
    }
  }
  _adlib_msScroll(marginTop);
}

function _adlib_msAdd(adUnit, element, insertPosition) {
  var el = document.body.querySelector(element);
  if (!el) return;
  _checkGPTExists();
  var gpt_id = _randomID();
  window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    googletag.defineSlot(adUnit, [[300, 250], [300, 600]], gpt_id).addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
  });

  var html = `<div class="adlib-multisize" style="margin:10px calc(50% - 50vw);width:100vw;">
    <span style="display:block;font-size:14px;text-align:center;color:#9e9e9e;background:#f1f1f1;">Quảng cáo</span>
    <div class="adlib-ms-wrap" style="position:relative;min-height:600px;">
      <center class="adlib-ms-ad"><div id="${gpt_id}"></div></center>
    </div>
    <span style="display:block;font-size:14px;text-align:center;color:#9e9e9e;background:#f1f1f1;">Cuộn để tiếp tục</span>
  </div>`;

  if      (insertPosition === 1) el.insertAdjacentHTML('afterbegin',  html);
  else if (insertPosition === 2) el.insertAdjacentHTML('beforebegin', html);
  else if (insertPosition === 3) el.insertAdjacentHTML('afterend',    html);
  else                           el.insertAdjacentHTML('beforeend',   html);

  googletag.cmd.push(function () { googletag.display(gpt_id); });
}

var _adlib_msScrollBound = false;
function _adlib_msScroll(marginTop) {
  if (_adlib_msScrollBound) return;
  _adlib_msScrollBound = true;
  document.addEventListener('scroll', function () {
    document.querySelectorAll('.adlib-multisize').forEach(function (e) {
      var div  = e.querySelector('.adlib-ms-ad');
      var wrap = e.querySelector('.adlib-ms-wrap');
      var h = wrap.clientHeight, ch = div.clientHeight;
      var ap = wrap.getBoundingClientRect().top;
      if (ch < h) {
        if (ap >= marginTop) {
          div.style.cssText = '';
        } else if (Math.abs(ap) + ch < h - marginTop) {
          div.style.cssText = 'position:fixed;top:' + marginTop + 'px;left:50%;transform:translateX(-50%);';
        } else {
          div.style.cssText = 'position:absolute;bottom:0;left:50%;transform:translateX(-50%);';
        }
      } else {
        div.style.cssText = '';
      }
    });
  });
}


// ============================================================
// ADX — WIPE (nổi góc dưới phải, mobile only)
// ============================================================

/**
 * AdxWipe: Quảng cáo 300×250 nổi góc dưới phải sau một khoảng thời gian (chỉ mobile)
 * @param {string} adUnit
 * @param {number} [delay=3000]     - ms trước khi hiển thị
 * @param {number} [closeBtnPos=1]
 */
function AdxWipe(adUnit, delay, closeBtnPos) {
  if (window.innerWidth >= 768) return;
  delay       = delay       !== undefined ? delay       : 3000;
  closeBtnPos = closeBtnPos !== undefined ? closeBtnPos : 1;
  if (!_adlib_checkFrequency('wipe')) return;

  setTimeout(function () {
    _checkGPTExists();
    var gpt_id = _randomID();
    var cId    = 'adlib-wipe-' + gpt_id;

    document.body.insertAdjacentHTML('beforeend', `
      <div id="${cId}" style="display:none;position:fixed;bottom:200px;right:10px;z-index:2147483646;">
        <div id="wrap-${gpt_id}" style="position:relative;background:#fff;box-shadow:0 0 15px rgba(0,0,0,.2);padding:2px;border-radius:4px;">
          <div id="${gpt_id}" style="width:300px;height:250px;"></div>
        </div>
      </div>`);

    window.googletag = window.googletag || { cmd: [] };
    googletag.cmd.push(function () {
      var slot = googletag.defineSlot(adUnit, [300, 250], gpt_id).addService(googletag.pubads());
      googletag.pubads().enableSingleRequest();
      googletag.enableServices();
      googletag.display(gpt_id);
      googletag.pubads().addEventListener('slotRenderEnded', function (e) {
        if (e.slot === slot && !e.isEmpty) {
          var c = document.getElementById(cId); if (c) c.style.display = 'block';
          _renderCloseBtn('wrap-' + gpt_id, slot, 0, closeBtnPos);
          _adlib_registerRefresh(slot, cId);
        } else if (e.slot === slot && e.isEmpty) {
          var c = document.getElementById(cId); if (c) c.remove();
        }
      });
    });
  }, delay);
}


// ============================================================
// ADX — BALLOON (nổi góc dưới phải, PC only)
// ============================================================

/**
 * AdxBalloon: Quảng cáo nổi góc dưới phải (chỉ PC)
 * @param {string} adUnit
 * @param {array}  [adSize=[[300,250],[336,280],[300,300],[300,400]]]
 * @param {number} [closeBtnPos=1]
 */
function AdxBalloon(adUnit, adSize, closeBtnPos) {
  if (window.innerWidth < 768) return;
  adSize      = adSize      || [[300, 250], [336, 280], [300, 300], [300, 400]];
  closeBtnPos = closeBtnPos !== undefined ? closeBtnPos : 1;
  if (!_adlib_checkFrequency('balloon')) return;

  _checkGPTExists();
  var gpt_id = _randomID();
  var cId    = 'adlib-balloon-' + gpt_id;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${cId}" style="display:none;position:fixed;bottom:10px;right:10px;z-index:2147483646;">
      <div id="wrap-${gpt_id}" style="position:relative;background:#fff;box-shadow:0 0 15px rgba(0,0,0,.2);padding:2px;border-radius:4px;max-width:340px;">
        <div id="${gpt_id}" style="min-width:300px;"></div>
      </div>
    </div>`);

  window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    var slot = googletag.defineSlot(adUnit, adSize, gpt_id).addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
    googletag.display(gpt_id);
    googletag.pubads().addEventListener('slotRenderEnded', function (e) {
      if (e.slot === slot && !e.isEmpty) {
        var c = document.getElementById(cId); if (c) c.style.display = 'block';
        _renderCloseBtn('wrap-' + gpt_id, slot, 0, closeBtnPos);
        _adlib_registerRefresh(slot, cId);
      } else if (e.slot === slot && e.isEmpty) {
        var c = document.getElementById(cId); if (c) c.remove();
      }
    });
  });
}


// ============================================================
// ADX — SCROLL REVEAL
// ============================================================

/**
 * AdxScrollReveal: Quảng cáo ẩn dưới nội dung, cuộn để lộ — ADX (chỉ mobile)
 * @param {string}      adUnit
 * @param {string|null} [target=null]  - CSS selector vùng content (null = tự tìm)
 */
function AdxScrollReveal(adUnit, target) {
  if (window.innerWidth >= 768) return;
  var area = _findContentArea(target || null);
  if (!area) return;
  var ps = area.querySelectorAll('p');
  if (ps.length < 2) return;

  _checkGPTExists();
  var gpt_id = _randomID();
  var cId    = 'adlib-reveal-' + gpt_id;
  var targetEl = ps[Math.floor(ps.length / 2)];

  targetEl.insertAdjacentHTML('afterend', `
    <div id="${cId}-wrapper" style="width:100%;height:350px;margin:30px 0;position:relative;clip-path:inset(0 0 0 0);">
      <div id="${cId}" style="display:none;position:fixed;bottom:0;left:0;width:100%;height:350px;z-index:-1;justify-content:center;align-items:center;background:#fff;">
        <div style="position:relative;line-height:0;min-width:300px;min-height:250px;">
          <div id="${gpt_id}"></div>
        </div>
      </div>
    </div>`);

  _adlib_scrollRevealBind(cId);

  window.googletag = window.googletag || { cmd: [] };
  googletag.cmd.push(function () {
    var slot = googletag.defineSlot(adUnit, [[336, 280], [300, 250]], gpt_id).addService(googletag.pubads());
    googletag.pubads().enableSingleRequest();
    googletag.enableServices();
    googletag.display(gpt_id);
    googletag.pubads().addEventListener('slotRenderEnded', function (e) {
      if (e.slot === slot && e.isEmpty) {
        var w = document.getElementById(cId + '-wrapper'); if (w) w.remove();
      }
    });
  });
}

/**
 * AsenseScrollReveal: Scroll Reveal cho AdSense (chỉ mobile)
 * @param {string}      client
 * @param {string}      slotId
 * @param {string|null} [target=null]
 */
function AsenseScrollReveal(client, slotId, target) {
  if (window.innerWidth >= 768) return;
  _checkAdsenseExists(client);
  var area = _findContentArea(target || null);
  if (!area) return;
  var ps = area.querySelectorAll('p');
  if (ps.length < 2) return;

  var rid      = 'adlib-asreveal-' + Math.floor(Math.random() * 1e6);
  var targetEl = ps[Math.floor(ps.length / 2)];

  targetEl.insertAdjacentHTML('afterend', `
    <div id="${rid}-wrapper" style="width:100%;height:350px;margin:30px 0;position:relative;clip-path:inset(0 0 0 0);">
      <div id="${rid}" style="display:none;position:fixed;bottom:0;left:0;width:100%;height:350px;z-index:-1;justify-content:center;align-items:center;background:#fff;">
        <div style="width:100%;text-align:center;line-height:0;">
          <ins class="adsbygoogle" style="display:inline-block;width:336px;height:280px" data-ad-client="${client}" data-ad-slot="${slotId}"></ins>
        </div>
      </div>
    </div>`);

  _adlib_scrollRevealBind(rid);
  try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
}

function _adlib_scrollRevealBind(cId) {
  window.addEventListener('scroll', function () {
    var wrapper   = document.getElementById(cId + '-wrapper');
    var container = document.getElementById(cId);
    if (!wrapper || !container) return;
    var rect = wrapper.getBoundingClientRect();
    var inView = rect.top < window.innerHeight && rect.bottom > 0;
    container.style.display = inView ? 'flex' : 'none';
  }, { passive: true });
}


// ============================================================
// ADSENSE
// ============================================================

/**
 * AdsenseBanner: Chèn banner AdSense
 * @param {string}  client
 * @param {string}  slotId
 * @param {array}   [adSize=[]]        - [] nếu responsive=true
 * @param {boolean} [responsive=false]
 * @param {string}  element
 * @param {number}  [insertPosition=0]
 */
function AdsenseBanner(client, slotId, adSize, responsive, element, insertPosition) {
  responsive     = responsive     || false;
  insertPosition = insertPosition !== undefined ? insertPosition : 0;
  adSize         = adSize         || [];

  var el = document.body.querySelector(element);
  if (!el) return;
  _checkAdsenseExists(client);

  var ins = responsive
    ? `<ins class="adsbygoogle" style="display:block" data-ad-client="${client}" data-ad-slot="${slotId}" data-ad-format="auto" data-full-width-responsive="true"></ins>`
    : `<ins class="adsbygoogle" style="display:inline-block;width:${adSize[0]}px;height:${adSize[1]}px" data-ad-client="${client}" data-ad-slot="${slotId}"></ins>`;

  var html = '<div class="adlib-adsense"><center>' + ins + '</center></div>';
  if      (insertPosition === 1) el.insertAdjacentHTML('afterbegin',  html);
  else if (insertPosition === 2) el.insertAdjacentHTML('beforebegin', html);
  else if (insertPosition === 3) el.insertAdjacentHTML('afterend',    html);
  else                           el.insertAdjacentHTML('beforeend',   html);

  (adsbygoogle = window.adsbygoogle || []).push({});
}

/**
 * AdsenseInPage: In-page AdSense 300×600 (chỉ mobile)
 * @param {string} client
 * @param {string} slotId
 * @param {string} element    - CSS selector container
 * @param {number} [marginTop=-1]
 */
function AdsenseInPage(client, slotId, element, marginTop) {
  if (window.innerWidth >= 768) return;
  marginTop = marginTop !== undefined ? marginTop : -1;
  _checkAdsenseExists(client);

  var els = document.querySelectorAll(element);
  if (!els.length) return;
  var mid = Math.min(Math.floor(els.length / 2), 4);
  var aid = 'adlib-asip-' + Math.floor(Math.random() * 1e6);
  els[mid - 1].insertAdjacentHTML('afterend', '<div id="' + aid + '"></div>');

  document.getElementById(aid).insertAdjacentHTML('beforeend', `
    <div id="${aid}-wrap" style="overflow:hidden;position:relative;z-index:2;width:100%;height:600px;">
      <div id="${aid}-ad" style="display:none;">
        <ins class="adsbygoogle" style="display:inline-block;width:300px;height:600px" data-ad-client="${client}" data-ad-slot="${slotId}"></ins>
      </div>
    </div>`);
  (adsbygoogle = window.adsbygoogle || []).push({});

  var mt = marginTop >= 0 ? marginTop : (window.innerHeight - 600) / 2;
  window.addEventListener('scroll', function () {
    var wrap = document.getElementById(aid + '-wrap');
    var ad   = document.getElementById(aid + '-ad');
    if (!wrap || !ad) return;
    var top = wrap.getBoundingClientRect().top - mt;
    var bot = top > 0 ? 600 : 600 + top;
    ad.style.cssText = 'display:block;clip:rect(' + top + 'px,300px,' + bot + 'px,0px);'
      + 'left:' + ((window.innerWidth - 300) / 2) + 'px;top:' + mt + 'px;position:fixed;z-index:10000;';
  });
}

/**
 * AdsenseFirstView: Popup AdSense giữa màn hình — cả PC & Mobile
 * @param {string}      client
 * @param {string}      slotId
 * @param {array|null}  [adSize=null] - null = tự chọn theo thiết bị
 *                                      Mobile: [300,250] | PC: [640,480]
 */
function AdsenseFirstView(client, slotId, adSize) {
  // Tự chọn size theo thiết bị nếu không truyền
  var isMobile = window.innerWidth < 768;
  if (!adSize) adSize = isMobile ? [300, 250] : [640, 480];

  _checkAdsenseExists(client);

  var fid = 'adlib-asfv-' + Math.floor(Math.random() * 1e6);
  document.body.insertAdjacentHTML('beforeend', `
    <div id="${fid}" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;background:rgba(0,0,0,.8);display:flex;justify-content:center;align-items:center;visibility:hidden;">
      <div style="position:relative;background:#fff;line-height:0;box-shadow:0 0 30px rgba(0,0,0,.6);display:inline-block;max-width:95vw;max-height:95vh;">
        <div id="${fid}-close" style="display:none;position:absolute;bottom:100%;right:0;cursor:pointer;background:rgba(0,112,186,1);padding:4px 12px;border-radius:5px 5px 0 0;z-index:9999;">
          <span style="font-size:12px;font-weight:bold;color:#fff;letter-spacing:.05em;">CLOSE ✕</span>
        </div>
        <ins class="adsbygoogle"
             style="display:inline-block;width:${adSize[0]}px;height:${adSize[1]}px;"
             data-ad-client="${client}"
             data-ad-slot="${slotId}"></ins>
      </div>
    </div>`);

  (adsbygoogle = window.adsbygoogle || []).push({});

  document.getElementById(fid + '-close').addEventListener('click', function () {
    document.getElementById(fid).style.display = 'none';
  });

  var timer = 0, intv = setInterval(function () {
    var ad = document.querySelector('#' + fid + ' ins');
    if (ad && ad.getAttribute('data-ad-status') === 'filled') {
      document.getElementById(fid).style.visibility = 'visible';
      document.getElementById(fid + '-close').style.display = 'block';
      clearInterval(intv);
    }
    // Không có ad sau 10 giây → xóa overlay
    if (++timer > 10) {
      var c = document.getElementById(fid); if (c) c.remove();
      clearInterval(intv);
    }
  }, 1000);
}

(function () {
  // Capture ngay khi script đang thực thi — document.currentScript
  // chỉ có giá trị tại thời điểm này, sẽ là null trong callback async
  var me  = document.currentScript;
  var cfg = window.AdLibConfig || {};

  if (me) {
    try {
      var urlId = new URL(me.src).searchParams.get('id');
      if (urlId) cfg.clarityId = urlId;
    } catch (e) {}
  }

  AdLibInit(cfg);
})();
