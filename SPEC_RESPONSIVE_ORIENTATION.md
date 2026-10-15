# ĐẶC TẢ KỸ THUẬT: CƠ CHẾ RESPONSIVE & QUY TẮC XOAY NGANG/DỌC (RESPONSIVE & ORIENTATION SYSTEM)
**Mã tệp:** `SPEC_RESPONSIVE_ORIENTATION.md`  
**Nền tảng đích:** Flutter (iOS/iPadOS & Android)  
**Tài liệu tham chiếu mã nguồn Web gốc:**
- `web-app/src/App.jsx`
- `web-app/src/components/Navbar.jsx`
- `web-app/src/components/PosScreen.jsx`
- `web-app/src/components/ProductsView.jsx`
- `web-app/src/components/DashboardView.jsx`
- `web-app/src/components/ProductFormModal.jsx`
- `web-app/src/components/CheckoutModal.jsx`
- `web-app/src/components/ReceiptModal.jsx`

---

## 1. HỆ THỐNG ĐIỂM NGẮT VIEWPORT (BREAKPOINTS SYSTEM)

Mã nguồn Web sử dụng bộ Breakpoints chuẩn của TailwindCSS kết hợp các quy tắc co giãn tự động bằng Flexbox, CSS Grid và Safe Area Insets:

| Tên Breakpoint | Độ rộng Viewport (Width) | Loại thiết bị tương ứng | Trạng thái xoay (Orientation) | Hành vi bố cục tổng thể |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile Portrait** | `< 640px` (`sm`) | Điện thoại thông minh (iPhone, Android) | Dọc (Portrait) | - Bottom Navigation Bar cố định ở đáy<br>- Giỏ hàng chuyển thành Floating Bottom Bar + Bottom Sheet Drawer<br>- Danh sách dạng Card dọc (không scroll ngang bảng)<br>- Lưới sản phẩm POS: 2 cột |
| **Mobile Landscape / Small Tablet** | `640px - 767px` | Điện thoại xoay ngang / iPad Mini dọc | Ngang (Landscape) hoặc Dọc hẹp | - Lưới sản phẩm POS mở rộng 3 cột<br>- KPI Dashboard chuyển 2x2<br>- Modal Form bắt đầu xuất hiện layout dạng lưới mở rộng |
| **Tablet Portrait / Medium Screen** | `768px - 1023px` (`md`) | iPad 10.2", iPad Air dọc / Tablet Android | Dọc (Portrait) hoặc Ngang nhỏ | - Thanh Navigation chuyển từ Bottom Bar sang **Vertical Left Sidebar** cố định (rộng `64px` - `80px`)<br>- Giỏ hàng POS chuyển thành **Dock cố định bên phải (Right Dock)** rộng `300px`<br>- Bảng sản phẩm chuyển sang **Responsive Horizontal Table**<br>- Lưới sản phẩm POS: 3 - 4 cột |
| **Tablet Landscape / Laptop POS** | `1024px - 1279px` (`lg`) | iPad Pro ngang / iPad Air ngang / Laptop 13" | Ngang (Landscape) | - Right Cart Dock mở rộng `340px`<br>- Lưới sản phẩm POS: 4 cột<br>- KPI Dashboard dàn thành 4 cột ngang 1 hàng (`grid-cols-4`)<br>- Dashboard Analytics chia 2 cột: Trái `65%` (8 cols) - Phải `35%` (4 cols)<br>- Product Form Modal chia 2 cột: Trái 5 cols - Phải 7 cols |
| **Large Desktop / POS Terminal Monitor** | `≥ 1280px` (`xl` & `2xl`) | Màn hình máy bán hàng POS quầy / PC 24"+ | Ngang màn rộng (Fixed Wide) | - Right Cart Dock mở rộng `380px`<br>- Lưới sản phẩm POS: 5 cột cực thoáng<br>- Navbar có thể bung rộng `240px` - `256px` có đầy đủ text nhãn |

