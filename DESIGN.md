---
name: MeiiShop POS
description: Hệ thống POS bán lẻ tạp hóa tại Lào — tối ưu thao tác chạm trên iPad/Tablet
colors:
  primary-teal: "#0D9488"
  primary-teal-hover: "#0F766E"
  primary-teal-tint: "#F0FDFA"
  accent-amber: "#F59E0B"
  accent-amber-deep: "#B45309"
  accent-amber-tint: "#FFFBEB"
  danger-crimson: "#EF4444"
  danger-crimson-deep: "#B91C1C"
  danger-crimson-tint: "#FEF2F2"
  canvas: "#F1F5F9"
  surface: "#FFFFFF"
  border: "#E2E8F0"
  ink: "#0F172A"
  ink-muted: "#475569"
typography:
  display:
    fontFamily: "Noto Sans Lao, Phetsarath OT, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.3
  headline:
    fontFamily: "Noto Sans Lao, Phetsarath OT, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  title:
    fontFamily: "Noto Sans Lao, Phetsarath OT, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans Lao, Phetsarath OT, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Noto Sans Lao, Phetsarath OT, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  money:
    fontFamily: "JetBrains Mono, Consolas, monospace, Noto Sans Lao"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-checkout:
    backgroundColor: "{colors.primary-teal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    height: "52px"
    padding: "0 20px"
  button-checkout-hover:
    backgroundColor: "{colors.primary-teal-hover}"
  button-quotation:
    backgroundColor: "{colors.accent-amber-tint}"
    textColor: "{colors.accent-amber-deep}"
    rounded: "{rounded.lg}"
    height: "52px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.danger-crimson}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    height: "44px"
  qty-stepper:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 14px"
---

# Design System: MeiiShop POS

## Overview

**Creative North Star: "Modern Touch POS"**

Tinh gọn, phẳng, sắc nét. Mỗi pixel phục vụ thao tác chạm ngón tay của thu ngân đang đứng quầy dưới đèn huỳnh quang, cầm súng quét barcode tay phải và bấm giỏ hàng tay trái. Không có gì thừa.

Giao diện sáng (light mode) duy nhất — môi trường quầy bán luôn sáng. Card trắng nổi nhẹ trên nền xám lạnh bằng viền mảnh và đổ bóng mềm. Màu sắc mang nghĩa nghiệp vụ cố định: Teal là tiền và hoàn tất, Amber là trạng thái tạm (báo giá, đang sửa đơn), Crimson là nợ và rủi ro.

**Key Characteristics:**
- Mọi nút thao tác thường xuyên ≥ 44px, nút CTA chính ≥ 52px.
- 100% tiếng Lào tự nhiên, không cắt dấu thanh, không cắt cụt chữ.
- Số tiền và số lượng luôn dùng `font-mono tabular-nums`, căn phải, có dấu chấm phân cách hàng nghìn.
- Kíp (₭) và Baht (฿) luôn tách biệt, không bao giờ gộp chung.

**Chống AI-Slop:**
- Không gradient tím/xanh (purple, violet, indigo, blue-to-cyan).
- Không viền phát sáng (glow / neon border).
- Không card lồng card vô nghĩa.
- Không hiệu ứng nảy/bounce chậm chạp (`animate-bounce`, elastic easing).

## Colors

Bảng màu tối giản, mỗi màu gắn chặt với một vai trò nghiệp vụ.

### Primary — Deep Teal
- **Teal-600** (`#0D9488` / `bg-teal-600`): nút Checkout `ຊຳລະເງິນ`, tổng tiền phải thu, trạng thái đã thanh toán, tab/chip đang chọn.
- **Teal-700** (`#0F766E` / `hover:bg-teal-700`): hover/pressed của nút Teal.
- **Teal Tint** (`#F0FDFA` / `bg-teal-50`): nền mục đang chọn, dòng giỏ hàng vừa thêm.
- **Focus ring:** `focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500`.

