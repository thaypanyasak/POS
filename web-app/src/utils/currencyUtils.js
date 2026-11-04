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
 * Chuẩn hóa đuôi số lẻ tiền Kíp Lào theo bước nhảy (mặc định 500 ₭)
 * Quy tắc làm tròn chuẩn bán lẻ 500 LAK:
 * - Đuôi 0..249   -> về 000 (Ví dụ: 23.210 -> 23.000)
 * - Đuôi 250..749 -> về 500 (Ví dụ: 23.323 -> 23.500; 25.542 -> 25.500)
 * - Đuôi 750..999 -> lên 1.000 tiếp theo (Ví dụ: 23.780 -> 24.000)
 *
 * @param {number|string} price
 * @param {number} step (mặc định 500)
 * @returns {number}
 */
export const roundLakToStep = (price, step = 500) => {
  const p = Number(price);
  if (!p || isNaN(p) || p <= 0) return 0;
  const s = Number(step) > 0 ? Number(step) : 500;
  return Math.round(p / s) * s;
};

/**
 * Converts Thai Baht (THB) to Lao Kip (LAK) for COST valuation
 * Keeps exact Lao Kip integer without rounding to step (500 LAK),
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
 * Applies standard retail rounding to step (default 500 LAK) for fair pricing and cash change.
 *
 * @param {number|string} thbAmount
 * @param {number|string} exchangeRate
 * @param {number} step
 * @returns {number}
 */
export const convertThbToLakSellingPrice = (thbAmount, exchangeRate, step = 500) => {
  const thb = Number(thbAmount);
  const rate = Number(exchangeRate);
  if (isNaN(thb) || thb <= 0 || isNaN(rate) || rate <= 0) return 0;
  return roundLakToStep(thb * rate, step);
};
