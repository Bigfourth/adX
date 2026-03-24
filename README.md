# AdLib v2.0

Thư viện quảng cáo tổng hợp cho Google Ad Manager (GAM/ADX), Google AdSense và Microsoft Clarity.

---

## Nhúng thư viện

Chỉ cần **1 thẻ script**. Clarity ID truyền qua `?id=` trên URL, config còn lại set qua `window.AdLibConfig` trước khi nhúng.

```html
<script>
  window.AdLibConfig = {
    refresh  : { interval: 30, maxTimes: 10, onlyVisible: true, minVisible: 50 },
    frequency: { cap: 3, cooldown: 60 },
  };

  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/Bigfourth/adX@main/main.js?id=YOUR_CLARITY_ID';
  s.onload = function () {
    // Gọi các hàm quảng cáo ở đây
    AdxCatfish('/NETWORK_CODE/catfish');
    AdxFirstView('/NETWORK_CODE/firstview');
  };
  document.head.appendChild(s);
</script>
```

> Nếu không dùng Clarity, bỏ `?id=` khỏi URL. Nếu không cần config refresh/frequency, bỏ luôn `window.AdLibConfig`.

---

## Tham số dùng chung

| Tham số | Giá trị |
|---|---|
| `isDisplay` | `0` = Cả PC & Mobile · `1` = Chỉ PC · `2` = Chỉ Mobile |
| `pageView` | `[0]` = Tất cả · `[1,3,5]` = Chỉ hiện ở lượt xem 1, 3, 5 trong session |
| `closeBtnPos` | `0` = Trái · `1` = Phải · `2` = Giữa |
| `insertPosition` | `0` = beforeend · `1` = afterbegin · `2` = beforebegin · `3` = afterend |

---

## Config (AdLibInit)

| Thuộc tính | Mặc định | Mô tả |
|---|---|---|
| `clarityId` | — | Microsoft Clarity Project ID |
| `lazyLoad` | `true` | GPT lazy load — chỉ fetch khi ad sắp vào viewport |
| `fetchMargin` | `500` | px ngoài viewport thì bắt đầu fetch |
| `renderMargin` | `200` | px ngoài viewport thì bắt đầu render |
| `refresh.interval` | `0` | Refresh mỗi N giây (0 = tắt) |
| `refresh.maxTimes` | `10` | Số lần refresh tối đa |
| `refresh.onlyVisible` | `true` | Chỉ refresh khi ad đang nhìn thấy |
| `refresh.minVisible` | `50` | % diện tích ad phải nhìn thấy mới refresh |
| `frequency.cap` | `0` | Số lần hiển thị tối đa / session (0 = tắt) |
| `frequency.cooldown` | `0` | Giây chờ tối thiểu giữa 2 lần hiển thị (0 = tắt) |

---

## ADX

### AdxSticky
Dải quảng cáo cố định đầu hoặc cuối trang.

```js
AdxSticky(
  '/NETWORK_CODE/sticky',
  0,   // adPosition: 0=bottom | 1=top (chỉ mobile)
  1    // closeBtnPos
);
```

---

### AdxInterstitial
Quảng cáo chiếm toàn màn hình, GAM tự quản lý tần suất.

```js
AdxInterstitial('/NETWORK_CODE/interstitial');
```

---

### AdxRewarded
Quảng cáo có thưởng. Chỉ gọi 1 lần/session mỗi ad unit.

```js
AdxRewarded(
  '/NETWORK_CODE/rewarded',
  0,         // isDisplay
  [1, 3, 6]  // pageView: chỉ hiện ở lượt 1, 3, 6
);
```

---

### AdxCatfish
Banner cố định dưới trang — hiện khi cuộn xuống, ẩn khi cuộn lên.  
Tự động chọn size: PC → `728×90`, Mobile → `320×100`.

```js
AdxCatfish(
  '/NETWORK_CODE/catfish',
  0,    // isDisplay
  [0],  // pageView
  1,    // closeBtnPos
  0     // bottom (px cách đáy trang)
);
```

