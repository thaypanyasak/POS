# ĐẶC TẢ KỸ THUẬT: MÀN HÌNH LỊCH SỬ BÁN HÀNG & QUẢN LÝ HÓA ĐƠN (SALES HISTORY & INVOICE MANAGEMENT)
**Mã tài liệu:** `SPEC_SALES_HISTORY.md`  
**Vai trò:** Principal Mobile Software Architect & Flutter Technical Lead  
**Nền tảng mục tiêu:** Flutter (iOS/iPadOS, Android POS Terminals, Desktop/Web POS)  
**Hệ quản trị CSDL:** Supabase (PostgreSQL + PostgREST + RPC Transactions)  
**Phiên bản chuẩn:** v2.4 (Ultra-Detailed Construction Spec / Single Source of Truth)

---

## 1. TỔNG QUAN NGHIỆP VỤ (BUSINESS OVERVIEW)

### 1.1. Mục đích nghiệp vụ
Màn hình Lịch sử Bán hàng (`SalesHistoryView` / `InvoiceManagementScreen`) là trung tâm kiểm soát doanh thu, đối soát dòng tiền và kiểm tra tính minh bạch trong vận hành cửa hàng tạp hóa / bán buôn MeiiShop:
1. **Theo dõi chi tiết mọi giao dịch:** Tra cứu thông tin từng đơn hàng (hóa đơn bán sỉ, bán lẻ, tiền mặt, chuyển khoản, bán nợ).
2. **Kiểm tra và ngăn chặn gian lận:** Nhận diện ngay lập tức các hóa đơn bị hủy (Void), hiển thị rõ ai hủy, lý do hủy và thời điểm hủy.
3. **In lại hóa đơn (Reprint Receipt):** Khi khách hàng hoặc đối tác cần in lại hóa đơn bản in nhiệt mà không làm xáo trộn số liệu kho.
4. **Hủy hóa đơn sai sót & Tự động hoàn kho (Void & Auto-Restock):** Khi thu ngân nhập nhầm món hoặc khách trả lại toàn bộ đơn, hệ thống hỗ trợ hủy hóa đơn, tự động khấu trừ khỏi doanh thu và hoàn trả chính xác tồn kho cơ sở theo từng đơn vị quy đổi (Thùng, Lốc, Lẻ).

---

### 1.2. Phân quyền người dùng (Role-Based Access Control)
- **Thu ngân (Cashier):**
  * Xem danh sách hóa đơn phát sinh trong ca làm việc hiện tại.
  * Mở xem chi tiết hóa đơn và in lại hóa đơn (`🖨️ ເບິ່ງບິນ`).
  * Không có quyền xóa vĩnh viễn hóa đơn khỏi cơ sở dữ liệu.
  * Chỉ được hủy hóa đơn khi có sự xác nhận của Quản lý hoặc trong khoảng thời gian cho phép (ví dụ: trong vòng 15 phút sau khi tạo đơn).
- **Quản lý / Chủ cửa hàng (Admin/Owner):**
  * Toàn quyền xem, lọc theo ngày/tuần/tháng/toàn thời gian.
  * Toàn quyền Hủy hóa đơn (Void Invoice) bất kỳ thời điểm nào.
  * Quyền xóa hẳn bản ghi đơn hàng thử nghiệm (Hard Delete) kèm cảnh báo nghiêm ngặt.

---

## 2. BỐ CỤC GIAO DIỆN & THANH ĐIỀU KHIỂN (HEADER & CONTROLS)

