# ĐẶC TẢ KỸ THUẬT: MÀN HÌNH BÁN HÀNG & THANH TOÁN (POS SCREEN & CHECKOUT)
**Mã tài liệu:** `SPEC_POS_SCREEN.md`  
**Vai trò:** Principal Mobile Software Architect & Flutter Technical Lead  
**Nền tảng mục tiêu:** Flutter (iOS/iPadOS, Android POS Terminals, Desktop/Web POS)  
**Hệ quản trị CSDL:** Supabase (PostgreSQL + PostgREST + Realtime)  
**Phiên bản chuẩn:** v2.4 (Ultra-Detailed Construction Spec / Single Source of Truth)

---

## 1. TỔNG QUAN NGHIỆP VỤ & BỐ CỤC CHUNG (LAYOUT ARCHITECTURE)

### 1.1. Mục tiêu thiết bị & Triết lý thiết kế (Design Philosophy)
Màn hình Bán hàng (POS Screen) là trung tâm vận hành cốt lõi của ứng dụng MeiiShop POS. Mọi tương tác chạm, quét mã vạch và thanh toán phải đạt tốc độ dưới 100ms, không độ trễ, tối ưu hóa triệt để cho thao tác 1 chạm trên màn hình cảm ứng:
- **Tablet / iPad màn hình ngang (Landscape - Width >= 768px):** Bố cục 2 cột cố định (Split View), nhân viên thu ngân nhìn thấy đồng thời cả danh mục sản phẩm và giỏ hàng mà không cần chuyển màn hình.
- **Điện thoại di động (Portrait - Width < 768px):** Bố cục 1 cột ưu tiên catalog sản phẩm với thanh trạng thái giỏ hàng ghim nổi ở chân trang (Sticky Floating Bottom Cart Bar).

---

