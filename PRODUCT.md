# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cashiers and grocery store owners/managers in Laos operating daily retail point-of-sale systems on iPad, touchscreen POS terminals, and desktop workstations.

## Product Purpose

MeiiShop POS provides a fast, tactile, and reliable retail management system specifically built for the Lao retail environment, handling real-time checkout, multi-tier inventory (carton/pack/piece), multi-currency accounting (Lao Kip LAK and Thai Baht THB), customer debt tracking, and supplier goods receipt notes (GRN).

## Positioning

The only point-of-sale built natively for Lao retail reality: dual-currency pricing (LAK & THB), multi-tier wholesale-to-retail unit conversions, and natural Lao script typography without latency or visual clutter.

## Operating Context

Busy retail convenience and grocery store checkout counters. Operators work standing or seated under bright fluorescent retail lighting, switching between barcode scanner guns, touchscreen product picking, cash drawers, and BCEL One QR transfer confirmation screens. Every second saved at checkout directly reduces customer queue times.

## Capabilities and Constraints

- **Multi-currency Operations:** All retail billing in Lao Kip (LAK); purchase costs and wholesale conversions support both Thai Baht (THB) and Lao Kip (LAK).
- **Multi-tier Inventory:** Automated roll-overs between Cartons (ແກັດ/ລັງ), Packs (ແພັກ), and Pieces (ອັນ).
- **Offline & Low Latency:** Fast UI feedback, optimistic local state updates with Supabase backend sync.
- **Language & Script:** 100% natural Lao language interface with proper Noto Sans Lao typography, avoiding any clipped glyphs or awkward translations.
- **Anti-AI-Slop Principle:** Clean, purposeful design without superfluous gradients, excessive pill buttons, or sluggish animations.

## Brand Commitments

- **Tone:** Professional, crisp, modern retail, trustworthy, tactile.
- **Style:** Modern Flat Retail — clean surfaces, structural borders over shadows, no decorative gradients.
- **Colors:** Deep Emerald / Clean Teal (`#0D9488` / `teal-600` to `teal-700`) as primary financial brand; Amber (`#F59E0B`) for quotations and active bill modifications; Danger Crimson (`#EF4444`) for debts and out-of-stock items; Warm Slate/Zinc neutrals.
- **Typography:** Noto Sans Lao and modern clean sans-serif; tabular-nums for all monetary figures and quantities.

## Evidence on Hand

- Production web application in `web-app/` with React, Tailwind CSS, and Supabase client services.
- Flutter mobile/tablet POS implementation in `lib/`.
- Active database tables: `products`, `sale_transactions`, `purchase_orders`, `suppliers`, `categories`, `customers`.

## Product Principles

1. **High Speed, Low Friction:** Every common action (scan, tap, tender, print) requires minimal taps and zero cognitive lag.
2. **Tabular Precision:** Currency figures are always formatted with proper dot thousand separators, aligned in tabular columns.
3. **Information Density with Breathable Clarity:** Maximize screen real estate without nesting cards or cluttering the operator's view.
4. **Resilient Dual-Currency Handling:** Seamless conversion and explicit indication of Kip vs Baht on all transactions and receipts.

## Accessibility & Inclusion

- High visual contrast (WCAG AA compliant) for readability under harsh store lighting.
- Minimum 14px text labels; 16px-24px for prices, total amounts, and touch targets (minimum 44x44px touch areas for POS touchscreens).
- Legible Lao script with adequate line-height (`leading-relaxed`) to prevent vowel/tone mark clipping.