---

## 2. QUY TẮC CHUYỂN ĐỔI BỐ CỤC THEO TỪNG MÀN HÌNH (SCREEN-BY-SCREEN BEHAVIOR)

### 2.1. Màn hình Bán hàng (POS Screen & Cart)

#### A. Khi Màn hình Rộng / Xoay Ngang (Landscape $\ge$ 768px - iPad / Tablet POS / Desktop):
1. **Chia cột tỷ lệ:** 
   - **Bên Trái (Catalog Dock):** Chiếm trọn không gian còn lại (`flex-1 min-w-0`), nền xám nhạt `bg-slate-50`, viền phải `border-r border-slate-200/80`.
   - **Bên Phải (Cart Dock):** Cố định độc lập (`hidden md:flex flex-col h-full shrink-0`), cuộn độc lập (`overflow-y-auto overscroll-contain`).
     * Độ rộng: `md:w-[300px]`, `lg:w-[340px]`, `xl:w-[380px]`.
     * Tỷ lệ chiếm dụng màn hình: Khoảng `65%` - `70%` bên trái và `30%` - `35%` bên phải.
2. **Lưới sản phẩm (Product Grid):**
   - Sử dụng CSS Grid tự động co giãn theo điểm ngắt:
     * `sm` (640px): 3 cột (`grid-cols-3`)
     * `md` (768px): 3 cột
     * `lg` (1024px): 4 cột
     * `xl` (1280px): 5 cột
   - Khoảng cách thẻ: `gap-2 sm:gap-3`.
   - Chiều cao ảnh thumbnail: `h-20 sm:h-24` (80px - 96px).
   - Dải nút bấm đơn vị 1-Tap (`Fast Unit Add`): Dàn ngang 1 hàng dưới chân thẻ (`flex items-center gap-1`). Nếu có 3 đơn vị (Gói/Lốc/Thùng), mỗi nút chiếm `flex-1` tự chia đều độ rộng.
3. **Thanh tìm kiếm & Category Chips:**
   - Input tìm kiếm tích hợp nút mở camera/barcode scanner và nút Fullscreen ở góc phải.
   - Category Chips cuộn ngang (`overflow-x-auto no-scrollbar`), padding `py-0.5`.

#### B. Khi Màn hình Hẹp / Xoay Dọc (Portrait < 768px - Điện thoại):
1. **Giỏ hàng chuyển đổi hoàn toàn:**
   - Sidebar giỏ hàng bên phải bị ẩn hoàn toàn (`hidden md:flex`).
   - Xuất hiện **Floating Cart Summary Bar** cố định ở đáy màn hình ngay trên Bottom Navigation (`md:hidden fixed bottom-0 z-20`):
     * Bên trái: Icon giỏ hàng có Badge số lượng + Tên khách + Tổng tiền KIP nổi bật màu Teal.
     * Bên phải: Nút `ເບິ່ງກະຕ່າ & ເຊັກບິນ →` (Xem giỏ & Checkout) màu xanh Teal.
   - Khi bấm vào thanh này, mở **Mobile Slide-Over / Bottom Sheet Cart Drawer** (`h-[88dvh] max-h-[88dvh] rounded-t-3xl shadow-2xl`):
     * Có thanh kéo handle `w-10 h-1 bg-slate-300 rounded-full mx-auto`.
     * Cho phép chỉnh sửa số lượng, đổi đơn vị, gán nợ, ghi chú và bấm thanh toán toàn màn hình.
2. **Lưới sản phẩm:** 
   - Tự động co về **2 cột** (`grid-cols-2`), tối ưu hiển thị trên màn hình dọc từ 360px - 430px.
   - Thẻ sản phẩm hiển thị ảnh, tên 1 dòng cắt ngắn (`line-clamp-1`), tồn kho tóm tắt và cụm nút 1-tap thêm giỏ hàng.
