import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import {
  pool,
  getStore,
  initializeStore,
  mutateStore,
  addNoticeTo,
  addTransaction,
  type Store,
  type User,
  type Withdrawal
} from './store.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'albertgmartins17@gmail.com').toLowerCase();
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-only-change-this-secret-before-deploying';
const AD_URL = 'https://omg10.com/4/11268369';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const asyncRoute = (
  handler: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => Promise<unknown>
): express.RequestHandler => (req, res, next) => {
  void handler(req, res, next).catch(next);
};

app.use(express.json({ limit: '30kb' }));
const PgSession = connectPgSimple(session);

const sessionStore = pool
  ? new PgSession({
      pool,
      tableName: 'martins_tokens_sessions',
      createTableIfMissing: true
    })
  : undefined;

app.use(session({
  store: sessionStore,
  name: 'martins.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.resolve('dist')));

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Lagos',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

const userIn = (data: Store, req: express.Request) =>
  data.users.find(u => u.id === req.session.userId);

const publicUser = (data: Store, u: User) => ({
  userId: u.id,
  email: u.email,
  name: u.name,
  username: u.username,
  balance: u.balance,
  earned: u.earned,
  redeemed: u.redeemed,
  spinsToday: u.spins[today()] || 0,
  nextSpinAt: u.nextSpinAt ? new Date(u.nextSpinAt).toISOString() : null,
  notifications: u.notifications,
  transactions: u.transactions,
  withdrawalsOpen: data.settings.withdrawalsOpen,
  minimumWithdrawal: data.settings.minimumWithdrawal,
  conversionRate: data.settings.conversionRate
});

function credit(u: User, amount: number, reason: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Invalid reward amount.');
  }

  u.balance += amount;
  u.earned += amount;
  addTransaction(u, 'earning', amount, reason);
}

const requireUser: express.RequestHandler = asyncRoute(async (req, res, next) => {
  const data = await getStore();
  if (!userIn(data, req)) {
    res.status(401).json({ error: 'Please log in to continue.' });
    return;
  }
  next();
});

const requireAdmin: express.RequestHandler = asyncRoute(async (req, res, next) => {
  const data = await getStore();
  const user = userIn(data, req);

  if (!user) {
    res.status(401).json({ error: 'Please log in.' });
    return;
  }

  if (user.email.toLowerCase() !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Administrator access required.' });
    return;
  }

  next();
});

app.get('/api/_healthcheck', (_req, res) => res.json({ ok: true }));

app.get('/api/public/stats', asyncRoute(async (_req, res) => {
  const data = await getStore();
  res.json({
    users: data.users.length,
    tokens: data.users.reduce((n, u) => n + u.earned, 0)
  });
}));

app.get('/api/me', asyncRoute(async (req, res) => {
  const data = await getStore();
  const user = userIn(data, req);

  if (!user) {
    res.json({ authenticated: false });
    return;
  }

  res.json({ authenticated: true, profile: publicUser(data, user) });
}));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const password = String(req.body?.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  if (name.length < 2) throw new HttpError(400, 'Enter your name.');
  if (password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = {
    id: randomUUID(),
    email,
    name,
    username: name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'player',
    passwordHash,
    createdAt: new Date().toISOString(),
    balance: 0,
    earned: 0,
    redeemed: 0,
    spins: {},
    nextSpinAt: 0,
    transactions: [],
    notifications: [{
      id: randomUUID(),
      message: 'Welcome to Martins Tokens! Explore the games and reward rules.',
      createdAt: new Date().toISOString(),
      read: false
    }]
  };

  const result = await mutateStore(data => {
    if (data.users.some(u => u.email === email)) return false;
    data.users.push(user);
    return true;
  });

  if (!result.result) {
    throw new HttpError(409, 'An account already exists for this email. Please log in.');
  }

  // Registration intentionally does not log the user in.
  res.status(201).json({
    ok: true,
    message: 'Account created. Please log in to continue.'
  });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const data = await getStore();
  const user = data.users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }

  req.session.userId = user.id;
  res.json({ ok: true, profile: publicUser(data, user) });
}));

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('martins.sid');
    res.json({ ok: true });
  });
});

