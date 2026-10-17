# ĐẶC TẢ KỸ THUẬT: FORM THÊM & SỬA SẢN PHẨM (PRODUCT ENTRY & EDIT MODAL)
**Mã tài liệu:** `SPEC_PRODUCT_FORM_MODAL.md`  
**Vai trò:** Principal Mobile Software Architect & Flutter Technical Lead  
**Nền tảng mục tiêu:** Flutter (iOS / iPadOS & Android - Responsive POS Terminal)  
**Hệ quản trị CSDL:** Supabase (PostgreSQL + PostgREST + Storage API)  
**Phiên bản chuẩn:** v2.4 (Ultra-Detailed Engineering Spec)

---

## 1. TỔNG QUAN VỀ FORM & VÒNG ĐỜI DỮ LIỆU (LIFECYCLE & HYDRATION)

### 1.1. Hai chế độ hoạt động (Modal Operating Modes)
Modal hoặc Fullscreen Dialog thêm & sửa sản phẩm hỗ trợ 2 chế độ riêng biệt:

1. **Chế độ Thêm mới (Create Mode - `product == null`):**
   - Khởi tạo form trắng, reset toàn bộ TextEditingControllers.
   - Giá trị số khởi tạo là `0` hoặc chuỗi rỗng `""`.
   - Danh mục mặc định: Lấy bản ghi đầu tiên từ bảng `categories` (hoặc `category_id` đầu tiên khả dụng).
   - Switch theo dõi tồn kho: `trackStock = true`.
   - Cấu hình công tắc mặc định:
     * Cấp 1 (Thùng / Carton): `BẬT` (true), tên đơn vị: `ແກັດ` (hoặc `ລັງ`).
     * Cấp 2 (Lốc / Pack): `BẬT` (true), tên đơn vị: `ແພັກ`, quy đổi `packsPerCarton = 8`.
     * Cấp 3 (Lẻ / Piece): `TẮT` (false), tên đơn vị: `ອັນ`, quy đổi `piecesPerPack = 6`.

2. **Chế độ Chỉnh sửa (Edit Mode - `product != null`):**
   - Nạp dữ liệu sản phẩm đầy đủ từ Supabase dựa trên `product.id`.
   - Lấy danh sách các đơn vị bán liên kết từ bảng `product_units` (`WHERE product_id = product.id`).

---

### 1.2. QUY TẮC CHỐNG RÒ RỈ VÀ SAI LỆCH STATE KHI EDIT (ANTI-STATE LEAK ARCHITECTURE)
Để triệt tiêu 100% lỗi logic "sản phẩm sau nhận nhầm state của sản phẩm trước" hoặc "bật nhầm cấp đơn vị đã tắt":

1. **Clean Slate Reset (Dọn sạch State trước khi nạp):**
   - Trong `initState()`, `didUpdateWidget()`, hoặc Bloc/Riverpod event `LoadProductForEdit(product)`:
   - BẮT BUỘC gọi phương thức reset toàn bộ các biến State về giá trị mặc định TRƯỚC KHI nạp dữ liệu từ `product`.
   - Hủy bỏ (dispose) hoặc xóa trắng text trong toàn bộ các TextEditingControllers:
     * `nameController.clear()`, `costKipController.clear()`, `costBahtController.clear()`
     * `stockCartonController.clear()`, `stockPackController.clear()`, `stockPieceController.clear()`
     * `tier1BarcodeController.clear()`, `tier2BarcodeController.clear()`, `tier3BarcodeController.clear()`
     * `tier1PriceController.clear()`, `tier2PriceController.clear()`, `tier3PriceController.clear()`

2. **Quy tắc Map công tắc tuyệt đối theo Database (No Assumption Rule):**
   - Trạng thái BẬT/TẮT của 3 công tắc (`tier1_active`, `tier2_active`, `tier3_active`) BẮT BUỘC map chính xác 100% theo sự tồn tại của đơn vị tương ứng trong mảng `product.units` (hoặc cờ boolean `is_active` được lưu).
   - **ĐIỀU CẤM KỴ TUYỆT ĐỐI:**
     * KHÔNG ĐƯỢC tự động suy diễn bật switch Cấp 3 nếu `price > 0`.
     * KHÔNG ĐƯỢC tự động suy diễn bật switch dựa trên số lượng tồn kho `current_stock_base_units > 0`.
     * Nếu trong CSDL bản ghi Cấp 3 không tồn tại (hoặc `tier3_active == false`), công tắc Cấp 3 BẮT BUỘC PHẢI TẮT (Switch OFF).

