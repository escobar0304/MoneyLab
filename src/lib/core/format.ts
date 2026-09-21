/**
 * One locale for the whole app.
 *
 * Money was formatted pt-PT while every date was formatted en-US, so a single
 * row could read "1 234,56 €" next to "Sep 25, 2026" — two conventions for the
 * same reader, in the same line. The app is Portuguese where it is opinionated
 * at all (IRS headings, IUC dates), so that is the one it commits to.
 */
export const LOCALE = 'pt-PT';

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
});

export function formatMoney(amount: number): string {
  return currencyFormatter.format(amount);
}

/**
 * Short money for axis ticks: "3k €", "1,5k €", "500 €".
 *
 * A column of "3000,00 €" down the left of a plot is five repetitions of the
 * same information and eats ~70px of the card. Keeps pt-PT's comma decimal and
 * trailing symbol so it doesn't read as a different locale from the tooltips.
 */
export function formatMoneyCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${trimZero(abs / 1_000_000)}M €`;
  if (abs >= 1_000) return `${sign}${trimZero(abs / 1_000)}k €`;
  return `${sign}${Math.round(abs)} €`;
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '').replace('.', ',');
}

export function formatSignedMoney(amount: number): string {
  const formatted = currencyFormatter.format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : formatted;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Today as `YYYY-MM-DD` in the *local* calendar. Going via toISOString would
 * return the UTC date, which is yesterday for the first hour of every day in any
 * timezone ahead of UTC — including Lisbon on summer time. */
export function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(LOCALE, { year: 'numeric', month: 'long' });
}

/** Clock time only. A price fetched four minutes ago needs the minute, not the
 * date — and the date would be today in every case that matters. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

const numericDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `21/09/2026` — the same order the native date field uses, for readers whose
 * browser puts the month first. */
export function formatDateNumeric(iso: string): string {
  return numericDateFormatter.format(new Date(`${iso}T00:00:00`));
}

/**
 * Whether `<input type="date">` will disagree with the rest of the app about
 * which number is the day.
 *
 * The native date field is drawn by the browser in the browser's own locale,
 * and nothing in the page can change that: `lang` on the input, on an ancestor
 * or on `<html>` is ignored by Chromium — measured, not assumed. So on an en-US
 * browser the form offers `09/21/2026` while the history beside it lists
 * `17/09/2026`, and the same screen shows two date orders at once.
 *
 * Rather than replace the native control — which is the right control,
 * especially the picker a phone gives you for free — the field says what date
 * it holds whenever the two conventions differ. Comparing a day that cannot be
 * a month (the 22nd) is what makes the two orders distinguishable at all.
 */
export function browserDateOrderDiffers(): boolean {
  const sample = new Date(2026, 0, 22);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  try {
    return (
      new Intl.DateTimeFormat(undefined, options).format(sample) !==
      new Intl.DateTimeFormat(LOCALE, options).format(sample)
    );
  } catch {
    // A runtime without a usable default locale is not a reason to break a form.
    return false;
  }
}
