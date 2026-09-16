/**
 * Getting the ledger out when the app itself is the thing that's broken.
 *
 * Deliberately reads `localStorage` directly rather than going through the
 * store: the two places this is offered from are a crashed render and a failed
 * write, and in both the store is either the suspect or already known not to
 * be saving. Nothing here imports from the app — it is a few lines of DOM and
 * JSON so that it keeps working when the rest does not.
 *
 * The file it writes is the same shape as a normal export (a bare array of
 * events), so a rescued copy imports back through Settings like any other.
 */

const STORAGE_KEY = 'moneylab-v1';

export function rescueExport(): { ok: true; count: number } | { ok: false; reason: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, reason: 'This browser is not allowing access to stored data.' };
  }
  if (!raw) return { ok: false, reason: 'No saved ledger was found in this browser.' };

  let events: unknown;
  try {
    events = (JSON.parse(raw) as { state?: { events?: unknown } }).state?.events;
  } catch {
    // Unparseable is exactly when a raw copy is worth most — hand over the
    // bytes and let it be sorted out off the machine.
    downloadText(raw, `moneylab-rescue-raw-${stamp()}.json`);
    return { ok: true, count: 0 };
  }

  if (!Array.isArray(events)) return { ok: false, reason: 'The saved ledger is not in a shape this can read.' };

  downloadText(JSON.stringify(events, null, 2), `moneylab-rescue-${stamp()}.json`);
  return { ok: true, count: events.length };
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadText(contents: string, name: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