---

## 2. CHI TIẾT CÁC PHẦN TRONG GIAO DIỆN FORM (UI SECTIONS SPECIFICATION)

### Phần 1: Thông tin cơ bản & Quản lý Danh mục (Product Profile & Category Section)

#### 1. Ảnh sản phẩm (Product Image Module)
- **Nguồn ảnh:** Hỗ trợ 3 tùy chọn:
  1. Chụp ảnh từ Camera thiết bị (`ImageSource.camera`).
  2. Chọn ảnh từ Thư viện ảnh (`ImageSource.gallery`).
  3. Nhập trực tiếp đường link ảnh Web URL (`https://...`).
- **Quy trình nén ảnh tự động (Client-side Compression):**
  * Sử dụng thư viện `flutter_image_compress` (hoặc Image package tương đương).
  * Kích thước tối đa: `maxWidth: 800px`, `maxHeight: 800px`.
  * Định dạng nén: `CompressFormat.webp` (hoặc `jpeg`), chất lượng: `quality: 75-80`.
  * Dung lượng sau nén mục tiêu: **15 KB - 40 KB** (tránh làm tràn bộ nhớ Supabase Storage).
  * Upload lên Supabase Storage bucket: `product-images`, đường dẫn: `products/{product_id}_{timestamp}.webp`.

#### 2. Tên sản phẩm (Product Name Input)
- **Label:** `ຊື່ສິນຄ້າ (Product Name) *`
- **Validation:** Bắt buộc (`validator: (val) => val.trim().isEmpty ? 'ກະລຸນາປ້ອນຊື່ສິນຄ້າ' : null`).
- **Bàn phím:** `TextInputType.text`, `textCapitalization: TextCapitalization.sentences`.

#### 3. Danh mục sản phẩm & Module CRUD Danh mục con (Category CRUD Architecture)
- **Kiến trúc quan hệ (Foreign Key Architecture):**
  * Trong bảng `products`: Cột `category_id` (UUID) liên kết khóa ngoại với bảng `categories(id)`.
  * State trong Form: Lưu trữ trực tiếp `selectedCategoryId` (UUID).
  * TUYỆT ĐỐI KHÔNG lưu tên danh mục dưới dạng chuỗi Text tĩnh độc lập.
- **Giao diện chọn:**
  * Dropdown/Combobox chọn danh mục nhanh kèm danh sách cuộn các Category Chips lấy động từ bảng `categories` theo thứ tự `display_order ASC`.
- **Nút hành động mở Modal Quản lý danh mục (`⚙️ ຈັດການໝວດໝູ່ / + ໝວດໃໝ່`):**
  * Nhấn nút mở `CategoryManagerDialog` dạng modal popup:
    1. **Thêm danh mục mới (Create):** Ô nhập tên danh mục + nút `+ ເພີ່ມ`. Khi lưu thành công vào Supabase `categories`, tự động gán `selectedCategoryId = newCategory.id` trong Product Form.
    2. **Sửa tên danh mục (Update):** Nút icon bút chì cạnh từng danh mục. Cho phép sửa tên tại chỗ (`inline edit`). Khi update bảng `categories`, toàn bộ sản phẩm liên kết tự động hiển thị tên mới mà không cần sửa từng sản phẩm.
    3. **Xóa danh mục (Delete):** Nút icon thùng rác.
       * **Bảo vệ toàn vẹn dữ liệu (Integrity Check):** Đếm số lượng sản phẩm đang có `category_id == cat.id`. Nếu `count > 0`, hiển thị Alert Dialog cảnh báo:  
         `⚠️ ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ {count} ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.`  
         Chặn không cho xóa. Chỉ cho phép xóa khi `count == 0`.

---

### Phần 2: Giá vốn mua vào (Purchase Cost) - Quy đổi 2 chiều & Làm tròn thương mại