3. **Thanh tìm kiếm:** Chiếm 100% chiều ngang, các nút camera/scan thu gọn vào trong ô input.

---

### 2.2. Màn hình Danh sách sản phẩm & Kho hàng (Product List & Inventory)

#### A. Khi Màn hình Rộng / Xoay Ngang ($\ge$ 768px):
- **Giao diện bảng (Horizontal Scroll Table):** Kích hoạt hiển thị (`hidden md:block`).
- **Cấu trúc bảng:**
  * Bảng dạng bảng phẳng bọc trong container bo góc `rounded-2xl border border-slate-200 bg-white`.
  * Chiều rộng tối thiểu của bảng `min-w-[950px]` với thanh cuộn ngang mượt mà (`overflow-x-auto overscroll-x-contain`).
  * Tiêu đề bảng cố định khi cuộn dọc (`sticky top-0 bg-slate-50 z-10`).
  * 7 cột chuẩn: `ຮູບ & ຊື່ສິນຄ້າ`, `ໝວດໝູ່`, `ຕົ້ນທຶນບາດ (฿) & ກີບ (₭)`, `ລະດັບຫົວໜ່ວຍຂາຍ`, `ສາງຄົງເຫຼືອ (Stock)`, `ອັດຕາສ່ວນ (Ratio)`, `ຈັດການ`.
- **Thanh công cụ Header:** Dàn ngang 1 hàng (`flex-row justify-between items-center`), các nút `ໝວດໝູ່`, `ໂຫຼດຄືນ`, `+ ເພີ່ມສິນຄ້າໃໝ່` xếp cạnh nhau bên phải.

#### B. Khi Màn hình Hẹp / Xoay Dọc (< 768px):
- **Chuyển đổi sang Card View dọc:** Bảng table bị ẩn hoàn toàn, chuyển sang danh sách thẻ dọc (`md:hidden flex flex-col gap-3`).
- **Cấu trúc mỗi Card:**
  * **Hàng trên:** Ảnh sản phẩm (`w-14 h-14 rounded-xl`) + Tên sản phẩm + Badge danh mục + Barcode; bên phải là cụm 2 nút bấm hình vuông `40x40px` (Sửa icon bút chì, Xóa icon thùng rác).
  * **Hàng giữa:** Box chi phí vốn nền xám `bg-slate-50` hiển thị rõ cả tiền Baht (฿) và tiền Kip (₭) kèm tỷ lệ quy đổi (Ví dụ: `1 ແກັດ = 8 ແພັກ`).
  * **Hàng dưới:** Chi tiết tồn kho 3 cấp (Thùng, Gói, Lẻ) và badge tổng số gói quy đổi. Nếu hết hàng, hiển thị chữ đỏ `ໝົດສະຕັອກ (0)`.
- **Thanh công cụ Header:** Tự động xếp chồng dọc (`flex-col gap-3`), các nút bấm hành động chuyển sang full-width hoặc co giãn đều (`flex-1 min-h-[44px]`).

---

### 2.3. Màn hình Báo cáo Tài chính (Financial Dashboard)

#### A. Khi Màn hình Rộng / Xoay Ngang ($\ge$ 1024px):
1. **Dải 4 thẻ KPI chính:** Dàn đều thành **4 cột ngang 1 hàng** (`lg:grid-cols-4 gap-3`).
2. **Khu vực phân tích 2 cột sâu (Two-Column Deep-Dive Analytics):**
   - Sử dụng lưới 12 cột (`grid grid-cols-12 gap-4 items-start`):
     * **Cột Trái (65% - `lg:col-span-8`):** Chứa 2 khối biểu đồ lớn:
       - Khối 1: Biểu đồ cột xu hướng bán hàng theo giờ từ 07:00 đến 22:00 (`Hourly Sales Trend Chart`). Chiều cao cột tối đa 140px.
       - Khối 2: Cơ cấu doanh số theo danh mục (`Sales by Category Breakdown`) với thanh tiến trình ngang nhiều màu (Horizontal Stacked Bar) và lưới thẻ danh mục con 2 cột (`grid-cols-2`).
     * **Cột Phải (35% - `lg:col-span-4`):** Chứa 2 khối danh sách:
       - Khối 3: Top 5 sản phẩm bán chạy nhất (`Top 5 Best Selling Products`).
       - Khối 4: Cảnh báo hàng sắp hết kho (`Stock Alert`) hoặc Danh sách nợ tồn đọng (`Debt Customers`).

