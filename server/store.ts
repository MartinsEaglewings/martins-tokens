import fs from 'node:fs';
import path from 'node:path';

export type User = {
  id: string; email: string; name: string; username: string; passwordHash: string;
  createdAt: string; balance: number; earned: number; redeemed: number;
  spins: Record<string, number>; nextSpinAt: number;
  transactions: { id: string; type: string; amount: number; reason: string; createdAt: string }[];
  notifications: { id: string; message: string; createdAt: string; read: boolean }[];
};
export type Withdrawal = {
  id: string; userId: string; username: string; email: string; fullName: string;
  bankName: string; accountName: string; accountNumber: string; amountNaira: number;
  tokenAmount: number; status: 'Pending' | 'Under Review' | 'Approved' | 'Paid' | 'Rejected';
  createdAt: string; updatedAt?: string;
};
export type Settings = { withdrawalsOpen: boolean; minimumWithdrawal: number; conversionRate: number };
type Store = { users: User[]; withdrawals: Withdrawal[]; settings: Settings; audit: any[] };

const dataDir = path.resolve('server/data');
const dataFile = path.join(dataDir, 'store.json');
const initial: Store = {
  users: [],
  withdrawals: [],
  settings: { withdrawalsOpen: false, minimumWithdrawal: 500, conversionRate: 100 },
  audit: []
};
fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2));
let state: Store = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
export function readStore(): Store { return state; }
export function saveStore(): void {
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, dataFile);
}
export function addNotice(userId: string, message: string): void {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  user.notifications.unshift({ id: crypto.randomUUID(), message, createdAt: new Date().toISOString(), read: false });
  saveStore();
}
export function addTransaction(user: User, type: string, amount: number, reason: string): void {
  user.transactions.unshift({ id: crypto.randomUUID(), type, amount, reason, createdAt: new Date().toISOString() });
}