### 1.2. Phân bổ không gian màn hình Tablet (Landscape Split View)
```
┌─────────────────────────────────────────────────────────────┬──────────────────────────────────────┐
│  CỘT TRÁI: DANH MỤC SẢN PHẨM (PRODUCT CATALOG - 60% ~ 65%)   │ CỘT PHẢI: GIỎ HÀNG (CART - 35% ~ 40%)│
├─────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
│ [Search Bar] [Camera Scan Button] [Quick Category Chips]    │ [Customer Profile: ລູກຄ້າທົ່ວໄປ] [⚙️]  │
├─────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
│                                                             │ [Cart Item 1]                        │
│                     PRODUCT GRID                            │   - Tên + Đơn vị (ແກັດ)             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │   - [-] [ Qty: 8 ] [+] [Trash]       │
│  │ Thẻ món 1     │ │ Thẻ món 2     │ │ Thẻ món 3     │      │   - Line Total: 2.400.000 ₭          │
│  │ Ảnh + Tồn kho │ │ Ảnh + Tồn kho │ │ Ảnh + Tồn kho │      ├──────────────────────────────────────┤
│  │ [Carton ₭]    │ │ [Carton ₭]    │ │ [Carton ₭]    │      │ [Cart Item 2]                        │
│  │ [Pack ₭]      │ │ [Pack ₭]      │ │ (Piece OFF)   │      │   ...                                │
│  │ [Piece ₭]     │ │ (Piece OFF)   │ │ (Pack OFF)    │      │                                      │
│  └───────────────┘ └───────────────┘ └───────────────┘      ├──────────────────────────────────────┤
│                                                             │ Summary: ລວມ N ລາຍການ                │
│                                                             │ TOTAL DUE: 2.640.000 ₭               │
│                                                             │ [Clear Cart]  [CHECKOUT (ຊຳລະເງິນ)]   │
└─────────────────────────────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. KHU VỰC CHỌN SẢN PHẨM (BÊN TRÁI - PRODUCT CATALOG AREA)

### 2.1. Thanh công cụ phía trên (Header & Quick Actions)
1. **Ô tìm kiếm tức thì (Real-time Search Bar):**
   - **Placeholder:** `ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ສະແກນບາໂຄດ... (Tìm kiếm sản phẩm hoặc quét mã...)`
   - **Cơ chế tìm kiếm đa năng (Multi-Match Search Filter):**
     * Tìm kiếm không dấu / có dấu tiếng Lào & tiếng Việt theo `product.name`.
     * Tìm kiếm theo mã vạch chung của sản phẩm `product.barcode`.
     * Tìm kiếm theo mã vạch của **từng cấp đơn vị** `product_units.barcode` (tìm ra sản phẩm ngay cả khi khách quét mã thùng hoặc mã lốc).
     * Nút xóa nhanh text (Clear `✕`) khi có nội dung.
2. **Nút quét mã vạch Camera (Camera Scanner Button):**
   - Nút icon `BarcodeScanner` kích thước `44x44px` nổi bật.
   - Nhấn mở camera toàn màn hình hoặc khung quét overlay hỗ trợ tự động nhận diện mã vạch liên tục (Continuous Scanning Mode).
3. **Dải nút Danh mục cuộn ngang (Category Filter Tabs - 100% Dynamic API Fetching):**
   - **Quy tắc bất di bất dịch (Zero Hardcoded Categories Rule):** Tuyệt đối **KHÔNG** gắn mảng danh mục cố định (hardcode) trong mã nguồn Flutter.
   - **Cơ chế nạp động từ Supabase:**
     * Nạp trực tiếp từ bảng `categories` (sắp xếp theo `sort_order ASC, name ASC`).
     * Nếu bảng `categories` chưa có dữ liệu, tự động trích xuất các danh mục phân biệt (distinct categories) từ bảng `products`.
     * Luôn đặt tab đầu tiên là `ທັງໝົດ (Tất cả)` (mặc định được chọn).
     * Nút `[+ ເພີ່ມໝວດໝູ່]` ở cuối danh sách cho phép thu ngân thêm danh mục mới và lập tức lưu vào bảng `categories` trên Supabase.
   - **Tương tác:** Nhấn tab nào -> Lọc danh sách sản phẩm tức thì trong `productsState` mà không phải gọi lại network API.

---

### 2.2. Lưới thẻ sản phẩm (Product Grid Item Specifications)
- **Cấu hình Grid:**
  * Tablet: `crossAxisCount: 3` hoặc `4` (tùy kích thước màn hình).
  * Tỉ lệ thẻ `childAspectRatio: 0.72 - 0.78` (đảm bảo đủ không gian cho ảnh, tồn kho và các nút đơn vị).
- **Mỗi thẻ sản phẩm (Product Card) gồm 4 tầng thông tin:**

#### Tầng 1: Hình ảnh sản phẩm (Product Image)
- Tỉ lệ khung hình `1:1`, bo góc trên `rounded-t-2xl`.
- Sử dụng `CachedNetworkImage` kèm placeholder shimmer loading và ảnh fallback dự phòng.
- Badge danh mục nhỏ mờ ở góc dưới ảnh (VD: `ເຄື່ອງດື່ມ`).

#### Tầng 2: Tên sản phẩm (Product Name)
- Font: `font-bold`, kích thước `12.5px - 13.5px`, màu `slate-900`.
- Giới hạn tối đa `2 dòng`, có `TextOverflow.ellipsis`.

#### Tầng 3: Trạng thái tồn kho thông minh (Smart Stock Status Line)
- **Trường hợp A: Sản phẩm không theo dõi kho (`product.track_stock == false`):**
  * Hiển thị chữ màu xám: `ສະຕັອກ: ບໍ່ນັບສາງ (Không đếm kho)`.
  * Cho phép bấm bán vô hạn mà không bị chặn out-of-stock.
- **Trường hợp B: Sản phẩm có theo dõi kho (`product.track_stock == true`):**
  * **Còn hàng:** Phân rã số lượng cơ sở (`current_stock_base_units`) thành chuỗi quy đổi chuẩn qua hàm `formatCompoundStock`:
    - Ví dụ: `ສະຕັອກ: 8 ແກັດ 4 ແພັກ` hoặc `ສະຕັອກ: 24 ແພັກ`.
    - Màu sắc: `text-teal-700 font-extrabold`.
  * **Hết hàng (`current_stock_base_units <= 0`):**
    - Hiển thị nhãn đỏ cảnh báo: `ສະຕັອກ: ໝົດສະຕັອກ (0)`.
    - Thẻ sản phẩm phủ mờ `opacity: 0.65`.
    - Khi bấm vào các nút bán hàng: Bật Alert thông báo hết hàng và chặn không cho thêm vào giỏ.

#### Tầng 4: Các nút chọn Đơn vị bán (Tier Unit Action Buttons)
Dựa vào các đơn vị đang BẬT (`product_units`):
```dart
// Render động danh sách các nút đơn vị đang active
Column(
  children: activeUnits.map((unit) {
    return Container(
      margin: EdgeInsets.only(top: 4),
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: unit.isCarton ? Colors.teal[50] : Colors.slate[100],
          foregroundColor: unit.isCarton ? Colors.teal[900] : Colors.slate[800],
          padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        onPressed: () => handleAddToCart(product, unit),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('${unit.unitName}', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
            Text('${formatKip(unit.retailPrice)}', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11)),
          ],
        ),
      ),
    );
  }).toList(),
)
```
- **Hành vi người dùng:** Nhân viên chỉ cần nhấn **1 chạm trực tiếp** vào nút `ແກັດ 300.000 ₭` là Thùng được thêm ngay vào giỏ hàng với đúng giá sỉ; hoặc nhấn `ແພັກ 40.000 ₭` để bán Lốc.

---

## 3. LOGIC QUÉT MÃ VẠCH ĐA CẤP (TIERED BARCODE SCANNING ALGORITHM)

Hệ thống hỗ trợ cả **Máy quét Laser USB / Bluetooth (Hardware Scanner HID Keyboard Event)** và **Camera Scanner tích hợp**.

### 3.1. Thuật toán nhận diện mã vạch đa cấp:
```dart
void handleBarcodeScanned(String rawBarcode) {
  final cleanBarcode = rawBarcode.trim().toLowerCase();
  if (cleanBarcode.isEmpty) return;

  // 1. Quét tìm kiếm chính xác trong bảng product_units
  ProductUnit? matchedUnit;
  Product? matchedProduct;

  for (final prod in allProducts) {
    for (final unit in prod.units) {
      if (unit.barcode != null && unit.barcode!.trim().toLowerCase() == cleanBarcode) {
        matchedUnit = unit;
        matchedProduct = prod;
        break;
      }
    }
    if (matchedProduct != null) break;
  }

  // 2. Nếu không khớp bảng product_units, tìm theo barcode chung của product
  if (matchedProduct == null) {
    matchedProduct = allProducts.firstWhereOrNull(
      (p) => p.barcode != null && p.barcode!.trim().toLowerCase() == cleanBarcode,
    );
    if (matchedProduct != null && matchedProduct.units.isNotEmpty) {
      // Ưu tiên đơn vị cơ sở (base unit), nếu không có lấy đơn vị đầu tiên
      matchedUnit = matchedProduct.units.firstWhereOrNull((u) => u.isBaseUnit) ?? matchedProduct.units.first;
    }
  }

  // 3. Xử lý kết quả quét
  if (matchedProduct != null && matchedUnit != null) {
    // Kiểm tra tồn kho trước khi thêm
    if (canAddToCart(matchedProduct, matchedUnit, 1)) {
      addItemToCart(matchedProduct, matchedUnit, quantity: 1);
      playBeepSound();      // Âm thanh Bíp thành công
      triggerHapticFeedback(); // Rung phản hồi
      showMiniToast('ເພີ່ມ: ${matchedProduct.name} (${matchedUnit.unitName})');
    } else {
      playErrorSound();
      showOutOfStockDialog(matchedProduct);
    }
  } else {
    playErrorSound();
    showBarcodeNotFoundDialog(cleanBarcode);
  }
}
```

### 3.2. Bảng ánh xạ kết quả quét thực tế:
| Chuỗi Barcode quét được | Vị trí khớp trong CSDL | Hành vi tự động của giỏ hàng |
| :--- | :--- | :--- |
| `885012300001` (In trên Thùng) | `product_units(tier=3).barcode` | Thêm **1 Thùng (`ແກັດ`)** giá Thùng vào giỏ. |
| `885012300002` (In trên Lốc) | `product_units(tier=2).barcode` | Thêm **1 Lốc (`ແພັກ`)** giá Lốc vào giỏ. |
| `885012300003` (In trên Lon/Gói) | `product_units(tier=1).barcode` | Thêm **1 Cái (`ອັນ/ກະປ໋ອງ`)** giá Lẻ vào giỏ. |
| `885099999999` (Mã chung) | `products.barcode` | Thêm theo đơn vị cơ sở (`is_base_unit = true`). |

---

## 4. KHU VỰC GIỎ HÀNG (BÊN PHẢI - CART / ORDER TICKET)

### 4.1. Thông tin khách hàng (Customer Selection Header)
- Mặc định: `ລູກຄ້າທົ່ວໄປ (Khách vãng lai)`.
- Quick Customer Chips:
  * Nút chip chọn nhanh `ທົ່ວໄປ` (Khách lẻ thông thường).
  * Nút chip chọn nhanh `VIP` (Khách quen / VIP).
- Nút bấm icon người dùng mở danh sách chọn khách hàng từ danh bạ Supabase (`customers`) để tìm kiếm theo tên hoặc số điện thoại.
- **Quy tắc công nợ:** Nếu khách hàng chọn thanh toán bằng hình thức **Ghi nợ (Debt)**, hệ thống **bắt buộc** phải chọn một khách hàng cụ thể (không được để `Khách vãng lai`).

---

### 4.2. Danh sách các dòng món trong giỏ hàng (Cart Items List)
Mỗi dòng trong giỏ hàng (`CartLineItemTile` / `CartItemWidget`) biểu diễn một cặp `(Product, ProductUnit)`:
- **Ảnh đại diện sản phẩm:** Thumbnail nhỏ $36 \times 36$ góc bo tròn (hoặc icon hộp hàng nếu không có ảnh).
- **Tên món & Chuyển đổi đơn vị trực tiếp trong giỏ (In-Cart Unit Switcher):**
  * Tên món: In đậm, hiển thị rõ tên sản phẩm.
  * Hàng nút chuyển đổi đơn vị (`u.unitName` chips) hiển thị tất cả đơn vị quy đổi đang hoạt động của sản phẩm (`ແກັດ`, `ແພັກ`, `ອັນ`). Thu ngân có thể chạm trực tiếp để đổi đơn vị ngay trong giỏ hàng mà không cần phải xóa đi thêm lại.
- **Đơn giá & Sửa giá đặc biệt (Price Override with Reason):**
  * Đơn giá: Hiển thị dạng phân cách chấm: `300.000 ₭`.
  * Cho phép thu ngân chạm vào nhãn giá `@ [giá]` để kích hoạt hộp thoại sửa giá nhanh (Price Override). Khi giá bị sửa khác giá niêm yết, hiển thị badge màu vàng cam `ພິເສດ` kèm lý do giảm giá.
- **Bộ điều khiển số lượng thông minh (Direct Input Quantity Controller):**
  * Nút giảm `[-]`: Giảm 1 đơn vị (nếu về 0 thì hỏi xác nhận xóa hoặc xóa khỏi giỏ).
  * **Ô số lượng bấm vào mở Bàn phím số (Numpad Dialog):**
    * Khi bán số lượng lớn (VD: khách sỉ mua 50 thùng), thu ngân chỉ cần chạm trực tiếp vào số `1` trên màn hình.
    * Bàn phím số Numpad cảm ứng xuất hiện ngay lập tức -> Gõ `50` -> Nhấn `ຕົກລົງ (Xác nhận)`.
    * Không bắt thu ngân phải bấm nút `[+]` 50 lần.
  * Nút tăng `[+]`: Tăng 1 đơn vị (tự động chặn nếu vượt tồn kho thực tế của hàng đếm kho).
- **Tính năng Cọc vỏ két / Thùng (Crate Deposit / ບໍ່ມີແກັດປ່ຽນ):**
  * **Điều kiện áp dụng (`isCrateEligible`):** Sản phẩm có cờ `hasCrateDeposit == true` HOẶC tên / nhóm sản phẩm chứa từ khóa `ເບຍ (Bia)` và đơn vị bán là Thùng (`ແກັດ`, `ລັງ`) hoặc hệ số quy đổi $\ge 12$.
  * **Giao diện dòng Cọc vỏ két (Amber Banner):**
    - Khung viền màu vàng hổ phách (`bg-amber-50 border-amber-200 / #FFFBEB`).
    - Hộp kiểm Checkbox: `ບໍ່ມີແກັດປ່ຽນ / ບໍ່ມີລັງປ່ຽນ (+30.000 ₭/ແກັດ)`.
    - Bộ đếm số lượng két nợ `[-] {missingCratesCount} [+]` (cho phép khách trả một phần két, ví dụ mua 5 két bia nhưng chỉ nợ 2 két rỗng). Mặc định bằng số lượng thùng mua.
    - Tiền cọc hiển thị tức thì: `+60.000 ₭`.
