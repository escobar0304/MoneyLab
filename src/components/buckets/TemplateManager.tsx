import { useState } from 'react';
import type { AllocationRule, AllocationTemplate } from '../../lib/types';
import { useStore, useBuckets, useTemplates } from '../../lib/store';
import { Button, Card, EmptyState, Input, Label, Modal, SectionTitle } from '../ui/primitives';
import { AllocationRuleBuilder } from './AllocationRuleBuilder';

function ruleSummary(rules: AllocationRule[], bucketName: (id: string) => string): string {
  if (rules.length === 0) return 'No rules';
  return rules
    .map((r) => {
      const label = r.mode === 'percent' ? `${r.value}%` : r.mode === 'fixed' ? `$${r.value}` : 'rest';
      return `${bucketName(r.bucketId)} ${label}`;
    })
    .join(', ');
}

export function TemplateManager() {
  const templates = useTemplates();
  const buckets = useBuckets();
  const upsertTemplate = useStore((s) => s.upsertTemplate);
  const [editing, setEditing] = useState<AllocationTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [rules, setRules] = useState<AllocationRule[]>([]);

  const bucketName = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Unknown';

  const openCreate = () => {
    setName('');
    setRules([]);
    setCreating(true);
  };
  const openEdit = (t: AllocationTemplate) => {
    setEditing(t);
    setName(t.name);
    setRules(t.rules);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };
  const save = () => {
    if (!name.trim()) return;
    upsertTemplate({ id: editing?.id, name: name.trim(), rules });
    close();
  };

  const modalOpen = creating || editing !== null;

  return (
    <Card>
      <SectionTitle action={<Button onClick={openCreate}>New template</Button>}>Allocation templates</SectionTitle>
      {templates.length === 0 ? (
        <EmptyState title="No templates yet" description="Save a split (e.g. 'Standard Paycheck Split') to reuse it on future income." />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 p-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">{t.name}</p>
                <p className="truncate text-xs text-neutral-500">{ruleSummary(t.rules, bucketName)}</p>
              </div>
              <Button variant="ghost" className="shrink-0 px-2 py-1" onClick={() => openEdit(t)}>
                Edit
              </Button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Edit template' : 'New template'} onClose={close}>
          <div className="space-y-3">
            <div>
              <Label htmlFor="template-name">Template name</Label>
              <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Paycheck Split" autoFocus />
            </div>
            <div>
              <Label>Rules (based on a sample $1,000 for preview)</Label>
              <AllocationRuleBuilder rules={rules} onChange={setRules} buckets={buckets} baseAmount={1000} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button onClick={save}>Save template</Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