### Accent — Amber (Warning / Edit)
- **Amber-500** (`#F59E0B` / `bg-amber-500`): banner Đang sửa đơn `ກຳລັງແກ້ໄຂບິນ`, trạng thái Trả một phần.
- **Amber Deep** (`#B45309`): chữ trên nền Amber tint (đạt AA contrast).
- **Amber Tint** (`#FFFBEB` / `bg-amber-50`): nền nút Báo giá `ໃບບອກລາຄາ`.

### Danger — Crimson (Debt / Delete)
- **Red-500** (`#EF4444` / `bg-red-500`): số nợ còn lại `ຕິດໜີ້`, badge Hết hàng, nút xóa/hủy bill.
- **Red-700** (`#B91C1C`): chữ nợ khi đặt trên nền tint.
- **Red Tint** (`#FEF2F2` / `bg-red-50`): nền cảnh báo tồn kho thấp, dòng công nợ.

### Neutral
| Token | Hex | Tailwind | Vai trò |
|---|---|---|---|
| Canvas | `#F1F5F9` | `bg-slate-100` | Nền toàn ứng dụng |
| Surface | `#FFFFFF` | `bg-white` | Card, panel, giỏ hàng, bảng |
| Border | `#E2E8F0` | `border-slate-200` | Viền card, input, dòng bảng (1px, opacity 80%) |
| Ink | `#0F172A` | `text-slate-900` | Chữ chính |
| Ink Muted | `#475569` | `text-slate-600` | Chữ phụ, mã barcode, nhãn |

### Named Rules
**The Meaning-Bound Color Rule.** Amber chỉ dùng cho trạng thái tạm (edit/quote), Crimson chỉ dùng cho nợ, hết hàng và hành động phá hủy. Không dùng hai màu này để trang trí.

**The Currency Separation Rule.** Kíp và Baht luôn có ký hiệu riêng (₭ / ฿) và ô hiển thị riêng. Không cộng gộp hai loại tiền vào một con số.

## Typography

**UI Font:** `Noto Sans Lao`, fallback `Phetsarath OT`, rồi `system-ui, sans-serif`.
**Money / Quantity Font:** `JetBrains Mono, Consolas, monospace` + `Noto Sans Lao` cho ký hiệu tiền.

### Hierarchy
| Role | Weight | Size | Line-height | Ghi chú |
|---|---|---|---|---|
| Display (tổng tiền) | 800 | 1.75–2.25rem | 1.3 | Tổng giỏ hàng, tổng Checkout |
| Headline (tiêu đề) | 700 | 1.25rem | 1.4 | Tiêu đề màn hình, header modal |
| Title (tên SP) | 600 | 1rem | 1.5 | Tên sản phẩm, tiêu đề card |
| Body (nội dung) | 400 | 0.875rem (14px) | 1.6 | Bảng, ghi chú, mô tả |
| Label (nhãn) | 600 | 0.875rem (14px) | 1.5 | Nhãn form, nhãn nút. **Tối thiểu 14px** |
| Money (giá tiền) | 700 | 1–1.5rem | 1.4 | `font-mono tabular-nums`. **Tối thiểu 16px** |

### Named Rules
**The Mono Money Rule.** Mọi giá trị tiền tệ và số lượng hàng hóa **bắt buộc** dùng `font-mono tabular-nums` để các cột số luôn thẳng hàng. Dùng `formatKip()` / `formatThb()` / `formatDots()` với dấu chấm phân cách hàng nghìn.

**The Tone-Mark Rule.** Chữ Lào có dấu nguyên âm và dấu thanh trên/dưới (ິ ີ ຶ ື ຸ ູ ່ ້ ໊ ໋). Line-height tối thiểu 1.4; không dùng `leading-none`, `leading-tight`, hoặc `overflow-hidden` cắt chiều cao chữ Lào.

## Layout

