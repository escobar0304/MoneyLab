import { useState } from 'react';
import type { AllocationRule } from '../../lib/types';
import { useStore, useBuckets, useTemplates } from '../../lib/store';
import { AllocationRuleBuilder } from '../buckets/AllocationRuleBuilder';
import { Button, Card, EmptyState, Input, Label, Select, SectionTitle } from '../ui/primitives';
import { todayInputValue } from '../../lib/format';

function cloneRules(rules: AllocationRule[]): AllocationRule[] {
  return rules.map((r) => ({ ...r, subRules: r.subRules ? cloneRules(r.subRules) : undefined }));
}

export function IncomeEntryForm() {
  const buckets = useBuckets();
  const templates = useTemplates();
  const addIncome = useStore((s) => s.addIncome);

  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [templateId, setTemplateId] = useState('');
  const [rules, setRules] = useState<AllocationRule[]>([]);

  const activeBuckets = buckets.filter((b) => !b.archived);
  const amountNum = Number(amount) || 0;

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((t) => t.id === id);
    setRules(t ? cloneRules(t.rules) : []);
  };

  const submit = () => {
    if (amountNum <= 0 || !label.trim() || rules.length === 0) return;
    addIncome({
      amount: amountNum,
      label: label.trim(),
      rules,
      templateId: templateId || undefined,
      date: new Date(date).toISOString(),
    });
    setAmount('');
    setLabel('');
    setTemplateId('');
    setRules([]);
  };

  if (activeBuckets.length === 0) {
    return (
      <Card>
        <SectionTitle>Log income</SectionTitle>
        <EmptyState title="Create a bucket first" description="Head to the Buckets tab to set up where your money should go." />
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Log income</SectionTitle>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="income-amount">Amount</Label>
            <Input id="income-amount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2400" />
          </div>
          <div>
            <Label htmlFor="income-label">Label</Label>
            <Input id="income-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="July freelance payment" />
          </div>
          <div>
            <Label htmlFor="income-date">Date</Label>
            <Input id="income-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="income-template">Template</Label>
          <Select id="income-template" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">One-off split (no template)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Split ({amountNum > 0 ? `for ${amount}` : 'edit amount above to preview $'})</Label>
          <AllocationRuleBuilder rules={rules} onChange={setRules} buckets={activeBuckets} baseAmount={amountNum} />
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={submit} disabled={amountNum <= 0 || !label.trim() || rules.length === 0}>
            Log income &amp; allocate
          </Button>
        </div>
      </div>
    </Card>
  );
}