Bao gồm 2 ô nhập số quy đổi tương tác 2 chiều mượt mà (Two-way Reactive Conversion):
1. **Giá vốn Baht Thái (ຕົ້ນທຶນ ฿ THB):**
   - Dùng để chủ quán đối soát hóa đơn nhập khẩu từ Thái Lan.
   - Khi người dùng gõ ô Baht: Tự động tính ô Tiền Kíp: `costLak = Math.round(costThb * rate)`. Tiền Kíp là số nguyên nguyên tử, không có số thập phân.
2. **Giá vốn Kíp Lào (ຕົ້ນທຶນ ₭ LAK):**
   - Bắt buộc dùng để tính toán **Giá vốn hàng bán (COGS)** và **Lợi nhuận gộp (Gross Profit)** trên Financial Dashboard.
   - Khi người dùng gõ ô Kíp: Tự động tính ô Tiền Baht: `costThb = Math.round(costLak / rate)`. Áp dụng chuẩn làm tròn số thương mại (Commercial Half-Up Rounding): $\ge 0.5$ làm tròn lên, $< 0.5$ làm tròn xuống. Loại bỏ hoàn toàn phần thập phân để tiền Baht là số nguyên tròn trịa.
3. **Cơ chế chống vòng lặp (Infinite Loop Prevention):**
   - Áp dụng cơ chế State Machine với `lastModifiedField` (`'THB'` hoặc `'LAK'`).
   - Chỉ tính toán ô còn lại khi nhận sự kiện `onChange` từ bàn phím người dùng.
   - Loại bỏ các dấu phân cách hàng nghìn bằng `parseCurrencyInput` trước khi tính toán.
   - Khi xóa trống một ô, ô còn lại cũng tự động xóa về trống/0 (không gây lỗi `NaN`).
4. **Hiển thị & Lưu Database:**
   - Cả 2 ô format phân cách hàng nghìn bằng dấu chấm (`formatDots`), font `font-mono tabular-nums`.
   - Hiển thị tỷ giá thời gian thực từ hệ thống: `1 ฿ = {formatDots(rate)} ₭`.
   - Payload gửi lên Supabase: `cost_thb` (integer), `cost_lak` (integer), và `cost_per_base_unit = Math.round(cost_lak / baseUnitMultiplier)`.

---

### Phần 3: Theo dõi tồn kho & Tồn kho ban đầu (Track Stock & Initial Inventory)

#### 1. Công tắc theo dõi tồn kho (Switch: `3. ຕິດຕາມສະຕັອກສິນຄ້າ`):
- **Trạng thái BẬT (`trackStock == true`):**
  * Hiển thị lưới nhập số lượng tồn kho ban đầu tương ứng với các cấp đang BẬT:
    - Nếu Cấp 1 BẬT: Có ô nhập `ຈຳນວນແກັດ / ລັງ` (Stock Carton).
    - Nếu Cấp 2 BẬT: Có ô nhập `ຈຳນວນແພັກ` (Stock Pack).
    - Nếu Cấp 3 BẬT: Có ô nhập `ຈຳນວນອັນ` (Stock Piece).
  * **Dòng tóm tắt tồn kho thời gian thực (Real-time Live Preview):**  
    `ສະຕັອກເລີ່ມຕົ້ນ: {cartons} ແກັດ {packs} ແພັກ {pieces} ອັນ (ລວມທັງໝົດ: {totalBaseUnits} {baseUnitName})`
- **Trạng thái TẮT (`trackStock == false`):**
  * Ẩn toàn bộ các ô nhập số lượng tồn kho.
  * Hiển thị card thông tin màu lam nhạt (Info banner):  
    `💡 ໂໝດບໍ່ນັບສະຕັອກ: ລະບົບຈະບໍ່ຕັດສະຕັອກ ແລະ ສາມາດຂາຍໄດ້ຕະຫຼອດ (ບໍ່ມີສິນຄ້າໝົດສາງ).`
- **QUY TẮC LƯU DATABASE SUPABASE (CRITICAL NOT-NULL RULE):**
  * Cột `current_stock_base_units` trong PostgreSQL có thể có ràng buộc `NOT NULL DEFAULT 0`.
  * Khi `trackStock == false`, payload gửi lên Supabase BẮT BUỘC LÀ:  
    `"current_stock_base_units": 0` và `"track_stock": false`.  
    **TUYỆT ĐỐI KHÔNG GỬI `null`** để tránh văng lỗi cơ sở dữ liệu `null value in column violates not-null constraint`.