app.get('/api/profile', requireUser, asyncRoute(async (req, res) => {
  const data = await getStore();
  const user = userIn(data, req);
  if (!user) throw new HttpError(401, 'Please log in to continue.');
  res.json(publicUser(data, user));
}));

app.post('/api/spin', requireUser, asyncRoute(async (req, res) => {
  const now = Date.now();
  const key = today();
  const outcomes = [50, 5, 0, 20, 10, 0, 3, 10];
  const reward = outcomes[randomInt(outcomes.length)];

  const result = await mutateStore(data => {
    const user = userIn(data, req);
    if (!user) throw new HttpError(401, 'Please log in to continue.');

    if (user.nextSpinAt > now) {
      throw new HttpError(
        429,
        `Please wait ${Math.ceil((user.nextSpinAt - now) / 1000)} seconds before spinning again.`
      );
    }

    user.spins[key] ||= 0;
    if (user.spins[key] >= 10) {
      throw new HttpError(429, 'You have used all 10 spins for today.');
    }

    user.spins[key] += 1;
    user.nextSpinAt = now + 5000;

    if (reward > 0) {
      credit(user, reward, 'Spin & Win reward');
    } else {
      user.transactions.unshift({
        id: randomUUID(),
        type: 'spin',
        amount: 0,
        reason: 'Spin & Win — no reward',
        createdAt: new Date().toISOString()
      });
    }

    return {
      reward,
      remaining: 10 - user.spins[key],
      nextSpinAt: new Date(user.nextSpinAt).toISOString(),
      profile: publicUser(data, user)
    };
  });

  res.json({ ok: true, ...result.result, adUrl: AD_URL });
}));

const gameRules: Record<string, { cap?: number }> = {
  snake: {},
  memory: { cap: 1 },
  puzzle: { cap: 1 },
  tic: { cap: 1 },
  brick: { cap: 1 }
};

app.post('/api/games/reward', requireUser, asyncRoute(async (req, res) => {
  const game = String(req.body?.game || '');
  const eventId = String(req.body?.eventId || '');
  const score = Number(req.body?.score);
  const metric = String(req.body?.metric || '');
  const fruitCount = Number(req.body?.fruitCount);

  if (!gameRules[game] || !eventId || eventId.length > 120 ||
      !Number.isInteger(score) || score < 0 || score > 10000) {
    throw new HttpError(400, 'Invalid game reward event.');
  }

  let amount = 0;
  let reason = '';

  if (game === 'snake') {
    if (score < 1 || fruitCount !== 1 || metric !== 'fruit') {
      throw new HttpError(400, 'Invalid Snake reward event.');
    }
    amount = 2;
    reason = 'Snake fruit reward';
  } else if (game === 'memory') {
    if (metric !== 'complete' || score < 6 || score > 100) {
      throw new HttpError(400, 'Complete Memory Match to claim this reward.');
    }
    amount = 12;
    reason = 'Memory Match completion reward';
  } else if (game === 'puzzle') {
    if (metric !== 'solved' || score < 1 || score > 500) {
      throw new HttpError(400, 'Solve Number Slide to claim this reward.');
    }
    amount = 10;
    reason = 'Number Slide completion reward';
  } else if (game === 'tic') {
    if (metric !== 'win' || score !== 1) {
      throw new HttpError(400, 'Win Tic-Tac-Toe to claim this reward.');
    }
    amount = 8;
    reason = 'Tic-Tac-Toe win reward';
  } else {
    if (metric !== 'finished' || score < 1 || score > 24) {
      throw new HttpError(400, 'Break at least one brick to claim this reward.');
    }
    amount = score;
    reason = 'Brick Breaker performance reward';
  }

  const nowMs = Date.now();
  const result = await mutateStore(data => {
    const user = userIn(data, req);
    if (!user) throw new HttpError(401, 'Please log in to continue.');

    const audit = data.audit as Array<{
      kind?: string;
      key?: string;
      userId?: string;
      createdAt?: string;
    }>;

    const eventKey = `${user.id}:${eventId}`;
    if (audit.some(a => a.kind === 'game-event' && a.key === eventKey)) {
      throw new HttpError(409, 'This game event was already processed.');
    }

    const recent = audit.filter(a =>
      a.kind === 'game-event' &&
      a.userId === user.id &&
      a.createdAt &&
      nowMs - Date.parse(a.createdAt) < 60000
    );

    if (recent.length >= 30) {
      throw new HttpError(429, 'Reward rate limit reached. Please keep playing for fun.');
    }

    if (game !== 'snake') {
      const dailyKey = `${user.id}:${game}:${today()}`;
      if (audit.some(a => a.kind === 'game-daily' && a.key === dailyKey)) {
        throw new HttpError(429, 'You have already claimed this game reward today.');
      }
      audit.push({
        kind: 'game-daily',
        key: dailyKey,
        userId: user.id,
        createdAt: new Date().toISOString()
      });
    }

    audit.push({
      kind: 'game-event',
      key: eventKey,
      userId: user.id,
      createdAt: new Date().toISOString()
    });

    credit(user, amount, reason);
    return { amount, balance: user.balance, profile: publicUser(data, user) };
  });

  res.json({ ok: true, ...result.result });
}));

