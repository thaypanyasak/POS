# ĐẶC TẢ KỸ THUẬT CHI TIẾT: QUẢN LÝ DANH MỤC SẢN PHẨM (CATEGORY MANAGEMENT)
**Nguồn phân tích:** 
- `web-app/src/components/CategoryManagerModal.jsx` (Modal CRUD danh mục chuyên sâu)
- `web-app/src/components/ProductsView.jsx` (Nút kích hoạt & bộ lọc danh sách kho)
- `web-app/src/components/PosScreen.jsx` (Dải Category Chips bán hàng POS)
- `web-app/src/components/ProductFormModal.jsx` (Tích hợp quản lý danh mục tại form sản phẩm)
- `web-app/src/services/supabase.js` (`createCategoryInSupabase`, `updateCategoryInSupabase`, `deleteCategoryInSupabase`)
- `web-app/src/App.jsx` (State đồng bộ tầng ứng dụng và hiệu ứng cập nhật lan truyền cascade)

**Mục tiêu áp dụng:** Triển khai Flutter & Supabase  

---

## 1. TỔNG QUAN VÀ TRÁCH NHIỆM NGHIỆP VỤ (MODULE OVERVIEW)
- **Mục đích chính:** Cung cấp giải pháp quản trị toàn diện vòng đời danh mục hàng hóa (Xem danh sách kèm thống kê số lượng sản phẩm, Thêm mới, Sửa tên và Xóa an toàn) với cơ chế đồng bộ tức thời (Instant State Propagation) trên toàn hệ thống (POS Catalog, Danh sách quản lý sản phẩm, Form thêm/sửa sản phẩm và cơ sở dữ liệu Supabase).
- **Danh sách màn hình / Modal liên quan:**
  1. `CategoryManagerModal`: Modal trung tâm thực hiện CRUD danh mục với cảnh báo xác thực an toàn.
  2. `ProductsView`: Màn hình danh sách sản phẩm & chi phí vốn quy đổi, chứa nút kích hoạt `ໝວດໝູ່`.
  3. `PosScreen`: Dải Category Chips lọc nhanh sản phẩm bán hàng tại quầy.
  4. `ProductFormModal`: Modal thêm/sửa sản phẩm, tích hợp nút gọi nhanh `ຈັດການໝວດໝູ່` hoặc tạo nhanh `+ ໝວດໃໝ່`.
- **Luồng hoạt động chính của người dùng:**
  1. Người dùng nhấn nút `ໝວດໝູ່` (hoặc `ຈັດການໝວດໝູ່`) trên thanh công cụ của màn hình danh sách sản phẩm hoặc cạnh dải lọc Category Chips.
  2. Hệ thống hiển thị modal `CategoryManagerModal` lấy danh sách danh mục hiện thời kèm đếm số lượng sản phẩm đang gắn với từng danh mục (`products.filter(p => p.category === cat.name || p.categoryId === cat.id).length`).
  3. **Thêm mới:** Nhập tên danh mục vào ô input đầu trang và nhấn `+ ເພີ່ມ` (hoặc phím Enter). Hệ thống kiểm tra trùng lặp tại local state trước khi gửi query INSERT lên Supabase.
  4. **Chỉnh sửa tên:** Nhấn icon cây bút chì `PencilSimple`. Ô hiển thị tên chuyển sang input chỉnh sửa tại chỗ (inline edit), hỗ trợ phím `Enter` (lưu) và `Escape` (hủy). Khi lưu thành công, hệ thống tự động thực hiện cập nhật cascade đổi tên danh mục cho toàn bộ sản phẩm đang sử dụng danh mục đó.
  5. **Xóa an toàn:** Nhấn icon thùng rác `Trash`. Nếu danh mục đang có $\ge 1$ sản phẩm, hệ thống chặn lại ngay lập tức và phát thông báo cảnh báo. Nếu danh mục rỗng (0 sản phẩm), mở hộp thoại xác nhận thứ cấp in-modal trước khi gửi lệnh DELETE lên Supabase.
  6. **Đóng modal:** Khi đóng modal, toàn bộ Category Chips và danh sách sản phẩm đã được đồng bộ sẵn sàng mà không cần reload trang.