---

### Phần 4: Cấu hình 3 Cấp đơn vị bán & Barcode riêng từng cấp (Dynamic Units & Barcodes)

Mỗi cấp đơn vị là một khối Container độc lập với công tắc BẬT/TẮT:

#### 1. Cấp 1: Bán sỉ Thùng / Bao / Lọt (Carton / Box / Sack)
- **Công tắc:** `tier1_active` (Boolean).
- **Tên đơn vị Cấp 1:** Dropdown hoặc Input: `ແກັດ`, `ລັງ`, `ເປົາ`, `ກະສອບ`, `ກ່ອງໃຫຍ່`, `ຖັງ`.
- **Ô nhập Barcode Thùng (Carton Barcode):**
  * Input field `tier1_barcode`.
  * Nút bấm bên phải: Icon máy quét camera (`CameraBarcodeScanner`). Nhấn để mở camera quét mã vạch in trên bao bì thùng carton lớn.
- **Hệ số quy đổi ra Cấp 2:**
  * Label: `1 [Tên Cấp 1] = N [Tên Cấp 2]` (ví dụ: `1 ແກັດ = 8 ແພັກ`).
  * Input số nguyên `packs_per_carton` (mặc định: `8`).
- **Giá bán Cấp 1:**
  * `tier1_retail_price` (Giá bán sỉ nguyên thùng bằng Kíp ₭).
- **Công tắc Tiền cọc vỏ thùng (Crate Deposit Switch):**
  * Dành cho mặt hàng Bia chai / Nước ngọt có vỏ két: `has_crate_deposit` (true/false).
  * Tiền cọc mỗi két: mặc định `30.000 ₭`.

#### 2. Cấp 2: Bán theo Lốc / Vỉ / Bó (Pack / Bundle)
- **Công tắc:** `tier2_active` (Boolean).
- **Tên đơn vị Cấp 2:** Dropdown hoặc Input: `ແພັກ`, `ມັດ`, `ແຕະ`, `ໂຫຼ`, `ຖົງກາງ`.
- **Ô nhập Barcode Lốc (Pack Barcode):**
  * Input field `tier2_barcode`.
  * Nút bấm bên phải: Icon máy quét camera để quét mã vạch in trên màng co lốc/vỉ.
- **Hệ số quy đổi ra Cấp 3:**
  * **ĐIỀU KIỆN HIỂN THỊ:** Chỉ hiển thị khi Cấp 3 đang BẬT (`tier3_active == true`).
  * Label: `1 [Tên Cấp 2] = N [Tên Cấp 3]` (ví dụ: `1 ແພັກ = 6 ອັນ`).
  * Input số nguyên `pieces_per_pack` (mặc định: `6`).
  * **Khi Cấp 3 TẮT:** Khối này tự động ẩn hoàn toàn.
- **Giá bán Cấp 2:**
  * `tier2_retail_price` (Giá bán lốc bằng Kíp ₭).

#### 3. Cấp 3: Bán lẻ từng Cái / Lon / Gói (Base Unit / Piece)
- **Công tắc:** `tier3_active` (Boolean).
- **Tên đơn vị Cấp 3:** Dropdown hoặc Input: `ອັນ`, `ແກ້ວ`, `ຖົງ`, `ກະປ໋ອງ`, `ຕຸກ`, `ຊອງ`, `ກ່ອງນ້ອຍ`.
- **Ô nhập Barcode Bán lẻ (Piece Barcode):**
  * Input field `tier3_barcode`.
  * Nút bấm bên phải: Icon máy quét camera để quét mã vạch in trực tiếp trên từng gói snack, lon nước, chai bia lẻ.
- **Giá bán Cấp 3:**
  * `tier3_retail_price` (Giá bán lẻ 1 cái bằng Kíp ₭).

---

## 3. THUẬT TOÁN TÍNH TOÁN MULTIPLIER & TỒN KHO CƠ SỞ (DYNAMIC MULTIPLIER SPECIFICATION)

Đây là phần quan trọng nhất để giải quyết dứt điểm lỗi "Hệ thống bị nhân dồn sai hệ số tồn kho khi Cấp 3 tắt".

