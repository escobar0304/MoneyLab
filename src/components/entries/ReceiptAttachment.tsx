import { useEffect, useRef, useState } from 'react';
import { saveReceipt, getReceipt, deleteReceipt, formatBytes } from '../../lib/money/receipts';
import { Button, Modal } from '../ui/primitives';

/**
 * An optional receipt on one expense.
 *
 * Entirely opt-in: an expense with no receipt costs nothing in storage and the
 * control is a single quiet link until used. The object URL is revoked on
 * unmount — a forgotten one keeps the whole blob alive in memory, which for
 * photos is exactly the leak you don't notice until the tab is sluggish.
 */
export function ReceiptAttachment({ expenseId, onChange }: { expenseId: string; onChange?: (has: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    getReceipt(expenseId)
      .then((record) => {
        if (cancelled || !record) return;
        revoked = URL.createObjectURL(record.blob);
        setUrl(revoked);
        setSize(record.size);
      })
      .catch(() => {
        /* no receipt store available — treat as "none attached" */
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [expenseId]);

  const attach = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const record = await saveReceipt(expenseId, file);
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(record.blob));
      setSize(record.size);
      onChange?.(true);
    } catch {
      setError("Couldn't save that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    await deleteReceipt(expenseId);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setSize(null);
    onChange?.(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {url ? (
        <>
          <button
            type="button"
            onClick={() => setViewing(true)}
            className="cursor-pointer rounded-md border border-hairline px-2 py-1 text-ink-secondary transition-colors hover:border-border hover:text-ink"
          >
            View receipt{size !== null && ` · ${formatBytes(size)}`}
          </button>
          <button type="button" onClick={remove} className="cursor-pointer text-ink-muted transition-colors hover:text-critical-text">
            Remove
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="cursor-pointer text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {busy ? 'Saving…' : '+ Attach receipt (optional)'}
        </button>
      )}

      {error && <span className="text-critical-text">{error}</span>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        aria-label="Receipt file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) attach(file);
        }}
      />

      {viewing && url && (
        <Modal title="Receipt" onClose={() => setViewing(false)}>
          <img src={url} alt="Receipt" className="max-h-[60vh] w-full rounded-lg object-contain" />
          <div className="mt-3 flex justify-end">
            <a href={url} download={`receipt-${expenseId}`}>
              <Button variant="secondary">Download</Button>
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