---

### AdxCatfishAuto
Giống `AdxCatfish` nhưng tự chọn size theo thiết bị, hiện khi cuộn đủ xa (1.5x chiều cao màn hình).

```js
AdxCatfishAuto(
  '/NETWORK_CODE/catfish_auto',
  null,  // adSize: null = tự chọn theo thiết bị
  0,     // isDisplay
  [0],   // pageView
  0      // bottom (px)
);
```

---

### AdxFirstView
Popup giữa màn hình khi vào trang.

```js
AdxFirstView(
  '/NETWORK_CODE/firstview',
  0,       // isDisplay
  [1, 4],  // pageView: chỉ hiện ở lượt 1 và 4
  1        // closeBtnPos
);
```

---

### AdxBanner
Chèn banner quảng cáo vào vị trí chỉ định trong trang.

```js
AdxBanner(
  '/NETWORK_CODE/banner',
  [[728, 90], [300, 250], [320, 100]],  // adSize
  [                                      // size mapping
    { breakpoint: [1024, 0], size: [[728, 90]] },
    { breakpoint: [768, 0],  size: [[300, 250]] },
    { breakpoint: [0, 0],    size: [[320, 100], [300, 250]] },
  ],
  '.entry-content',  // element selector
  2,                 // insertPosition
  true               // setMin: giữ kích thước tối thiểu, chống layout shift
);
```

---

### AdxAutoAds
Tự động chèn nhiều banner vào các phần tử theo khoảng cách màn hình.  
Ad unit được ghép số tự động: `prefix + start`, `prefix + (start+1)`...

```js
AdxAutoAds(
  '/NETWORK_CODE/auto_',  // prefix — ghép số: auto_1, auto_2...
  1,                       // start
  5,                       // end
  [[300, 250], [320, 100]],
  [
    { breakpoint: [1024, 0], size: [[728, 90]] },
    { breakpoint: [0, 0],    size: [[300, 250], [320, 100]] },
  ],
  '.entry-content p',  // elements
  2,                   // insertPosition
  false,               // setMin
  1                    // minScreen: khoảng cách tối thiểu giữa 2 ad (số màn hình)
);
```

---

### AdxInPage
Banner `300×600` cuộn dính theo nội dung. **Chỉ mobile.**

```js
AdxInPage(
  '/NETWORK_CODE/inpage',
  '.entry-content',  // element chứa nội dung
  -1                 // marginTop: -1 = tự tính giữa màn hình
);
```

---

### AdxInImage
Chèn quảng cáo đè lên ảnh trong bài viết.

```js
// 1 ảnh
AdxInImage(
  '/NETWORK_CODE/inimage',
  [[300, 250], [320, 100]],
  [],
  '.entry-content img',
  2,   // imageIndex: ảnh thứ 2 (tính từ 1)
  0    // marginBottom (px)
);

// Nhiều ảnh cùng lúc — ad unit ghép số tự động
AdxInImages(
  '/NETWORK_CODE/inimage_',  // prefix
  1,                          // start
  3,                          // end
  [[300, 250], [320, 100]],
  [],
  '.entry-content img',
  [1, 2, 3],  // imageList: chỉ ảnh 1, 2, 3 ([] = tất cả)
  0
);
```

---

### AdxMultipleSize
Banner `300×600` dính theo nội dung khi cuộn, chiều cao tối thiểu 1 màn hình. **Chỉ mobile.**

```js
// 1 vị trí
AdxMultipleSize(
  '/NETWORK_CODE/multisize',
  '.entry-content',
  2,   // insertPosition
  0    // marginTop (px)
);

// Nhiều vị trí — ad unit ghép số tự động
AdxMultipleSizes(
  '/NETWORK_CODE/multisize_',
  1, 3,
  '.entry-content p',
  2,   // insertPosition
  0,   // marginTop
  1    // minScreen
);
```

---