Giao diện được thiết kế dạng bảng dữ liệu chuẩn Enterprise, hỗ trợ cuộn mượt mà trên cả iPad ngang và màn hình điện thoại:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ປະຫວັດບິນຂາຍ (42 ບິນ)                                                                [↻ ໂຫຼດຄືນ]      │
│  ຈັດການບິນຂາຍ: ເບິ່ງບິນ, ຍົກເລີກບິນ & ຄືນສະຕັອກສິນຄ້າອັດຕະໂນມັດ, ແກ້ໄຂຂໍ້ມູນ (ເຊື່ອມຕໍ່ Supabase)              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ ທັງໝົດ (42) ]  [ ສຳເລັດ (40) ]  [ ຍົກເລີກແລ້ວ (2) ]          [ ຄົ້ນຫາເລກທີບິນ ຫຼື ຊື່ລູກຄ້າ... 🔍 ] ພົບ 42 ບິນ│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  TABLE VIEW:                                                                                           │
│  ┌────────────┬─────────────────────────┬───────────────┬─────────────────────┬─────────────┬────────┐ │
│  │ ເລກທີບິນ    │ ວັນທີ & ເວລາ             │ ຊື່ລູກຄ້າ      │ ຮູບແບບຊຳລະ / ສະຖານະ  │ ຍອດຊຳລະ     │ ຈັດການ  │ │
│  ├────────────┼─────────────────────────┼───────────────┼─────────────────────┼─────────────┼────────┤ │
│  │ INV-0042   │ 10/16/2026, 12:15:30 AM │ ລູກຄ້າທົ່ວໄປ   │ [ ເງິນສົດ ]         │ 340.000 ₭   │ [🖨️][🚫]│ │
│  │ INV-0041   │ 10/16/2026, 12:10:05 AM │ ທ້າວ ສົມສັກ    │ [ ຄ້າງຊຳລະ 100% ]   │ 1.250.000 ₭ │ [🖨️][🚫]│ │
│  │ ~~INV-0040~~│ 10/15/2026, 11:42:43 PM │ ລູກຄ້າທົ່ວໄປ   │ [ 🚫 ຍົກເລີກບິນ ]   │~~680.000 ₭~~│ [🖨️][🔒]│ │
│  └────────────┴─────────────────────────┴───────────────┴─────────────────────┴─────────────┴────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Thanh tiêu đề (Header Toolbar)
- **Tiêu đề chính:** `ປະຫວັດບິນຂາຍ ({totalInvoices} ບິນ)` (Ví dụ: `ປະຫວັດບິນຂາຍ (42 ບິນ)`).
- **Mô tả nghiệp vụ:** `ຈັດການບິນຂາຍ: ເບິ່ງບິນ, ຍົກເລີກບິນ & ຄືນສະຕັອກສິນຄ້າອັດຕະໂນມັດ, ແກ້ໄຂຂໍ້ມູນ (ເຊື່ອມຕໍ່ Supabase)`.
- **Nút Làm mới dữ liệu (Refresh Button):**
  * Nút icon xoay tròn `↻ ໂຫຼດຄືນ` đặt ở góc trên cùng bên phải.
  * Hiệu ứng: Khi bấm, kích hoạt hàm nạp lại dữ liệu Supabase, hiển thị animation xoay nhẹ `animate-spin`.

---

### 2.2. Thanh công cụ lọc & tìm kiếm (Filter Tabs & Search Input)

#### 1. Dải nút lọc trạng thái hóa đơn (Status Filter Chips):
Hàng Chip ngang có hiệu ứng chuyển trạng thái mượt mà:
- **Tab 1: `ທັງໝົດ ({allCount})`:** Hiển thị toàn bộ hóa đơn (mặc định active).
- **Tab 2: `ສຳເລັດ ({completedCount})`:** Chỉ hiển thị các hóa đơn hợp lệ có `status == 'completed'`.
- **Tab 3: `ຍົກເລີກແລ້ວ ({voidedCount})`:** Chỉ hiển thị các hóa đơn đã bị hủy `status == 'voided'` (hoặc `status == 'cancelled'`).
- **Style:** Tab đang active có nền trắng nổi khối, chữ màu `teal-900`, viền `border-teal-500` hoặc nền `bg-teal-600` chữ trắng.

#### 2. Ô tìm kiếm tức thì (Search Input Field):
- **Vị trí:** Đặt bên phải dải filter tabs.
- **Placeholder:** `ຄົ້ນຫາເລກທີບິນ ຫຼື ຊື່ລູກຄ້າ... (Tìm số hóa đơn hoặc tên khách...)`.
- **Badge số lượng kết quả:** Hiển thị text nhỏ bên cạnh: `ພົບ {filteredList.length} ບິນ`.
- **Phạm vi tìm kiếm (Search Scope):**
  * Khớp chuỗi theo Mã hóa đơn (`invoice_no` hoặc `receipt_number`, ví dụ: `INV-0042`).
  * Khớp chuỗi theo Tên khách hàng (`customer_name`).
  * Khớp chuỗi theo Ghi chú công nợ (`debt_note` hoặc `notes`).