#### B. Khi Màn hình Hẹp / Xoay Dọc (< 1024px hoặc điện thoại < 640px):
1. **Dải thẻ KPI chính:**
   - Trên Tablet dọc (640px - 1023px) hoặc điện thoại: Tự động chia thành **lưới 2x2** (`grid-cols-2 gap-3`).
2. **Khu vực phân tích chuyển về dạng 1 cột xếp chồng (Single Column Stack):**
   - Chuyển thành `grid-cols-1` theo thứ tự ưu tiên thị giác:
     1. Biểu đồ doanh số theo giờ (Biểu đồ tự động co giãn theo chiều ngang màn hình, chiều cao biểu đồ giữ nguyên độ thoáng `h-[140px]`, font trục X giảm nhẹ `text-[9.5px]`).
     2. Cơ cấu ngành hàng (Thẻ danh mục chuyển về 1 cột dọc `grid-cols-1`).
     3. Top 5 sản phẩm bán chạy nhất.
     4. Cảnh báo kho / Danh sách nợ.
3. **Thanh lọc thời gian (Timeframe Chips):**
   - Cho phép cuộn ngang cảm ứng (`overflow-x-auto no-scrollbar`), các chip `ມື້ນີ້`, `7 ມື້ຜ່ານມາ`, `ເດືອນນີ້`, `ທັງໝົດ` không bị vỡ hàng.

---

### 2.4. Các Modal Form (Thêm/Sửa sản phẩm, Checkout, In hóa đơn)

#### A. Modal Thêm / Chỉnh sửa sản phẩm (`ProductFormModal.jsx`):
- **Thiết kế Responsive Đột Phá: Full Screen Page Modal**
  * Modal chiếm toàn bộ màn hình (`fixed inset-0 w-screen h-screen bg-slate-100 flex flex-col z-50`).
  * **Header cố định trên cùng (`shrink-0`):** Nút quay lại `ArrowLeft` + Tiêu đề + Nút bộ mẫu nhanh (Presets) + Nút lưu `Save Product`.
  * **Nội dung cuộn ở giữa (`flex-1 overflow-y-auto`):**
    - **Trên Desktop/Tablet ngang (`lg:grid-cols-12 max-w-6xl mx-auto gap-6`):**
      * Cột trái (5 cột - `lg:col-span-5`): Ảnh sản phẩm, Tên, Danh mục, Chi phí vốn Baht/Kip, Công tắc bật/tắt theo dõi tồn kho và nhập số lượng tồn khởi tạo.
      * Cột phải (7 cột - `lg:col-span-7`): Cụm 3 Switch bật/tắt 3 cấp đơn vị (Carton, Pack, Piece) kèm quy cách đóng gói, giá bán lẻ/buôn và barcode từng cấp.
    - **Trên Điện thoại dọc (`grid-cols-1 gap-4`):**
      * Tự động xếp chồng 1 cột dọc liên tục.
      * Nút bộ mẫu nhanh (Presets) trên Header tự động ẩn bớt text, chỉ hiển thị icon hoặc co gọn để ưu tiên nút Lưu.
      * Các ô nhập số tiền/giá bán có diện tích chạm lớn (`padding: 10px 14px`).

