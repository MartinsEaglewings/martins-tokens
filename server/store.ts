import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

export type User = {
  id: string;
  email: string;
  name: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  balance: number;
  earned: number;
  redeemed: number;
  spins: Record<string, number>;
  nextSpinAt: number;
  transactions: {
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string;
  }[];
  notifications: {
    id: string;
    message: string;
    createdAt: string;
    read: boolean;
  }[];
};

export type Withdrawal = {
  id: string;
  userId: string;
  username: string;
  email: string;
  fullName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  amountNaira: number;
  tokenAmount: number;
  status: 'Pending' | 'Under Review' | 'Approved' | 'Paid' | 'Rejected';
  createdAt: string;
  updatedAt?: string;
};

export type Settings = {
  withdrawalsOpen: boolean;
  minimumWithdrawal: number;
  conversionRate: number;
};

export type Store = {
  users: User[];
  withdrawals: Withdrawal[];
  settings: Settings;
  audit: any[];
};

const initial: Store = {
  users: [],
  withdrawals: [],
  settings: {
    withdrawalsOpen: false,
    minimumWithdrawal: 500,
    conversionRate: 100
  },
  audit: []
};

const dataDir = path.resolve('server/data');
const dataFile = path.join(dataDir, 'store.json');
const usePostgres = Boolean(process.env.DATABASE_URL);

export const pool = usePostgres
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ...(process.env.NODE_ENV === 'production'
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000
    })
  : null;

fs.mkdirSync(dataDir, { recursive: true });

if (!usePostgres && !fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2), {
    mode: 0o600
  });
}

let localState: Store = usePostgres
  ? structuredClone(initial)
  : JSON.parse(fs.readFileSync(dataFile, 'utf8'));

function validateStore(value: unknown): Store {
  if (!value || typeof value !== 'object') {
    throw new Error('Stored Martins Tokens data is invalid.');
  }

  const data = value as Store;

  if (
    !Array.isArray(data.users) ||
    !Array.isArray(data.withdrawals) ||
    !Array.isArray(data.audit) ||
    !data.settings ||
    typeof data.settings !== 'object'
  ) {
    throw new Error('Stored Martins Tokens data has an invalid structure.');
  }

  return data;
}

export async function initializeStore(): Promise<void> {
  if (!pool) {
    localState = validateStore(JSON.parse(fs.readFileSync(dataFile, 'utf8')));
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS martins_tokens_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Preserve the existing database row. Never import local JSON into PostgreSQL.
  await pool.query(
    `INSERT INTO martins_tokens_state (id, data)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(initial)]
  );

  await getStore();
}

export async function getStore(): Promise<Store> {
  if (!pool) return localState;

  const result = await pool.query(
    'SELECT data FROM martins_tokens_state WHERE id = 1'
  );

  if (result.rowCount !== 1) {
    throw new Error('Martins Tokens database state has not been initialized.');
  }

  const raw = result.rows[0].data;
  const data = validateStore(typeof raw === 'string' ? JSON.parse(raw) : raw);
  localState = data;
  return data;
}

export async function mutateStore<T>(
  change: (data: Store) => T
): Promise<{ store: Store; result: T }> {
  if (!pool) {
    const previous = localState;
    const data = structuredClone(previous);
    const result = change(data);
    localState = data;

    try {
      saveStore();
    } catch (error) {
      localState = previous;
      throw error;
    }

    return { store: data, result };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const selected = await client.query(
      'SELECT data FROM martins_tokens_state WHERE id = 1 FOR UPDATE'
    );

    if (selected.rowCount !== 1) {
      throw new Error('Martins Tokens database state has not been initialized.');
    }

    const raw = selected.rows[0].data;
    const data = validateStore(typeof raw === 'string' ? JSON.parse(raw) : raw);
    const result = change(data);

    await client.query(
      `UPDATE martins_tokens_state
       SET data = $1::jsonb, updated_at = NOW()
       WHERE id = 1`,
      [JSON.stringify(data)]
    );

    await client.query('COMMIT');
    localState = data;
    return { store: data, result };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function saveStore(): void {
  if (usePostgres) {
    throw new Error('Use mutateStore() for PostgreSQL writes.');
  }

  const tmp = `${dataFile}.tmp`;

  fs.writeFileSync(tmp, JSON.stringify(localState, null, 2), {
    mode: 0o600
  });

  fs.renameSync(tmp, dataFile);
}

export function addNoticeTo(
  data: Store,
  userId: string,
  message: string
): void {
  const user = data.users.find(u => u.id === userId);
  if (!user) return;

  user.notifications.unshift({
    id: randomUUID(),
    message,
    createdAt: new Date().toISOString(),
    read: false
  });
}

export function addTransaction(
  user: User,
  type: string,
  amount: number,
  reason: string
): void {
  user.transactions.unshift({
    id: randomUUID(),
    type,
    amount,
    reason,
    createdAt: new Date().toISOString()
  });
}