---

## 3. ĐẶC TẢ CHI TIẾT TỪNG CỘT TRONG BẢNG LỊCH SỬ (TABLE COLUMNS SPECIFICATION)

Bảng lịch sử bán hàng hiển thị toàn bộ thông tin với 6 cột dữ liệu chuẩn:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Cột 1: ເລກທີບິນ          │ Cột 2: ວັນທີ & ເວລາ │ Cột 3: ຊື່ລູກຄ້າ │ Cột 4: ຮູບແບບຊຳລະ │ Cột 5: ຍອດຊຳລະ │ Cột 6: ຈັດການ  │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cột 1: Mã hóa đơn (ເລກທີບິນ / Invoice Number)
- **Nguồn dữ liệu:** `orders.receipt_number` hoặc `orders.invoice_no`.
- **Hiển thị:**
  * **Hóa đơn bình thường:** Font monospace/sans in đậm, màu `slate-900` (Ví dụ: `INV-20261016-0042`).
  * **Hóa đơn đã bị hủy (`voided`):** Mã hóa đơn bị gạch ngang `line-through` kèm màu xám mờ `text-slate-400`, gắn Badge nhỏ màu đỏ bên cạnh: `ຍົກເລີກແລ້ວ`.

---

### Cột 2: Ngày giờ giao dịch (ວັນທີ & ເວລາ / Date & Time)
- **Nguồn dữ liệu:** `orders.created_at` và `orders.voided_at` (hoặc `cancelled_at`).
- **Hiển thị:**
  * Định dạng ngày giờ: `MM/DD/YYYY, hh:mm:ss A` (Ví dụ: `10/16/2026, 12:15:30 AM`).
  * **Nếu hóa đơn đã bị hủy:** Hiển thị thêm dòng text nhỏ màu đỏ bên dưới:  
    `(ຍົກເລີກ: 12:45:10 AM)` thể hiện chính xác thời điểm thu ngân đã thực hiện lệnh hủy đơn.

---

### Cột 3: Tên khách hàng (ຊື່ລູກຄ້າ / Customer Name)
- **Nguồn dữ liệu:** `orders.customer_name`.
- **Hiển thị:**
  * Khách lẻ thông thường: `ລູກຄ້າທົ່ວໄປ` (màu `slate-600`).
  * Khách mua nợ hoặc khách sỉ có tên: Hiển thị chữ in đậm màu xanh hoặc màu tối (Ví dụ: `ທ້າວ ສົມສັກ (ຮ້ານຄ້າ ຫຼວງພະບາງ)`).

---

### Cột 4: Hình thức thanh toán & Trạng thái (ຮູບແບບຊຳລະ / ສະຖານະ)
- **Nguồn dữ liệu:** `orders.payment_method`, `orders.status`, `orders.paid_amount`, `orders.debt_amount`.
- **Quy tắc hiển thị Badge trạng thái tương ứng:**
  1. **Tiền mặt (Cash):** Badge xanh lục ngọc nhạt: `ເງິນສົດ` (`bg-emerald-50 text-emerald-800 border-emerald-200`).
  2. **Chuyển khoản (Transfer / BCEL OnePay):** Badge xanh dương nhạt: `QR ໂອນ` (`bg-blue-50 text-blue-800 border-blue-200`).
  3. **Khách nợ 100% (Debt 100%):** Badge màu cam/đỏ: `ຄ້າງຊຳລະ 100%` (`bg-amber-50 text-amber-800 border-amber-300`).
  4. **Khách nợ một phần (Partial Debt):** Badge màu vàng cảnh báo: `ຄ້າງຊຳລະ (ຄ້າງ {formatKip(debt_amount)})`.
  5. **Đơn hàng đã bị hủy (Voided):** Badge màu đỏ viền đỏ: `🚫 ຍົກເລີກບິນ (Void)` (`bg-rose-50 text-rose-700 border-rose-300`).

---

