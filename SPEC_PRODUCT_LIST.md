# ĐẶC TẢ KỸ THUẬT: MÀN HÌNH DANH SÁCH SẢN PHẨM & KHO HÀNG (PRODUCT & INVENTORY LIST)
**Mã tệp:** `SPEC_PRODUCT_LIST.md`  
**Nền tảng đích:** Flutter (iOS/iPadOS & Android)  
**Database / Backend:** Supabase Cloud  
**Tài liệu tham chiếu mã nguồn gốc:**
- `web-app/src/components/ProductsView.jsx` (Giao diện chuẩn 7 cột bảng Desktop & Danh sách Card di động)
- `web-app/src/components/CategoryManagerModal.jsx` (Modal quản lý danh mục toàn diện)
- `web-app/src/components/ProductFormModal.jsx` (Modal Fullscreen tạo & sửa sản phẩm)
- `web-app/src/services/supabase.js` (Query lấy sản phẩm, giải nạp quan hệ danh mục và bảng đơn vị)
- `lib/features/backoffice/presentation/product_list_screen.dart` (Hiện trạng Flutter cần đồng bộ 100%)

---

## 1. TỔNG QUAN NGHIỆP VỤ (BUSINESS OVERVIEW)
- **Mục đích chính:** Cung cấp giao diện trung tâm để quản lý toàn bộ danh mục hàng hóa của cửa hàng tạp hóa MeiiShop, kiểm kê số lượng tồn kho đa cấp quy đổi (Thùng/Lốc/Cái), hiển thị chi phí vốn song tệ Baht (฿) và Kíp (₭), lọc nhanh ngành hàng, tìm kiếm/quét mã vạch tự động bắt sáng (scanned highlight) và điều hướng tới các modal thao tác (Thêm mới, Chỉnh sửa, Xóa, Quản lý danh mục).
- **Quyền hạn người dùng:**
  * **Thu ngân (Cashier):** Xem danh sách, tra cứu giá bán các cấp, tìm kiếm tên/barcode, kiểm tra tồn kho đa cấp.
  * **Quản lý / Chủ cửa hàng (Admin/Owner):** Toàn quyền kiểm tra giá vốn (฿ / ₭), mở Form thêm/sửa sản phẩm, xóa sản phẩm kèm đối soát an toàn, quản lý danh mục Category.

---

## 2. BỐ CỤC GIAO DIỆN & THANH ĐIỀU KHIỂN (HEADER & CONTROLS)

### 2.1. Thanh tiêu đề & Công cụ điều khiển (Top Header Toolbar)
1. **Tiêu đề phân hệ:**
   - Text in đậm: `ລາຍການສິນຄ້າ & ຕົ້ນທຶນບາດ` (kèm icon `Warehouse` màu Teal-600 `#0D9488`).
   - Dòng mô tả phụ: `ສະແດງລາຄາຕົ້ນທຶນບາດ ແລະ ກີບ ຍົກລັງ/ແກັດ (Carton), ພ້ອມຫົວໜ່ວຍຂາຍ ແລະ ສະຕັອກສິນຄ້າ`.
2. **Cụm nút hành động bên phải (Action Buttons):**
   - **Nút Quản lý Danh mục (`ໝວດໝູ່`):** Nền xám nhạt `bg-slate-100`, viền `border-slate-200`, icon `Folders` màu Teal-700. Khi bấm: Mở `CategoryManagementModal` (xem Mục 5).
   - **Nút Tải lại từ Supabase (`ໂຫຼດຄືນ`):** Nền xám nhạt `bg-slate-100`, icon `ArrowClockwise` (xoay tròn khi `isLoading == true`). Bấm vào: Tải lại dữ liệu mới nhất trực tiếp từ Supabase Cloud.
   - **Nút Thêm sản phẩm mới (`+ ເພີ່ມສິນຄ້າໃໝ່`):** Nền xanh ngọc Teal-600 (`#0D9488`), icon `Plus`, chữ trắng in đậm bo góc `rounded-xl (12px)`. Bấm vào: Mở `ProductEntryFormModal` ở chế độ Thêm mới (`productToEdit = null`).