app.get('/api/withdrawals', requireUser, asyncRoute(async (req, res) => {
  const data = await getStore();
  const user = userIn(data, req);
  if (!user) throw new HttpError(401, 'Please log in to continue.');

  res.json({
    settings: data.settings,
    withdrawals: data.withdrawals
      .filter(w => w.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  });
}));

app.post('/api/withdrawals', requireUser, asyncRoute(async (req, res) => {
  const amountNaira = Number(req.body?.amountNaira);
  const fullName = String(req.body?.fullName || '').trim();
  const bankName = String(req.body?.bankName || '').trim();
  const accountName = String(req.body?.accountName || '').trim();
  const accountNumber = String(req.body?.accountNumber || '').replace(/\D/g, '');

  if (!Number.isSafeInteger(amountNaira) || amountNaira < 1) {
    throw new HttpError(400, 'Enter a valid withdrawal amount.');
  }
  if (!fullName || !bankName || !accountName || !/^\d{10}$/.test(accountNumber)) {
    throw new HttpError(400, 'Complete all bank details and enter a 10-digit account number.');
  }

  const result = await mutateStore(data => {
    const user = userIn(data, req);
    if (!user) throw new HttpError(401, 'Please log in to continue.');

    const settings = data.settings;
    if (!settings.withdrawalsOpen) {
      throw new HttpError(403, 'Withdrawals are currently closed.');
    }
    if (amountNaira < settings.minimumWithdrawal) {
      throw new HttpError(400, `Minimum withdrawal is ₦${settings.minimumWithdrawal}.`);
    }

    const tokenAmount = Math.ceil(amountNaira * settings.conversionRate);
    if (!Number.isSafeInteger(tokenAmount) || tokenAmount <= 0) {
      throw new HttpError(400, 'Invalid withdrawal amount.');
    }
    if (user.balance < tokenAmount) {
      throw new HttpError(400, 'Your available balance is not enough for this request.');
    }

    const withdrawal: Withdrawal = {
      id: randomUUID(),
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName,
      bankName,
      accountName,
      accountNumber,
      amountNaira,
      tokenAmount,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    data.withdrawals.push(withdrawal);
    addNoticeTo(data, user.id, 'Withdrawal request received and is pending review.');

    const admin = data.users.find(u => u.email.toLowerCase() === ADMIN_EMAIL);
    if (admin) {
      addNoticeTo(data, admin.id, `New withdrawal request from ${user.username} for ₦${amountNaira}.`);
    }

    return { requestId: withdrawal.id, status: withdrawal.status };
  });

  res.status(201).json({ ok: true, ...result.result });
}));

app.post('/api/notifications/read', requireUser, asyncRoute(async (req, res) => {
  await mutateStore(data => {
    const user = userIn(data, req);
    if (!user) throw new HttpError(401, 'Please log in to continue.');

    const notification = user.notifications.find(n => n.id === req.body?.id);
    if (!notification) throw new HttpError(404, 'Notification not found.');
    notification.read = true;
  });

  res.json({ ok: true });
}));

app.get('/api/admin/overview', requireUser, requireAdmin, asyncRoute(async (_req, res) => {
  const data = await getStore();

  res.json({
    users: data.users.map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      balance: u.balance,
      earned: u.earned,
      createdAt: u.createdAt
    })),
    totalEarned: data.users.reduce((n, u) => n + u.earned, 0),
    withdrawals: data.withdrawals.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    settings: data.settings,
    transactions: data.users
      .flatMap(u => u.transactions.map(t => ({ ...t, email: u.email })))
      .slice(0, 200)
  });
}));

