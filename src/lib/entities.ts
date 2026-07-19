import type { LedgerEvent, Salary } from './types';

/**
 * Folds salary_upsert events plus matching income events into the current salary
 * state. lastChargedDate derives from the latest income event tagged with this
 * salary's id, not stored redundantly on upsert.
 */
export function foldSalary(events: LedgerEvent[]): Salary | undefined {
  let salary: Salary | undefined;
  for (const e of events) {
    if (e.type === 'salary_upsert') {
      salary = { ...e.salary, lastChargedDate: salary?.lastChargedDate };
    } else if (e.type === 'income' && salary && e.salaryId === salary.id) {
      salary = { ...salary, lastChargedDate: e.timestamp };
    }
  }
  return salary;
}
