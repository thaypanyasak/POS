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
 * Converts Thai Baht (THB) to Lao Kip (LAK)
 * Lao Kip is atomic integer currency with zero decimal places.
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