#### B. Modal Thanh toán (`CheckoutModal.jsx`):
- Container dạng Card căn giữa màn hình (`max-w-md w-full max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6`).
- **Trên Điện thoại dọc:** Chiều rộng ôm sát `w-full` với lề ngoài `p-4`, chiều cao tối đa `92vh`, tự động cuộn khi bàn phím ảo đẩy lên.
- Cụm 3 nút chọn phương thức thanh toán (`Tiền mặt`, `QR Chuyển khoản`, `Ghi nợ`):
  * Dàn 3 cột đều nhau (`grid grid-cols-3 gap-2`).
  * Chiều cao nút tối thiểu `48px` đảm bảo ngón tay cái bấm chính xác 100%.

#### C. Modal In Hóa đơn (`ReceiptModal.jsx` & `MeiiReceiptSlip`):
- Kích thước Dialog giới hạn `max-w-md` (`440px`).
- Thanh công cụ trên cùng có switch chuyển khổ giấy: **80mm** (`380px`) vs **58mm** (`280px`).
- Giấy in nhiệt mô phỏng cuộn độc lập bên trong `max-h-[95vh] overflow-y-auto`.
- Khi bấm in trên di động hoặc máy tính bảng, gọi hàm print adapter native của hệ điều hành.

---

## 3. QUY CHUẨN KÍCH THƯỚC DÀN TRANG (SPACING, TYPOGRAPHY & TOUCH TARGETS)

### 3.1. Bảng Padding Container chính theo Viewport
| Vùng hiển thị | Màn hình nhỏ / Dọc (< 640px) | Tablet dọc (640px - 1023px) | Tablet ngang & Desktop ($\ge$ 1024px) |
| :--- | :--- | :--- | :--- |
| **Padding trang chính (`main`)** | `p-3` (12px) | `p-4` hoặc `p-5` (16px - 20px) | `p-6` (24px) |
| **Khoảng cách giữa các thẻ (`gap`)** | `gap-2` hoặc `gap-2.5` (8px - 10px) | `gap-3` (12px) | `gap-4` hoặc `gap-5` (16px - 20px) |
| **Bo góc Card / Container** | `rounded-xl` (12px) | `rounded-2xl` (16px) | `rounded-3xl` (24px) |

### 3.2. Quy chuẩn Vùng Bấm Chạm (Touch Target Size):
- **Quy tắc vàng:** Tất cả các thành phần tương tác trên màn hình cảm ứng (iPad/Điện thoại) **phải có chiều cao hoặc diện tích chạm tối thiểu 44 x 44px** (theo chuẩn Apple Human Interface Guidelines).
  * Nút chuyển tab Bottom Navigation: Chiều cao `min-h-[46px]`.
  * Nút Thêm vào giỏ 1-Tap (`Fast Unit Button`): Chiều cao tối thiểu `38px - 44px`, padding dọc `py-1.5`.
  * Các nút Icon thao tác (Sửa, Xóa, Scan): Bao bọc trong container `w-10 h-10` (40x40px) hoặc `w-11 h-11` (44x44px).
  * Nút Checkout / Xác nhận: Chiều cao `44px - 50px`.

### 3.3. Xử lý Vùng An Toàn (Safe Area & Notch Adaptation):
Web sử dụng các thuộc tính CSS `env(safe-area-inset-*)` để không bị tai thỏ (Notch) hoặc thanh gạt Home Indicator che khuất nội dung:
```css
/* Chừa lề đáy cho thanh điều hướng di động */
padding-bottom: max(4.5rem, calc(4rem + env(safe-area-inset-bottom, 0px)));

/* Chừa lề phải cho màn hình xoay ngang có tai thỏ */
padding-right: max(0.75rem, env(safe-area-inset-right, 0px));
```
- **Trong Flutter:** Phải luôn bọc giao diện trong widget `SafeArea(top: false, bottom: true)` hoặc đọc trực tiếp `MediaQuery.of(context).padding`.

