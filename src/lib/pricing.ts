export const PAYG_MIN = 100;
export const PAYG_MAX = 50000;

/** Tiered per-credit INR rate: 500+ => 0.95, 1500+ => 0.90, 2500+ => 0.85, else 1.00 */
export function paygRateFor(credits: number): number {
  if (credits >= 2500) return 0.85;
  if (credits >= 1500) return 0.9;
  if (credits >= 500) return 0.95;
  return 1.0;
}

export function paygAmountPaise(credits: number): number {
  const rate = paygRateFor(credits);
  return Math.round(credits * rate * 100);
}

export function normalizeCredits(input: unknown): number | null {
  const n = typeof input === "string" ? parseInt(input, 10) : (input as number);
  if (!Number.isInteger(n)) return null;
  if (n < PAYG_MIN || n > PAYG_MAX) return null;
  return n;
}

export function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
