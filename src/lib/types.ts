export type ID = string;

/** The recurrence-relevant shape for anything that repeats monthly. Kept as its
 * own interface so the date math in recurrence.ts stays decoupled from what's
 * being paid. */
export interface RecurringSchedule {
  cycle: 'monthly';
  startDate: string; // ISO date
  lastChargedDate?: string; // ISO date, last cycle boundary already charged
}

export type RecurringKind = 'income' | 'expense';

/**
 * A rule that posts an entry every month — a salary, a retainer, the rent, a
 * subscription.
 *
 * Income and expense share one type on purpose: pausing, skipping a month and
 * the idempotent catch-up are identical problems, and duplicating that machinery
 * per direction is how the two halves drift apart.
 */
export interface Recurring extends RecurringSchedule {
  id: ID;
  kind: RecurringKind;
  label: string;
  amount: number;
  /** Expenses only — which category the generated entry lands in. */
  category?: string;
  /** Paused rules stop generating but keep everything already posted. */
  active: boolean;
}

/** @deprecated v1 shape. Retained so old ledgers and exports still load. */
export interface RecurringIncome extends RecurringSchedule {
  id: ID;
  label: string;
  amount: number;
  active: boolean;
}

/** @deprecated v0 shape. Retained so old ledgers and exports still load. */
export interface Salary extends RecurringSchedule {
  id: ID;
  amount: number;
}

/**
 * Something owned that has a market price — shares, crypto, a fund.
 *
 * `lastPrice` is a manually recorded observation rather than a live quote: the
 * TradingView panel is an iframe and its data is not readable from the page, and
 * anything else would mean a keyed market-data API. Storing `lastPriceAt`
 * alongside it keeps the figure honest — a value is only as current as the
 * price it was computed from, and the UI says when that was.
 */
export interface Holding {
  id: ID;
  /** TradingView-style symbol, so it lines up with the watchlist. */
  symbol: string;
  label: string;
  quantity: number;
  /** What one unit cost on average, in the base currency. */
  avgCost: number;
  lastPrice?: number;
  lastPriceAt?: string;
}

export type AccountKind = 'main' | 'savings' | 'investment' | 'other';

/**
 * A pot the balance is divided into — the current account, a savings envelope,
 * money set aside to invest.
 *
 * These are *your* divisions, not the bank's. The sum of every account is always
 * the ledger's single balance, because a transfer only ever moves money between
 * them and never in or out. That invariant is what makes it safe to slice the
 * balance up without any number on the dashboard becoming a lie: net worth,
 * runway and every chart keep reading the undivided total and never need to know
 * accounts exist.
 */
export interface Account {
  id: ID;
  label: string;
  kind: AccountKind;
  note?: string;
  /** Archived accounts keep their history but leave the pickers. */
  archived?: boolean;
}

/**
 * Money set aside for something specific — a deposit, a trip, an emergency fund.
 *
 * A goal is an *earmark*, not an account: contributing to it moves nothing, it
 * only marks part of the existing balance as spoken for. The two coexist on
 * purpose — an account answers "where is it", a goal answers "what is it for",
 * and a savings account can hold three goals at once.
 */
export interface Goal {
  id: ID;
  label: string;
  /** What the goal needs, in the base currency. */
  target: number;
  /** Optional deadline — the thing that turns "saving" into "on track". */
  targetDate?: string; // ISO date
  note?: string;
}

/**
 * A loan being paid down on a fixed monthly schedule — mortgage, car, personal.
 *
 * `annualRate` is the nominal annual rate as a percentage (3.4 means 3.4%), the
 * number the lender quotes, converted to a monthly rate at calculation time.
 * Portuguese mortgages quote a variable rate; changing this field re-derives the
 * whole schedule from today's rate, which is the honest reading of "what would
 * happen if it stayed here".
 */
export interface Debt {
  id: ID;
  label: string;
  /** Amount borrowed at the start, in the base currency. */
  principal: number;
  /** Nominal annual rate as a percentage. 0 is allowed (interest-free). */
  annualRate: number;
  termMonths: number;
  startDate: string; // ISO date
  /** Voluntary overpayment applied every month on top of the scheduled one. */
  extraPayment?: number;
  active: boolean;
}

