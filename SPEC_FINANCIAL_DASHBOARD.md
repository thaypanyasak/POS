# ĐẶC TẢ KỸ THUẬT: MÀN HÌNH BÁO CÁO & PHÂN TÍCH TÀI CHÍNH (FINANCIAL DASHBOARD)
**Mã tài liệu:** `SPEC_FINANCIAL_DASHBOARD.md`  
**Vai trò:** Principal Mobile Software Architect & Flutter Technical Lead  
**Nền tảng mục tiêu:** Flutter (iOS/iPadOS, Android POS Terminals, Desktop/Web POS)  
**Hệ quản trị CSDL:** Supabase (PostgreSQL + PostgREST + RPC Aggregations)  
**Phiên bản chuẩn:** v2.4 (Ultra-Detailed Construction Spec / Single Source of Truth)

---

## 1. TỔNG QUAN NGHIỆP VỤ & BỐ CỤC (OVERVIEW & LAYOUT ARCHITECTURE)

### 1.1. Mục đích nghiệp vụ
Màn hình Báo cáo Tài chính (`FinancialDashboardScreen` / `DashboardView`) là trung tâm chỉ huy số liệu kinh doanh của chủ cửa hàng và giám đốc bán hàng MeiiShop:
1. **Phản ánh sức khỏe dòng tiền thời gian thực:** Doanh thu thực tế, Giá vốn hàng bán (COGS), Lợi nhuận gộp, và Tỷ suất lợi nhuận (Margin %).
2. **Loại trừ 100% hóa đơn đã hủy (Void Invoices):** Đảm bảo các hóa đơn sai sót bị hủy không bị tính trùng lặp vào kết quả kinh doanh.
3. **Đối soát cân bằng phương thức thanh toán:** Phân bổ rạch ròi giữa Tiền mặt (Cash), Chuyển khoản (Transfer / OnePay), và Công nợ (Credit/Debt) với quy tắc cân bằng 100% khớp với Doanh thu.
4. **Phân tích hành vi mua sắm:** Nhận diện khung giờ cao điểm (07:00 - 22:00), cơ cấu đóng góp doanh số của từng ngành hàng, Top 5 mặt hàng sinh lời cao nhất, cảnh báo hàng sắp hết và danh sách các khoản nợ cần thu hồi vốn.

---

### 1.2. Bộ lọc thời gian (Time Range Selector)
- **Vị trí:** Nằm ở góc trên cùng bên phải Header.
- **Dạng giao diện:** Hàng nút bấm bo góc (Segmented Chips Control) với hiệu ứng chuyển đổi trạng thái mượt mà:
  1. `ມື້ນີ້ (Today)`: Lọc toàn bộ đơn hàng phát sinh từ `00:00:00` đến `23:59:59` của ngày hiện tại (mặc định active).
  2. `7 ມື້ຜ່ານມາ (Last 7 Days)`: Lọc các đơn từ 7 ngày trước đến thời điểm hiện tại.
  3. `ເດືອນນີ້ (This Month)`: Lọc từ ngày 01 của tháng hiện tại lúc `00:00:00` đến hiện tại.
  4. `ທັງໝົດ (All Time)`: Toàn bộ dữ liệu lịch sử trong hệ cơ sở dữ liệu.

---