---

## 2. PHÂN TÍCH KIẾN TRÚC GIAO DIỆN & WIDGET TREE (UI ANATOMY)

### 2.1. Bảng phân rã thành phần giao diện của Modal `CategoryManagerModal`
| Tên thành phần UI | Loại Component/Widget gốc | Vị trí / Bố cục | Nhãn hiển thị / Placeholder | Điều kiện hiển thị | Hành vi khi tương tác |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backdrop Backdrop Overlay** | `div` / `Stack` + `BackdropFilter` | Toàn màn hình cố định (`fixed inset-0 z-50`) | Không có | `isOpen === true` | `bg-slate-900/60 backdrop-blur-xs`. Nhấp ra ngoài không tự đóng do có `stopPropagation` trên card. |
| **Modal Container Card** | `div` / `Dialog` hoặc `Container` | Căn giữa màn hình (`max-w-lg`, `max-h-[85vh]`) | Không có | Luôn hiển thị khi modal mở | Hiệu ứng zoom in mượt mà, bo góc `rounded-3xl (24px)`, nền trắng. |
| **Header Toolbar** | `header` / `Container` | Đầu Modal Card, dải gradient Teal sang Emerald | Tiêu đề: `ຈັດການໝວດໝູ່ສິນຄ້າ (Category Manager)`<br>Phụ đề: `ເພີ່ມ, ແກ້ໄຂຊື່ ແລະ ລຶບໝວດໝູ່ໃນລະບົບ Supabase` | Luôn hiển thị | Hiển thị icon `Folders`, nền `from-teal-700 to-emerald-800`, chữ trắng. |
| **Nút Đóng Modal (Close Button)** | `button` / `IconButton` | Góc phải trên Header Toolbar | Icon `X` | Luôn hiển thị | Gọi `onClose()`. |
| **Feedback Toast Banner** | `div` / `AnimatedContainer` | Dưới Header, chiếm trọn chiều ngang | Nội dung từ `feedback.message` | `feedback !== null` | Tự biến mất sau 3.5s. Màu xanh `emerald` (thành công) hoặc đỏ `red` (thất bại). |
| **Create Bar Input Form** | `form` / `Row` bọc `TextField` + `ElevatedButton` | Dải xám nhạt (`bg-slate-50`) ngăn cách dưới Header | Placeholder: `ປ້ອນຊື່ໝວດໝູ່ໃໝ່ (e.g. ເຄື່ອງໃຊ້ໄຟຟ້າ, ເຂົ້າສານ...)` | Luôn hiển thị | Cho phép nhập text, icon `Tag` bên trái. Submit khi bấm Enter hoặc click nút `ເພີ່ມ`. Bị disabled khi đang submit. |
| **Nút Thêm (Add Button)** | `button` / `ElevatedButton` | Cạnh phải ô input tạo mới | `+ ເພີ່ມ` | Luôn hiển thị | Disabled khi `isSubmitting || !newCatName.trim()`. Nền xanh Teal-600. |
| **Tiêu đề đếm danh mục** | `div` / `Row` | Đầu danh sách scrollable | Trái: `ລາຍການໝວດໝູ່ທັງໝົດ ({count})`<br>Phải: `* ແກ້ໄຂຊື່ແລ້ວສິນຄ້າທັງໝົດຈະອັບເດດຕາມອັດຕະໂນມັດ` | Luôn hiển thị | Text nhỏ `text-xs font-extrabold text-slate-700` và chú thích màu xám `slate-400`. |
| **Empty State** | `div` / `Column` | Vùng danh sách khi không có item | Icon `Tag` (32px)<br>`ຍັງບໍ່ມີໝວດໝູ່ໃນລະບົບ`<br>`ປ້ອນຊື່ໝວດໝູ່ດ້ານເທິງເພື່ອເລີ່ມຕົ້ນສ້າງ` | `categories.length === 0` | Bo góc viền đứt đoạn `border-dashed border-slate-200`, nền xám `slate-50`. |
| **Category Item Tile** | `div` / `Container` | Danh sách cuộn dạng Column | Cột số thứ tự (Index badge) + Tên danh mục + Số lượng sản phẩm | `categories.length > 0` | Hiệu ứng chuyển đổi viền khi đang ở chế độ chỉnh sửa inline (`editingCatId === cat.id`). |
| **Category Inline Edit Field** | `input` / `TextField` | Thay thế text tên khi bấm nút sửa | Giá trị hiện thời của danh mục | `editingCatId === cat.id` | Tự động focus (`autoFocus`). Nhấn Enter gọi `handleSaveEdit(cat)`, nhấn Escape gọi `handleCancelEdit()`. |
| **Nút Lưu Sửa (Save Edit Button)** | `button` / `IconButton` | Cạnh input sửa inline | Icon `Check` | `editingCatId === cat.id` | Nền `bg-teal-600`, icon trắng. Lưu dữ liệu đã sửa. |
| **Nút Hủy Sửa (Cancel Edit Button)** | `button` / `IconButton` | Cạnh nút Lưu sửa | Icon `X` | `editingCatId === cat.id` | Nền `bg-slate-200`, icon xám. Hủy trạng thái sửa. |
| **Nút Kích Hoạt Sửa (Edit Button)** | `button` / `IconButton` | Cụm thao tác bên phải item | Icon `PencilSimple` | `editingCatId !== cat.id` | Đưa item vào chế độ sửa inline. |
| **Nút Kích Hoạt Xóa (Delete Button)** | `button` / `IconButton` | Cụm thao tác bên phải item | Icon `Trash` | `editingCatId !== cat.id` | Kiểm tra số lượng sản phẩm: nếu $> 0$ cảnh báo chặn; nếu $= 0$ mở hộp thoại xác nhận. |
| **Modal Footer** | `footer` / `Container` | Đáy Modal Card | Trái: Icon `Info` + `ບັນທຶກລົງຕາຕະລາງ categories ໃນ Supabase ໂດຍກົງ`<br>Phải: Nút `ປິດໜ້າຕ່າງ` | Luôn hiển thị | Nền `bg-slate-100/80`, border-top `border-slate-200`. Nút đóng màu xám `slate-200`. |
| **Delete Confirmation Dialog (In-Modal)** | `div` / `Stack Overlay` | Nằm đè lên trên Modal Card (`absolute inset-0 z-20`) | Tiêu đề: `ຢືນຢັນການລຶບໝວດໝູ່`<br>Nội dung: `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບໝວດໝູ່ "{cat.name}"?`<br>Nút: `ຍົກເລີກ` & `ຢືນຢັນລຶບ` | `categoryToDelete !== null` | Nền backdrop mờ `bg-slate-900/60`, hộp thoại nhỏ `max-w-sm` màu trắng, icon thùng rác đỏ `w-12 h-12 rounded-full bg-red-100 text-red-600`. |