### Cột 5: Tổng tiền thanh toán (ຍອດຊຳລະ / Total Due)
- **Nguồn dữ liệu:** `orders.grand_total` hoặc `orders.total_amount`.
- **Hiển thị:**
  * **Hóa đơn hợp lệ:** Font in đậm `font-black`, kích thước `13.5px`, màu `slate-900`, định dạng phân cách hàng nghìn (Ví dụ: `340.000 ₭`).
  * **Hóa đơn đã bị hủy:**
    - Số tiền tổng bị gạch ngang: `~~340.000 ₭~~`.
    - Dòng chữ nhỏ màu đỏ bên dưới: `(ຫັກອອກ 0 ₭)` xác nhận doanh thu này đã bị loại khỏi tổng doanh số cửa hàng.

---

### Cột 6: Thao tác quản lý (ຈັດການບິນ / Actions)
Mỗi dòng hóa đơn gồm các nút bấm hành động trực quan:
1. **Nút Xem & In lại hóa đơn (`🖨️ ເບິ່ງບິນ`):**
   - Icon máy in `Printer` màu `teal-600`.
   - Nhấn mở `ReceiptDetailModal` xem đầy đủ chi tiết các món và nút in lại hóa đơn.
2. **Nút Hủy hóa đơn (`🚫 ຍົກເລີກບິນ`):**
   - **Với hóa đơn đang hoàn tất (`completed`):** Nút màu đỏ `🚫 ຍົກເລີກບິນ`. Khi bấm sẽ hiển thị hộp thoại xác nhận hủy đơn (Confirm Dialog).
   - **Với hóa đơn đã hủy (`voided`):** Trở thành nút trạng thái vô hiệu hóa: `🚫 ຍົກເລີກແລ້ວ` (`disabled`, màu xám, không cho bấm lại).
3. **Nút Chỉnh sửa thông tin (Icon cây bút chì `PencilSimple`):**
   - Cho phép Quản lý sửa lại tên khách hàng hoặc bổ sung ghi chú công nợ.
4. **Nút Xóa vĩnh viễn (Icon thùng rác `Trash`):**
   - Dành riêng cho tài khoản Quản trị để xóa bỏ các hóa đơn test rác (bật hộp thoại xác nhận nguy hiểm `danger`).

---

## 4. LOGIC HỦY HÓA ĐƠN & TỰ ĐỘNG HOÀN TRẢ TỒN KHO (VOID & AUTO-RESTOCK LOGIC)

Đây là quy trình nghiệp vụ nhạy cảm và quan trọng nhất của phân hệ này.

### 4.1. Hộp thoại xác nhận hủy đơn (Confirm Void Dialog)
Khi người dùng bấm vào nút `🚫 ຍົກເລີກບິນ`, ứng dụng hiển thị `ConfirmDialogModal` dạng popup cảnh báo:
- **Tiêu đề:** `ຢືນຢັນການຍົກເລີກບິນ {receipt_number}? (Xác nhận hủy hóa đơn?)`
- **Nội dung cảnh báo chi tiết:**  
  `⚠️ ລະບົບຈະຫັກຍອດຂາຍອອກຈາກລາຍຮັບ ແລະ ດຶງສະຕັອກສິນຄ້າທັງໝົດໃນບິນນີ້ກັບຄືນສາງອັດຕະໂນມັດ.`  
  *(Hệ thống sẽ trừ doanh thu khỏi báo cáo và tự động hoàn trả số lượng toàn bộ sản phẩm trong hóa đơn này về lại kho hàng).*
- **Ô nhập lý do hủy:** Ô nhập `Lý do hủy đơn (ເຫດຜົນການຍົກເລີກ)` (Ví dụ: "Khách đổi ý trả hàng", "Thu ngân gõ nhầm số lượng").
- **2 Nút lựa chọn:**
  * Nút `ຍົກເລີກ (Bỏ qua / Hủy bỏ)`: Đóng dialog.
  * Nút `ຢືນຢັນຍົກເລີກບິນ (Xác nhận hủy hóa đơn)`: Màu đỏ đậm, kích hoạt quy trình RPC.

---

### 4.2. Quy trình xử lý hoàn kho đa cấp (Auto-Restock Multi-tier Units)