- **Thành tiền dòng (Line Total):**
  $$\text{Line Goods Total} = \text{Unit Retail Price} \times \text{Quantity}$$
  $$\text{Crate Fee Total} = \begin{cases} \text{Missing Crates Count} \times 30.000 ₭, & \text{nếu bật cọc vỏ} \\ 0, & \text{ngược lại} \end{cases}$$
  $$\text{Line Total} = \text{Line Goods Total} + \text{Crate Fee Total}$$
- **Nút xóa dòng:** Icon thùng rác màu đỏ xám để xóa nhanh món khỏi giỏ.

---

### 4.3. Ràng buộc kiểm soát tồn kho trong giỏ hàng (Cart Stock Validation Engine)
Mỗi khi số lượng trong giỏ hàng thay đổi:
1. Tính tổng số lượng đơn vị cơ sở (`total_base_units_in_cart`) của sản phẩm đó trong giỏ:
   $$\text{total\_base\_units\_in\_cart} = \sum_{\text{các dòng của SP}} (\text{item.quantity} \times \text{item.unit.multiplier})$$
2. **Nếu `product.track_stock == true`:**
   * So sánh: Nếu $\text{total\_base\_units\_in\_cart} > \text{product.current\_stock\_base\_units}$:
   * Chặn không cho tăng số lượng, hiển thị thông báo:  
     `⚠️ ສິນຄ້າໃນສາງບໍ່ພໍ! ຍັງເຫຼືອພຽງ {formatCompoundStock(product)}`