### 2.2. Thanh tìm kiếm & Dải lọc Danh mục (Search & Filter Bar)
1. **Ô tìm kiếm đa năng (Universal Search Bar):**
   - Placeholder text: `ຄົ້ນຫາຊື່ສິນຄ້າ, ໝວດໝູ່ ຫຼື ສະແກນບາໂຄດ...`
   - Icon kính lúp `MagnifyingGlass` bên trái.
   - **Tiêu chí tìm kiếm tức thì (Real-time Filter):**
     * Tên sản phẩm (`products.name`).
     * Mã vạch chính (`products.barcode`).
     * Mã vạch của bất kỳ cấp độ nào (`product_units.barcode` - Thùng, Lốc, Lon/Cái).
     * Tên danh mục (`categories.name` hoặc `products.category`).
   - **Tích hợp nút Camera Barcode bên phải ô tìm kiếm:**
     * Icon máy quét mã vạch `Barcode`. Bấm vào mở Camera Scanner để quét nhanh mã vạch trên vỏ hộp.
     * Khi phát hiện mã vạch hoặc nhập mã vạch bấm Enter: Tự động lọc ra sản phẩm tương ứng và làm nổi bật dòng sản phẩm đó bằng hiệu ứng viền sáng xanh (`ring-2 ring-teal-500 bg-teal-50`) trong 6 giây, đồng thời phát Toast thông báo `ພົບສິນຄ້າ "[Tên món]"`.
2. **Dải nút lọc Danh mục cuộn ngang (Category Filter Chips):**
   - Nguồn dữ liệu: Đọc từ bảng `categories` trên Supabase (kèm chip mặc định đầu tiên: `ທັງໝົດ`).
   - Style: Pill bo góc `rounded-xl`.
     * Khi Active: Nền Teal-700 (`#0F766E`), chữ trắng, shadow nhẹ.
     * Khi Inactive: Nền xám nhạt (`#F1F5F9`), chữ xám đậm (`#475569`), hover chuyển nền xám đậm hơn.
   - Khi bấm vào Chip: Lọc danh sách sản phẩm tức thì.

---

## 3. ĐẶC TẢ CHI TIẾT 7 CỘT TRONG BẢNG DỮ LIỆU DESKTOP (DATA TABLE SPECIFICATION)
Khi màn hình $\ge 768px$ (iPad / Tablet ngang / Desktop), hệ thống hiển thị bảng phẳng bo góc `rounded-2xl border border-slate-200 bg-white shadow-xs` với 7 cột chuẩn:

| Cột | Tiêu đề hiển thị | Nguồn dữ liệu (Supabase) | Quy tắc định dạng & Hiển thị chi tiết |
| :---: | :--- | :--- | :--- |
| **1** | **ຮູບ & ຊື່ສິນຄ້າ**<br>*(Image & Name)* | `products.image_url`<br>`products.name`<br>`products.barcode`<br>`product_units.barcode` | - Thumbnail ảnh: `44x44px` (`w-11 h-11 rounded-xl object-cover`), viền nhẹ. Nếu không có ảnh dùng placeholder Unsplash.<br>- Tên sản phẩm: Cỡ chữ 12px, font cực đậm (`font-extrabold text-slate-900`), tối đa 2 dòng.<br>- Barcode các cấp: Dạng badge nhỏ font monospace xám `[Tên đơn vị]: [Mã vạch]` (Ví dụ: `ແກັດ: 8850123456`, `ແພັກ: 8850123457`). Nếu không có barcode từng cấp thì hiện barcode chính hoặc `ບໍ່ມີບາໂຄດ`. |
| **2** | **ໝວດໝູ່**<br>*(Category)* | `categories.name` qua Foreign Key `category_id` (hoặc `products.category`) | - Hiển thị dạng Badge bo góc `rounded-md`, nền xám nhạt `bg-slate-100`, chữ màu `text-slate-700`, font đậm `text-[11px] font-bold`.<br>- Tự động đổi tên tức thì khi người dùng sửa tên danh mục trong `CategoryManagerModal`. |
| **3** | **ຕົ້ນທຶນບາດ (฿) & ກີບ (₭)**<br>*(Cost Breakdown)* | `products.cost_thb`<br>`products.cost_lak`<br>`exchangeRate` | - **Dòng 1 (Tiền Baht):** `[cost_thb] ฿ / [Tên đơn vị Thùng]` (Ví dụ: `250 ฿ / ແກັດ`).<br>- **Dòng 2 (Tiền Kíp):** `[cost_lak] ₭ / [Tên đơn vị Thùng]` (Ví dụ: `180.000 ₭ / ແກັດ`).<br>- Font monospace sắc nét, phân tách hàng nghìn bằng dấu chấm (`.`). |
| **4** | **ລະດັບຫົວໜ່ວຍຂາຍ**<br>*(Sale Units & Prices)* | `product_units` (`tier`, `unit_name`, `retail_price`, `is_active`) | - Liệt kê toàn bộ các cấp đơn vị đang bật (`is_active == true`).<br>- Mỗi đơn vị là một chip độc lập viền xám: `[unit_name]: [retail_price] ₭` (Ví dụ: `ແກັດ: 210.000 ₭`, `ແພັກ: 55.000 ₭`, `ອັນ: 10.000 ₭`).<br>- Cấp nào tắt (`is_active == false`) TUYỆT ĐỐI không hiển thị. |
| **5** | **ສາງຄົງເຫຼືອ (Stock)**<br>*(Stock Balance)* | `products.track_stock`<br>`products.current_stock_base_units`<br>`product_units.multiplier` | **1. Khi `track_stock == false`:**<br>Hiển thị duy nhất Badge xám: `ບໍ່ນັບສາງ`. TUYỆT ĐỐI không hiện số 0 và không hiện cảnh báo hết hàng.<br>**2. Khi `track_stock == true`:**<br>- Giải mã tổng base units ra dạng đa cấp: `X [Tên Thùng] Y [Tên Lốc] Z [Tên Cái]`. Thùng nền vàng nhạt `bg-amber-50 text-amber-900`, Lốc nền xanh dương nhạt `bg-sky-50 text-sky-900`, Cái nền xám `bg-slate-100 text-slate-700`.<br>- Dòng phụ bên dưới: `ລວມທັງໝົດ: N [Tên đơn vị Lốc/Cái]`.<br>- Nếu kho = 0: Chữ đỏ in đậm `ໝົດສະຕັອກ (0)`. |
| **6** | **ອັດຕາສ່ວນ (Ratio)**<br>*(Conversion Ratio)* | Tỷ lệ quy đổi giữa các đơn vị đang bật | - Nếu có Thùng & Lốc: `1 [Thùng] = [multiplier] [Lốc]` (Ví dụ: `1 ແກັດ = 8 ແພັກ`).<br>- Nếu có thêm Cái: `1 [Lốc] = [multiplier] [Cái]` (Ví dụ: `1 ແພັກ = 6 ອັນ`).<br>- Nếu chỉ có 1 cấp đơn vị: Hiển thị `-`. |
| **7** | **ຈັດການ**<br>*(Actions)* | Thao tác dòng dữ liệu | - Cụm 2 nút icon bo góc `rounded-lg`:<br>  * Nút sửa `PencilSimple`: Mở `ProductFormModal` ở chế độ Edit (`productToEdit = p`).<br>  * Nút xóa `Trash`: Mở Popup xác nhận an toàn xóa sản phẩm. |

---

## 4. BỐ CỤC RESPONSIVE: CHUYỂN ĐỔI BẢNG SANG CARD LIST TRÊN DI ĐỘNG (< 768px)