```dart
/// Hàm xử lý Hủy hóa đơn và Tự động hoàn trả tồn kho cơ sở vào Supabase
Future<bool> handleVoidTransaction({
  required String transactionId,
  required String voidReason,
}) async {
  try {
    // Bước 1: Lấy chi tiết đơn hàng và các dòng order_items từ Supabase
    final txData = await supabase
        .from('orders')
        .select('*, order_items(*, products(id, name, track_stock, current_stock_base_units))')
        .eq('id', transactionId)
        .single();

    if (txData == null || txData['status'] == 'voided') {
      showErrorToast('ບິນນີ້ຖືກຍົກເລີກໄປກ່ອນໜ້ານີ້ແລ້ວ!');
      return false;
    }

    final List<dynamic> items = txData['order_items'] ?? [];

    // Bước 2: Hoàn trả tồn kho cho các sản phẩm có theo dõi kho (track_stock == true)
    for (final item in items) {
      final product = item['products'];
      final bool trackStock = product != null && product['track_stock'] != false;

      if (!trackStock) {
        // Hàng không đếm kho ("ບໍ່ນັບສາງ") -> Bỏ qua không cộng kho
        continue;
      }

      final String productId = item['product_id'];
      final int quantity = item['quantity'] ?? 1;
      final int multiplier = item['multiplier'] ?? 1;

      // Số lượng đơn vị cơ sở cần cộng bù vào kho
      final int restockUnits = quantity * multiplier;
      final int currentStock = product['current_stock_base_units'] ?? 0;
      final int newStock = currentStock + restockUnits;

      // Cập nhật lại kho hàng trong bảng products
      await supabase
          .from('products')
          .update({
            'current_stock_base_units': newStock,
            'updated_at': DateTime.now().toIso8601String(),
          })
          .eq('id', productId);
    }

    // Bước 3: Cập nhật trạng thái hóa đơn thành 'voided'
    await supabase
        .from('orders')
        .update({
          'status': 'voided',
          'voided_at': DateTime.now().toIso8601String(),
          'void_reason': voidReason,
          'updated_at': DateTime.now().toIso8601String(),
        })
        .eq('id', transactionId);

    // Bước 4: Đồng bộ trạng thái vào Cache cục bộ & cập nhật UI
    showSuccessToast('ຍົກເລີກບິນ ແລະ ສົ່ງຄືນສະຕັອກສິນຄ້າສຳເລັດແລ້ວ!');
    return true;
  } catch (err) {
    showErrorToast('ເກີດຂໍ້ຜິດພາດໃນການຍົກເລີກບິນ: $err');
    return false;
  }
}
```

---

### 4.3. Bảng ví dụ thực tế quy trình Hoàn kho khi Hủy đơn:
Giả sử hóa đơn `INV-0042` gồm:
1. `8 ແກັດ` Nước tăng lực (hệ số quy đổi: 1 Thùng = 8 Lốc, Cấp 3 tắt -> Base unit là Lốc).
2. `2 ອັນ` Bánh mì ngọt (hệ số quy đổi: 1 Cái = 1 đơn vị cơ sở).
3. `5 bao` Đá lạnh (`track_stock = false` - ບໍ່ນັບສາງ).

**Khi bấm Hủy hóa đơn `INV-0042`:**
- **Nước tăng lực:** Hệ thống tính $\text{restock} = 8 \times 8 = 64\text{ Lốc}$. Kho tự động cộng thêm $+64$ vào `current_stock_base_units`.
- **Bánh mì ngọt:** Hệ thống tính $\text{restock} = 2 \times 1 = 2\text{ Cái}$. Kho tự động cộng thêm $+2$.
- **Đá lạnh:** Vì `track_stock == false`, hệ thống **bỏ qua không cộng kho**.

---

## 5. MODAL XEM CHI TIẾT & IN LẠI HÓA ĐƠN (INVOICE DETAIL & REPRINT MODAL)

Khi người dùng bấm vào nút `🖨️ ເບິ່ງບິນ` trong Lịch sử bán hàng hoặc hoàn tất thanh toán ở màn hình POS, ứng dụng hiển thị `ReceiptModal` mô phỏng hóa đơn in nhiệt cuộn 80mm hoặc 58mm:

### 5.1. Bố cục phiếu in nhiệt chuẩn mới (Updated Thermal Receipt Layout Specification)

#### 1. Phần Đầu (Receipt Header):
- **Tên cửa hàng & Tiêu đề:**
  * `ຮ້ານຄ້າ ໄມ້ຄຳ (MeiiShop POS)`
  * Địa chỉ & Số điện thoại cửa hàng.
  * Banner tiêu đề: `ໃບບິນຮັບເງິນ / RECEIPT`.