### 2.2. Vị trí nút kích hoạt trên màn danh sách và dải lọc
1. **Trên màn hình danh sách sản phẩm (`ProductsView.jsx`):**
   - Đặt trên Header Toolbar bên cạnh nút `+ ເພີ່ມສິນຄ້າໃໝ່` và nút `ໂຫຼດຄືນ`:
   ```html
   <button onClick={onOpenCategoryManager} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200">
     <Folders size={15} weight="bold" className="text-teal-700" />
     <span>ໝວດໝູ່</span>
   </button>
   ```
2. **Cạnh dải lọc danh mục (Category Chips) trên màn POS hoặc màn danh sách:**
   - Đặt ở đầu hoặc cuối dải lướt ngang: Một nút bấm tròn/bo góc nhỏ với icon `Gear` ⚙️ hoặc `Folders` kèm nhãn `ຈັດການໝວດໝູ່`:
   ```html
   <button onClick={onOpenCategoryManager} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:text-teal-700 hover:border-teal-500 text-xs font-bold flex items-center gap-1">
     <Gear size={13} weight="bold" />
     <span>ຈັດການໝວດໝູ່</span>
   </button>
   ```

### 2.3. Quy tắc Style & Màu sắc
- **Màu chủ đạo Header & Action:** Gradient `from-teal-700 (#0F766E)` to `emerald-800 (#065F46)`.
- **Màu nhấn nút Lưu/Thêm:** `Teal-600 (#0D9488)`, hover `Teal-700 (#0F766E)`.
- **Màu cảnh báo & Xóa:** `Red-600 (#DC2626)`, nền cảnh báo `red-50 (#FEF2F2)`, viền `red-200 (#FECACA)`.
- **Màu thành công:** `Emerald-600 (#059669)`, nền `emerald-50 (#ECFDF5)`, viền `emerald-200 (#A7F3D0)`.
- **Bo góc chuẩn:** Modal card `rounded-3xl (24px)`, Input & Button `rounded-xl (12px)`, Item Tile `rounded-2xl (16px)`, Icon badge `rounded-lg (8px)`.
- **Kích thước chạm chuẩn Mobile (Touch Target):** Chiều cao tối thiểu của nút tương tác là `44px` trên màn hình nhỏ hoặc `padding: 10px 14px`.

