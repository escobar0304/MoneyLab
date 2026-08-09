const currencyFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

export function formatMoney(amount: number): string {
  return currencyFormatter.format(amount);
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