### 1.3. Bố cục không gian tổng thể (Responsive Layout Architecture)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ແຜງຄວບຄຸມລາຍຮັບ & ຕົ້ນທຶນ (Financial Dashboard)                       [ມື້ນີ້] [7ມື້] [ເດືອນນີ້] [ທັງໝົດ]  │
│  ສະຫຼຸບລາຍຮັບ, ຕົ້ນທຶນສິນຄ້າ, ຍອດເງິນສົດ/ໂອນ/ຕິດໜີ້ ແລະ ວິເຄາະທຸລະກິດ Real-time (ກີບ ₭)                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  HÀNG 1: 4 THẺ CHỈ SỐ KPI TÀI CHÍNH CỐT LÕI (4 EQUAL COLUMNS)                                          │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐         │
│  │ 1. ຍອດຂາຍລວມ (Rev)   │ 2. ຕົ້ນທຶນສິນຄ້າ (COGS)│ 3. ກຳໄລຂັ້ນຕົ້ນ (Profit)│ 4. ຍອດສະເລ່ຍ (Basket)│         │
│  │ 33.825.000 ₭         │ 30.485.031 ₭         │ 3.339.969 ₭          │ 867.308 ₭            │         │
│  │ ຈຳນວນ: 39 ບິນສຳເລັດ │ ຕົ້ນທຶນ [ຕົ້ນຈິງ]    │ ອັດຕາກຳໄລ: 9.9%      │ ສະເລ່ຍ/1 ລູກຄ້າ      │         │
│  └──────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘         │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  HÀNG 2: ĐỐI SOÁT PHƯƠNG THỨC THANH TOÁN (PAYMENT BREAKDOWN - 3 CARDS)                                 │
│  ກວດສອບຍອດ: 33.825.000 ₭ (100% ຄົບຖ້ວນ)                                                               │
│  ┌────────────────────────────────┬────────────────────────────────┬────────────────────────────────┐  │
│  │ 1. ເງິນສົດ (Cash)              │ 2. ໂອນເງິນ (Transfer / OnePay) │ 3. ຍອດຂາຍຕິດໜີ້ (Credit / Debt)│  │
│  │ 20.325.000 ₭                   │ 9.900.000 ₭                    │ 3.100.000 ₭                    │  │
│  │ ເງິນສົດຈິງທີ່ໄດ້ຮັບ              │ OnePay QR + ໂອນບັນຊີ           │ ລວມ 4 ບິນຕິດໜີ້                │  │
│  └────────────────────────────────┴────────────────────────────────┴────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  HÀNG 3: BỐ CỤC 2 CỘT DEEP-DIVE ANALYTICS (65% LEFT - 35% RIGHT)                                       │
│  ┌───────────────────────────────────────────────────┬──────────────────────────────────────────────┐  │
│  │ CỘT TRÁI (65% - lg:col-span-8)                    │ CỘT PHẢI (35% - lg:col-span-4)               │  │
│  │ ───────────────────────────────────────────────── │ ──────────────────────────────────────────── │  │
│  │ [Component 1: Hourly Sales Trend Chart]           │ [Component 3: Top 5 Best Sellers]            │  │
│  │   - Cột doanh thu từ 07:00 đến 22:00              │   - #1: ເຂົ້າໜົມ Layy (31 ແກັດ) -> 16.4M ₭   │  │
│  │   - Tooltip tiền & số hóa đơn từng giờ            │   - #2: ເບຍລາວ ລັງ (43 ລັງ)   -> 11.7M ₭   │  │
│  │                                                   │   - #3: ນ້ຳຫວານແກ້ວ (61 ແພັກ) -> 5.7M ₭    │  │
│  │ [Component 2: Sales by Category Breakdown]        │                                              │  │
│  │   - Stacked Progress Bar đa màu                   │ [Component 4: Low Stock Alert Widget]        │  │
│  │   - Nhóm 1: ເຄື່ອງປຸງ (48.6%)                      │   - ⚠️ 4 mặt hàng đếm kho có tồn = 0         │  │
│  │   - Nhóm 2: ເບຍ (34.6%)                           │   - Bỏ qua hàng "ບໍ່ນັບສາງ"                  │  │
│  │   - Nhóm 3: ເຄື່ອງດື່ມ (16.9%)                     │                                              │  │
│  │                                                   │ [Component 5: Recent Credit Customers]       │  │
│  │                                                   │   - Danh sách khách nợ gần đây & số tiền     │  │
│  └───────────────────────────────────────────────────┴──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CHI TIẾT 4 THẺ CHỈ SỐ KPI TÀI CHÍNH (CORE FINANCIAL KPIS)

Các thẻ KPI nằm ở hàng trên cùng, phân bổ đều 4 cột (`grid-cols-2 lg:grid-cols-4`), bo góc `rounded-xl`, đổ bóng nhẹ `shadow-2xs`:

### Thẻ 1: Doanh thu tổng (ຍອດຂາຍລວມ / Total Revenue)
- **Nguồn dữ liệu:** Bảng `orders` kết hợp điều kiện lọc thời gian và:
  $$\text{orders.status} == \text{'completed'} \quad (\text{TUYỆT ĐỐI BỎ QUA các đơn } \text{status} == \text{'voided'})$$
- **Công thức:**
  $$\text{Total Revenue} = \sum_{\text{đơn hợp lệ}} \text{orders.grand\_total}$$
- **Hiển thị:** Font in đậm `font-black`, cỡ chữ `22px - 26px`, màu xanh ngọc `text-teal-700` (VD: `33.825.000 ₭`).
- **Icon:** `CurrencyCircleDollar` màu teal, nền `bg-teal-50`.
- **Dòng phụ (Sub-label):** `ຈຳນວນ: {validOrdersCount} ບິນສຳເລັດ` (VD: `ຈຳນວນ: 39 ບິນສຳເລັດ`).

---

### Thẻ 2: Giá vốn hàng bán tổng (ຕົ້ນທຶນສິນຄ້າລວມ / Total COGS)
- **Nguồn dữ liệu:** Duyệt qua các dòng `order_items` thuộc các đơn hàng hợp lệ trong kỳ.
- **Công thức:**
  $$\text{Total COGS} = \sum (\text{item.quantity} \times \text{item.unit\_multiplier} \times \text{item.product.cost\_per\_base\_unit})$$
- **Hiển thị:** Cỡ chữ `22px - 26px`, font in đậm, màu `slate-800` (VD: `30.485.031 ₭`).
- **Icon:** `CalendarBlank` màu hổ phách, nền `bg-amber-50`.
- **Dòng phụ:** `ຕົ້ນທຶນສິນຄ້າທີ່ຂາຍອອກ` kèm huy hiệu nhỏ bên cạnh: `ຕົ້ນຈິງ 100%`.

---

### Thẻ 3: Lợi nhuận gộp (ກຳໄລຂັ້ນຕົ້ນ / Gross Profit)
- **Công thức:**
  $$\text{Gross Profit} = \text{Total Revenue} - \text{Total COGS}$$
  $$\text{Profit Margin (\%)} = \begin{cases} \left(\dfrac{\text{Gross Profit}}{\text{Total Revenue}}\right) \times 100 & \text{nếu Revenue} > 0 \\ 0 & \text{nếu Revenue} = 0 \end{cases}$$
- **Hiển thị:** Màu xanh lá đậm `text-emerald-700`, cỡ chữ `22px - 26px` (VD: `3.339.969 ₭`).
- **Icon:** `CreditCard` màu xanh lục, nền `bg-emerald-50`.
- **Dòng phụ:** Huy hiệu tỷ suất lợi nhuận:  
  `ອັດຕາກຳໄລ: ` <span style="background:#ECFDF5; padding:2px 6px; border-radius:4px; font-weight:800; color:#047857;">9.9%</span>

---

### Thẻ 4: Giá trị trung bình trên mỗi hóa đơn (ຍອດສະເລ່ຍຕໍ່ບິນ / Average Basket Size)
- **Công thức:**
  $$\text{Avg Basket} = \begin{cases} \text{round}\left(\dfrac{\text{Total Revenue}}{\text{Số lượng hóa đơn hợp lệ}}\right) & \text{nếu hóa đơn} > 0 \\ 0 & \text{nếu hóa đơn} = 0 \end{cases}$$
- **Hiển thị:** Cỡ chữ `22px - 26px`, màu `slate-900` (VD: `867.308 ₭`).
- **Icon:** `ChartBar` màu tím, nền `bg-purple-50`.
- **Dòng phụ:** `ສະເລ່ຍຕໍ່ 1 ລູກຄ້າ` và nhãn `ບິນ/ລູກຄ້າ`.

---

## 3. KHỐI ĐỐI SOÁT PHƯƠNG THỨC THANH TOÁN (PAYMENT BREAKDOWN & RECONCILIATION)