---

## 3. PHÂN TÍCH QUẢN LÝ TRẠNG THÁI (STATE MANAGEMENT SPECIFICATION)

### 3.1. Bảng kê khai biến State trong Component `CategoryManagerModal`
| Tên biến State | Kiểu dữ liệu | Giá trị khởi tạo | Mục đích nghiệp vụ | Phạm vi ảnh hưởng |
| :--- | :--- | :--- | :--- | :--- |
| `newCatName` | `String` | `''` | Lưu giá trị người dùng nhập vào ô thêm danh mục mới | Chỉ trong phạm vi ô input và hàm `handleCreate` |
| `editingCatId` | `String \| Number \| null` | `null` | Lưu ID của danh mục đang được bật chế độ sửa tên inline | Quyết định item nào hiển thị TextField hay Text tĩnh |
| `editingCatName` | `String` | `''` | Lưu giá trị tên danh mục đang được gõ sửa | Thuộc ô input sửa inline |
| `isSubmitting` | `Boolean` | `false` | Khóa giao diện (disabled buttons & inputs) khi query Supabase đang chạy | Toàn bộ các nút Thêm, Sửa, Xóa trong Modal |
| `feedback` | `Object \| null` | `null` | Hiển thị Toast thông báo (`{ type: 'success' \| 'error', message: String }`) | Banner thông báo trên cùng của Modal |
| `categoryToDelete` | `Object \| null` | `null` | Lưu đối tượng danh mục đang được yêu cầu xóa để bật popup xác nhận | Điều khiển mở/đóng hộp thoại xác nhận thứ cấp |

### 3.2. Bảng kê khai State tại Tầng Ứng Dụng (App / Provider Level)
| Tên biến State | Kiểu dữ liệu | Khởi tạo | Mục đích nghiệp vụ | Phạm vi ảnh hưởng |
| :--- | :--- | :--- | :--- | :--- |
| `categoryManagerModalOpen` | `Boolean` | `false` | Điều khiển đóng / mở modal quản lý danh mục | Tầng Root / Screen navigation |
| `rawCategories` | `List<Category>` | `[]` | Danh sách đầy đủ object danh mục `{ id, name, sort_order }` từ bảng `categories` | Truyền vào modal và các dropdown chọn danh mục |
| `categoriesList` | `List<String>` | `[]` | Mảng chứa riêng tên danh mục dạng chuỗi (String array) | Cache vào `localStorage`, phục vụ dropdown đơn giản |
| `categories` | `List<String>` | `['ທັງໝົດ']` | Mảng danh mục hiển thị trên Category Chips (`['ທັງໝົດ', ...categoriesList]`) | Dải Category Chips POS & Danh sách sản phẩm |
| `products` | `List<Product>` | `[]` | Danh sách toàn bộ sản phẩm | Nhận cập nhật tên danh mục tự động khi danh mục được đổi tên |

### 3.3. Vòng đời dữ liệu và Đồng bộ State (Data Hydration & Cascading)
1. **Khởi tạo (Hydration):**
   - Đọc danh sách categories từ Supabase:
     ```javascript
     const { data } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
     ```
   - Cập nhật cả `rawCategories` và cache chuỗi tên vào LocalStorage `meiishop_categories_cache` để tải ngay tức khắc khi mở app.