- **Phần thông tin giao dịch (Metadata Info - Gọn gàng 2 dòng đối xứng):**
  * **Dòng 1:** `ຜູ້ຂາຍ: [Tên nhân viên]` (Căn trái)  +  `ລູກຄ້າ: [Tên khách hàng]` (Căn phải).
  * **Dòng 2:** `ວັນທີ: [Ngày giờ]` (Căn trái)  +  `ຊຳລະ: [Phương thức thanh toán: ເງິນສົດ / QR ໂອນ / ຕິດໜີ້]` (Căn phải).
  * *(Lưu ý: Không đặt số hóa đơn `ເລກທີ` ở đầu bill để tránh trùng lặp, vì mã hóa đơn cùng Barcode đã được in rõ nét ở chân bill).*

#### 2. Bảng danh sách hàng hóa (Item Table - 4 Cột trên 1 dòng duy nhất):
Bố cục tỷ lệ 4 cột chuẩn máy in nhiệt POS:
- **Cột 1 (`40%` - Căn trái):** `ຊື່ລາຍການ` (Tên món kèm đơn vị quy cách trong ngoặc, ví dụ: `ເບຍລາວ ໃຫຍ່ (ແກັດ)` hoặc `ເຂົ້າໜົມ Lay (ແພັກ)`).
- **Cột 2 (`15%` - Căn giữa):** `ຈຳນວນ` (Định dạng có chữ `x`, ví dụ: `3x`, `1x`).
- **Cột 3 (`20%` - Căn phải):** `ລາຄາ` (Đơn giá quy đổi có dấu chấm ngăn cách, ví dụ: `260.000`).
- **Cột 4 (`25%` - Căn phải):** `ລວມ (₭)` (Thành tiền dòng in đậm nhẹ font mono, ví dụ: `780.000`).

*(Trường hợp khách mua két bia/chai két mà không có vỏ két đổi)*:
- Ngay dưới món đó, chèn một dòng thụt lề:
  `↳ ບໍ່ມີລັງປ່ຽນ          2x      30.000     +60.000`

#### 3. Khối tổng kết thanh toán (Totals Summary):
- **`ລວມເງິນສິນຄ້າ (Subtotal)`:** Chỉ tính thuần tiền giá trị sản phẩm (Ví dụ: `780.000 ₭`).
- **`ຄ່າມັດຈຳລັງ (Crate Deposit)`:** Phụ thu tiền cọc két/vỏ chai (Ví dụ: `+60.000 ₭`).
- **`ສ່ວນຫຼຸດ (Discount)`:** Nếu có chiết khấu/giảm giá (Ví dụ: `-0 ₭`).
- **`ຍອດຊຳລະສຸດທິ (Total Due)`:** Tổng cộng thực tế khách phải trả:
  $$\text{ຍອດຊຳລະສຸດທິ} = \text{ລວມເງິນສິນຄ້າ (780.000)} + \text{ຄ່າມັດຈຳລັງ (60.000)} = \mathbf{840.000\ ₭}$$
- *(Nếu là đơn mua nợ)*: Hiển thị hộp nợ:
  * `ຈ່າຍແລ້ວ / ຈ່າຍກ່ອນ (Paid):`
  * `ຍອດຄ້າງຊຳລະ (Debt Balance):`
  * `ໝາຍເຫດ nợ:`

#### 4. Khối quét mã QR chuyển khoản / trả nợ (Frameless & Minimal QR):
- Hiển thị khi thanh toán qua Chuyển khoản (Transfer / OnePay) hoặc đơn Bán nợ còn số dư:
  * Mã QR kích thước `128px (w-32 h-32)` căn giữa, không viền hộp xám, không có chữ tiêu đề thừa.
  * Phía dưới mã QR là số tiền cần chuyển in đậm font mono: `ຍອດໂອນ: [Số tiền] ₭`.
  * Không in thừa số tài khoản và chữ MeiiShop để giữ hóa đơn tối giản.