Khối này giải quyết triệt để vấn đề "trùng lặp phương thức thanh toán", đảm bảo chuẩn 1:1 với màn hình POS Checkout.

### 3.1. Huy hiệu đối soát góc phải (Reconciliation Badge)
- Tiêu đề khối: `ຊ່ອງທາງການຊຳລະເງິນ (PAYMENT BREAKDOWN)`.
- **Huy hiệu bảo vệ số liệu (Reconciliation Badge):**  
  `ກວດສອບຍອດ: {formatKip(Total Revenue)} (100% ຄົບຖ້ວນ)`
- **Định luật đối soát dòng tiền bất biến:**
  $$\text{Total Revenue} \equiv \text{Cash Total} + \text{Transfer Total} + \text{Credit/Debt Total}$$
  *(Con số tổng của 3 thẻ bên dưới luôn khớp 100% từng đồng Kíp với thẻ Doanh thu ở Hàng 1).*

---

### 3.2. Ba Thẻ Phương thức thanh toán thành phần:

#### 1. Thẻ 1: Tiền mặt (1. ເງິນສົດ / Cash)
- **Tiêu chuẩn tính:** Tổng các đơn thanh toán bằng tiền mặt (`payment_method == 'cash'`).
- **Icon:** `CurrencyDollar` màu trắng, nền tròn xanh lục `#10B981` bo góc `rounded-xl`.
- **Số tiền:** `20.325.000 ₭` (font `text-xl font-black text-emerald-800`).
- **Dòng phụ:** `ເງິນສົດຈິງທີ່ໄດ້ຮັບ (Tiền mặt thực tế thu về trong két)`.

#### 2. Thẻ 2: Chuyển khoản (2. ໂອນເງິນ / Transfer - OnePay QR)
- **Tiêu chuẩn tính:** Gộp chung toàn bộ chuyển khoản ngân hàng (`transfer`) và quét mã BCEL OnePay QR (`onepay`, `qrTransfer`) thành **MỘT THẺ DUY NHẤT**.
- **Icon:** `QrCode` màu trắng, nền tròn xanh dương `#2563EB` bo góc `rounded-xl`.
- **Số tiền:** `9.900.000 ₭` (font `text-xl font-black text-blue-900`).
- **Dòng phụ:** `OnePay QR + ໂອນບັນຊີທະນາຄານ`.

#### 3. Thẻ 3: Bán nợ / Công nợ (3. ຍອດຂາຍຕິດໜີ້ / Credit - Debt)
- **Tiêu chuẩn tính:** Tổng số tiền còn nợ lại từ các đơn hàng mua nợ (`payment_method == 'debt'` hoặc `is_debt == true`).
  $$\text{Credit Total} = \sum \text{orders.debt\_amount}$$
- **Icon:** `ClockCountdown` màu trắng, nền tròn cam cảnh báo `#F59E0B` bo góc `rounded-xl`.
- **Số tiền:** `3.100.000 ₭` (font `text-xl font-black text-amber-900`).
- **Dòng phụ:** `ລວມ {debtCount} ບິນຕິດໜີ້ (Số lượng hóa đơn nợ đang theo dõi thu hồi vốn)`.

---

## 4. CHI TIẾT CỘT TRÁI (65%): BIỂU ĐỒ & CƠ CẤU NGÀNH HÀNG

Phân bổ không gian rộng rãi (65% chiều ngang màn hình) dành cho phân tích chuyên sâu:

### 4.1. Biểu đồ Doanh thu theo khung giờ (Hourly Sales Trend Chart: 07:00 - 22:00)
- **Tiêu đề component:** `ຍອດຂາຍຕາມຊ່ວງເວລາ (Hourly Sales Trend: 07:00 - 22:00)` kèm icon `ClockAfternoon`.
- **Mô tả:** `ວິເຄາະຊ່ວງເວລາທີ່ຂາຍດີທີ່ສຸດຂອງຮ້ານ ເພື່ອຈັດສັບພະນັກງານ ແລະ ກຽມສະຕັອກ`.
- **Huy hiệu góc phải:** `[N] ບິນ` (Số đơn hoàn tất trong khung giờ, VD: `39 ບິນ`).
- **Cấu trúc biểu đồ:**
  * **Trục Y:** Doanh thu tương đối (chiều cao cột tỉ lệ theo giờ có doanh thu lớn nhất `maxHourlyRevenue`).
  * **Trục X:** 16 cột tương ứng từ 7h sáng đến 22h đêm (các nhãn mốc chính: `07:00`, `10:00`, `13:00`, `16:00`, `19:00`, `22:00`).
  * **Màu sắc cột:**
    - Cột thông thường có doanh số: Nền xanh teal `bg-teal-500/80 hover:bg-teal-600`.
    - **Cột đỉnh điểm (Peak Hour):** Được tô màu dải chuyển sắc nổi bật `bg-gradient-to-t from-teal-600 to-emerald-400` kèm đổ bóng nhẹ `shadow-xs`.
    - Cột không có doanh số: Màu xám nhạt `bg-slate-100`.
- **Tương tác Tooltip thông minh (Interactive Hover / Touch Popover):**
  * Khi người dùng chạm hoặc rê chuột vào bất kỳ cột nào, một hộp thoại màu tối hiện lên ngay trên đầu cột:
    ```
    ┌─────────────────────────┐
    │ 16:00                   │
    │ 12.450.000 ₭            │
    │ 14 ບິນສຳເລັດ             │
    └─────────────────────────┘
    ```

---

### 4.2. Cơ cấu Doanh thu theo Ngành hàng (Sales by Category Breakdown)
- **Tiêu đề component:** `ໂຄງສ້າງຍອດຂາຍຕາມໝວດໝູ່ (Sales by Category)` kèm icon `ChartPie`.
- **Mô tả:** `ສັດສ່ວນລາຍຮັບຂອງແຕ່ລະກຸ່ມສິນຄ້າ (ເຄື່ອງດື່ມ, ເຂົ້າໜົມ, ເບຍ,...)`.
- **Huy hiệu:** `[N] ໝວດໝູ່` (Số lượng nhóm hàng có phát sinh giao dịch, VD: `3 ໝວດໝູ່`).
- **1. Thanh tiến trình xếp chồng đa sắc (Horizontal Stacked Progress Bar):**
  * Chiều cao `8px - 10px`, bo tròn 2 đầu `rounded-full`.
  * Phân đoạn độ rộng tỉ lệ chính xác theo tỷ phần đóng góp % doanh thu của từng ngành hàng:
    - Nhóm 1 (`ເຄື່ອງປຸງ`): `width: 48.6%`, màu Teal.
    - Nhóm 2 (`ເບຍ`): `width: 34.6%`, màu Emerald.
    - Nhóm 3 (`ເຄື່ອງດື່ມ`): `width: 16.9%`, màu Hổ phách/Vàng.
- **2. Lưới thẻ chi tiết danh mục bên dưới (Category Metric Cards):**
  * Chia đều thành các Card con 2 cột:
    - Chấm màu định danh nhóm.
    - Tên danh mục (in đậm, cắt gọn nếu quá dài).
    - Số lượng món đã bán: `ຂາຍໄດ້ 45 ລາຍການ`.
    - Cột bên phải: Doanh thu của ngành hàng (VD: `16.440.000 ₭`) + Tỷ lệ % đóng góp (VD: `48.6%`).

---

## 5. CHI TIẾT CỘT PHẢI (35%): SẢN PHẨM & CẢNH BÁO

Cột bên phải (35% chiều ngang màn hình) tập trung vào các cảnh báo vận hành cấp bách:

### 5.1. Top 5 Sản phẩm bán chạy nhất (Top 5 Best Sellers)
- **Tiêu đề component:** `5 ສິນຄ້າຂາຍດີທີ່ສຸດ (Top 5 Best Sellers)` kèm icon ngọn lửa 🔥 (`Fire`).
- **Huy hiệu:** `ມື້ນີ້/ພາບລວມ`.
- **Cấu trúc danh sách 5 món:**
  * **Huy hiệu xếp hạng (Rank Badge):**
    - Hạng 1: Badge màu vàng kim (`bg-amber-500 text-white`).
    - Hạng 2: Badge màu bạc (`bg-slate-400 text-white`).
    - Hạng 3: Badge màu đồng (`bg-amber-700 text-white`).
    - Hạng 4, 5: Badge màu xám (`bg-slate-300 text-slate-700`).
  * **Ảnh thu nhỏ (Thumbnail):** Kích thước `32x32px` hoặc `36x36px`, bo góc nhẹ `rounded-lg`.
  * **Tên sản phẩm:** Chữ in đậm, cắt gọn 1 dòng.
  * **Số lượng bán quy đổi thông minh (Smart Compound Unit Quantity):**
    - Hệ thống áp dụng hàm `formatCompoundStock` để hiển thị đúng đơn vị khách mua:  
      `ຂາຍແລ້ວ: 31 ແກັດ` hoặc `ຂາຍແລ້ວ: 43 ລັງ` hoặc `ຂາຍແລ້ວ: 61 ແພັກ`.
  * **Cột tài chính bên phải:**
    - Tổng doanh thu thu về từ sản phẩm: `16.440.000 ₭` (màu đen in đậm).
    - Lợi nhuận ròng mang lại: `+16.440.000 ₭` (màu xanh lá in đậm).

---

### 5.2. Cảnh báo Hàng sắp hết / Hết kho (Low Stock Alert Widget)
- **Tiêu đề component:** `ສິນຄ້າໃກ້ໝົດສາງ (Low Stock Alert)` kèm icon cảnh báo hình bát giác `WarningOctagon` màu đỏ.
- **Huy hiệu:** `[N] ລາຍການ` (Số mặt hàng chạm ngưỡng nguy hiểm, VD: `4 ລາຍການ`).
- **Thuật toán quét cảnh báo (Low Stock Scanning Engine):**
  * **ĐIỀU KIỆN QUÉT BẮT BUỘC:** Chỉ quét những sản phẩm có `track_stock == true`.
  * **LOẠI TRỪ 100%:** Tuyệt đối KHÔNG hiển thị các mặt hàng không đếm kho (`track_stock == false` hoặc `ບໍ່ນັບສາງ`).
  * **Ngưỡng chạm cảnh báo:**
    $$\text{product.current\_stock\_base\_units} \le \max(15, \text{carton\_multiplier})$$
    *(Sản phẩm còn bằng 0 hoặc còn ít hơn 1 thùng/hộp an toàn).*
- **Giao diện dòng cảnh báo:**
  * Tên sản phẩm + Nhóm hàng (VD: `ໝວດ: ເບຍ`).
  * Huy hiệu trạng thái bên phải: Khối màu đỏ nổi bật `ໝົດສາງ (0)` hoặc `ຍັງເຫຼືອ 2 ແພັກ`.

---

### 5.3. Danh sách Khách hàng mua nợ gần đây (Recent Credit Customers)
- **Tiêu đề component:** `ລູກຄ້າຄ້າງຊຳລະ (Recent Credit)` kèm icon đồng hồ hẹn giờ `ClockCountdown` màu cam.
- **Huy hiệu:** `[N] ບິນ` (Số lượng đơn nợ chưa tất toán trong kỳ).
- **Danh sách từng dòng công nợ:**
  * Tên khách hàng (VD: `ທ້າວ ສົມສັກ (ຮ້ານຄ້າ ຫຼວງພະບາງ)` hoặc `ລູກຄ້າທົ່ວໄປ`).
  * Mã số hóa đơn kèm ghi chú bên dưới: `ບິນ: INV-0041 • Trả trước 50%, hẹn thứ 7 trả nốt`.
  * Số tiền nợ bên phải: `1.450.000 ₭` kèm tag nhỏ màu cam: `ຕິດໜີ້`.
  * **Tương tác:** Nhấn vào dòng khách nợ sẽ chuyển nhanh sang xem chi tiết hóa đơn hoặc mở màn hình đối soát công nợ.

---