2. **Khi Thêm Mới thành công:**
   - Dữ liệu trả về từ Supabase `newCatObj` được append trực tiếp vào state:
     ```javascript
     setRawCategories([...rawCategories, newCatObj]);
     setCategoriesList([...categoriesList, newCatObj.name]);
     ```
   - Tự động reset ô input: `setNewCatName('')`.
3. **Khi Chỉnh Sửa Tên thành công (Cascade Updates):**
   - Cập nhật item trong `rawCategories`:
     ```javascript
     setRawCategories(rawCategories.map(c => c.id === id ? { ...c, name: newName } : c));
     ```
   - Quét và cập nhật trực tiếp state `products` tại bộ nhớ để giao diện đổi tên tức thời mà không cần gọi lại API GET products:
     ```javascript
     setProducts(prev => prev.map(p => {
       if (p.categoryId === id || p.category === oldName) {
         return { ...p, category: newName, categoryId: id, categories: { id, name: newName } };
       }
       return p;
     }));
     ```
   - Nếu Form thêm sản phẩm đang chọn dở danh mục cũ (`newProdCategory === oldName`), tự động đổi sang `newName`.
4. **Khi Xóa thành công:**
   - Lọc bỏ danh mục khỏi `rawCategories` và `categoriesList`:
     ```javascript
     setRawCategories(rawCategories.filter(c => c.id !== id));
     setCategoriesList(categoriesList.filter(name => name !== categoryName));
     ```

---

## 4. LOGIC TOÁN HỌC & THUẬT TOÁN NGHIỆP VỤ (BUSINESS RULES & ALGORITHMS)

### 4.1. Thuật toán kiểm tra an toàn trước khi xóa (Safety Check Pre-deletion)
```plaintext
FUNCTION requestDelete(category)
    // 1. Đếm số lượng sản phẩm liên kết với category này
    matchedProducts = products.FILTER(p => 
        p.category == category.name OR p.categoryId == category.id
    )
    productCount = matchedProducts.LENGTH

    // 2. Chặn tuyệt đối nếu danh mục không rỗng
    IF productCount > 0 THEN
        SHOW_TOAST("error", "⚠️ ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ " + productCount + " ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.")
        RETURN
    END IF

    // 3. Nếu không có sản phẩm, kích hoạt hộp thoại xác nhận xóa
    SET categoryToDelete = category
END FUNCTION
```

### 4.2. Thuật toán kiểm tra trùng lặp tên danh mục (Duplicate Prevention)
```plaintext
FUNCTION handleCreate(newCatName)
    cleanName = TRIM(newCatName)
    IF cleanName IS EMPTY THEN RETURN

    // Kiểm tra không phân biệt hoa thường
    isDuplicate = categories.SOME(c => LOWERCASE(c.name) == LOWERCASE(cleanName))
    IF isDuplicate THEN
        SHOW_TOAST("error", "ໝວດໝູ່ \"" + cleanName + "\" ມີໃນລະບົບແລ້ວ!")
        RETURN
    END IF

    CALL API createCategoryInSupabase(cleanName, categories.LENGTH + 1)
END FUNCTION
```

### 4.3. Thuật toán sửa tên danh mục & Lan truyền dữ liệu (Update & Cascade Logic)
```plaintext
FUNCTION handleSaveEdit(category, newName)
    cleanName = TRIM(newName)
    IF cleanName IS EMPTY THEN RETURN
    
    // Nếu không thay đổi thì đóng chế độ sửa
    IF cleanName == category.name THEN
        CLOSE_EDIT_MODE()
        RETURN
    END IF

    // Gửi cập nhật lên Database
    result = CALL API updateCategoryInSupabase(category.id, cleanName, category.name)
    
    IF result.success THEN
        // Bước 1: Đổi tên danh mục trong mảng Categories
        UPDATE rawCategories WHERE id == category.id WITH name = cleanName
        
        // Bước 2: Cascade đổi tên cho toàn bộ sản phẩm đang gắn danh mục này
        FOREACH product IN products DO
            IF product.categoryId == category.id OR product.category == category.name THEN
                product.category = cleanName
                product.categoryId = category.id
            END IF
        END FOREACH
        
        SHOW_TOAST("success", "ແກ້ໄຂໝວດໝູ່ເປັນ \"" + cleanName + "\" ສຳເລັດແລ້ວ!")
        CLOSE_EDIT_MODE()
    ELSE
        SHOW_TOAST("error", result.error)
    END IF
END FUNCTION
```