Trên điện thoại thông minh (màn hình dọc $< 768px$), bảng dữ liệu tự động ẩn đi và chuyển sang **Danh sách Thẻ Card Dọc (`Card View`)**:

### Cấu trúc mỗi Thẻ Card trên Di động:
1. **Hàng đầu (Header Row):**
   - Bên trái: Thumbnail ảnh (`w-14 h-14 rounded-xl`) + Tên sản phẩm in đậm 2 dòng + Badge danh mục + Barcode các cấp.
   - Bên phải: Cụm 2 nút bấm thao tác chuẩn vùng chạm cảm ứng (`40x40px`): Nút Sửa (bút chì nền xám) và Nút Xóa (thùng rác nền đỏ nhạt).
2. **Hàng giữa (Cost & Ratio Row):**
   - Box nền xám `bg-slate-50` bo góc `rounded-xl border border-slate-200/70` hiển thị rõ:
     * `ຕົ້ນທຶນ (ແກັດ): [cost_thb] ฿ / [cost_lak] ₭`
     * Tỷ lệ quy đổi: `1 ແກັດ = 8 ແພັກ` (nếu có).
3. **Hàng đáy (Sale Prices & Stock Row):**
   - Danh sách giá bán các cấp: Hiển thị từng badge giá cho Thùng, Lốc, Cái.
   - Chi tiết tồn kho:
     * Nếu không theo dõi kho: Badge `ບໍ່ນັບສາງ`.
     * Nếu có theo dõi kho: Các tag số lượng đa cấp `X ແກັດ Y ແພັກ Z ອັນ` và dòng `ລວມທັງໝົດ: N ແພັກ`. Nếu hết hàng hiện chữ đỏ `ໝົດສະຕັອກ (0)`.

---

## 5. TÍCH HỢP MODAL QUẢN LÝ DANH MỤC CON (CATEGORY MANAGEMENT MODAL)
Khi người dùng bấm vào nút `ໝວດໝູ່` trên thanh công cụ hoặc cạnh dải Category Chips:
1. **Giao diện Modal (`CategoryManagerModal`):**
   - Modal bo góc lớn `rounded-3xl (24px)`, Header gradient xanh Teal to Emerald: `ຈັດການໝວດໝູ່ສິນຄ້າ (Category Manager)`.
   - Ô nhập thêm mới ở đầu: Input nhập tên danh mục tiếng Lào/Việt + nút `+ ເພີ່ມ` (tự động chống trùng lặp tên ở local state trước khi gửi query).
2. **Danh sách danh mục:**
   - Liệt kê toàn bộ danh mục từ bảng `categories`.
   - Mỗi item hiển thị: Số thứ tự + Tên danh mục + Số lượng sản phẩm đang liên kết (`{count} ສິນຄ້າ` hoặc `ຍັງບໍ່ມີສິນຄ້າ`).
   - Chế độ sửa tên tại chỗ (Inline Edit): Bấm icon bút chì `PencilSimple` chuyển sang TextField, nhấn `Enter` để lưu, `Escape` để hủy. Khi lưu thành công, hệ thống tự động **Cascade Update** đổi tên danh mục cho toàn bộ sản phẩm trên bảng danh sách mà không cần reload trang.
3. **Ràng buộc an toàn tuyệt đối khi xóa:**
   - Nếu danh mục đang có $\ge 1$ sản phẩm liên kết: Chặn xóa và hiển thị cảnh báo: *"⚠️ ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ {count} ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ."*.
   - Nếu danh mục rỗng (0 sản phẩm): Mở popup xác nhận thứ cấp in-modal `ຢືນຢັນການລຶບໝວດໝູ່` trước khi gửi lệnh DELETE lên Supabase.
4. **Đồng bộ State:** Đóng modal, tự động cập nhật lại dải Category Chips và bảng sản phẩm ngay lập tức.

---

