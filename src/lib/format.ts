const currencyFormatter = new Intl.NumberFormat('pt-PT', {
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
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
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
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