### POS (Bán hàng): Split 65/35
- **Trái 65%** (`md:basis-[65%]`): thanh tìm kiếm/quét barcode, chip danh mục, lưới sản phẩm (2–5 cột tùy breakpoint). Mỗi thẻ: ảnh 1:1, tên tối đa 2 dòng, badge tồn kho, hàng nút đơn vị `ແກັດ / ແພັກ / ອັນ` cao ≥ 44px.
- **Phải 35%** (`md:basis-[35%]`): Sticky Cart, chiều cao bằng viewport. Header (tên khách hàng) và footer (tổng tiền + 2 nút CTA) cố định; chỉ danh sách dòng hàng cuộn.
- **Footer giỏ hàng:** `ໃບບອກລາຄາ` (Amber) và `ຊຳລະເງິນ` (Teal) đặt cạnh nhau, tỉ lệ 2:3, nút Checkout luôn lớn hơn. Cả hai cao 52px.
- **Banner sửa đơn:** khi `editingOldTransaction` khác null, banner Amber cố định trên cùng hiển thị: `ກຳລັງແກ້ໄຂບິນ: #[số bill] • ລູກຄ້າ: [ชื่อ] • ຮູບແບບຊຳລະເດີມ: [badge]`. Badge thanh toán cũ: Cash (Teal), Transfer (Slate), Debt (Crimson kèm số nợ).
- **< 768px:** lưới full-width, giỏ hàng thành bottom sheet, thanh tóm tắt tổng tiền ghim đáy.

### GRN (Nhập kho): Fullscreen 3 Cards
- Header cố định: nút quay lại, tiêu đề, nút Hủy + nút Lưu.
- Thân cuộn, max-width 1152px, 3 card trắng xếp dọc cách nhau 24px:
  1. **Nguồn hàng & người nhận:** nhà cung cấp, người nhận, ngày nhập.
  2. **Sản phẩm & số lượng:** chọn SP, nhập theo cấp `ແກັດ → ແພັກ → ອັນ`, xem trước tồn kho cộng dồn, giá vốn + giá bán.
  3. **Tổng chi phí & thanh toán:** 2 ô tổng (₭ | ฿), nút trạng thái `ຈ່າຍຄົບ / ຕິດໜີ້ / ຈ່າຍບາງສ່ວນ`, số nợ.

### Dashboard (Báo cáo)
- Header: segmented control `ມື້ນີ້ / 7 ມື້ / ເດືອນນີ້ / ສົມທຽບ 2 ເດືອນ`.
- Chế độ thường: hàng KPI → biểu đồ 12 tháng (smooth area, Teal).
- **So sánh 2 tháng: Side-by-side 50/50**, hai cột cùng cấu trúc. Cột B hiển thị badge tăng/giảm %.
- **< 1024px:** hai cột xếp chồng dọc.

### Spacing
Thang 4px: `4 / 8 / 12 / 16 / 24 / 32`. Trong nhóm 8–12px, giữa các nhóm 24px.

## Elevation & Depth

### Surface Cards
Mọi card dùng: `bg-white rounded-2xl border border-slate-200/80 shadow-sm`.
Đây là elevation duy nhất ở trạng thái nghỉ. Không thêm `shadow-md`, `shadow-lg` hoặc `shadow-xl` cho card thường.

### Hover
- Card sản phẩm: `hover:border-teal-400/50 hover:shadow-md transition-all duration-150`.
- Dòng bảng: `hover:bg-slate-50/70 transition-colors`.

### Overlay (Modal / Bottom Sheet)
- Backdrop: `bg-slate-950/60 backdrop-blur-sm`.
- Modal surface: `bg-white rounded-3xl shadow-2xl`.

### Named Rules
**The Single-Elevation Rule.** Một phần tử chỉ khai báo MỘT cách tạo depth: viền + shadow-sm (card), HOẶC shadow-2xl (modal). Không chồng cả hai ở mức cao.

## Shapes

| Phần tử | Border-radius | Tailwind |
|---|---|---|
| Card, panel | 16px | `rounded-2xl` |
| Modal | 24px | `rounded-3xl` |
| Nút, input, qty stepper | 12px | `rounded-xl` |
| Badge trạng thái | 6px | `rounded-md` |
| Badge đếm số (pill) | 9999px | `rounded-full` |

Không có viền trái/phải dày hơn 1px trên card, dòng, hoặc cảnh báo.

## Components