/** One of a vehicle's IUC payments, recurring every year on the same day —
 * `monthDay` rather than a fixed date, since the due date is an anniversary,
 * not a one-off. */
export interface IucInstallment {
  monthDay: string; // MM-DD
  amount: number;
}

/**
 * A vehicle, tracked only for its IUC due date(s).
 *
 * `amount` is typed in from the owner's own notice rather than computed: the
 * real formula depends on cylinder capacity, CO2 and a table that moves every
 * state budget, and a tax *liability* is the one place in this app where a
 * plausible-looking wrong number is worse than no number. What this app can
 * do reliably is the date arithmetic — when the next payment falls, and how
 * many days away that is — so that's what it does.
 */
export interface Vehicle {
  id: ID;
  plate: string;
  registrationDate: string; // ISO date — the anniversary IUC is due on
  amount: number;
  /** Splits the total across more than one payment a year, each on its own
   * anniversary — left empty for the common case of one payment covering the
   * full amount, in the registration month. */
  installments?: IucInstallment[];
  note?: string;
}

interface LedgerEventBase {
  id: ID;
  timestamp: string; // ISO datetime
}

/**
 * A self-imposed no-spend window over a hand-picked set of categories — "no
 * takeaway for 30 days", not a system-wide budget freeze.
 *
 * Purely a tracker, never an enforcement: nothing here stops an expense from
 * posting in a challenged category. It only reports, afterwards, whether each
 * day in the window stayed clean.
 */
export interface SpendChallenge {
  id: ID;
  label: string;
  categories: string[];
  startDate: string; // ISO date
  endDate: string; // ISO date
}

/**
 * Money recorded in a currency other than the base one.
 *
 * `amount` on the event itself is ALWAYS the base-currency value, so every
 * derive and analysis function keeps working untouched and totals never depend
 * on a conversion happening at read time. This is the audit trail beside it:
 * what was actually paid, and the rate that was used on that date.
 */
export interface ForeignAmount {
  currency: string;
  originalAmount: number;
  /** Base currency per 1 unit of `currency`, as of `rateDate`. */
  rate: number;
  rateDate: string;
}

export interface IncomeEvent extends LedgerEventBase {
  type: 'income';
  amount: number;
  label: string;
  foreign?: ForeignAmount;
  /** Set when generated by a recurring rule. */
  recurringId?: ID;
  /**
   * Which pot it landed in. Absent means the main account — which is why adding
   * accounts needed no migration and no version bump: every entry ever written
   * before them already means "main", and still does.
   */
  accountId?: ID;
  /** @deprecated v0 name for recurringId. */
  salaryId?: ID;
}

export interface ExpenseEvent extends LedgerEventBase {
  type: 'expense';
  amount: number;
  foreign?: ForeignAmount;
  category: string;
  subcategory?: string;
  note?: string;
  /** Set when generated by a recurring rule. */
  recurringId?: ID;
  /** Which pot it came out of. Absent means the main account. */
  accountId?: ID;
  /** Set when this expense is a vehicle's IUC payment, so the fiscal
   * calendar can tell a cycle has been settled instead of continuing to show
   * a due date already paid. `installmentIndex` picks which of the vehicle's
   * installments this covers; absent means the default single payment. */
  vehicleId?: ID;
  installmentIndex?: number;
  /** Set when this expense is one payment of a purchase split across several
   * months, so the group can be told apart from a one-off expense and shown as
   * "3 of 12" instead of just another entry that happens to repeat. */
  splitId?: ID;
  splitIndex?: number;
  splitCount?: number;
}

export interface RecurringUpsertEvent extends LedgerEventBase {
  type: 'recurring_upsert';
  rule: Recurring;
}

export interface RecurringRemoveEvent extends LedgerEventBase {
  type: 'recurring_remove';
  recurringId: ID;
}

/** Marks one month of one rule as deliberately not posted, so deleting a
 * generated entry doesn't simply regenerate it on the next load. */
export interface RecurringSkipEvent extends LedgerEventBase {
  type: 'recurring_skip';
  recurringId: ID;
  month: string; // YYYY-MM
}

