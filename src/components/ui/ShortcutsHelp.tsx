import { SHORTCUTS } from '../../lib/shortcuts';
import { Modal } from './primitives';

/** Reachable with `?`, and the only place the shortcut list is presented — it
 * reads straight off the same array the handler uses, so the two cannot drift. */
export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const groups = ['Navigate', 'Act'] as const;

  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{group}</p>
            <dl className="space-y-1.5">
              {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-ink-secondary">{s.description}</dt>
                  <dd className="shrink-0">
                    <kbd className="rounded-md border border-border bg-surface-0 px-2 py-0.5 font-mono text-xs text-ink-secondary">
                      {s.keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Modal>
  );
}