3. **Nếu `product.track_stock == false`:**
   * Bỏ qua việc so sánh tồn kho, cho phép bán số lượng không giới hạn.

---

### 4.4. Bảng tóm tắt thanh toán (Summary & Action Buttons)
- Dòng tóm tắt: `ລວມທັງໝົດ: {totalItemsCount} ລາຍການ ({totalQuantity} ຊິ້ນ)`.
- **Phân bổ tiền hàng và tiền cọc két (Subtotal vs Crate Deposit Math Rule):**
  * Khi giỏ hàng có phát sinh tiền cọc vỏ két (`totalCrateDeposit > 0`):
    - `ລວມເງິນສິນຄ້າ (Subtotal)` = Tiền hàng thuần túy chưa tính cọc vỏ (Ví dụ: `780.000 ₭`).
    - `ຄ່າມັດຈຳແກັດ (Crate Deposit)` = Tiền phụ thu cọc vỏ két rỗng (Ví dụ: `+60.000 ₭`).
    - `ຍອດຊຳລະສຸດທິ (Total Due)` = Tổng tiền khách phải thanh toán (Ví dụ: `840.000 ₭`).
    - **Quy tắc bất biến:** $\text{Pure Goods Subtotal} + \text{Total Crate Deposit} = \text{Grand Total}$. Tuyệt đối không được gộp cọc vào Subtotal rồi lại cộng thêm lần nữa gây trùng lặp số liệu.