/** A monthly spending limit for one category. Amount 0 is not a limit — use
 * budget_clear to remove one. */
export interface BudgetSetEvent extends LedgerEventBase {
  type: 'budget_set';
  category: string;
  amount: number;
}

export interface BudgetClearEvent extends LedgerEventBase {
  type: 'budget_clear';
  category: string;
}

export interface HoldingUpsertEvent extends LedgerEventBase {
  type: 'holding_upsert';
  holding: Holding;
}

export interface HoldingRemoveEvent extends LedgerEventBase {
  type: 'holding_remove';
  holdingId: ID;
}

/**
 * A buy or sell of a holding.
 *
 * Deliberately does *not* touch the cash ledger. Buying shares is a transfer,
 * not spending, and with a single undivided pot there is no account to move the
 * cash out of — pretending otherwise would make Net worth count the money twice.
 * The trade log exists to compute cost basis and return, which a single
 * `avgCost` field cannot do once you have bought the same thing twice.
 */
export interface TradeEvent extends LedgerEventBase {
  type: 'trade';
  holdingId: ID;
  side: 'buy' | 'sell';
  quantity: number;
  /** Price per unit, in the base currency. */
  price: number;
  /** Commission and taxes, added to cost on a buy and deducted on a sell. */
  fees?: number;
}

/** Cash paid out by a holding. Counted in return, and optionally logged as
 * income too — that choice is the user's, because whether it actually reached a
 * spendable account depends on the broker. */
export interface DividendEvent extends LedgerEventBase {
  type: 'dividend';
  holdingId: ID;
  /** Total received, net, in the base currency. */
  amount: number;
}

export interface GoalUpsertEvent extends LedgerEventBase {
  type: 'goal_upsert';
  goal: Goal;
}

export interface GoalRemoveEvent extends LedgerEventBase {
  type: 'goal_remove';
  goalId: ID;
}

/** Earmarks (or, when negative, releases) part of the balance for a goal. */
export interface GoalContributionEvent extends LedgerEventBase {
  type: 'goal_contribution';
  goalId: ID;
  amount: number;
}

export interface DebtUpsertEvent extends LedgerEventBase {
  type: 'debt_upsert';
  debt: Debt;
}

export interface DebtRemoveEvent extends LedgerEventBase {
  type: 'debt_remove';
  debtId: ID;
}

/**
 * Marks an entry as checked off against the bank.
 *
 * A separate event rather than a field on the entry, because it is not part of
 * what happened — it is a later assertion *about* what happened. Keeping money
 * events as untouched records of the transaction means reconciling can never
 * corrupt the thing being reconciled.
 */
export interface EntryClearedEvent extends LedgerEventBase {
  type: 'entry_cleared';
  entryId: ID;
  cleared: boolean;
}

/** Files one of your categories under an IRS deduction heading. A null rule
 * unfiles it again. */
export interface DeductionMapEvent extends LedgerEventBase {
  type: 'deduction_map';
  category: string;
  ruleId: string | null;
}

/** Overrides a deduction's annual ceiling. The defaults shipped in the code are
 * a starting point, not a source of truth — the ceilings move with each budget,
 * so they have to be correctable without a new release. */
export interface DeductionCapEvent extends LedgerEventBase {
  type: 'deduction_cap';
  ruleId: string;
  cap: number;
}

export interface AccountUpsertEvent extends LedgerEventBase {
  type: 'account_upsert';
  account: Account;
}

export interface AccountRemoveEvent extends LedgerEventBase {
  type: 'account_remove';
  accountId: ID;
}

/**
 * Money moved between two of your own pots.
 *
 * Deliberately not a MoneyEvent: nothing was earned and nothing was spent, so
 * counting a transfer as either would make the same euro appear twice or vanish.
 * This is the event that finally makes "put 200 into savings" recordable without
 * it reading as spending — which, with a single undivided pot, it always did.
 */
export interface TransferEvent extends LedgerEventBase {
  type: 'transfer';
  fromAccountId: ID;
  toAccountId: ID;
  amount: number;
  note?: string;
}

export type RuleField = 'text' | 'amount' | 'category';
export type RuleOp = 'contains' | 'equals' | 'gte' | 'lte';

