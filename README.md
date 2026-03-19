/**
 * ============================================================
 *  AdLib - Thư viện quảng cáo tổng hợp v2.0
 * ============================================================
 *  Tổng hợp từ: BFA Ad Library + Xad Ad Library
 *  Tích hợp: Google Ad Manager (GAM/ADX) + Google AdSense + Microsoft Clarity
 *
 *  KHỞI TẠO:
 *    AdLibInit({
 *      clarityId   : 'YOUR_CLARITY_ID',  // Microsoft Clarity (bỏ qua nếu không dùng)
 *      lazyLoad    : true,               // Lazy load (mặc định: true)
 *      fetchMargin : 500,                // px ngoài viewport mới fetch (mặc định: 500)
 *      renderMargin: 200,                // px ngoài viewport mới render (mặc định: 200)
 *      refresh     : {
 *        interval  : 30,                 // Refresh mỗi N giây (mặc định: 0 = tắt)
 *        maxTimes  : 10,                 // Tối đa bao nhiêu lần refresh (mặc định: 10)
 *        onlyVisible: true,              // Chỉ refresh khi ad đang nhìn thấy (mặc định: true)
 *        minVisible : 50,                // % diện tích ad phải nhìn thấy (mặc định: 50)
 *      },
 *      frequency   : {
 *        cap       : 0,                  // Max lần hiển thị/session (0 = tắt)
 *        cooldown  : 0,                  // Giây chờ trước khi hiển thị lại (0 = tắt)
 *      }
 *    });
 *
 *  DANH SÁCH HÀM:
 *  ─── ADX ────────────────────────────────────────────────────
 *  AdxSticky(adUnit, adPosition, closeBtnPos)
 *  AdxInterstitial(adUnit)
 *  AdxRewarded(adUnit, isDisplay, pageView)
 *  AdxCatfish(adUnit, isDisplay, pageView, closeBtnPos, bottom)
 *  AdxCatfishAuto(adUnit, adSize, isDisplay, pageView, bottom)
 *  AdxFirstView(adUnit, isDisplay, pageView, closeBtnPos)
 *  AdxBanner(adUnit, adSize, mapping, element, insertPosition, setMin)
 *  AdxAutoAds(adUnit, start, end, adSize, mapping, elements, insertPosition, setMin, minScreen)
 *  AdxInPage(adUnit, element, marginTop)
 *  AdxInImage(adUnit, adSize, mapping, element, imageIndex, marginBottom)
 *  AdxInImages(adUnit, start, end, adSize, mapping, element, imageList, marginBottom)
 *  AdxMultipleSize(adUnit, element, insertPosition, marginTop)
 *  AdxMultipleSizes(adUnit, start, end, elements, insertPosition, marginTop, minScreen)
 *  AdxWipe(adUnit, delay, closeBtnPos)
 *  AdxBalloon(adUnit, adSize, closeBtnPos)
 *  AdxScrollReveal(adUnit, target)
 *  ─── ADSENSE ────────────────────────────────────────────────
 *  AdsenseBanner(client, slotId, adSize, responsive, element, insertPosition)
 *  AdsenseInPage(client, slotId, element, marginTop)
 *  AdsenseFirstView(client, slotId, adSize)
 *  AsenseScrollReveal(client, slotId, target)
 *  ─── PARAMS ─────────────────────────────────────────────────
 *  isDisplay     : 0=Cả hai | 1=Chỉ PC | 2=Chỉ Mobile
 *  pageView      : [0]=Tất cả | [1,3,5]=Chỉ lượt xem 1,3,5 trong session
 *  closeBtnPos   : 0=Trái | 1=Phải | 2=Giữa
 *  insertPosition: 0=beforeend | 1=afterbegin | 2=beforebegin | 3=afterend
 * ============================================================
 */
