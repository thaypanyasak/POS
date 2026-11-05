/**
 * Centralized Enterprise Currency Conversion Utilities (Accounting Compliant)
 * Strict validation: Never fall back to hardcoded rates (e.g. 690, 700, 720).
 * If rate <= 0 or amount <= 0, return 0.
 */

/**
 * Converts Lao Kip (LAK) to Thai Baht (THB)
 * Standard Commercial Half-Up Rounding.
 * Strictly returns 0 if rate <= 0 or lakAmount <= 0.
 *
 * @param {number|string} lakAmount
 * @param {number|string} exchangeRate
 * @returns {number}
 */
export const convertLakToThb = (lakAmount, exchangeRate) => {
  const lak = Number(lakAmount);
  const rate = Number(exchangeRate);
  if (isNaN(lak) || lak <= 0 || isNaN(rate) || rate <= 0) return 0;
  return Math.round(lak / rate);
};

/**
 * Chuẩn hóa đuôi số lẻ tiền Kíp Lào theo bước nhảy (mặc định 1.000 ₭)
 * Quy tắc làm tròn chuẩn bán lẻ 1.000 LAK (Lấy mốc 500 để làm tròn chẵn nghìn):
 * - Đuôi 000..499 -> kéo lùi về 000 (Ví dụ: 25.405 -> 25.000; 23.210 -> 23.000)
 * - Đuôi 500..999 -> tiến lên 1.000 tiếp theo (Ví dụ: 24.778 -> 25.000; 24.500 -> 25.000; 382.794 -> 383.000)
 *
 * @param {number|string} price
 * @param {number} step (mặc định 1000)
 * @returns {number}
 */
export const roundLakToStep = (price, step = 1000) => {
  const p = Number(price);
  if (!p || isNaN(p) || p <= 0) return 0;
  const s = Number(step) > 0 ? Number(step) : 1000;
  return Math.round(p / s) * s;
};

/**
 * Converts Thai Baht (THB) to Lao Kip (LAK) for COST valuation
 * Keeps exact Lao Kip integer without rounding to step,
 * preserving honest cost basis for inventory reporting and profit margins.
 * Strictly returns 0 if rate <= 0 or thbAmount <= 0.
 *
 * @param {number|string} thbAmount
 * @param {number|string} exchangeRate
 * @returns {number}
 */
export const convertThbToLak = (thbAmount, exchangeRate) => {
  const thb = Number(thbAmount);
  const rate = Number(exchangeRate);
  if (isNaN(thb) || thb <= 0 || isNaN(rate) || rate <= 0) return 0;
  return Math.round(thb * rate);
};

/**
 * Converts Thai Baht (THB) to Lao Kip (LAK) for RETAIL SELLING PRICE
 * Applies standard retail rounding to step (default 1000 LAK) for fair pricing and cash change.
 *
 * @param {number|string} thbAmount
 * @param {number|string} exchangeRate
 * @param {number} step
 * @returns {number}
 */
export const convertThbToLakSellingPrice = (thbAmount, exchangeRate, step = 1000) => {
  const thb = Number(thbAmount);
  const rate = Number(exchangeRate);
  if (isNaN(thb) || thb <= 0 || isNaN(rate) || rate <= 0) return 0;
  return roundLakToStep(thb * rate, step);
};