### 3.1. Thuật toán xác định đơn vị cơ sở động (Dynamic Base Unit Resolution)

Toàn bộ hệ thống POS chỉ tính toán hệ số quy đổi dựa trên những cấp đơn vị đang **BẬT (`active == true`)**:

```
                       ┌─────────────────────────┐
                       │  Xác định cấp thấp nhất │
                       │       đang BẬT          │
                       └────────────┬────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
   [Cấp 3 đang BẬT]         [Cấp 3 TẮT, Cấp 2 BẬT]    [Chỉ Cấp 1 BẬT]
   ─────────────────        ──────────────────────    ───────────────
   Base Unit = Cấp 3        Base Unit = Cấp 2         Base Unit = Cấp 1
   (VD: ອັນ - Piece)         (VD: ແພັກ - Pack)          (VD: ແກັດ - Carton)
```

#### Quy tắc xác lập Multiplier cho từng trường hợp:

#### TRƯỜNG HỢP A: Cấp 3 BẬT (`tier3_active == true`)
- **Đơn vị cơ sở (`base_unit`):** Lấy theo tên Cấp 3 (VD: `ອັນ`).
- **Cấp 3 (Lẻ):**  
  * `multiplier = 1`  
  * `is_base_unit = true`
- **Cấp 2 (Lốc):**  
  * `multiplier = pieces_per_pack` (VD: 6)  
  * `is_base_unit = false`
- **Cấp 1 (Thùng):**  
  * `multiplier = packs_per_carton * pieces_per_pack` (VD: 8 * 6 = 48)  
  * `is_base_unit = false`

#### TRƯỜNG HỢP B: Cấp 3 TẮT, Cấp 2 BẬT (`tier3_active == false && tier2_active == true`)
*(Đây là trường hợp thực tế khách hàng kinh doanh sỉ Thùng & Lốc, không bán gói lẻ)*
- **Đơn vị cơ sở (`base_unit`):** Lấy theo tên Cấp 2 (VD: `ແພັກ`).
- **Cột `base_unit` trong bảng `products`:** BẮT BUỘC lưu là `"ແພັກ"`.
- **Cấp 2 (Lốc):**  
  * `multiplier = 1`  
  * `is_base_unit = true`
- **Cấp 1 (Thùng):**  
  * `multiplier = packs_per_carton` (VD: 8)  
  * `is_base_unit = false`  
  * ⚠️ **LƯU Ý CỰC KỲ QUAN TRỌNG:** TUYỆT ĐỐI KHÔNG nhân thêm với bất kỳ hệ số nào của Cấp 3.
- **Cấp 3 (Lẻ):** Không tạo bản ghi trong bảng `product_units`.

#### TRƯỜNG HỢP C: Chỉ Cấp 1 BẬT (`tier1_active == true && tier2_active == false && tier3_active == false`)
*(Ví dụ: Bia chỉ bán theo két, bao gạo 50kg chỉ bán theo bao)*
- **Đơn vị cơ sở (`base_unit`):** Lấy theo tên Cấp 1 (VD: `ແກັດ` hoặc `ເປົາ`).
- **Cột `base_unit` trong bảng `products`:** BẮT BUỘC lưu tên Cấp 1.
- **Cấp 1 (Thùng / Bao):**  
  * `multiplier = 1`  
  * `is_base_unit = true`

---

### 3.2. Thuật toán tính tổng tồn kho cơ sở khi Submit Form (Flutter Implementation)

Hàm tính toán tồn kho ban đầu chuẩn xác 100%:

```dart
/// Tính toán tổng số lượng đơn vị cơ sở (base units) để lưu vào Supabase
int calculateInitialStockBaseUnits({
  required bool trackStock,
  required bool tier1Active,
  required bool tier2Active,
  required bool tier3Active,
  required int stockCarton,
  required int stockPack,
  required int stockPiece,
  required int packsPerCarton,
  required int piecesPerPack,
}) {
  // 1. Nếu không theo dõi kho, luôn trả về 0 (tránh null)
  if (!trackStock) {
    return 0;
  }

  // 2. Trường hợp A: Cấp 3 BẬT -> Base unit là PIECE
  if (tier3Active) {
    final int packMultiplier = tier2Active ? (piecesPerPack > 0 ? piecesPerPack : 1) : 1;
    final int cartonMultiplier = tier1Active ? (packsPerCarton > 0 ? packsPerCarton * packMultiplier : packMultiplier) : 1;

    final int fromCarton = tier1Active ? (stockCarton * cartonMultiplier) : 0;
    final int fromPack = tier2Active ? (stockPack * packMultiplier) : 0;
    final int fromPiece = stockPiece;

    return fromCarton + fromPack + fromPiece;
  }

  // 3. Trường hợp B: Cấp 3 TẮT, Cấp 2 BẬT -> Base unit là PACK
  if (tier2Active) {
    final int cartonMultiplier = tier1Active ? (packsPerCarton > 0 ? packsPerCarton : 1) : 1;

    final int fromCarton = tier1Active ? (stockCarton * cartonMultiplier) : 0;
    final int fromPack = stockPack;

    // Tuyệt đối không cộng thêm stockPiece hoặc nhân hệ số Cấp 3
    return fromCarton + fromPack;
  }

  // 4. Trường hợp C: Chỉ Cấp 1 BẬT -> Base unit là CARTON
  if (tier1Active) {
    return stockCarton;
  }

  return 0;
}
```

---

## 4. CẤU TRÚC DỮ LIỆU & PAYLOAD LƯU SUPABASE (DATABASE PAYLOAD SPECIFICATION)

Quá trình lưu Form thực hiện qua 2 bước (hoặc sử dụng Supabase RPC Transaction):

### 4.1. Payload bảng chính `products`:
```json
{
  "id": "prod_uuid_here",
  "name": "Nước tăng lực RedBull 250ml",
  "category_id": "cat_uuid_drinks",
  "barcode": "tier1_barcode_hoac_null",
  "image_url": "https://supabase-storage-url.../redbull.webp",
  "base_unit": "ແພັກ",
  "track_stock": true,
  "current_stock_base_units": 64,
  "cost_per_base_unit": 30000,
  "has_crate_deposit": false,
  "crate_deposit_fee": 0,
  "updated_at": "2026-10-16T00:00:00Z"
}
```

### 4.2. Danh sách bản ghi bảng con `product_units`:

#### Ví dụ Thực tế: RedBull bán Thùng (8 lốc) & Lốc (không bán lon lẻ):
- Cấp 1 (Thùng):
  ```json
  {
    "id": "unit_uuid_1",
    "product_id": "prod_uuid_here",
    "unit_name": "ແກັດ",
    "multiplier": 8,
    "retail_price": 260000,
    "wholesale_price": 250000,
    "barcode": "885012300001",
    "is_base_unit": false
  }
  ```
- Cấp 2 (Lốc):
  ```json
  {
    "id": "unit_uuid_2",
    "product_id": "prod_uuid_here",
    "unit_name": "ແພັກ",
    "multiplier": 1,
    "retail_price": 34000,
    "wholesale_price": 33000,
    "barcode": "885012300002",
    "is_base_unit": true
  }
  ```
*(Lưu ý: Không tạo bản ghi Cấp 3 trong `product_units` khi Cấp 3 đã tắt!)*

---

## 5. THUẬT TOÁN HIỂN THỊ TỒN KHO TỔNG HỢP (COMPOUND STOCK FORMATTER)

Khi người dùng xem danh sách sản phẩm hoặc xem trước trong form, hệ thống phân tích ngược từ `current_stock_base_units`:

```dart
String formatCompoundStock({
  required int totalBaseUnits,
  required bool trackStock,
  required bool tier1Active,
  required bool tier2Active,
  required bool tier3Active,
  required String tier1UnitName,
  required String tier2UnitName,
  required String tier3UnitName,
  required int packsPerCarton,
  required int piecesPerPack,
}) {
  if (!trackStock) return 'ບໍ່ນັບສາງ';
  if (totalBaseUnits == 0) return 'ໝົດສາງ (0)';

  final bool isNeg = totalBaseUnits < 0;
  final int absTotal = totalBaseUnits.abs();
  final List<String> parts = [];

  // Case 1: Cả 3 cấp đều BẬT
  if (tier1Active && tier2Active && tier3Active) {
    final int piecesPerCarton = packsPerCarton * piecesPerPack;
    final int cartons = absTotal ~/ piecesPerCarton;
    final int rem = absTotal % piecesPerCarton;
    final int packs = rem ~/ piecesPerPack;
    final int pieces = rem % piecesPerPack;

    if (cartons > 0) parts.add('$cartons $tier1UnitName');
    if (packs > 0) parts.add('$packs $tier2UnitName');
    if (pieces > 0) parts.add('$pieces $tier3UnitName');

    final String summary = parts.isEmpty ? '0 $tier3UnitName' : parts.join(' ');
    final String full = '$summary (ລວມທັງໝົດ: $absTotal $tier3UnitName)';
    return isNeg ? '-$full' : full;
  }

  // Case 2: Cấp 1 & Cấp 2 BẬT, Cấp 3 TẮT (Pack là base unit)
  if (tier1Active && tier2Active && !tier3Active) {
    final int cartons = absTotal ~/ packsPerCarton;
    final int packs = absTotal % packsPerCarton;

    if (cartons > 0) parts.add('$cartons $tier1UnitName');
    if (packs > 0) parts.add('$packs $tier2UnitName');

    final String summary = parts.isEmpty ? '0 $tier2UnitName' : parts.join(' ');
    // Nếu có số thùng, thêm hiển thị tổng số lốc phía sau
    if (cartons > 0) {
      final String full = '$summary (ລວມທັງໝົດ: $absTotal $tier2UnitName)';
      return isNeg ? '-$full' : full;
    }
    return isNeg ? '-$summary' : summary;
  }

  // Case 3: Chỉ Cấp 1 BẬT
  if (tier1Active && !tier2Active && !tier3Active) {
    final String full = '$absTotal $tier1UnitName';
    return isNeg ? '-$full' : full;
  }

  return '$absTotal';
}
```

---

## 6. DANH MỤC KIỂM TRA CHẤT LƯỢNG CHO KỸ SƯ (ENGINEER QA CHECKLIST)

Trước khi nghiệm thu mã nguồn màn hình Product Entry Modal trên Flutter, kỹ sư BẮT BUỘC kiểm tra qua 7 kịch bản sau:

- [ ] **Test Case 1 (Lỗi nhân dồn hệ số khi Cấp 3 TẮT):**
  * Nhập sản phẩm: Cấp 1 bật (`1 ແກັດ = 8 ແພັກ`), Cấp 2 bật, Cấp 3 TẮT.
  * Nhập tồn kho: `8 ແກັດ`.
  * Kết quả hiển thị và lưu DB: **Chính xác `64 ແພັກ`**. TUYỆT ĐỐI KHÔNG thành `192 ແພັກ`!
- [ ] **Test Case 2 (Anti-State Leak khi Edit):**
  * Mở sản phẩm A có Cấp 3 bật -> Đóng form.
  * Mở sản phẩm B có Cấp 3 tắt -> Đảm bảo công tắc Cấp 3 hiển thị TẮT và các ô nhập của Cấp 3 không được lưu vào DB.
- [ ] **Test Case 3 (Track Stock False):**
  * Tắt công tắc `ຕິດຕາມສະຕັອກສິນຄ້າ`.
  * Nhấn lưu sản phẩm -> CSDL nhận `current_stock_base_units = 0` (không văng lỗi not-null).
- [ ] **Test Case 4 (Barcode riêng biệt từng cấp):**
  * Quét mã vạch thùng `8850001` vào Cấp 1, mã vạch lốc `8850002` vào Cấp 2.
  * Ra màn hình POS quét `8850001` tự động thêm 1 Thùng vào giỏ hàng; quét `8850002` tự động thêm 1 Lốc vào giỏ hàng.
- [ ] **Test Case 5 (Relational Category Update):**
  * Vào `CategoryManagerModal` đổi tên danh mục từ "Bánh kẹo" sang "Bánh kẹo nhập khẩu".
  * Mọi sản phẩm thuộc danh mục này tự động đổi tên hiển thị ngay lập tức.
- [ ] **Test Case 6 (Chặn xóa danh mục đang có sản phẩm):**
  * Bấm xóa danh mục đang có sản phẩm -> Hệ thống bật Alert cảnh báo và chặn xóa.
- [ ] **Test Case 7 (Nén ảnh):**
  * Tải ảnh chụp từ Camera 8MB -> Ảnh upload lên Supabase Storage có dung lượng dưới 50KB.