---

## 4. BẢNG QUY ĐỔI SANG WIDGET FLUTTER (MAPPING TO FLUTTER ARCHITECTURE)

Để đảm bảo mã Flutter chạy mượt mà 60-120fps trên cả iPadOS và Android Tablet mà không gặp lỗi giật lag hay vỡ giao diện:

| Thành phần Web | Giải pháp CSS trên Web | Widget Flutter tương đương khuyến nghị | Lý do kiến trúc & Lưu ý hiệu năng |
| :--- | :--- | :--- | :--- |
| **Kiểm tra Hướng xoay & Kích thước** | Media queries `@media (min-width: 768px)` | `LayoutBuilder` kết hợp điều kiện `constraints.maxWidth >= 768` | **Tránh dùng `MediaQuery.of(context)` cho toàn bộ widget con** vì sẽ gây rebuild không cần thiết khi bàn phím ảo xuất hiện. `LayoutBuilder` chỉ đo kích thước thực tế của container cha. |
| **Bố cục POS Split View (Catalog + Cart)** | `flex flex-col md:flex-row` | `Row(children: [Expanded(child: CatalogDock()), SizedBox(width: isTablet ? 340 : 380, child: CartDock())])` | Trên Mobile: Không build CartDock cố định mà dùng `BottomSheet` hoặc `SlideTransition` khi bấm xem giỏ hàng. |
| **Lưới sản phẩm linh hoạt (Product Grid)** | `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` | `GridView.builder` với `SliverGridDelegateWithFixedCrossAxisCount` tính toán theo `maxWidth`: `int cols = width < 640 ? 2 : (width < 1024 ? 3 : (width < 1280 ? 4 : 5));` | Đảm bảo thẻ sản phẩm luôn giữ tỷ lệ aspect ratio đẹp (`childAspectRatio: 0.72 - 0.78`). |
| **Chuyển đổi Bảng sang Card (Products View)** | `md:block` (Table) vs `md:hidden` (Card List) | `LayoutBuilder` trả về: `if (constraints.maxWidth >= 768) return _buildDesktopTable(); else return _buildMobileCardList();` | Giữ nguyên 100% logic dữ liệu, chỉ hoán đổi cách render giao diện. |
| **Khối Dashboard 2 cột (65% - 35%)** | `grid grid-cols-1 lg:grid-cols-12` (`col-span-8` & `col-span-4`) | `if (isWide) Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(flex: 65, child: LeftColumn()), SizedBox(width: 16), Expanded(flex: 35, child: RightColumn())]) else Column(...)` | Khi màn hình hẹp tự động xếp thành Column, tránh tuyệt đối lỗi RenderFlex Overflow. |
| **Thanh Navigation Bar** | Bottom Bar trên Mobile, Left Sidebar trên Tablet | `Scaffold` với `bottomNavigationBar` khi hẹp (`width < 768`), hoặc `Row` bọc `NavigationRail` / Custom Sidebar bên trái khi rộng (`width >= 768`). | Tạo trải nghiệm Native chuẩn mực của ứng dụng iPad POS chuyên nghiệp. |
| **Drawer Giỏ hàng Di động** | Mobile Bottom Sheet Slide-Over | `showModalBottomSheet(context: context, isScrollControlled: true, shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))))` | Thiết lập chiều cao `FractionallySizedBox(heightFactor: 0.88)` tương đương `h-[88dvh]`. |

---

## 5. MẪU MÃ NGUỒN FLUTTER CHUẨN (FLUTTER IMPLEMENTATION CODE SNIPPETS)

