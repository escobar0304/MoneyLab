import type { LedgerEvent, Vehicle } from '../core/types';

/** Current vehicles, latest upsert wins, removals drop out — the same fold
 * shape as goals, debts and challenges. */
export function foldVehicles(events: LedgerEvent[]): Vehicle[] {
  const byId = new Map<string, Vehicle>();
  for (const e of events) {
    if (e.type === 'vehicle_upsert') byId.set(e.vehicle.id, { ...e.vehicle });
    else if (e.type === 'vehicle_remove') byId.delete(e.vehicleId);
  }
  return Array.from(byId.values()).sort((a, b) => a.plate.localeCompare(b.plate));
}