- **Tổng tiền cần thanh toán (Total Due):**
  * Hiển thị cỡ chữ lớn `24px - 28px`, màu `teal-800`, in đậm `font-black`.
  * Định dạng: `840.000 ₭`.
- **2 Nút hành động chính:**
  1. **Nút "Hủy đơn / Làm mới (Clear Cart)":**
     - Icon thùng rác, nền màu xám nhạt `bg-slate-100`.
     - Nhấn vào hiển thị hộp thoại xác nhận `ConfirmDialogModal`:  
       `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບລາຍການສິນຄ້າທັງໝົດໃນກະຕ່າ?`  
       Xác nhận thì xóa sạch giỏ hàng.
  2. **Nút "Thanh toán (ຊຳລະເງິນ / Checkout)":**
     - Nền gradient xanh Mint / Teal đậm `bg-teal-600 hover:bg-teal-700`, chữ trắng, in đậm.
     - Vô hiệu hóa (disabled) khi giỏ hàng rỗng (`cart.isEmpty`).
     - Nhấn mở `CheckoutModal`.

---

## 5. MODAL THANH TOÁN (CHECKOUT MODAL SPECIFICATION)

Khi bấm nút "Thanh toán", mở `CheckoutModal` dạng Dialog toàn màn hình hoặc popup lớn (Max-width: 650px).

### 5.1. Ba Phương thức thanh toán chuẩn (1:1 với Financial Dashboard)

#### 1. TIỀN MẶT (ເງິນສົດ / CASH)
- **Giao diện:**
  * Ô nhập số tiền khách đưa (`amount_tendered`).
  * Các nút bấm chọn nhanh mệnh giá tiền Kíp thường gặp:
    * `[ 50.000 ₭ ]`
    * `[ 100.000 ₭ ]`
    * `[ 200.000 ₭ ]`
    * `[ 500.000 ₭ ]`
    * `[ ພໍດີ (Đưa đủ: Total Due) ]`