app.post('/api/admin/settings', requireUser, requireAdmin, asyncRoute(async (req, res) => {
  const result = await mutateStore(data => {
    const settings = data.settings;
    const min = req.body?.minimumWithdrawal === undefined
      ? settings.minimumWithdrawal
      : Number(req.body.minimumWithdrawal);
    const rate = req.body?.conversionRate === undefined
      ? settings.conversionRate
      : Number(req.body.conversionRate);

    if (!Number.isSafeInteger(min) || min < 1 || !Number.isFinite(rate) || rate <= 0) {
      throw new HttpError(400, 'Invalid payout settings.');
    }

    settings.minimumWithdrawal = min;
    settings.conversionRate = rate;
    if (req.body?.withdrawalsOpen !== undefined) {
      settings.withdrawalsOpen = Boolean(req.body.withdrawalsOpen);
    }

    return { ...settings };
  });

  res.json({ ok: true, settings: result.result });
}));

app.post('/api/admin/withdrawal-status', requireUser, requireAdmin, asyncRoute(async (req, res) => {
  const id = String(req.body?.id || '');
  const status = String(req.body?.status || '');

  if (!['Under Review', 'Approved', 'Paid', 'Rejected'].includes(status)) {
    throw new HttpError(400, 'Invalid status.');
  }

  const result = await mutateStore(data => {
    const withdrawal = data.withdrawals.find(w => w.id === id);
    if (!withdrawal) throw new HttpError(404, 'Withdrawal request not found.');

    if (withdrawal.status === 'Paid' || withdrawal.status === 'Rejected') {
      throw new HttpError(409, 'This request is already final.');
    }

    if (status === 'Paid') {
      const user = data.users.find(u => u.id === withdrawal.userId);
      if (!user) throw new HttpError(404, 'Withdrawal account not found.');
      if (user.balance < withdrawal.tokenAmount) {
        throw new HttpError(409, 'Wallet balance no longer covers this request.');
      }

      user.balance -= withdrawal.tokenAmount;
      user.redeemed += withdrawal.tokenAmount;
      addTransaction(user, 'withdrawal', -withdrawal.tokenAmount, `Manual payout ${withdrawal.id}`);
    }

    withdrawal.status = status as Withdrawal['status'];
    withdrawal.updatedAt = new Date().toISOString();

    addNoticeTo(data, withdrawal.userId, `Withdrawal status updated to ${status}.`);
    data.audit.unshift({
      id: randomUUID(),
      action: 'withdrawal_status',
      requestId: withdrawal.id,
      status,
      createdAt: new Date().toISOString()
    });

    return status;
  });

  res.json({ ok: true, status: result.result });
}));

app.get('*', (_req, res, next) => {
  const index = path.resolve('dist/index.html');
  if (process.env.NODE_ENV === 'production') return res.sendFile(index);
  next();
});

app.use((
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error('Martins Tokens API error:', error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

initializeStore()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Martins Tokens API listening on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('Failed to initialize Martins Tokens storage:', error);
    process.exit(1);
  });
