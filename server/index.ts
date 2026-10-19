import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { readStore, saveStore, addNotice, addTransaction, type User, type Withdrawal } from './store.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'albertgmartins17@gmail.com').toLowerCase();
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-only-change-this-secret-before-deploying';
const AD_URL = 'https://omg10.com/4/11268369';

app.use(express.json({ limit: '30kb' }));
app.use(session({
  name: 'martins.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.resolve('dist')));

declare module 'express-session' {
  interface SessionData { userId?: string }
}
const store = () => readStore();
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const userOf = (req: express.Request) => store().users.find(u => u.id === req.session.userId);
function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!userOf(req)) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const u = userOf(req);
  if (!u) return res.status(401).json({ error: 'Please log in.' });
  if (u.email.toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ error: 'Administrator access required.' });
  next();
}
const publicUser = (u: User) => ({
  userId: u.id, email: u.email, name: u.name, username: u.username, balance: u.balance,
  earned: u.earned, redeemed: u.redeemed, spinsToday: u.spins[today()] || 0,
  nextSpinAt: u.nextSpinAt ? new Date(u.nextSpinAt).toISOString() : null,
  notifications: u.notifications, transactions: u.transactions,
  withdrawalsOpen: store().settings.withdrawalsOpen,
  minimumWithdrawal: store().settings.minimumWithdrawal,
  conversionRate: store().settings.conversionRate
});
function credit(u: User, amount: number, reason: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid reward amount.');
  u.balance += amount; u.earned += amount;
  addTransaction(u, 'earning', amount, reason);
}

app.get('/api/_healthcheck', (_req, res) => res.json({ ok: true }));
app.get('/api/public/stats', (_req, res) => res.json({
  users: store().users.length,
  tokens: store().users.reduce((n, u) => n + u.earned, 0)
}));
app.get('/api/me', (req, res) => {
  const u = userOf(req);
  if (!u) return res.json({ authenticated: false });
  res.json({ authenticated: true, profile: publicUser(u) });
});
app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const password = String(req.body?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (store().users.some(u => u.email === email)) return res.status(409).json({ error: 'An account already exists for this email. Please log in.' });
  const user: User = {
    id: randomUUID(), email, name, username: name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'player',
    passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString(),
    balance: 0, earned: 0, redeemed: 0, spins: {}, nextSpinAt: 0, transactions: [],
    notifications: [{ id: randomUUID(), message: 'Welcome to Martins Tokens! Explore the games and reward rules.', createdAt: new Date().toISOString(), read: false }]
  };
  store().users.push(user); saveStore();
  res.status(201).json({ ok: true, message: 'Account created. Please log in to continue.' });
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const u = store().users.find(x => x.email === email);
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  req.session.userId = u.id;
  res.json({ ok: true, profile: publicUser(u) });
});
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => {
  res.clearCookie('martins.sid'); res.json({ ok: true });
}));
app.get('/api/profile', requireUser, (req, res) => res.json(publicUser(userOf(req)!)));

app.post('/api/spin', requireUser, (req, res) => {
  const u = userOf(req)!;
  const now = Date.now();
  if (u.nextSpinAt > now) return res.status(429).json({ error: `Please wait ${Math.ceil((u.nextSpinAt - now) / 1000)} seconds before spinning again.` });
  const key = today();
  u.spins[key] ||= 0;
  if (u.spins[key] >= 10) return res.status(429).json({ error: 'You have used all 10 spins for today.' });
  const outcomes = [50, 5, 0, 20, 10, 0, 3, 10];
  const reward = outcomes[randomInt(outcomes.length)];
  u.spins[key] += 1; u.nextSpinAt = now + 5000;
  if (reward > 0) credit(u, reward, 'Spin & Win reward');
  else u.transactions.unshift({ id: randomUUID(), type: 'spin', amount: 0, reason: 'Spin & Win — no reward', createdAt: new Date().toISOString() });
  saveStore();
  res.json({ ok: true, reward, remaining: 10 - u.spins[key], nextSpinAt: new Date(u.nextSpinAt).toISOString(), adUrl: AD_URL, profile: publicUser(u) });
});