- **Tính toán tiền thối lại (Change Due Calculation):**
  * Công thức: $\text{Tiền thừa} = \max(0, \text{amount\_tendered} - \text{grand\_total})$.
  * Hiển thị dòng chữ to màu xanh: `ເງິນທອນ (Tiền thừa): {formatKip(changeDue)}`.
  * Nếu khách đưa thiếu: Báo đỏ `ຍັງຂາດ: {formatKip(grand_total - amount_tendered)}` và khóa nút xác nhận thanh toán.

#### 2. CHUYỂN KHOẢN (ໂອນເງິນ / TRANSFER & ONEPAY QR)
- **Giao diện:**
  * Tích hợp thống nhất giữa chuyển khoản ngân hàng và mã BCEL OnePay QR.
  * Hiển thị mã QR động chứa số tài khoản + số tiền chính xác của hóa đơn để khách quét bằng ứng dụng ngân hàng.
  * Số tiền thanh toán mặc định nhận đủ `100%`: $\text{amount\_tendered} = \text{grand\_total}$, $\text{changeDue} = 0$.
  * Nút "ຢືນຢັນໄດ້ຮັບເງິນໂອນແລ້ວ (Xác nhận đã nhận được tiền)".

#### 3. BÁN NỢ / GHI NỢ (ຄ້າງຊຳລະ / DEBT - CREDIT SALE)
- **Ràng buộc tiên quyết:**
  * Kiểm tra khách hàng: Nếu đang là `ລູກຄ້າທົ່ວໄປ (Khách vãng lai)` -> Bắt buộc mở modal chọn hoặc tạo mới Khách hàng có Tên và Số điện thoại.
- **Cấu hình thanh toán nợ linh hoạt:**
  * **Tùy chọn A - Nợ 100%:** `paid_amount = 0`, `debt_amount = grand_total`.
  * **Tùy chọn B - Trả trước 50%:** `paid_amount = grand_total * 0.5`, `debt_amount = grand_total * 0.5`.
  * **Tùy chọn C - Trả trước tùy ý:** Cho phép nhập ô số tiền khách trả trước.
- **Hiển thị số tiền còn nợ lại:**
  * Dòng cảnh báo màu đỏ/cam nổi bật: `ຍອດຄ້າງຊຳລະ (DEBT BALANCE): {formatKip(debt_amount)}`.
- **Ô nhập ghi chú nợ & Hạn thanh toán:**
  * Ô nhập text: `ໝາຍເຫດຄ້າງຊຳລະ (Ghi chú: hẹn cuối tuần, nợ tiền bia,...)`.

---

### 5.2. Nút Hoàn tất thanh toán & In hóa đơn (Confirm & Silent Printing)
- Nút bấm lớn dưới chân modal: `ຢືນຢັນການຂາຍ & ພິມໃບບິນ (Xác nhận & In bill)`.
- **Tiến trình xử lý khi nhấn (Execution Flow):**
  1. Hiển thị loading overlay: `ກຳລັງບັນທຶກລົງຖານຂໍ້ມູນ Supabase...`
  2. Tạo bản ghi đơn hàng trong bảng `orders` (hoặc `sale_transactions`) và chi tiết món trong `order_items` (hoặc `sale_transaction_items`).
  3. Trừ kho các mặt hàng có `track_stock == true`.
  4. Gửi lệnh in hóa đơn nhiệt tự động (Silent Print) qua Bluetooth/LAN hoặc mở Modal xem lại hóa đơn (`ReceiptModal`).
  5. Xóa sạch giỏ hàng hiện tại, phát hiệu ứng chúc mừng (confetti / success sound) và sẵn sàng đón khách tiếp theo.

---

## 6. THUẬT TOÁN TRỪ KHO CƠ SỞ CHÍNH XÁC KHI CHECKOUT (STOCK DEDUCTION ALGORITHM)

Để bảo đảm tính toàn vẹn 100% của kho hàng khi bán các đơn vị quy đổi khác nhau (Thùng, Lốc, Lẻ):

### 6.1. Nguyên tắc trừ kho theo đơn vị cơ sở (Base Unit Deduction Rule)
Mọi phép trừ kho trong cơ sở dữ liệu Supabase **chỉ thực hiện trên một cột duy nhất**: `current_stock_base_units`.

