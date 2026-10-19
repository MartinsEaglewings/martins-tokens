import './styles.css';

type Profile = {
  userId: string; email: string; name: string; username: string; balance: number;
  earned: number; redeemed: number; spinsToday: number; nextSpinAt?: string | null;
  notifications: { id: string; message: string; createdAt: string; read: boolean }[];
  transactions: { id: string; type: string; amount: number; reason: string; createdAt: string }[];
  withdrawalsOpen: boolean; minimumWithdrawal: number; conversionRate: number;
};
const AD_URL = 'https://omg10.com/4/11268369';
const ADMIN_EMAIL = 'albertgmartins17@gmail.com';
const root = document.querySelector<HTMLDivElement>('#app')!;
let profile: Profile | null = null;
let activeTab = 'home';
let currentGame = '';
let gameTimer: number | undefined;
let adTimer: number | undefined;
let gameSeconds = 0;

const money = (n: number) => new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(n);
const safe = (s = '') => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(url, {
    credentials: 'include', ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong.');
  return data as T;
}
function toast(message: string, kind = 'info') {
  const el = document.createElement('div'); el.className = `toast ${kind}`; el.textContent = message;
  document.body.append(el); window.setTimeout(() => el.remove(), 3200);
}
function brand() {
  return `<a class="brand" href="#home"><span class="brand-mark">M</span><span>MARTINS <b>TOKENS</b><small>PLAY • EARN • RISE</small></span></a>`;
}
function renderLanding() {
  stopGame();
  root.innerHTML = `<div class="site-shell">
    <header class="topbar">${brand()}<nav><a href="#how">How it works</a><a href="#games">Games</a><a href="#rewards">Rewards</a><a href="#faq">FAQ</a></nav><div class="top-actions"><button class="btn quiet" id="loginTop">Log in</button><button class="btn gold" id="signupTop">Create account ↗</button></div><button class="menu-toggle" id="menuToggle">☰</button></header>
    <main>
      <section class="hero section-wrap" id="home"><div class="hero-copy"><span class="eyebrow"><i></i> YOUR NEXT LEVEL STARTS HERE</span><h1>Play more.<br><span>Earn rewards.</span><br>Rise together.</h1><p>A fresh way to play, challenge yourself and collect Martins Tokens. Jump into fun games, try your luck, and track every reward in one stylish place.</p><div class="hero-actions"><button class="btn gold large" id="heroStart">Start earning ↗</button><a class="btn glass large" href="#games">Explore games ↓</a></div><p class="fine">✓ Free to join · Progress saved to your account</p></div><div class="hero-art"><div class="orbit"></div><div class="coin">M<small>MARTINS</small></div><div class="float-card earn">✦ <span><small>REWARD DROP</small><b>+50 MARTINS</b></span></div><div class="float-card spin">◉ <span><small>DAILY CHALLENGE</small><b>Spin & win</b></span></div><div class="art-grid"></div></div></section>
      <section class="stats section-wrap"><div><b id="statUsers">Growing</b><small>community</small></div><div><b id="statTokens">Martins rewards</b><small>earned through play</small></div><div><b>5 mini-games</b><small>fun to explore</small></div><div><b>Manual payouts</b><small>when withdrawals open</small></div></section>
      <section class="section-wrap block" id="how"><div class="heading"><span class="eyebrow">SIMPLE AS ONE, TWO, PLAY</span><h2>Your fun has a <span>reward path.</span></h2><p>Get started in minutes. Your wallet and activity history stay connected to your account.</p></div><div class="steps"><article><b>01</b><h3>Create your account</h3><p>Register securely, then log in to open your dashboard.</p></article><article><b>02</b><h3>Play and collect</h3><p>Try the daily wheel and explore mini-games.</p></article><article><b>03</b><h3>Track every token</h3><p>Check your balance and transaction history. Compensation is conditional.</p></article></div></section>
      <section class="games-section block" id="games"><div class="section-wrap"><div class="heading"><span class="eyebrow">PICK YOUR PLAY</span><h2>Small games. <span>Big energy.</span></h2><p>Quick challenges built for your phone, tablet or desktop.</p></div><div class="game-cards"><article><div>🐍</div><small>ARCADE</small><h3>Snake Rush</h3><p>Eat fruit, grow longer and beat your score.</p><button class="text-link" data-auth="signup">Play Snake ↗</button></article><article><div>🧠</div><small>BRAIN TRAINING</small><h3>Memory Match</h3><p>Flip cards and find every matching pair.</p><button class="text-link" data-auth="signup">Play Memory ↗</button></article><article><div>🔢</div><small>PUZZLE</small><h3>Number Slide</h3><p>Put the numbers in order.</p><button class="text-link" data-auth="signup">Play Puzzle ↗</button></article><article><div>⭕</div><small>STRATEGY</small><h3>Tic-Tac-Toe</h3><p>Challenge the computer and aim for three.</p><button class="text-link" data-auth="signup">Play Tic-Tac-Toe ↗</button></article><article><div>🧱</div><small>ARCADE</small><h3>Brick Breaker</h3><p>Keep the ball alive and break the bricks.</p><button class="text-link" data-auth="signup">Play Brick Breaker ↗</button></article></div></div></section>
      <section class="reward-banner section-wrap block" id="rewards"><div><span class="eyebrow">A LITTLE LUCK, A LOT OF FUN</span><h2>Make every spin <span>count.</span></h2><p>Try your daily spin wheel and track rewards in your wallet.</p><button class="btn gold" id="spinCTA">Discover Spin & Win ↗</button></div><div class="wheel-art">✦<b>SPIN</b><small>50 · 5 · 0 · 20 · 10 · 3</small></div></section>
      <section class="section-wrap block" id="faq"><div class="heading"><span class="eyebrow">GOOD TO KNOW</span><h2>Your questions, <span>answered.</span></h2></div><div class="faq">${[
        ['What are Martins Tokens?', 'Internal reward points for eligible activities. They are not a real cryptocurrency or tradable blockchain asset.'],
        ['How do I earn tokens?', 'Log in, play eligible games and use the spin wheel. Rewards are subject to platform rules and server validation.'],
        ['How many spins can I use daily?', 'Up to ten spins per Nigeria-local calendar day, with a five-second cooldown.'],
        ['Can I withdraw my rewards?', 'Eligible users may request compensation only when withdrawals are open and they meet the published requirements. Payments are processed manually.'],
        ['Will my balance disappear if I refresh?', 'Valid balances and transactions are stored by the backend.']
      ].map(([q,a]) => `<details><summary>${q}<b>＋</b></summary><p>${a}</p></details>`).join('')}</div></section>
      <section class="final-cta section-wrap"><div><span class="eyebrow">READY WHEN YOU ARE</span><h2>Let the next play <span>begin.</span></h2><p>Join the game and keep your progress in your own account.</p></div><button class="btn gold large" id="finalStart">Create your account ↗</button></section>
    </main><footer class="footer section-wrap"><div>${brand()}<p>Play with purpose. Keep it fun. Keep it fair.</p></div><p>Martins Tokens are internal reward points. Compensation is conditional on platform rules and available funds.<br>© 2026 Martins DeMatrix LTD.</p></footer></div>`;
  document.querySelectorAll<HTMLElement>('[data-auth]').forEach(el => el.addEventListener('click', () => renderAuth('signup')));
  ['signupTop','heroStart','finalStart','spinCTA'].forEach(id => document.getElementById(id)?.addEventListener('click', () => renderAuth('signup')));
  document.getElementById('loginTop')?.addEventListener('click', () => renderAuth('login'));
  document.getElementById('menuToggle')?.addEventListener('click', () => document.querySelector('nav')?.classList.toggle('open'));
  void api<any>('/api/public/stats').then(s => {
    const u = document.getElementById('statUsers'); const t = document.getElementById('statTokens');
    if (u) u.textContent = String(s.users); if (t) t.textContent = money(s.tokens);
  }).catch(() => {});
}
function renderAuth(mode: 'login'|'signup', message = '') {
  const signup = mode === 'signup';
  root.innerHTML = `<main class="auth-page"><section class="auth-card"><button class="back" id="back">← Back to Martins Tokens</button><div class="auth-logo">${brand()}</div><span class="eyebrow">${signup ? 'START YOUR JOURNEY' : 'WELCOME BACK'}</span><h1>${signup ? 'Create your account' : 'Log in to your account'}</h1><p>${signup ? 'Register first. You will be asked to log in separately before opening your dashboard.' : 'Log in with the account you registered.'}</p>${message ? `<div class="message">${safe(message)}</div>` : ''}<form id="authForm"><label>Full name ${signup ? `<input name="name" minlength="2" maxlength="80" required autocomplete="name">` : ''}</label><label>Email address<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" minlength="8" required autocomplete="${signup?'new-password':'current-password'}"></label><button class="btn gold submit" type="submit">${signup ? 'Create account' : 'Log in'} ↗</button></form><p class="switch">${signup ? 'Already have an account?' : 'New to Martins Tokens?'} <button id="switch">${signup ? 'Log in' : 'Create account'}</button></p></section></main>`;
  document.getElementById('back')?.addEventListener('click', renderLanding);
  document.getElementById('switch')?.addEventListener('click', () => renderAuth(signup ? 'login' : 'signup'));
  document.getElementById('authForm')?.addEventListener('submit', async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget as HTMLFormElement);
    const body = Object.fromEntries(form.entries());
    try {
      if (signup) {
        const result = await api<any>('/api/auth/register', { method:'POST', body: JSON.stringify(body) });
        renderAuth('login', result.message); return;
      }
      const result = await api<any>('/api/auth/login', { method:'POST', body: JSON.stringify(body) });
      profile = result.profile; activeTab = 'home'; renderDashboard(); toast('Welcome to Martins Tokens!', 'success');
    } catch (err) { renderAuth(mode, (err as Error).message); }
  });
}
function navButton(tab: string, label: string) {
  return `<button class="side-link ${activeTab===tab?'active':''}" data-tab="${tab}">${label}</button>`;
}
function renderDashboard() {
  if (!profile) return renderLanding();
  const isAdmin = profile.email.toLowerCase() === ADMIN_EMAIL;
  root.innerHTML = `<div class="dashboard"><aside class="sidebar"><div class="sidebar-brand">${brand()}</div><small>WORKSPACE</small>${navButton('home','⌂ Overview')}${navButton('games','▣ Games & tasks')}${navButton('spin','✧ Spin & Win')}${navButton('wallet','◈ Wallet & withdrawals')}${navButton('history','↻ Transaction history')}${navButton('notifications','♧ Notifications')}${isAdmin ? `<small>ADMINISTRATION</small>${navButton('admin','⚙ Admin dashboard')}`:''}<div class="sidebar-bottom"><a href="mailto:albertgmartins17@gmail.com">Contact support ↗</a><button id="logout" class="side-link">↪ Sign out</button><small>© 2026 Martins DeMatrix LTD.</small></div></aside><main class="dash-main"><header class="dash-top"><div><span class="eyebrow">MARTINS TOKENS / ${activeTab.toUpperCase()}</span><h1>${tabTitle(activeTab)}</h1></div><div class="user-chip"><span>${safe(profile.name.slice(0,1).toUpperCase())}</span><div><b>${safe(profile.name)}</b><small>${safe(profile.email)}</small></div></div></header><section id="dashContent">${renderTab()}</section></main></div>`;
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(el => el.addEventListener('click', () => { activeTab = el.dataset.tab || 'home'; renderDashboard(); if (activeTab==='admin') void loadAdmin(); if(activeTab==='wallet') void loadWithdrawals(); }));
  document.getElementById('logout')?.addEventListener('click', async () => { await api('/api/auth/logout',{method:'POST'}).catch(()=>{}); profile=null; renderLanding(); });
  bindTab();
}
function tabTitle(tab: string) { return ({home:'Your overview',games:'Games & tasks',spin:'Spin & Win',wallet:'Wallet & withdrawals',history:'Transaction history',notifications:'Notifications',admin:'Admin dashboard'} as Record<string,string>)[tab] || 'Dashboard'; }
function renderTab(): string {
  if (!profile) return '';
  if (activeTab==='home') return `<div class="welcome"><div><span class="eyebrow">YOUR PROGRESS, AT A GLANCE</span><h2>Welcome back, ${safe(profile.name.split(' ')[0])}.</h2><p>Your next reward is just a play away.</p></div><button class="btn gold" data-go="games">Explore games ↗</button></div><div class="wallet-cards"><article><small>AVAILABLE BALANCE</small><strong>${money(profile.balance)} <i>MT</i></strong><span>Martins Tokens</span></article><article><small>TOTAL EARNED</small><strong>${money(profile.earned)} <i>MT</i></strong><span>All eligible rewards</span></article><article><small>REDEEMED</small><strong>${money(profile.redeemed)} <i>MT</i></strong><span>Recorded payouts</span></article></div><div class="panel"><div class="panel-head"><h3>Quick access</h3></div><div class="quick-actions"><button data-go="spin">✧ Spin & Win</button><button data-go="games">🎮 Play games</button><button data-go="wallet">◈ Wallet</button><button data-go="history">↻ History</button></div></div><div class="panel"><div class="panel-head"><h3>Recent activity</h3><button data-go="history" class="text-link">View all ↗</button></div>${transactions(profile.transactions.slice(0,5))}</div>`;
  if (activeTab==='games') return `<div class="game-cards dashboard-games">${[['snake','🐍','Snake Rush','Eat fruit and grow longer.'],['memory','🧠','Memory Match','Find every matching pair.'],['numberSlide','🔢','Number Slide','Arrange tiles in order.'],['ticTacToe','⭕','Tic-Tac-Toe','Try to beat the computer.'],['brickBreaker','🧱','Brick Breaker','Break bricks with a bouncing ball.']].map(([id,emoji,name,desc])=>`<article><div>${emoji}</div><small>MINI GAME</small><h3>${name}</h3><p>${desc}</p><button class="btn gold" data-game="${id}">Play now ↗</button></article>`).join('')}</div>`;
  if (activeTab==='spin') return `<div class="spin-panel panel"><div class="wheel-art big">✦<b>SPIN</b><small>50 · 5 · 0 · 20 · 10 · 3</small></div><div><span class="eyebrow">DAILY CHALLENGE</span><h2>Give luck a little nudge.</h2><p>Rewards: 50, 5, 0, 20, 10, 0, 3 or 10 tokens. Ten spins per Nigeria-local day; five-second cooldown.</p><p>Spins remaining today: <b>${Math.max(0,10-profile.spinsToday)}</b></p><button class="btn gold" id="spinButton">Spin the wheel</button> <a class="btn glass" href="${AD_URL}" target="_blank" rel="noopener noreferrer">Visit partner ↗</a></div></div>`;
  if (activeTab==='wallet') return `<div class="panel"><div class="panel-head"><h3>Wallet summary</h3></div><p>Available balance: <strong>${money(profile.balance)} MT</strong></p><p>Withdrawals: <strong>${profile.withdrawalsOpen?'Open':'Currently closed'}</strong></p><p>Minimum withdrawal: ₦${money(profile.minimumWithdrawal)} · Conversion rate: ${money(profile.conversionRate)} MT per ₦1</p>${profile.withdrawalsOpen ? `<form id="withdrawForm" class="withdraw-form"><label>Amount in Naira<input name="amountNaira" type="number" min="${profile.minimumWithdrawal}" required></label><label>Full legal name<input name="fullName" required></label><label>Bank name<input name="bankName" required></label><label>Account name<input name="accountName" required></label><label>10-digit account number<input name="accountNumber" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required></label><button class="btn gold">Submit request</button></form>`:'<p class="notice">Withdrawal requests are not available right now. Please check again later.</p>'}<div id="withdrawalsList"></div></div>`;
  if (activeTab==='history') return `<div class="panel"><div class="panel-head"><h3>Transaction history</h3></div>${transactions(profile.transactions)}</div>`;
  if (activeTab==='notifications') return `<div class="panel"><div class="panel-head"><h3>Notifications</h3></div>${profile.notifications.length ? profile.notifications.map(n=>`<article class="notice-row"><p>${safe(n.message)}</p><small>${new Date(n.createdAt).toLocaleString()}</small>${n.read?'':'<button class="text-link" data-read="'+n.id+'">Mark read</button>'}</article>`).join(''):'<p>No notifications yet.</p>'}</div>`;
  if (activeTab==='admin') return `<div class="panel"><div class="panel-head"><h3>Administrator controls</h3></div><p>Owner-only tools for user balances, withdrawal requests and payout settings.</p><div id="adminContent">Loading administration data…</div></div>`;
  return '';
}
function transactions(items: Profile['transactions']) {
  return items.length ? `<div class="transactions">${items.map(t=>`<div class="transaction"><span class="transaction-icon">${t.amount>=0?'＋':'−'}</span><div><b>${safe(t.reason)}</b><small>${new Date(t.createdAt).toLocaleString()}</small></div><strong class="${t.amount<0?'negative':''}">${t.amount>0?'+':''}${money(t.amount)} MT</strong></div>`).join('')}</div>`:'<p class="empty">No transactions yet. Play a game or try Spin & Win.</p>';
}
function bindTab() {
  document.querySelectorAll<HTMLElement>('[data-go]').forEach(el=>el.addEventListener('click',()=>{activeTab=el.dataset.go||'home';renderDashboard();}));
  document.querySelectorAll<HTMLElement>('[data-game]').forEach(el=>el.addEventListener('click',()=>startGame(el.dataset.game||'')));
  document.getElementById('spinButton')?.addEventListener('click',()=>void doSpin());
  document.querySelectorAll<HTMLElement>('[data-read]').forEach(el=>el.addEventListener('click',async()=>{await api('/api/notifications/read',{method:'POST',body:JSON.stringify({id:el.dataset.read})});await refreshProfile();}));
  document.getElementById('withdrawForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const body=Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement).entries());const r=await api<any>('/api/withdrawals',{method:'POST',body:JSON.stringify(body)});toast(`Request submitted: ${r.requestId}`,'success');await refreshProfile();}catch(err){toast((err as Error).message,'error');}});
  if(activeTab==='wallet') void loadWithdrawals();
  if(activeTab==='admin') void loadAdmin();
}
async function refreshProfile() { profile=await api<Profile>('/api/profile'); renderDashboard(); }
async function doSpin() {
  const b=document.getElementById('spinButton') as HTMLButtonElement|null;if(b)b.disabled=true;
  try{const r=await api<any>('/api/spin',{method:'POST',body:'{}'});profile=r.profile;toast(r.reward?`You won ${r.reward} Martins Tokens!`:'No tokens this time — try again!','success');renderDashboard();if(confirm('Would you like to visit our advertising partner?'))window.open(AD_URL,'_blank','noopener');}
  catch(e){toast((e as Error).message,'error');if(b)b.disabled=false;}
}
async function loadWithdrawals() {
  try{const r=await api<any>('/api/withdrawals');const el=document.getElementById('withdrawalsList');if(el)el.innerHTML=`<h3>Your withdrawal requests</h3>${r.withdrawals.length?r.withdrawals.map((w:any)=>`<div class="transaction"><div><b>${safe(w.id)}</b><small>₦${money(w.amountNaira)} · ${new Date(w.createdAt).toLocaleString()}</small></div><strong>${safe(w.status)}</strong></div>`).join(''):'<p>No withdrawal requests yet.</p>'}`;}catch(e){toast((e as Error).message,'error');}
}
async function loadAdmin() {
  const el=document.getElementById('adminContent');if(!el)return;
  try{const d=await api<any>('/api/admin/overview');el.innerHTML=`<h3>Platform totals</h3><p>Users: <b>${d.users.length}</b> · Lifetime earned: <b>${money(d.totalEarned)} MT</b></p><form id="settingsForm" class="withdraw-form"><label><input type="checkbox" name="withdrawalsOpen" ${d.settings.withdrawalsOpen?'checked':''}> Open withdrawals</label><label>Minimum withdrawal (₦)<input name="minimumWithdrawal" type="number" min="1" value="${d.settings.minimumWithdrawal}"></label><label>Tokens per ₦1<input name="conversionRate" type="number" min="0.01" step="0.01" value="${d.settings.conversionRate}"></label><button class="btn gold">Save settings</button></form><h3>Users</h3><div class="transactions">${d.users.map((u:any)=>`<div class="transaction"><div><b>${safe(u.name)}</b><small>${safe(u.email)}</small></div><strong>${money(u.balance)} MT</strong></div>`).join('')}</div><h3>Withdrawal requests</h3><div class="transactions">${d.withdrawals.map((w:any)=>`<div class="transaction"><div><b>${safe(w.username)} · ₦${money(w.amountNaira)}</b><small>${safe(w.bankName)} · ${safe(w.accountNumber)} · ${safe(w.status)}</small></div><select data-withdrawal="${w.id}"><option>Pending</option><option>Under Review</option><option>Approved</option><option>Paid</option><option>Rejected</option></select></div>`).join('')||'<p>No requests yet.</p>'}</div>`;
    document.getElementById('settingsForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget as HTMLFormElement);try{await api('/api/admin/settings',{method:'POST',body:JSON.stringify({withdrawalsOpen:(e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>('[name=withdrawalsOpen]')?.checked,minimumWithdrawal:f.get('minimumWithdrawal'),conversionRate:f.get('conversionRate')})});toast('Settings saved.','success');await loadAdmin();}catch(err){toast((err as Error).message,'error');}});
    document.querySelectorAll<HTMLSelectElement>('[data-withdrawal]').forEach(s=>{s.value=d.withdrawals.find((w:any)=>w.id===s.dataset.withdrawal)?.status||'Pending';s.addEventListener('change',async()=>{try{await api('/api/admin/withdrawal-status',{method:'POST',body:JSON.stringify({id:s.dataset.withdrawal,status:s.value})});toast('Withdrawal status updated.','success');await refreshProfile();}catch(err){toast((err as Error).message,'error');}});});
  }catch(e){el.textContent=(e as Error).message;}
}
function stopGame() { if(gameTimer)clearInterval(gameTimer);if(adTimer)clearInterval(adTimer);gameTimer=undefined;adTimer=undefined;gameSeconds=0;currentGame=''; }
function startGame(game: string) {
  stopGame();currentGame=game;
  const names:Record<string,string>={snake:'Snake Rush',memory:'Memory Match',numberSlide:'Number Slide',ticTacToe:'Tic-Tac-Toe',brickBreaker:'Brick Breaker'};
  const content = game==='snake'?snakeGame():game==='memory'?memoryGame():game==='numberSlide'?slideGame():game==='ticTacToe'?ticTacToeGame():brickGame();
  root.innerHTML=`<div class="game-page"><header>${brand()}<button class="btn glass" id="gameBack">← Dashboard</button></header><main class="game-box"><span class="eyebrow">MINI GAME</span><h1>${names[game]||'Game'}</h1><div id="gameSurface">${content}</div><p class="fine">Rewards are subject to daily limits and server validation. Five-minute play breaks may open the partner ad.</p></main></div>`;
  document.getElementById('gameBack')?.addEventListener('click',()=>{stopGame();activeTab='games';void refreshProfile();});
  wireGame(game);
  adTimer=window.setInterval(()=>{if(!currentGame)return;gameSeconds++;if(gameSeconds>=300){gameSeconds=0;if(confirm('Five-minute break: open the partner ad?'))window.open(AD_URL,'_blank','noopener');}},1000);
}
function finishGame(game:string, score:number, metric:string) {
  const send = async (eventGame:string, eventScore:number, eventMetric:string, fruitCount?:number) => {
    const eventId = `${Date.now()}-${Math.random().toString(36).slice(2)}-${eventGame}`;
    return api<any>('/api/games/reward', { method:'POST', body:JSON.stringify({
      game:eventGame, eventId, score:eventScore, metric:eventMetric, ...(fruitCount === undefined ? {} : {fruitCount})
    })});
  };
  if (game === 'snake') {
    const count = Math.max(0, Math.min(100, Math.floor(score)));
    (async () => {
      let paid = 0;
      for (let i=0; i<count; i++) {
        try { await send('snake', 1, 'fruit', 1); paid += 2; }
        catch (e) { toast((e as Error).message, 'error'); break; }
      }
      if (paid) toast(`You earned ${paid} MT from ${paid/2} fruit!`, 'success');
      await refreshProfile().catch(()=>{});
    })();
    return;
  }
  const apiGame = game === 'numberSlide' ? 'puzzle' : game === 'ticTacToe' ? 'tic' : game;
  void send(apiGame, score, metric).then(r => {
    toast(`You earned ${r.amount} MT!`, 'success');
    void refreshProfile().catch(()=>{});
  }).catch(e=>toast((e as Error).message,'error'));
}
function snakeGame(){return `<p>Use arrow keys or tap the controls. Eat fruit to score, then claim your completion reward.</p><canvas id="snakeCanvas" width="320" height="320"></canvas><div class="game-controls"><button data-dir="up">↑</button><div><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div></div><p>Score: <b id="snakeScore">0</b></p><button class="btn gold" id="snakeStart">Start / Restart</button><button class="btn glass" id="snakeClaim">Claim reward</button>`}
function memoryGame(){return `<p>Find all matching pairs.</p><div class="memory-grid" id="memoryGrid"></div><p>Matches: <b id="memoryScore">0</b>/6</p><button class="btn gold" id="memoryReset">New round</button>`}
function slideGame(){return `<p>Arrange the tiles from 1 to 15, with the empty space last. Use arrow keys or tap a neighboring tile.</p><div class="slide-grid" id="slideGrid"></div><p>Moves: <b id="slideMoves">0</b></p><button class="btn gold" id="slideReset">Shuffle</button>`}
function ticTacToeGame(){return `<p>You are X. Make a line of three to win.</p><div class="ttt-grid" id="tttGrid"></div><p id="tttStatus">Your turn</p><button class="btn gold" id="tttReset">New game</button>`}
function brickGame(){return `<p>Move the paddle with your finger or arrow keys. Clear the bricks.</p><canvas id="brickCanvas" width="340" height="300"></canvas><div class="game-controls"><button id="brickLeft">←</button><button id="brickStart" class="btn gold">Start / Restart</button><button id="brickRight">→</button></div><p>Score: <b id="brickScore">0</b></p><button class="btn glass" id="brickClaim">Claim reward</button>`}
function wireGame(game:string) {
  if(game==='snake')wireSnake();
  if(game==='memory')wireMemory();
  if(game==='numberSlide')wireSlide();
  if(game==='ticTacToe')wireTtt();
  if(game==='brickBreaker')wireBrick();
}
function wireSnake(){
 const c=document.getElementById('snakeCanvas') as HTMLCanvasElement,ctx=c.getContext('2d')!;let body=[42,41,40],dir=1,food=77,score=0,run=false;
 const draw=()=>{ctx.fillStyle='#0b1a22';ctx.fillRect(0,0,320,320);for(let i=0;i<100;i++){ctx.fillStyle='#142b34';ctx.fillRect((i%10)*32+1,Math.floor(i/10)*32+1,30,30);}body.forEach((p,i)=>{ctx.fillStyle=i?'#2bd4a4':'#f4c45c';ctx.fillRect((p%10)*32+3,Math.floor(p/10)*32+3,26,26);});ctx.fillStyle='#ff687a';ctx.beginPath();ctx.arc((food%10)*32+16,Math.floor(food/10)*32+16,10,0,Math.PI*2);ctx.fill();};
 const tick=()=>{const head=body[0],x=head%10,y=Math.floor(head/10),nx=x+(dir===1?1:dir===3?-1:0),ny=y+(dir===2?1:dir===0?-1:0);const next=ny*10+nx;if(nx<0||nx>9||ny<0||ny>9||body.includes(next)){run=false;if(gameTimer)clearInterval(gameTimer);return;}body.unshift(next);if(next===food){score+=1;food=randomIntSafe(100);document.getElementById('snakeScore')!.textContent=String(score);}else body.pop();draw();};
 const start=()=>{body=[42,41,40];dir=1;food=77;score=0;run=true;document.getElementById('snakeScore')!.textContent='0';if(gameTimer)clearInterval(gameTimer);gameTimer=window.setInterval(()=>{if(run)tick();},180);draw();};
 document.getElementById('snakeStart')!.addEventListener('click',start);
 document.getElementById('snakeClaim')!.addEventListener('click',()=>{run=false;if(gameTimer)clearInterval(gameTimer);finishGame('snake',score,'fruit');});
 document.querySelectorAll<HTMLElement>('[data-dir]').forEach(b=>b.addEventListener('click',()=>{const d=({up:0,right:1,down:2,left:3} as Record<string,number>)[b.dataset.dir||''];if((d+2)%4!==dir)dir=d;}));
 window.addEventListener('keydown',snakeKeys);draw();
 function snakeKeys(e:KeyboardEvent){const d:Record<string,number>={ArrowUp:0,ArrowRight:1,ArrowDown:2,ArrowLeft:3};if(d[e.key]!==undefined&&(d[e.key]+2)%4!==dir)dir=d[e.key];}
}
function randomIntSafe(max:number){return Math.floor(Math.random()*max);}
function wireMemory(){
 const emojis=['🍋','🍇','🍒','🥝','🍉','🍊'];let cards:string[]=[],opened:number[]=[],matched=new Set<number>(),busy=false,matches=0;
 const render=()=>{const grid=document.getElementById('memoryGrid')!;grid.innerHTML=cards.map((v,i)=>`<button class="memory-card" data-card="${i}">${matched.has(i)||opened.includes(i)?v:'?'}</button>`).join('');grid.querySelectorAll<HTMLElement>('[data-card]').forEach(b=>b.addEventListener('click',()=>flip(Number(b.dataset.card))));};
 const reset=()=>{cards=[...emojis,...emojis].sort(()=>Math.random()-.5);opened=[];matched=new Set();busy=false;matches=0;document.getElementById('memoryScore')!.textContent='0';render();};
 const flip=(i:number)=>{if(busy||matched.has(i)||opened.includes(i))return;opened.push(i);render();if(opened.length===2){if(cards[opened[0]]===cards[opened[1]]){opened.forEach(x=>matched.add(x));opened=[];matches++;document.getElementById('memoryScore')!.textContent=String(matches);if(matches===6)finishGame('memory',matches,'complete');render();}else{busy=true;window.setTimeout(()=>{opened=[];busy=false;render();},650);}}};
 document.getElementById('memoryReset')!.addEventListener('click',reset);reset();
}
function wireSlide(){
 const grid=document.getElementById('slideGrid')!;let nums:number[]=[],moves=0;
 const render=()=>{grid.innerHTML=nums.map((n,i)=>`<button class="slide-tile ${n===0?'empty':''}" data-tile="${i}">${n||''}</button>`).join('');grid.querySelectorAll<HTMLElement>('[data-tile]').forEach(b=>b.addEventListener('click',()=>move(Number(b.dataset.tile))));};
 const solved=()=>nums.every((n,i)=>n===(i===15?0:i+1));
 const move=(i:number)=>{const z=nums.indexOf(0);if(Math.abs(i%4-z%4)+Math.abs(Math.floor(i/4)-Math.floor(z/4))!==1)return;[nums[i],nums[z]]=[nums[z],nums[i]];moves++;document.getElementById('slideMoves')!.textContent=String(moves);render();if(solved())finishGame('numberSlide',Math.max(1,moves),'solved');};
 const reset=()=>{nums=[...Array.from({length:15},(_,i)=>i+1),0];for(let i=0;i<200;i++){const z=nums.indexOf(0),opts=[z%4?z-1:-1,z%4<3?z+1:-1,z>3?z-4:-1,z<12?z+4:-1].filter(x=>x>=0);const n=opts[randomIntSafe(opts.length)];[nums[z],nums[n]]=[nums[n],nums[z]];}moves=0;document.getElementById('slideMoves')!.textContent='0';render();};
 document.getElementById('slideReset')!.addEventListener('click',reset);window.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;const z=nums.indexOf(0),i=e.key==='ArrowLeft'?(z%4<3?z+1:-1):e.key==='ArrowRight'?(z%4?z-1:-1):e.key==='ArrowUp'?(z<12?z+4:-1):(z>3?z-4:-1);if(i>=0)move(i);});reset();
}
function wireTtt(){
 const grid=document.getElementById('tttGrid')!;let board=Array(9).fill(''),ended=false;
 const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
 const winner=()=>lines.find(l=>board[l[0]]&&board[l[0]]===board[l[1]]&&board[l[1]]===board[l[2]])?.map(i=>board[i])[0]||'';
 const render=()=>{grid.innerHTML=board.map((v,i)=>`<button data-cell="${i}">${v}</button>`).join('');grid.querySelectorAll<HTMLElement>('[data-cell]').forEach(b=>b.addEventListener('click',()=>move(Number(b.dataset.cell))));};
 const move=(i:number)=>{if(ended||board[i])return;board[i]='X';if(winner()==='X'){ended=true;document.getElementById('tttStatus')!.textContent='You win!';render();finishGame('ticTacToe',1,'win');return;}let empties=board.map((v,j)=>v? -1:j).filter(j=>j>=0);if(!empties.length){ended=true;document.getElementById('tttStatus')!.textContent='Draw';render();return;}const winMove=(mark:string)=>{for(const j of empties){board[j]=mark;if(winner()===mark){board[j]='';return j;}board[j]='';}return -1;};let ai=winMove('O');if(ai<0)ai=winMove('X');if(ai<0)ai=empties[randomIntSafe(empties.length)];board[ai]='O';if(winner()==='O'){ended=true;document.getElementById('tttStatus')!.textContent='Computer wins';}else if(board.every(Boolean)){ended=true;document.getElementById('tttStatus')!.textContent='Draw';}render();};
 const reset=()=>{board=Array(9).fill('');ended=false;document.getElementById('tttStatus')!.textContent='Your turn';render();};document.getElementById('tttReset')!.addEventListener('click',reset);reset();
}
function wireBrick(){
 const c=document.getElementById('brickCanvas') as HTMLCanvasElement,ctx=c.getContext('2d')!;let x=170,y=230,dx=2,dy=-2,paddle=135,score=0,bricks=Array.from({length:30},(_,i)=>({x:(i%6)*54+8,y:20+Math.floor(i/6)*24,alive:true})),running=false;
 const draw=()=>{ctx.fillStyle='#0b1a22';ctx.fillRect(0,0,c.width,c.height);bricks.forEach(b=>{if(b.alive){ctx.fillStyle='#f4c45c';ctx.fillRect(b.x,b.y,44,15);}});ctx.fillStyle='#2bd4a4';ctx.fillRect(paddle,275,70,9);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();};
 const tick=()=>{x+=dx;y+=dy;if(x<6||x>c.width-6)dx=-dx;if(y<6)dy=-dy;if(y>269&&x>paddle&&x<paddle+70)dy=-Math.abs(dy);if(y>c.height){running=false;return;}for(const b of bricks){if(b.alive&&x>b.x&&x<b.x+44&&y>b.y&&y<b.y+15){b.alive=false;dy=-dy;score++;document.getElementById('brickScore')!.textContent=String(score);break;}}draw();if(bricks.every(b=>!b.alive)){running=false;finishGame('brickBreaker',score,'finished');}};
 const start=()=>{x=170;y=230;dx=2;dy=-2;paddle=135;score=0;bricks.forEach(b=>b.alive=true);running=true;document.getElementById('brickScore')!.textContent='0';if(gameTimer)clearInterval(gameTimer);gameTimer=window.setInterval(()=>{if(running)tick();},16);draw();};
 document.getElementById('brickStart')!.addEventListener('click',start);document.getElementById('brickClaim')!.addEventListener('click',()=>{running=false;if(gameTimer)clearInterval(gameTimer);finishGame('brickBreaker',score,'finished');});
 const move=(d:number)=>{paddle=Math.max(0,Math.min(c.width-70,paddle+d*22));draw();};document.getElementById('brickLeft')!.addEventListener('click',()=>move(-1));document.getElementById('brickRight')!.addEventListener('click',()=>move(1));c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();paddle=Math.max(0,Math.min(c.width-70,(e.clientX-r.left)*c.width/r.width-35));draw();});window.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);});draw();
}
async function init(){
 try{const m=await api<any>('/api/me');if(m.authenticated){profile=m.profile;renderDashboard();return;}}catch{}
 renderLanding();
}
init();