const gameRules: Record<string, { cap?: number }> = {
  snake: {},
  memory: { cap: 1 },
  puzzle: { cap: 1 },
  tic: { cap: 1 },
  brick: { cap: 1 }
};
app.post('/api/games/reward', requireUser, (req, res) => {
  const u = userOf(req)!;
  const game = String(req.body?.game || '');
  const eventId = String(req.body?.eventId || '');
  const score = Number(req.body?.score);
  const metric = String(req.body?.metric || '');
  const fruitCount = Number(req.body?.fruitCount);
  if (!gameRules[game] || !eventId || eventId.length > 120 || !Number.isInteger(score) || score < 0 || score > 10000)
    return res.status(400).json({ error: 'Invalid game reward event.' });

  let amount = 0;
  let reason = '';
  if (game === 'snake') {
    if (score < 1 || fruitCount !== 1 || metric !== 'fruit') return res.status(400).json({ error: 'Invalid Snake reward event.' });
    amount = 2; reason = 'Snake fruit reward';
  } else if (game === 'memory') {
    if (metric !== 'complete' || score < 6 || score > 100) return res.status(400).json({ error: 'Complete Memory Match to claim this reward.' });
    amount = 12; reason = 'Memory Match completion reward';
  } else if (game === 'puzzle') {
    if (metric !== 'solved' || score < 1 || score > 500) return res.status(400).json({ error: 'Solve Number Slide to claim this reward.' });
    amount = 10; reason = 'Number Slide completion reward';
  } else if (game === 'tic') {
    if (metric !== 'win' || score !== 1) return res.status(400).json({ error: 'Win Tic-Tac-Toe to claim this reward.' });
    amount = 8; reason = 'Tic-Tac-Toe win reward';
  } else {
    if (metric !== 'finished' || score < 1 || score > 24) return res.status(400).json({ error: 'Break at least one brick to claim this reward.' });
    amount = score; reason = 'Brick Breaker performance reward';
  }

  const eventKey = `${u.id}:${eventId}`;
  const audit = store().audit as Array<{ kind?: string; key?: string; userId?: string; createdAt?: string }>;
  if (audit.some(a => a.kind === 'game-event' && a.key === eventKey))
    return res.status(409).json({ error: 'This game event was already processed.' });
  const nowMs = Date.now();
  const recent = audit.filter(a => a.kind === 'game-event' && a.userId === u.id && a.createdAt && nowMs - Date.parse(a.createdAt) < 60000);
  if (recent.length >= 30) return res.status(429).json({ error: 'Reward rate limit reached. Please keep playing for fun.' });
  if (game !== 'snake') {
    const dailyKey = `${u.id}:${game}:${today()}`;
    if (audit.some(a => a.kind === 'game-daily' && a.key === dailyKey))
      return res.status(429).json({ error: 'You have already claimed this game reward today.' });
    audit.push({ kind: 'game-daily', key: dailyKey, userId: u.id, createdAt: new Date().toISOString() });
  }
  audit.push({ kind: 'game-event', key: eventKey, userId: u.id, createdAt: new Date().toISOString() });
  credit(u, amount, reason);
  saveStore();
  res.json({ ok: true, amount, balance: u.balance, profile: publicUser(u) });
});
app.get('/api/withdrawals', requireUser, (req, res) => res.json({
  settings: store().settings,
  withdrawals: store().withdrawals.filter(w => w.userId === userOf(req)!.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt))
}));
app.post('/api/withdrawals', requireUser, (req, res) => {
  const u = userOf(req)!; const s = store().settings;
  if (!s.withdrawalsOpen) return res.status(403).json({ error: 'Withdrawals are currently closed.' });
  const amountNaira = Number(req.body?.amountNaira);
  const tokenAmount = Math.ceil(amountNaira * s.conversionRate);
  const fullName = String(req.body?.fullName || '').trim();
  const bankName = String(req.body?.bankName || '').trim();
  const accountName = String(req.body?.accountName || '').trim();
  const accountNumber = String(req.body?.accountNumber || '').replace(/\D/g, '');
  if (!Number.isSafeInteger(amountNaira) || amountNaira < s.minimumWithdrawal) return res.status(400).json({ error: `Minimum withdrawal is ₦${s.minimumWithdrawal}.` });
  if (!fullName || !bankName || !accountName || !/^\d{10}$/.test(accountNumber)) return res.status(400).json({ error: 'Complete all bank details and enter a 10-digit account number.' });
  if (u.balance < tokenAmount) return res.status(400).json({ error: 'Your available balance is not enough for this request.' });
  const w: Withdrawal = { id: randomUUID(), userId: u.id, username: u.username, email: u.email, fullName, bankName, accountName, accountNumber, amountNaira, tokenAmount, status: 'Pending', createdAt: new Date().toISOString() };
  store().withdrawals.push(w); addNotice(u.id, `Withdrawal request received and is pending review.`);
  const admin = store().users.find(x => x.email === ADMIN_EMAIL);
  if (admin) addNotice(admin.id, `New withdrawal request from ${u.username} for ₦${amountNaira}.`);
  saveStore(); res.status(201).json({ ok: true, requestId: w.id, status: w.status });
});
app.post('/api/notifications/read', requireUser, (req, res) => {
  const u = userOf(req)!; const n = u.notifications.find(x => x.id === req.body?.id);
  if (!n) return res.status(404).json({ error: 'Notification not found.' });
  n.read = true; saveStore(); res.json({ ok: true });
});
app.get('/api/admin/overview', requireUser, requireAdmin, (_req, res) => res.json({
  users: store().users.map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email, balance: u.balance, earned: u.earned, createdAt: u.createdAt })),
  totalEarned: store().users.reduce((n, u) => n + u.earned, 0),
  withdrawals: store().withdrawals.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
  settings: store().settings,
  transactions: store().users.flatMap(u => u.transactions.map(t => ({ ...t, email: u.email }))).slice(0, 200)
}));
app.post('/api/admin/settings', requireUser, requireAdmin, (req, res) => {
  const s = store().settings;
  const min = req.body?.minimumWithdrawal === undefined ? s.minimumWithdrawal : Number(req.body.minimumWithdrawal);
  const rate = req.body?.conversionRate === undefined ? s.conversionRate : Number(req.body.conversionRate);
  if (!Number.isSafeInteger(min) || min < 1 || !Number.isFinite(rate) || rate <= 0) return res.status(400).json({ error: 'Invalid payout settings.' });
  s.minimumWithdrawal = min; s.conversionRate = rate;
  if (req.body?.withdrawalsOpen !== undefined) s.withdrawalsOpen = Boolean(req.body.withdrawalsOpen);
  saveStore(); res.json({ ok: true, settings: s });
});
app.post('/api/admin/withdrawal-status', requireUser, requireAdmin, (req, res) => {
  const w = store().withdrawals.find(x => x.id === req.body?.id);
  const status = String(req.body?.status || '');
  if (!w) return res.status(404).json({ error: 'Withdrawal request not found.' });
  if (!['Under Review', 'Approved', 'Paid', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  if (w.status === 'Paid' || w.status === 'Rejected') return res.status(409).json({ error: 'This request is already final.' });
  if (status === 'Paid') {
    const u = store().users.find(x => x.id === w.userId)!;
    if (u.balance < w.tokenAmount) return res.status(409).json({ error: 'Wallet balance no longer covers this request.' });
    u.balance -= w.tokenAmount; u.redeemed += w.tokenAmount;
    addTransaction(u, 'withdrawal', -w.tokenAmount, `Manual payout ${w.id}`);
  }
  w.status = status as Withdrawal['status']; w.updatedAt = new Date().toISOString();
  addNotice(w.userId, `Withdrawal status updated to ${status}.`);
  store().audit.unshift({ id: randomUUID(), action: 'withdrawal_status', requestId: w.id, status, createdAt: new Date().toISOString() });
  saveStore(); res.json({ ok: true, status });
});

app.get('*', (_req, res, next) => {
  const index = path.resolve('dist/index.html');
  if (process.env.NODE_ENV === 'production') return res.sendFile(index);
  next();
});
app.listen(PORT, '0.0.0.0', () => console.log(`Martins Tokens API listening on http://127.0.0.1:${PORT}`));