### 6.2. Thuật toán trừ kho (Dart / Flutter Code):
```dart
Future<bool> processStockDeduction(List<CartItem> cartItems) async {
  // Gom nhóm các món trong giỏ theo product_id để tránh trừ trùng lặp
  final Map<String, int> productDeductions = {};

  for (final item in cartItems) {
    final product = item.product;

    // 1. Nếu sản phẩm KHÔNG theo dõi kho -> Bỏ qua, không trừ
    if (!product.trackStock) {
      continue;
    }

    // 2. Tính số lượng đơn vị cơ sở của dòng này
    final int multiplier = item.unit.multiplier > 0 ? item.unit.multiplier : 1;
    final int baseUnitsForLine = item.quantity * multiplier;

    productDeductions[product.id] = (productDeductions[product.id] ?? 0) + baseUnitsForLine;
  }

  // 3. Thực hiện cập nhật vào Supabase
  for (final entry in productDeductions.entries) {
    final productId = entry.key;
    final unitsToDeduct = entry.value;

    final targetProd = allProducts.firstWhere((p) => p.id === productId);
    final int currentStock = targetProd.currentStockBaseUnits;
    final int newStock = currentStock - unitsToDeduct;

    final response = await supabase
        .from('products')
        .update({
          'current_stock_base_units': newStock,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', productId);

    // Cập nhật state cục bộ để giao diện phản hồi tức thì
    targetProd.currentStockBaseUnits = newStock;
  }

  return true;
}
```

### 6.3. Bảng ví dụ thực tế tính toán trừ kho:
| Sản phẩm | Trạng thái kho | Giỏ hàng mua | Phép tính quy đổi đơn vị cơ sở | Tồn kho mới |
| :--- | :--- | :--- | :--- | :--- |
| **Nước ngọt Oishi** | Tồn: 64 ແພັກ (Base: ແພັກ) | Mua 2 Thùng (hệ số 8) | $2 \times 8 = 16\text{ ແພັກ}$ | $64 - 16 = \mathbf{48\text{ ແພັກ}}$ |
| **Bia Tiger Lon** | Tồn: 100 ອັນ (Base: ອັນ) | Mua 1 Lốc (hệ số 6) + 2 Lon lẻ (hệ số 1) | $(1 \times 6) + (2 \times 1) = 8\text{ ອັນ}$ | $100 - 8 = \mathbf{92\text{ ອັນ}}$ |
| **Đá lạnh / Dịch vụ** | `track_stock = false` (`ບໍ່ນັບສາງ`) | Mua 50 bao | Không trừ kho | Không đổi |

---

## 7. MÔ HÌNH DỮ LIỆU & PAYLOAD SUPABASE KHI LƯU ĐƠN (ORDER PAYLOAD DTO)

### 7.1. Cấu trúc JSON gửi lên bảng `orders` (hoặc `sale_transactions`):
```json
{
  "id": "c0a80124-7e2b-42b1-9f93-111122223333",
  "receipt_number": "INV-20261016-0042",
  "created_at": "2026-10-16T00:50:00Z",
  "cashier_name": "ໄມ້ຄຳ (Meii)",
  "customer_id": "cust_uuid_9999",
  "customer_name": "ທ້າວ ສົມສັກ (Khách sỉ)",
  "payment_method": "debt",
  "is_wholesale": false,
  "subtotal": 2640000,
  "discount_total": 0,
  "grand_total": 2640000,
  "amount_tendered": 1000000,
  "change_amount": 0,
  "paid_amount": 1000000,
  "debt_amount": 1640000,
  "debt_status": "partial",
  "debt_note": "Trả trước 1.000.000 Kíp, hẹn thứ 7 trả nốt",
  "total_cost": 2100000,
  "gross_profit": 540000,
  "status": "completed"
}
```

### 7.2. Cấu trúc JSON gửi lên bảng `order_items` (hoặc `sale_transaction_items`):
```json
[
  {
    "id": "item_uuid_0001",
    "order_id": "c0a80124-7e2b-42b1-9f93-111122223333",
    "product_id": "prod_uuid_redbull",
    "product_name": "RedBull 250ml",
    "unit_name": "ແກັດ",
    "multiplier": 8,
    "unit_price": 260000,
    "quantity": 8,
    "line_total": 2080000,
    "line_cost": 1600000,
    "line_profit": 480000
  },
  {
    "id": "item_uuid_0002",
    "order_id": "c0a80124-7e2b-42b1-9f93-111122223333",
    "product_id": "prod_uuid_beerlao",
    "product_name": "ເບຍລາວ ໃຫຍ່ (Beerlao 640ml)",
    "unit_name": "ແພັກ",
    "multiplier": 1,
    "unit_price": 140000,
    "quantity": 4,
    "line_total": 560000,
    "line_cost": 500000,
    "line_profit": 60000
  }
]
```