#### 5. Chân hóa đơn & Barcode:
- Ô chữ ký: `ຜູ້ຮັບເຄື່ອງ (Customer)` và `ພະນັກງານຂາຍ (Cashier)`.
- Thanh mã vạch Barcode máy in nhiệt mô phỏng kèm mã số hóa đơn: `INV-20261016-0042`.
- Lời cảm ơn: `ຂໍຂອບໃຈລູກຄ້າທີ່ມາອຸດໜູນ! ໂອກາດໜ້າເຊີນໃໝ່ເດີ`.

### 5.2. Chức năng In lại hóa đơn (Reprint Execution)
- Nút bấm: `🖨️ ພິມໃບບິນອີກຄັ້ງ (In lại hóa đơn)`.
- Khi bấm: Gửi tập lệnh ESC/POS qua cổng Bluetooth / USB / LAN của máy in nhiệt đã cấu hình trong ứng dụng.
- **Tính năng độc lập:** In lại hóa đơn hoàn toàn KHÔNG gọi lại API trừ kho hoặc tạo thêm đơn hàng mới.

---

## 6. MÔ HÌNH DỮ LIỆU & TRUY VẤN SUPABASE (SUPABASE SCHEMA & QUERIES)

### 6.1. Truy vấn nạp danh sách lịch sử bán hàng đầy đủ quan hệ:
```dart
Future<List<Order>> fetchSalesHistoryFromSupabase() async {
  final response = await supabase
      .from('orders')
      .select('''
        id,
        receipt_number,
        created_at,
        customer_name,
        cashier_name,
        payment_method,
        status,
        voided_at,
        void_reason,
        subtotal,
        discount_total,
        grand_total,
        amount_tendered,
        change_amount,
        paid_amount,
        debt_amount,
        debt_note,
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
          line_profit
        )
      ''')
      .order('created_at', ascending: false);

  return (response as List).map((json) => Order.fromJson(json)).toList();
}
```

---

## 7. DANH MỤC KIỂM TRA CHẤT LƯỢNG CHO KỸ SƯ FLUTTER (QA ACCEPTANCE CRITERIA)

Trước khi bàn giao màn hình Lịch sử bán hàng, kỹ sư Flutter BẮT BUỘC phải kiểm thử đạt 100% trên 7 kịch bản sau:

- [ ] **Kịch bản 1 (Hiển thị & Bộ lọc trạng thái):** Chuyển đổi qua lại giữa các tab `ທັງໝົດ`, `ສຳເລັດ`, `ຍົກເລີກແລ້ວ` lọc danh sách chính xác ngay lập tức.
- [ ] **Kịch bản 2 (Tìm kiếm linh hoạt):** Gõ mã hóa đơn (VD: `INV-0042`) hoặc gõ tên khách hàng -> Bảng lọc ra đúng đơn hàng và hiển thị số lượng kết quả tìm thấy.
- [ ] **Kịch bản 3 (Hủy hóa đơn hoàn kho đa cấp):**
  * Hóa đơn có `8 Thùng` (hệ số 8) và `2 Cái lẻ` (hệ số 1).
  * Bấm Hủy đơn -> Cơ sở dữ liệu Supabase được cộng bù chính xác $+64$ và $+2$ vào `current_stock_base_units`.
- [ ] **Kịch bản 4 (Hủy hóa đơn không đếm kho):**
  * Hóa đơn có mặt hàng `track_stock == false` ("ບໍ່ນັບສາງ").
  * Bấm Hủy đơn -> Mặt hàng này không làm thay đổi tồn kho và không phát sinh lỗi.
- [ ] **Kịch bản 5 (Vô hiệu hóa đơn đã hủy):** Sau khi hủy thành công, mã hóa đơn bị gạch ngang `line-through`, số tiền bị gạch ngang, nút Hủy chuyển sang trạng thái disabled `🚫 ຍົກເລີກແລ້ວ`.
- [ ] **Kịch bản 6 (Đồng bộ Financial Dashboard):** Khi hủy một hóa đơn 300.000 ₭, chuyển sang màn hình Dashboard xác nhận doanh thu Revenue đã được tự động giảm trừ 300.000 ₭.
- [ ] **Kịch bản 7 (In lại hóa đơn):** Bấm `🖨️ ເບິ່ງບິນ` -> Xem hóa đơn chi tiết -> Bấm `ພິມໃບບິນອີກຄັ້ງ` gửi lệnh in ra máy in nhiệt chuẩn xác mà không bị duplicate đơn.