## 6. MÔ HÌNH DỮ LIỆU & CÂU LỆNH SUPABASE (DATA RETRIEVAL & AGGREGATION)

### 6.1. Câu lệnh truy vấn SQL / PostgREST tổng hợp đơn hàng theo mốc thời gian:
```dart
Future<DashboardData> fetchDashboardAnalytics({
  required DateTime startDate,
  required DateTime endDate,
}) async {
  // Lấy toàn bộ đơn hàng trong khung thời gian (loại bỏ đơn hủy voided)
  final ordersResponse = await supabase
      .from('orders')
      .select('''
        id,
        receipt_number,
        created_at,
        customer_name,
        payment_method,
        status,
        subtotal,
        discount_total,
        grand_total,
        amount_tendered,
        paid_amount,
        debt_amount,
        total_cost,
        gross_profit,
        order_items (
          id,
          product_id,
          product_name,
          unit_name,
          multiplier,
          quantity,
          unit_price,
          line_total,
          line_cost,
          line_profit,
          products (
            id,
            name,
            category_id,
            categories (id, name),
            track_stock,
            cost_per_base_unit,
            current_stock_base_units
          )
        )
      ''')
      .eq('status', 'completed')
      .gte('created_at', startDate.toIso8601String())
      .lte('created_at', endDate.toIso8601String())
      .order('created_at', ascending: false);

  return parseDashboardData(ordersResponse);
}
```

---

## 7. DANH MỤC KIỂM TRA CHẤT LƯỢNG CHO KỸ SƯ FLUTTER (QA ACCEPTANCE CRITERIA)

Trước khi bàn giao màn hình Báo cáo & Phân tích Tài chính, kỹ sư Flutter BẮT BUỘC phải đối soát và vượt qua 8 tiêu chí kiểm tra sau:

- [ ] **Tiêu chí 1 (Bộ lọc thời gian nhạy bén):** Bấm chọn giữa `ມື້ນີ້`, `7 ມື້ຜ່ານມາ`, `ເດືອນນີ້`, `ທັງໝົດ` số liệu các thẻ KPI và biểu đồ cập nhật ngay tức thì mà không lag giật.
- [ ] **Tiêu chí 2 (Khấu trừ đơn hủy 100%):** Hóa đơn đã hủy (`voided`) TUYỆT ĐỐI KHÔNG xuất hiện trong tổng `Total Revenue`, `Gross Profit`, và `Total Orders Count`.
- [ ] **Tiêu chí 3 (Đối soát dòng tiền bất biến):** Kiểm tra tính bằng nhau:
  $$\text{Total Revenue} == \text{Cash Total} + \text{Transfer Total} + \text{Credit Total}$$
- [ ] **Tiêu chí 4 (Thẻ Chuyển khoản duy nhất):** Gộp chung chuyển khoản ngân hàng và BCEL OnePay QR thành 1 thẻ duy nhất, không hiển thị thẻ trùng lặp.
- [ ] **Tiêu chí 5 (Biểu đồ cột theo giờ chính xác):** Doanh thu các đơn hàng phát sinh đúng giờ nào thì cột giờ đó dâng cao tương ứng; chạm vào cột hiển thị Tooltip đầy đủ số tiền và số đơn.
- [ ] **Tiêu chí 6 (Cơ cấu danh mục không lỗi):** Thanh Stacked Progress Bar và các thẻ danh mục cộng lại đúng bằng 100% doanh thu.
- [ ] **Tiêu chí 7 (Đơn vị quy đổi trong Top 5 Best Sellers):** Số lượng bán ra hiển thị đúng chuỗi quy đổi (VD: `31 ແກັດ`, `43 ລັງ`, `61 ແພັກ`) thông qua hàm `formatCompoundStock`.
- [ ] **Tiêu chí 8 (Lọc cảnh báo kho đúng chuẩn):** Widget cảnh báo kho chỉ hiển thị các mặt hàng có `track_stock == true` và có tồn $\le 15$ hoặc $\le$ 1 thùng; TUYỆT ĐỐI KHÔNG đưa hàng "ບໍ່ນັບສາງ" vào danh sách này.