### 5.1. Scaffold Bán hàng Tự Động Thích Ứng (Adaptive POS Screen)
```dart
class AdaptivePosScreen extends StatelessWidget {
  const AdaptivePosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final bool isLandscapeTablet = constraints.maxWidth >= 768;

        return Scaffold(
          body: Row(
            children: [
              // 1. Bên Trái: Catalog Sản Phẩm (Luôn hiển thị)
              const Expanded(
                child: PosCatalogView(),
              ),

              // 2. Bên Phải: Giỏ hàng cố định (Chỉ hiển thị khi xoay ngang / Tablet >= 768px)
              if (isLandscapeTablet) ...[
                const VerticalDivider(width: 1, thickness: 1, color: Color(0xFFE2E8F0)),
                SizedBox(
                  width: constraints.maxWidth >= 1280
                      ? 380
                      : (constraints.maxWidth >= 1024 ? 340 : 300),
                  child: const PosCartDock(),
                ),
              ],
            ],
          ),

          // 3. Thanh Giỏ hàng Nổi ở Đáy (Chỉ hiển thị trên Điện thoại < 768px)
          bottomNavigationBar: isLandscapeTablet
              ? null
              : const MobileFloatingCartBar(),
        );
      },
    );
  }
}
```

### 5.2. Tính toán Lưới Sản phẩm Thông minh (Responsive Product Grid Delegate)
```dart
int calculateGridColumns(double availableWidth) {
  if (availableWidth < 640) return 2;   // Mobile Portrait
  if (availableWidth < 900) return 3;   // Mobile Landscape / Small Tablet
  if (availableWidth < 1200) return 4;  // iPad Pro / Tablet POS
  return 5;                             // Màn hình Desktop lớn
}
```

---

## 6. TIÊU CHÍ NGHIỆM THU HIỂN THỊ (RESPONSIVE ACCEPTANCE CRITERIA)

- [ ] **AC-RESP-01 (Không lỗi tràn màn hình):** Khi xoay thiết bị (Rotate Device) giữa chiều dọc và chiều ngang trên mọi thiết bị (iPhone, iPad, Android), giao diện chuyển đổi mượt mà trong 0.2s, tuyệt đối không xuất hiện vạch sọc vàng đen cảnh báo lỗi tràn pixel (`A RenderFlex overflowed`).
- [ ] **AC-RESP-02 (POS Split View):** Trên màn hình rộng ($\ge 768px$), màn hình Bán hàng hiển thị song song 2 cột (Catalog bên trái, Giỏ hàng bên phải). Khi co hẹp ($< 768px$), giỏ hàng tự động ẩn và chuyển thành thanh nổi ở đáy kèm Drawer trượt lên.
- [ ] **AC-RESP-03 (Bảng danh sách thích ứng):** Trên Tablet ngang, trang Sản phẩm hiển thị đầy đủ bảng Table cuộn ngang có tiêu đề sticky. Trên điện thoại dọc, tự động chuyển đổi sang dạng thẻ (Card View) hiển thị đầy đủ giá Baht/Kip và tồn kho 3 cấp.
- [ ] **AC-RESP-04 (Dashboard linh hoạt):** Trên iPad ngang, 4 thẻ KPI dàn 1 hàng ngang và khu vực phân tích chia 2 cột (65% biểu đồ - 35% top bán chạy). Trên điện thoại, 4 thẻ chuyển sang lưới 2x2 và các khối phân tích tự động xếp chồng 1 cột mượt mà.
- [ ] **AC-RESP-05 (Modal Fullscreen):** Form Thêm/Sửa sản phẩm trên màn hình rộng chia 2 cột rõ ràng (5 cột thông tin cơ bản & chi phí - 7 cột cấu hình 3 cấp đơn vị), trên điện thoại tự động cuộn dọc thoáng đãng, bàn phím ảo không che khuất ô nhập giá và số lượng.
- [ ] **AC-RESP-06 (Chuẩn Safe Area):** Trên các thiết bị có tai thỏ (iPhone Dynamic Island, tai thỏ ngang iPad), nội dung không bao giờ bị chìm vào viền cắt hoặc bị thanh Home Indicator che mất nút bấm.