### AdxWipe
Banner `300×250` nổi góc dưới phải, xuất hiện sau một khoảng thời gian. **Chỉ mobile.**

```js
AdxWipe(
  '/NETWORK_CODE/wipe',
  3000,  // delay (ms)
  1      // closeBtnPos
);
```

---

### AdxBalloon
Banner nổi góc dưới phải. **Chỉ PC.**

```js
AdxBalloon(
  '/NETWORK_CODE/balloon',
  [[300, 250], [336, 280], [300, 300]],  // adSize
  1                                       // closeBtnPos
);
```

---

### AdxScrollReveal
Quảng cáo ẩn dưới nội dung, cuộn đến thì lộ ra. **Chỉ mobile.**

```js
AdxScrollReveal(
  '/NETWORK_CODE/reveal',
  null  // target selector (null = tự tìm vùng content)
);
```

---

## AdSense

### AdsenseBanner

```js
// Fixed size
AdsenseBanner(
  'ca-pub-XXXXXXXXXXXXXXXX',
  '1234567890',
  [300, 250],  // adSize
  false,       // responsive
  '.entry-content',
  2
);

// Responsive
AdsenseBanner(
  'ca-pub-XXXXXXXXXXXXXXXX',
  '1234567890',
  [],
  true,        // responsive = true, bỏ qua adSize
  '.sidebar',
  0
);
```

---

### AdsenseInPage
**Chỉ mobile.**

```js
AdsenseInPage(
  'ca-pub-XXXXXXXXXXXXXXXX',
  '1234567890',
  '.entry-content p',
  -1  // marginTop
);
```

---

### AdsenseFirstView
Popup AdSense giữa màn hình. **Chỉ mobile.**

```js
AdsenseFirstView(
  'ca-pub-XXXXXXXXXXXXXXXX',
  '1234567890',
  [300, 600]  // adSize
);
```

---

### AsenseScrollReveal
**Chỉ mobile.**

```js
AsenseScrollReveal(
  'ca-pub-XXXXXXXXXXXXXXXX',
  '1234567890',
  null  // target selector (null = tự tìm)
);
```

---

## Ví dụ hoàn chỉnh cho 1 site

```html
<script>
  window.AdLibConfig = {
    refresh  : { interval: 30, maxTimes: 10, onlyVisible: true, minVisible: 50 },
    frequency: { cap: 3, cooldown: 60 },
  };

  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/Bigfourth/adX@main/main.js?id=abc123xyz';
  s.onload = function () {
    AdxSticky('/22796784223/example.com/sticky');
    AdxCatfish('/22796784223/example.com/catfish', 0, [0], 1, 0);
    AdxFirstView('/22796784223/example.com/firstview', 0, [1, 3], 1);
    AdxBanner(
      '/22796784223/example.com/banner_top',
      [[728, 90], [300, 250], [320, 100]],
      [
        { breakpoint: [1024, 0], size: [[728, 90]] },
        { breakpoint: [0, 0],    size: [[320, 100], [300, 250]] },
      ],
      '.entry-content', 2, true
    );
    AdxAutoAds('/22796784223/example.com/auto_', 1, 5,
      [[300, 250], [320, 100]],
      [
        { breakpoint: [1024, 0], size: [[728, 90]] },
        { breakpoint: [0, 0],    size: [[300, 250], [320, 100]] },
      ],
      '.entry-content p', 2, false, 1
    );
    AdxWipe('/22796784223/example.com/wipe', 3000, 1);
    AdxBalloon('/22796784223/example.com/balloon', [[300, 250], [336, 280]], 1);
  };
  document.head.appendChild(s);
</script>
```

### Ad Carousel

```
<script src="https://cdn.jsdelivr.net/gh/Bigfourth/adX@main/xad-carousel.js"></script>
<script>XadCarousel("/1234/my-ad", 4, 300, 5, "auto")</script>

_ Adunit
_ số lượng slide
_ Chiều cao slide
_ Thời gian chờ
_ Chế độ load ( "auto" / "manual" / "both" )
```