---

## 5. TƯƠNG TÁC CƠ SỞ DỮ LIỆU & API (DATABASE & NETWORK OPERATIONS)

Toàn bộ thao tác cơ sở dữ liệu làm việc trực tiếp với bảng `categories` và bảng `products` trên Supabase.

### 5.1. Bảng `categories` Schema
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2. Thao tác Tạo mới (Create Category)
- **Hàm thực thi:** `createCategoryInSupabase(name, sortOrder)`
- **Query Supabase:**
  ```javascript
  const { data, error } = await supabase
    .from('categories')
    .insert([{ name: cleanName, sort_order: sortOrder }])
    .select()
    .single();
  ```
- **Payload JSON:**
  ```json
  {
    "name": "ເຄື່ອງດື່ມ",
    "sort_order": 5
  }
  ```
- **Ràng buộc:** `name` bắt buộc không được rỗng và không trùng lặp (trùng lặp sẽ trả về mã lỗi `23505` unique violation).

### 5.3. Thao tác Cập nhật (Update Category & Cascade Update)
- **Hàm thực thi:** `updateCategoryInSupabase(id, newName, oldName)`
- **Query Supabase (Bước 1 - Cập nhật bảng `categories`):**
  ```javascript
  const { data, error } = await supabase
    .from('categories')
    .update({ name: cleanName })
    .eq('id', id)
    .select()
    .single();
  ```
- **Query Supabase (Bước 2 - Cascade cập nhật bảng `products`):**
  ```javascript
  // 1. Cập nhật theo chuỗi tên cũ
  if (oldName) {
    await supabase
      .from('products')
      .update({ category: cleanName })
      .eq('category', oldName);
  }

  // 2. Cập nhật theo category_id (nếu bảng products có trường category_id)
  try {
    await supabase
      .from('products')
      .update({ category: cleanName })
      .eq('category_id', id);
  } catch (e) {
    // Graceful fallback nếu schema chưa migrate category_id
  }
  ```

### 5.4. Thao tác Xóa (Delete Category with Server-side Verification)
- **Hàm thực thi:** `deleteCategoryInSupabase(id, categoryName)`
- **Query Supabase (Bước 1 - Kiểm tra số lượng sản phẩm trên server):**
  ```javascript
  const { count: countByName } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category', categoryName);

  if (countByName && countByName > 0) {
    return {
      success: false,
      hasProducts: true,
      count: countByName,
      error: `ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ ${countByName} ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.`
    };
  }
  ```
- **Query Supabase (Bước 2 - Thực thi DELETE):**
  ```javascript
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  ```

---

## 6. HƯỚNG DẪN TRIỂN KHAI CHO FLUTTER (FLUTTER IMPLEMENTATION BLUEPRINT)

### 6.1. Cấu trúc Model Dart (`CategoryModel`)
```dart
class CategoryModel {
  final String id;
  final String name;
  final int sortOrder;

  CategoryModel({
    required this.id,
    required this.name,
    this.sortOrder = 0,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['id'] as String,
      name: json['name'] as String,
      sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'sort_order': sortOrder,
  };
}
```