## 6. TRUY VẤN SUPABASE VÀ CƠ CHẾ STATE MANAGEMENT TRÊN FLUTTER

### 6.1. Câu lệnh Supabase Query chuẩn (Full Joins)
```dart
// Lấy danh sách sản phẩm kèm danh mục và đơn vị bán
final response = await supabase
    .from('products')
    .select('''
      *,
      categories:category_id (id, name),
      product_units (*)
    ''')
    .order('created_at', ascending: false);
```

### 6.2. Cấu trúc StateNotifier (Riverpod)
```dart
@riverpod
class ProductCatalogNotifier extends StateNotifier<AsyncValue<List<Product>>> {
  final SupabaseClient _supabase;
  ProductCatalogNotifier(this._supabase) : super(const AsyncValue.loading()) {
    loadProducts();
  }

  Future<void> loadProducts() async {
    try {
      final data = await _supabase
          .from('products')
          .select('*, categories:category_id(id, name), product_units(*)')
          .order('created_at', ascending: false);
      final products = (data as List).map((p) => Product.fromSupabase(p)).toList();
      state = AsyncValue.data(products);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> deleteProduct(String productId) async {
    await _supabase.from('product_units').delete().eq('product_id', productId);
    await _supabase.from('products').delete().eq('id', productId);
    state = AsyncValue.data(state.value?.where((p) => p.id != productId).toList() ?? []);
  }
}
```

---

## 7. TIÊU CHÍ NGHIỆM THU KIỂM THỬ (ACCEPTANCE CRITERIA)
- [ ] **AC-PROD-01 (Đầy đủ 7 cột chuẩn):** Bảng hiển thị trên iPad/Desktop có chính xác 7 cột: `ຮູບ & ຊື່ສິນຄ້າ`, `ໝວດໝູ່`, `ຕົ້ນທຶນບາດ (฿) & ກີບ (₭)`, `ລະດັບຫົວໜ່ວຍຂາຍ`, `ສາງຄົງເຫຼືອ (Stock)`, `ອັດຕາສ່ວນ (Ratio)`, `ຈັດການ`.
- [ ] **AC-PROD-02 (Chuẩn hóa ບໍ່ນັບສາງ):** Sản phẩm có `track_stock == false` hiển thị badge xám `ບໍ່ນັບສາງ`. Tuyệt đối không hiển thị số lượng 0 và không hiện chữ đỏ `ໝົດສະຕັອກ (0)`.
- [ ] **AC-PROD-03 (Tồn kho đa cấp chính xác):** Sản phẩm có `track_stock == true` giải mã tồn kho chính xác theo từng cấp đơn vị đang bật (Ví dụ: `10 ແກັດ 2 ແພັກ` và dòng phụ `ລວມທັງໝົດ: 82 ແພັກ`).
- [ ] **AC-PROD-04 (Tìm kiếm & Quét Barcode):** Ô tìm kiếm lọc được cả tên, barcode cấp Thùng/Lốc/Cái và tên danh mục. Bắn mã vạch tự động làm nổi bật dòng sản phẩm.
- [ ] **AC-PROD-05 (Chuyển đổi Responsive):** Khi xoay ngang ($\ge 768px$), hiển thị bảng cuộn ngang mượt mà; khi xoay dọc trên điện thoại ($< 768px$), tự động chuyển sang Card List View với đầy đủ thông tin giá và tồn kho.
- [ ] **AC-PROD-06 (Quản lý Danh mục CRUD):** Bấm nút `ໝວດໝູ່` mở đúng `CategoryManagementModal`, hỗ trợ thêm mới, sửa tên inline (cascade toàn bộ sản phẩm), và chặn xóa an toàn danh mục đang có sản phẩm.
- [ ] **AC-PROD-07 (Đồng bộ Form):** Bấm nút Sửa mở `ProductFormModal` đúng sản phẩm đó; bấm `+ ເພີ່ມສິນຄ້າໃໝ່` mở Form trắng để thêm mới.
