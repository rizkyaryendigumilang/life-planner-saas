export interface SharedBill {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  splitBetween: string[]; // member names or user IDs
  date: string;
}

export interface SettlementTransfer {
  from: string;
  to: string;
  amount: number;
}

export interface MemberBalanceSummary {
  member: string;
  totalPaid: number;
  totalShare: number;
  netBalance: number; // positive = should receive, negative = owes
}

/**
 * Generates a clean, readable, collision-resistant household invite code
 * Format: HOME-XXXXXX (6 chars alphanumeric without ambiguous characters)
 */
export function generateHouseholdInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    randomPart += chars[idx];
  }
  return `HOME-${randomPart}`;
}

/**
 * Validates invite code format
 */
export function isValidHouseholdCode(code: string): boolean {
  return /^HOME-[A-Z0-9]{6}$/i.test(code.trim());
}

/**
 * Calculates net balances and generates minimum settlement transfers between members
 */
export function calculateHouseholdSettlements(
  bills: SharedBill[],
  allMembers: string[]
): {
  balances: MemberBalanceSummary[];
  settlements: SettlementTransfer[];
} {
  const memberMap = new Map<string, { totalPaid: number; totalShare: number }>();

  allMembers.forEach((m) => {
    memberMap.set(m, { totalPaid: 0, totalShare: 0 });
  });

  for (const bill of bills) {
    const amt = Number(bill.amount) || 0;
    if (amt <= 0) continue;

    // Track total paid
    const payer = bill.paidBy;
    if (!memberMap.has(payer)) {
      memberMap.set(payer, { totalPaid: 0, totalShare: 0 });
    }
    memberMap.get(payer)!.totalPaid += amt;

    // Track shares
    const participants = bill.splitBetween.length > 0 ? bill.splitBetween : allMembers;
    const sharePerPerson = amt / participants.length;

    participants.forEach((p) => {
      if (!memberMap.has(p)) {
        memberMap.set(p, { totalPaid: 0, totalShare: 0 });
      }
      memberMap.get(p)!.totalShare += sharePerPerson;
    });
  }

  // Build summary array
  const balances: MemberBalanceSummary[] = [];
  const debtors: { member: string; debt: number }[] = [];
  const creditors: { member: string; credit: number }[] = [];

  memberMap.forEach((stats, member) => {
    const net = Math.round(stats.totalPaid - stats.totalShare);
    balances.push({
      member,
      totalPaid: Math.round(stats.totalPaid),
      totalShare: Math.round(stats.totalShare),
      netBalance: net,
    });

    if (net < -1) {
      debtors.push({ member, debt: -net });
    } else if (net > 1) {
      creditors.push({ member, credit: net });
    }
  });

  // Calculate optimal minimal settlements using greedy pairing
  const settlements: SettlementTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amount = Math.min(debtor.debt, creditor.credit);

    if (amount > 0) {
      settlements.push({
        from: debtor.member,
        to: creditor.member,
        amount: Math.round(amount),
      });

      debtor.debt -= amount;
      creditor.credit -= amount;
    }

    if (debtor.debt <= 1) dIdx++;
    if (creditor.credit <= 1) cIdx++;
  }

  return { balances, settlements };
}