---

## 8. DANH MỤC KIỂM TRA CHẤT LƯỢNG CHO KỸ SƯ FLUTTER (QA ACCEPTANCE CRITERIA)

Mọi kỹ sư AI hoặc lập trình viên Flutter BẮT BUỘC phải đối soát và vượt qua 11 tiêu chí kiểm thử sau đây trước khi triển khai màn hình POS:

- [ ] **Tiêu chí 1 (Responsive Grid & Split Layout):** Màn hình iPad ngang giữ vững tỉ lệ 65% catalog - 35% giỏ hàng; không bị vỡ layout khi xoay màn hình hoặc gõ bàn phím số.
- [ ] **Tiêu chí 2 (Quét Barcode đa cấp tức thì):** Quét mã thùng -> Tự động thêm 1 Thùng; Quét mã lốc -> Tự động thêm 1 Lốc; Quét mã chai -> Tự động thêm 1 Chai.
- [ ] **Tiêu chí 3 (Nhập số lượng trực tiếp Numpad):** Bấm trực tiếp vào con số lượng của món trong giỏ hàng -> Mở bàn phím số -> Gõ `50` cập nhật ngay lập tức mà không cần bấm nút `+` 50 lần.
- [ ] **Tiêu chí 4 (Hàng không đếm kho "ບໍ່ນັບສາງ"):** Sản phẩm có `track_stock == false` cho phép bấm bán thoải mái với số lượng lớn mà không bao giờ bị báo hết hàng.
- [ ] **Tiêu chí 5 (Chặn bán hàng hết kho):** Sản phẩm có `track_stock == true` và tồn kho = 0 thì không cho thêm vào giỏ hàng, hiển thị nhãn `ໝົດສະຕັອກ (0)`.
- [ ] **Tiêu chí 6 (Đối soát Checkout 3 phương thức):** Modal Checkout hiển thị chuẩn 3 phương thức: Tiền mặt, Chuyển khoản, Ghi nợ; tổng thanh toán khớp 100% với doanh thu trên Financial Dashboard.
- [ ] **Tiêu chí 7 (Ràng buộc Bán nợ):** Không cho phép bán nợ khi khách hàng đang là "Khách vãng lai"; hiển thị chính xác số tiền còn nợ `debt_amount`.
- [ ] **Tiêu chí 8 (Trừ kho cơ sở chuẩn):** Bán 1 Thùng (hệ số 8) và 2 Lốc (hệ số 1) thì CSDL trừ chính xác $8 + 2 = 10$ đơn vị cơ sở `current_stock_base_units`.
- [ ] **Tiêu chí 9 (Danh mục Category động 100% không Hardcode):** Các tab bộ lọc nhóm sản phẩm phải nạp trực tiếp từ bảng `categories` trên Supabase, sắp xếp theo `sort_order`. Khi thêm danh mục mới từ Modal quản lý, danh mục đó phải tự động lưu lên database và xuất hiện trên thanh tab.
- [ ] **Tiêu chí 10 (Cọc vỏ két Crate Deposit & Phân bổ Subtotal):** 
  * Sản phẩm bia hoặc hàng cược két hiển thị checkbox `ບໍ່ມີແກັດປ່ຽນ (+30.000 ₭/ແກັດ)` và bộ đếm két thiếu `[-] {count} [+]`.
  * Tách biệt rõ ràng: $\text{Pure Goods Subtotal} + \text{Total Crate Deposit} = \text{Grand Total}$ trên cả Giỏ hàng (`CartDock`) và Hóa đơn (`MeiiReceiptSlip`). Không được cộng trùng lặp.
- [ ] **Tiêu chí 11 (Chuyển đơn vị trực tiếp & Sửa giá đặc biệt trong giỏ):** Cho phép đổi đơn vị bán (`u.unitName` chips) trực tiếp trong giỏ hàng và mở hộp thoại sửa giá nhanh kèm lý do (Price Override).