### Nút CTA
| Nút | Nền | Chữ | Chiều cao | Focus |
|---|---|---|---|---|
| Checkout `ຊຳລະເງິນ` | `bg-teal-600 hover:bg-teal-700` | `text-white font-extrabold` | 52px | `ring-2 ring-teal-500/20` |
| Báo giá `ໃບບອກລາຄາ` | `bg-amber-50 border border-amber-300` | `text-amber-900 font-bold` | 52px | `ring-2 ring-amber-500/20` |
| Xóa / Hủy | `bg-red-500 hover:bg-red-600` | `text-white font-bold` | 44px | `ring-2 ring-red-500/20` |
| Disabled | `bg-slate-200` | `text-slate-400` | — | không |

### Bộ tăng giảm số lượng (Qty Stepper)
- Hai nút `−` / `+`: 44×44px, `bg-slate-100 hover:bg-teal-50 rounded-xl`.
- Số ở giữa: `font-mono tabular-nums text-base font-bold`, min-width 32px, căn giữa.

### Thẻ sản phẩm (Product Card)
- `bg-white rounded-2xl border border-slate-200/80 shadow-sm`.
- Ảnh `aspect-square object-cover rounded-xl`.
- Tên: `font-extrabold text-xs line-clamp-1`.
- Hàng nút đơn vị: dải nút ngang, **không phải card con**. Nút carton: `bg-teal-600 text-white`, nút lẻ: `bg-white border`.

### Banner sửa đơn (Edit Order Banner)
- `bg-amber-500 text-white sticky top-0 z-20`.
- Nội dung: icon WarningCircle + số bill + tên khách + badge thanh toán cũ.
- Badge Cash: `bg-emerald-600 text-white rounded-full`.
- Badge Transfer: `bg-slate-600 text-white rounded-full`.
- Badge Debt: `bg-[#EF4444] text-white rounded-full` + số nợ.
- Nút Hủy: `bg-amber-600 hover:bg-amber-700 text-white rounded-lg`.

### Bảng dữ liệu (Data Table)
- Header: `sticky top-0 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider`.
- Cột tiền: `text-right font-mono tabular-nums`.
- Hover dòng: `hover:bg-slate-50/70 transition-colors`.

### Icon
- Chỉ dùng **Phosphor Icons**, weight `bold` thống nhất trong cùng một vùng.
- Không dùng emoji thay icon trong production UI.

### Motion
- Duration: 120–200ms.
- Easing: `ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`).
- Chỉ cho `transform`, `opacity`, `color`, `border-color`.
- Tôn trọng `prefers-reduced-motion`.

## Do's and Don'ts

### ✅ Do
- Giữ mọi nút chạm thường xuyên ≥ 44px (CTA chính ≥ 52px).
- Dùng `font-mono tabular-nums` cho mọi con số tiền & số lượng.
- Dùng `formatKip()` / `formatThb()` / `formatDots()` cho mọi con số.
- Ghi rõ đơn vị (₭ hoặc ฿) cạnh mọi con số tiền.
- Kiểm tra chữ Lào ở mọi breakpoint — sửa chỗ tràn hoặc cắt dấu.
- Giữ tương phản chữ ≥ 4.5:1 (WCAG AA).
- Card dùng `bg-white rounded-2xl border border-slate-200/80 shadow-sm`.

### ❌ Don't
- **Cấm gradient tím/xanh** (purple, violet, indigo, blue-to-cyan). Không gradient text.
- **Cấm viền phát sáng / glow** (`shadow-[0_0_Xpx_color]`, neon border).
- **Cấm card lồng card.** Trong card chỉ dùng divider 1px hoặc khoảng trắng.
- **Cấm hiệu ứng nảy:** không `animate-bounce`, không easing elastic/spring.
- Không dùng glassmorphism / backdrop-blur làm trang trí (chỉ cho modal overlay).
- Không giấu giá hoặc tồn kho trong tooltip chỉ hiện khi hover.
- Không dùng chữ nhỏ hơn 14px cho nhãn, nhỏ hơn 16px cho tiền.
- Không dùng `shadow-lg` / `shadow-xl` cho card thường (chỉ modal mới dùng `shadow-2xl`).