/** One test against an entry. A rule's conditions are ANDed, so adding one
 * always narrows — the same contract as search. */
export interface RuleCondition {
  field: RuleField;
  op: RuleOp;
  /** Free text for `text`/`category`; a decimal string for `amount`. */
  value: string;
}

/** What to set when a rule matches. Every field is optional; the ones left out
 * are left alone rather than blanked. */
export interface RuleActions {
  category?: string;
  subcategory?: string;
  accountId?: ID;
}

/**
 * "When an entry looks like this, file it like that."
 *
 * One primitive rather than a feature per destination: auto-categorising an
 * import, routing broker top-ups to the investment pot and tagging a
 * subcategory are the same operation with different fields set, and building
 * each of them separately is how three near-identical matchers drift apart.
 */
export interface Rule {
  id: ID;
  label: string;
  active: boolean;
  appliesTo: 'expense' | 'income' | 'any';
  conditions: RuleCondition[];
  actions: RuleActions;
}

export interface RuleUpsertEvent extends LedgerEventBase {
  type: 'rule_upsert';
  rule: Rule;
}

export interface RuleRemoveEvent extends LedgerEventBase {
  type: 'rule_remove';
  ruleId: ID;
}

export interface CategoryUpsertEvent extends LedgerEventBase {
  type: 'category_upsert';
  name: string;
}

export interface CategoryRemoveEvent extends LedgerEventBase {
  type: 'category_remove';
  name: string;
}

export interface ChallengeUpsertEvent extends LedgerEventBase {
  type: 'challenge_upsert';
  challenge: SpendChallenge;
}

export interface ChallengeRemoveEvent extends LedgerEventBase {
  type: 'challenge_remove';
  challengeId: ID;
}

export interface VehicleUpsertEvent extends LedgerEventBase {
  type: 'vehicle_upsert';
  vehicle: Vehicle;
}

export interface VehicleRemoveEvent extends LedgerEventBase {
  type: 'vehicle_remove';
  vehicleId: ID;
}

/** @deprecated v1 events, folded on load. */
export interface RecurringIncomeUpsertEvent extends LedgerEventBase {
  type: 'recurring_income_upsert';
  income: RecurringIncome;
}
export interface RecurringIncomeRemoveEvent extends LedgerEventBase {
  type: 'recurring_income_remove';
  incomeId: ID;
}
export interface RecurringIncomeSkipEvent extends LedgerEventBase {
  type: 'recurring_income_skip';
  recurringId: ID;
  month: string;
}
/** @deprecated v0 event, folded on load. */
export interface SalaryUpsertEvent extends LedgerEventBase {
  type: 'salary_upsert';
  salary: Salary;
}

export type LedgerEvent =
  | IncomeEvent
  | ExpenseEvent
  | RecurringUpsertEvent
  | RecurringRemoveEvent
  | RecurringSkipEvent
  | BudgetSetEvent
  | BudgetClearEvent
  | HoldingUpsertEvent
  | HoldingRemoveEvent
  | TradeEvent
  | DividendEvent
  | GoalUpsertEvent
  | GoalRemoveEvent
  | GoalContributionEvent
  | DebtUpsertEvent
  | DebtRemoveEvent
  | EntryClearedEvent
  | DeductionMapEvent
  | DeductionCapEvent
  | AccountUpsertEvent
  | AccountRemoveEvent
  | TransferEvent
  | RuleUpsertEvent
  | RuleRemoveEvent
  | CategoryUpsertEvent
  | CategoryRemoveEvent
  | ChallengeUpsertEvent
  | ChallengeRemoveEvent
  | VehicleUpsertEvent
  | VehicleRemoveEvent
  | RecurringIncomeUpsertEvent
  | RecurringIncomeRemoveEvent
  | RecurringIncomeSkipEvent
  | SalaryUpsertEvent;

export type LedgerEventType = LedgerEvent['type'];

/** The two event types that move money. Everything else is configuration. */
export type MoneyEvent = IncomeEvent | ExpenseEvent;

export function isMoneyEvent(e: LedgerEvent): e is MoneyEvent {
  return e.type === 'income' || e.type === 'expense';
}
