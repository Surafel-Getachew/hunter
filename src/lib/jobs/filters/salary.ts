import type { Salary } from "../types.ts";

/** Rough USD rates; only used to decide whether a posting clears the floor. */
const USD_PER_UNIT: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, AUD: 0.66, CHF: 1.12 };
const HOURS_PER_YEAR = 2000;

/** Highest annual USD the posting offers, or null when it can't be told. */
export function annualUsdCeiling(salary: Salary | undefined): number | null {
  if (!salary) return null;
  const top = salary.max ?? salary.min;
  const rate = USD_PER_UNIT[salary.currency.toUpperCase()];
  if (top == null || top <= 0 || rate == null) return null;
  const perYear = salary.period === "hourly" ? HOURS_PER_YEAR : salary.period === "monthly" ? 12 : 1;
  return top * perYear * rate;
}

export function formatSalary(salary: Salary | undefined): string | null {
  if (!salary || (salary.min == null && salary.max == null)) return null;
  const symbol = salary.currency.toUpperCase() === "USD" ? "$" : `${salary.currency.toUpperCase()} `;
  const fmt = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en-US"));
  const range = [salary.min, salary.max]
    .filter((n): n is number => n != null && n > 0)
    .map(fmt)
    .filter((v, i, all) => all.indexOf(v) === i)
    .join("–");
  if (!range) return null;
  const suffix = salary.period === "hourly" ? "/hr" : salary.period === "monthly" ? "/mo" : "/yr";
  return `${symbol}${range}${suffix}`;
}
