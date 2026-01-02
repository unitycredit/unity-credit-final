// ==========================================================
// Unity Brain Core: Central Rule Engine (single source of truth)
// - Savings + credit analysis formulas live here.
// - Frontends must fetch computed outputs via the Unity Brain API.
// ==========================================================
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function toFiniteNonNegativeNumber(v, fallback = 0) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0)
        return fallback;
    return n;
}
export function computeCreditSummary(cards) {
    const list = Array.isArray(cards) ? cards : [];
    let totalLimit = 0;
    let totalBalance = 0;
    for (const c of list) {
        totalLimit += toFiniteNonNegativeNumber(c?.limit, 0);
        totalBalance += toFiniteNonNegativeNumber(c?.balance, 0);
    }
    totalBalance = Math.min(totalBalance, totalLimit);
    const totalAvailable = Math.max(0, totalLimit - totalBalance);
    const utilizationPct = totalLimit > 0 ? clamp((totalBalance / totalLimit) * 100, 0, 100) : 0;
    const targetBalance = totalLimit * 0.3;
    const payTo30 = Math.max(0, totalBalance - targetBalance);
    return { totalLimit, totalBalance, totalAvailable, utilizationPct, payTo30 };
}
export function computeDebtRatio(params) {
    const income = params.monthlyIncome;
    const debt = params.monthlyDebtPayments;
    if (!Number.isFinite(income) || income <= 0)
        return { debtRatio: null, debtRatioPct: null };
    if (!Number.isFinite(debt) || debt < 0)
        return { debtRatio: null, debtRatioPct: null };
    const ratio = clamp(debt / income, 0, 10);
    const pct = clamp(ratio * 100, 0, 1000);
    return { debtRatio: ratio, debtRatioPct: pct };
}
export function estimateMonthlyDebtPaymentsFromCreditCards(cards, params) {
    const list = Array.isArray(cards) ? cards : [];
    const minPaymentPct = Number.isFinite(params?.minPaymentPct) ? Number(params?.minPaymentPct) : 0.02;
    let total = 0;
    for (const c of list) {
        const bal = toFiniteNonNegativeNumber(c?.balance, 0);
        if (bal <= 0)
            continue;
        total += bal * minPaymentPct;
    }
    return total;
}
function parseNumberLike(v) {
    if (v === null || v === undefined)
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
export function computeBudgetMonthlyTotalFromItems(items) {
    const list = Array.isArray(items) ? items : [];
    let total = 0;
    for (const it of list) {
        const m = parseNumberLike(it?.monthly);
        if (!Number.isFinite(m) || m <= 0)
            continue;
        total += m;
    }
    return total;
}
export function createFinanceSnapshot(params) {
    const credit = params.cards ? computeCreditSummary(params.cards) : null;
    const bank = params.bank
        ? {
            total_balance: parseNumberLike(params.bank.total_balance),
            monthly_income: parseNumberLike(params.bank.monthly_income),
            monthly_expenses: parseNumberLike(params.bank.monthly_expenses),
            accounts_count: parseNumberLike(params.bank.accounts_count),
        }
        : null;
    const budgetMonthlyTotal = computeBudgetMonthlyTotalFromItems(params.budget_items);
    const budget = params.budget_items ? { monthly_total: budgetMonthlyTotal } : null;
    const estDebtPayments = credit ? estimateMonthlyDebtPaymentsFromCreditCards(params.cards || [], { minPaymentPct: 0.02 }) : null;
    const dr = computeDebtRatio({ monthlyIncome: bank?.monthly_income ?? null, monthlyDebtPayments: estDebtPayments });
    const netWorthEstimate = typeof bank?.total_balance === 'number' && credit ? Number(bank.total_balance) - Number(credit.totalBalance) : null;
    return {
        version: 1,
        generated_at: new Date().toISOString(),
        credit,
        bank,
        budget,
        derived: {
            net_worth_estimate: Number.isFinite(netWorthEstimate) ? netWorthEstimate : null,
            est_monthly_debt_payments: Number.isFinite(estDebtPayments) ? estDebtPayments : null,
            debt_ratio_pct: dr.debtRatioPct,
        },
    };
}
