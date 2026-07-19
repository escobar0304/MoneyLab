export type ID = string;

export type BucketKind =
  | 'category'
  | 'investment'
  | 'savings'
  | 'debt'
  | 'subscription'
  | 'unallocated';

export interface Bucket {
  id: ID;
  name: string;
  parentId: ID | null;
  kind: BucketKind;
  color?: string;
  archived?: boolean;
}

export type AllocationMode = 'percent' | 'fixed' | 'remainder';

export interface AllocationRule {
  id: ID;
  bucketId: ID;
  mode: AllocationMode;
  value: number; // percent (0-100) for 'percent', dollars for 'fixed', ignored for 'remainder'
  subRules?: AllocationRule[]; // further splits this bucket's own share
}

export interface AllocationTemplate {
  id: ID;
  name: string;
  rules: AllocationRule[];
  createdAt: string;
}

export type SubscriptionCycle = 'weekly' | 'monthly' | 'yearly';

export interface Subscription {
  id: ID;
  name: string;
  amount: number;
  cycle: SubscriptionCycle;
  startDate: string; // ISO date
  trialEndDate?: string; // ISO date
  bucketId: ID;
  lastChargedDate?: string; // ISO date, last cycle boundary already charged
  cancelled?: boolean;
}

export interface AllocationResult {
  bucketId: ID;
  amount: number;
}

export interface NetWorthEntry {
  name: string;
  category: string;
  amount: number;
}

interface LedgerEventBase {
  id: ID;
  timestamp: string; // ISO datetime
}

export interface IncomeEvent extends LedgerEventBase {
  type: 'income';
  amount: number;
  label: string;
  templateId?: ID;
  allocations: AllocationResult[];
}

export interface ExpenseEvent extends LedgerEventBase {
  type: 'expense';
  amount: number;
  bucketId: ID;
  category: string;
  subcategory?: string;
  note?: string;
}

export interface SubscriptionChargeEvent extends LedgerEventBase {
  type: 'subscription_charge';
  subscriptionId: ID;
  amount: number;
  bucketId: ID;
}

export interface NetWorthSnapshotEvent extends LedgerEventBase {
  type: 'networth_snapshot';
  assets: NetWorthEntry[];
  liabilities: NetWorthEntry[];
}

export interface BucketUpsertEvent extends LedgerEventBase {
  type: 'bucket_upsert';
  bucket: Bucket;
}

export interface BucketArchiveEvent extends LedgerEventBase {
  type: 'bucket_archive';
  bucketId: ID;
}

export interface SubscriptionUpsertEvent extends LedgerEventBase {
  type: 'subscription_upsert';
  subscription: Subscription;
}

export interface SubscriptionCancelEvent extends LedgerEventBase {
  type: 'subscription_cancel';
  subscriptionId: ID;
}

export interface TemplateUpsertEvent extends LedgerEventBase {
  type: 'template_upsert';
  template: AllocationTemplate;
}

export type LedgerEvent =
  | IncomeEvent
  | ExpenseEvent
  | SubscriptionChargeEvent
  | NetWorthSnapshotEvent
  | BucketUpsertEvent
  | BucketArchiveEvent
  | SubscriptionUpsertEvent
  | SubscriptionCancelEvent
  | TemplateUpsertEvent;

export type LedgerEventType = LedgerEvent['type'];

export const UNALLOCATED_BUCKET_ID = 'unallocated';
