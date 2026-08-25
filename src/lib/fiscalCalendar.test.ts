import { describe, it, expect } from 'vitest';
import { fixedDeadlines, vehicleDeadlines, fiscalCalendar } from './fiscalCalendar';
import type { LedgerEvent, Vehicle } from './types';

const vehicle = (v: Partial<Vehicle> & Pick<Vehicle, 'id' | 'plate' | 'registrationDate' | 'amount'>): LedgerEvent => ({
  id: `u-${v.id}`,
  type: 'vehicle_upsert',
  timestamp: '2026-01-01T00:00:00.000Z',
  vehicle: { installments: undefined, note: undefined, ...v } as Vehicle,
});

describe('fixedDeadlines', () => {
  it('reports the IRS filing deadline for this year when it has not passed yet', () => {
    const d = fixedDeadlines(new Date('2026-03-01T00:00:00.000Z'));
    expect(d).toEqual([expect.objectContaining({ id: 'irs-modelo3', date: '2026-06-30' })]);
  });

  it('rolls over to next year once the deadline is behind us', () => {
    const d = fixedDeadlines(new Date('2026-08-01T00:00:00.000Z'));
    expect(d[0].date).toBe('2027-06-30');
  });

  it('counts the deadline day itself as still upcoming', () => {
    const d = fixedDeadlines(new Date('2026-06-30T00:00:00.000Z'));
    expect(d[0].date).toBe('2026-06-30');
  });
});

describe('vehicleDeadlines', () => {
  it('defaults to one payment, the full amount, on the registration anniversary', () => {
    const events = [vehicle({ id: 'v1', plate: '00-AA-00', registrationDate: '2018-09-12', amount: 120 })];
    const d = vehicleDeadlines(events, new Date('2026-01-01T00:00:00.000Z'));
    expect(d).toEqual([{ id: 'v1-0', label: 'IUC · 00-AA-00', date: '2026-09-12', amount: 120 }]);
  });

  it('splits into several dated installments when the vehicle has them', () => {
    const events = [
      vehicle({
        id: 'v1',
        plate: '00-AA-00',
        registrationDate: '2018-09-12',
        amount: 120,
        installments: [
          { monthDay: '09-12', amount: 60 },
          { monthDay: '01-12', amount: 60 },
        ],
      }),
    ];
    const d = vehicleDeadlines(events, new Date('2026-01-01T00:00:00.000Z'));
    expect(d).toHaveLength(2);
    expect(d.map((x) => x.date)).toEqual(['2026-09-12', '2026-01-12']);
  });

  it('lists every vehicle, not just one', () => {
    const events = [
      vehicle({ id: 'v1', plate: 'AA-00-AA', registrationDate: '2018-01-01', amount: 100 }),
      vehicle({ id: 'v2', plate: 'BB-00-BB', registrationDate: '2020-06-01', amount: 80 }),
    ];
    expect(vehicleDeadlines(events, new Date('2026-01-01T00:00:00.000Z'))).toHaveLength(2);
  });

  it('drops a removed vehicle', () => {
    const events: LedgerEvent[] = [
      vehicle({ id: 'v1', plate: 'AA-00-AA', registrationDate: '2018-01-01', amount: 100 }),
      { id: 'r', type: 'vehicle_remove', timestamp: '2026-01-02T00:00:00.000Z', vehicleId: 'v1' },
    ];
    expect(vehicleDeadlines(events, new Date('2026-01-01T00:00:00.000Z'))).toEqual([]);
  });
});

describe('fiscalCalendar', () => {
  it('merges the fixed deadlines and every vehicle into one list, in date order', () => {
    const events = [vehicle({ id: 'v1', plate: '00-AA-00', registrationDate: '2018-03-01', amount: 100 })];
    const all = fiscalCalendar(events, new Date('2026-01-01T00:00:00.000Z'));
    expect(all.map((d) => d.id)).toEqual(['v1-0', 'irs-modelo3']); // 2026-03-01 before 2026-06-30
  });
});