### 6.2. Controller / StateNotifier (Riverpod)
```dart
class CategoryNotifier extends StateNotifier<AsyncValue<List<CategoryModel>>> {
  final SupabaseClient _supabase;
  CategoryNotifier(this._supabase) : super(const AsyncValue.loading()) {
    loadCategories();
  }

  Future<void> loadCategories() async {
    try {
      final res = await _supabase.from('categories').select().order('sort_order', ascending: true);
      final list = (res as List).map((e) => CategoryModel.fromJson(e)).toList();
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<bool> createCategory(String name) async {
    try {
      final clean = name.trim();
      final currentList = state.value ?? [];
      final res = await _supabase.from('categories').insert({
        'name': clean,
        'sort_order': currentList.length + 1,
      }).select().single();
      final newCat = CategoryModel.fromJson(res);
      state = AsyncValue.data([...currentList, newCat]);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> updateCategory(String id, String newName, String oldName) async {
    try {
      final clean = newName.trim();
      await _supabase.from('categories').update({'name': clean}).eq('id', id);
      await _supabase.from('products').update({'category': clean}).eq('category', oldName);
      
      final currentList = state.value ?? [];
      state = AsyncValue.data(currentList.map((c) => c.id == id ? CategoryModel(id: id, name: clean, sortOrder: c.sortOrder) : c).toList());
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<String?> deleteCategory(String id, String name) async {
    try {
      // 1. Kiểm tra sản phẩm
      final count = await _supabase.from('products').count(CountOption.exact).eq('category', name);
      if (count > 0) {
        return 'ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ $count ລາຍການ, ບໍ່ສາມາດລຶບໄດ້!';
      }
      // 2. Xóa
      await _supabase.from('categories').delete().eq('id', id);
      final currentList = state.value ?? [];
      state = AsyncValue.data(currentList.where((c) => c.id != id).toList());
      return null;
    } catch (e) {
      return e.toString();
    }
  }
}
```

---

## 7. DANH SÁCH KIỂM THỬ NGHIỆM THU (ACCEPTANCE CRITERIA CHECKLIST)

- [ ] **AC-01 (Mở Modal):** Bấm nút `ໝວດໝູ່` hoặc `ຈັດການໝວດໝູ່` (icon bánh răng ⚙️ hoặc folders 📁) mở đúng `CategoryManagementModal` với hiệu ứng zoom-in.
- [ ] **AC-02 (Tải danh sách):** Modal hiển thị đầy đủ danh mục từ bảng `categories` kèm số lượng sản phẩm gắn kèm (`{count} ສິນຄ້າ` hoặc `ຍັງບໍ່ມີສິນຄ້າ`).
- [ ] **AC-03 (Chống trùng khi tạo):** Khi nhập tên đã tồn tại (không phân biệt hoa/thường), hệ thống hiển thị thông báo lỗi `ໝວດໝູ່ "{name}" ມີໃນລະບົບແລ້ວ!` và không gửi query lên server.
- [ ] **AC-04 (Tạo mới thành công):** Nhập tên hợp lệ, bấm `+ ເພີ່ມ` hoặc nhấn Enter lưu thành công vào Supabase, hiển thị Toast xanh `ເພີ່ມໝວດໝູ່ "{name}" ສຳເລັດແລ້ວ!` và xóa trắng ô input.
- [ ] **AC-05 (Sửa tên inline):** Bấm icon cây bút chì chuyển tên danh mục thành TextField, hỗ trợ phím Enter để lưu và Escape để hủy.
- [ ] **AC-06 (Cascade đổi tên):** Sau khi đổi tên danh mục thành công, toàn bộ sản phẩm thuộc danh mục đó trên bảng danh sách và dropdown form tự động chuyển sang tên mới mà không cần F5 reload.
- [ ] **AC-07 (Chặn xóa danh mục có hàng):** Nếu danh mục có $\ge 1$ sản phẩm, bấm icon thùng rác sẽ hiện ngay thông báo cảnh báo lỗi `⚠️ ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ {count} ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! กະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.` và không mở popup xác nhận xóa.
- [ ] **AC-08 (Hộp thoại xác nhận xóa):** Với danh mục rỗng (0 sản phẩm), hệ thống hiển thị popup xác nhận thứ cấp in-modal `ຢືນຢັນການລຶບໝວດໝູ່`.
- [ ] **AC-09 (Đồng bộ dải lọc Category Chips):** Ngay sau khi thêm/sửa/xóa danh mục và đóng modal, dải Category Chips (`['ທັງໝົດ', ...]`) trên cả giao diện POS và danh sách lập tức phản ánh chính xác danh sách danh mục mới.
