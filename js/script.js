/* ============================================================
   NIDIGO — NGO Finance Management & Transparency System
   script.js  v2.0
   ============================================================ */

/* ── DUMMY DATA ─────────────────────────────────────────── */
const DUMMY_TRANSACTIONS = [
  { id:1,  type:'income',  date:'2025-01-05', source:'UNICEF Grant',          category:'Grant',     amount:250000, description:'Annual education project grant from UNICEF.' },
  { id:2,  type:'expense', date:'2025-01-08', source:'Staff Salaries',         category:'Salary',    amount:85000,  description:'Monthly salary for 10 staff members.' },
  { id:3,  type:'income',  date:'2025-01-15', source:'Public Donation Drive',  category:'Donation',  amount:42000,  description:'Community fundraising event proceeds.' },
  { id:4,  type:'expense', date:'2025-01-20', source:'School Supply Project',  category:'Project',   amount:30000,  description:'Books, pens, bags for 300 students.' },
  { id:5,  type:'expense', date:'2025-01-25', source:'Office Utilities',       category:'Utilities', amount:8500,   description:'Electricity, internet, water bills.' },
  { id:6,  type:'income',  date:'2025-02-02', source:'World Bank Grant',       category:'Grant',     amount:180000, description:'Health awareness program funding.' },
  { id:7,  type:'expense', date:'2025-02-10', source:'Medical Supplies',       category:'Materials', amount:22000,  description:'First-aid kits and medicines for clinics.' },
  { id:8,  type:'income',  date:'2025-02-14', source:'Corporate Sponsor: ABC', category:'Donation',  amount:75000,  description:'CSR donation from ABC Corporation.' },
  { id:9,  type:'expense', date:'2025-02-20', source:'Staff Salaries',         category:'Salary',    amount:85000,  description:'Monthly salary for 10 staff members.' },
  { id:10, type:'income',  date:'2025-03-01', source:'Government Subsidy',     category:'Grant',     amount:95000,  description:'State government rural health subsidy.' },
  { id:11, type:'expense', date:'2025-03-05', source:'Clean Water Project',    category:'Project',   amount:46000,  description:'Borehole drilling in 3 villages.' },
  { id:12, type:'expense', date:'2025-03-12', source:'Training Workshop',      category:'Others',    amount:12000,  description:'Capacity building workshop for staff.' },
  { id:13, type:'income',  date:'2025-03-18', source:'Online Donations',       category:'Donation',  amount:28500,  description:'Crowdfunding campaign via website.' },
  { id:14, type:'expense', date:'2025-03-25', source:'Office Rent',            category:'Others',    amount:15000,  description:'Q1 office space rental payment.' },
  { id:15, type:'expense', date:'2025-03-30', source:'Staff Salaries',         category:'Salary',    amount:85000,  description:'Monthly salary for 10 staff members.' },
];

/* ── STORAGE ─────────────────────────────────────────────── */
function loadTransactions() {
  const raw = localStorage.getItem('nidigo_transactions');
  if (raw) return JSON.parse(raw);
  saveTransactions(DUMMY_TRANSACTIONS);
  return DUMMY_TRANSACTIONS;
}
function saveTransactions(txns) {
  localStorage.setItem('nidigo_transactions', JSON.stringify(txns));
}
function computeTotals(txns) {
  let income = 0, expense = 0;
  txns.forEach(t => {
    if (t.type === 'income')  income  += t.amount;
    if (t.type === 'expense') expense += t.amount;
  });
  return { income, expense, balance: income - expense };
}
function fmt(n) {
  return '₨ ' + n.toLocaleString('en-PK');
}

/* ── DARK / LIGHT MODE ───────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('nidigo_theme') || 'light';
  applyTheme(saved);
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('nidigo_theme', theme);
  // Update all toggle icons on page
  document.querySelectorAll('.mode-toggle i').forEach(icon => {
    icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  });
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ── AUTH ────────────────────────────────────────────────── */
function requireAuth() {
  if (!sessionStorage.getItem('nidigo_auth')) {
    window.location.href = 'index.html';
  }
}
function doLogout() {
  sessionStorage.removeItem('nidigo_auth');
  window.location.href = 'index.html';
}

/* ── ADMIN LOGIN ─────────────────────────────────────────── */
function initAdminLoginPage() {
  if (sessionStorage.getItem('nidigo_auth')) {
    window.location.href = 'dashboard.html';
    return;
  }
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const user   = document.getElementById('username').value.trim();
    const pass   = document.getElementById('password').value;
    const errEl  = document.getElementById('loginError');
    if (user === 'admin' && pass === 'admin123') {
      sessionStorage.setItem('nidigo_auth', 'admin');
      window.location.href = 'dashboard.html';
    } else {
      errEl.style.display = 'block';
      errEl.textContent = 'Invalid credentials. Try admin / admin123';
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
    }
  });
}

/* ── USER LOGIN ──────────────────────────────────────────── */
function initUserLoginPage() {
  if (sessionStorage.getItem('nidigo_user_auth')) {
    window.location.href = 'user-dashboard.html';
    return;
  }
  const form = document.getElementById('userLoginForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const email  = document.getElementById('userEmail').value.trim();
    const pass   = document.getElementById('userPassword').value;
    const errEl  = document.getElementById('userLoginError');
    if (email === 'donor@example.com' && pass === 'donor123') {
      sessionStorage.setItem('nidigo_user_auth', 'true');
      sessionStorage.setItem('nidigo_user_email', email);
      window.location.href = 'user-dashboard.html';
    } else {
      errEl.style.display = 'block';
      errEl.textContent = 'Invalid credentials. Try donor@example.com / donor123';
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
    }
  });
}

/* ── USER AUTH CHECK ─────────────────────────────────────── */
function requireUserAuth() {
  if (!sessionStorage.getItem('nidigo_user_auth')) {
    window.location.href = 'user-login.html';
  }
}

/* ── DASHBOARD ───────────────────────────────────────────── */
function initDashboard() {
  requireAuth();
  const txns   = loadTransactions();
  const totals = computeTotals(txns);
  setText('totalIncome',  fmt(totals.income));
  setText('totalExpense', fmt(totals.expense));
  setText('totalBalance', fmt(totals.balance));
  renderRecentActivity(txns.slice(-6).reverse());
  renderPieChart(txns);
  renderBarChart(txns);
}

function renderRecentActivity(txns) {
  const c = document.getElementById('recentActivity');
  if (!c) return;
  if (!txns.length) {
    c.innerHTML = '<div class="no-data"><i class="bi bi-inbox"></i>No transactions yet.</div>';
    return;
  }
  c.innerHTML = txns.map(t => {
    const inc = t.type === 'income';
    return `<div class="activity-item">
      <div class="act-icon ${inc ? 'income-icon' : 'expense-icon'}">
        <i class="bi bi-${inc ? 'arrow-down-circle' : 'arrow-up-circle'}"></i>
      </div>
      <div class="act-info">
        <div class="act-title">${t.source}</div>
        <div class="act-date">${formatDate(t.date)} &bull; ${t.category}</div>
      </div>
      <div class="act-amount ${inc ? 'pos' : 'neg'}">${inc ? '+' : '-'}${fmt(t.amount)}</div>
    </div>`;
  }).join('');
}

/* ── CHARTS ──────────────────────────────────────────────── */
function chartColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid:   dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    labels: dark ? '#8ab49f' : '#7a9589',
  };
}

function renderPieChart(txns) {
  const canvas = document.getElementById('pieChart');
  if (!canvas) return;
  const expenses = txns.filter(t => t.type === 'expense');
  const catMap   = {};
  expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);
  const COLORS = ['#0f6e4d','#1a56db','#d97706','#dc2626','#7c3aed','#0891b2'];
  const cc     = chartColors();
  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: COLORS.slice(0,labels.length), borderWidth:2, borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#101e16' : '#fff', hoverOffset:8 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'64%',
      plugins: {
        legend: { position:'bottom', labels:{ font:{family:'Inter',size:12}, padding:14, usePointStyle:true, pointStyleWidth:9, color:cc.labels } },
        tooltip: { callbacks:{ label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}` } }
      }
    }
  });
}

function renderBarChart(txns) {
  const canvas = document.getElementById('barChart');
  if (!canvas) return;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const inc = new Array(12).fill(0);
  const exp = new Array(12).fill(0);
  txns.forEach(t => {
    const m = new Date(t.date).getMonth();
    if (t.type === 'income')  inc[m] += t.amount;
    if (t.type === 'expense') exp[m] += t.amount;
  });
  const active = MONTHS.filter((_,i) => inc[i] || exp[i]);
  const aInc   = inc.filter((_,i) => inc[i] || exp[i]);
  const aExp   = exp.filter((_,i) => inc[i] || exp[i]);
  const cc     = chartColors();
  new Chart(canvas, {
    type:'bar',
    data: {
      labels: active,
      datasets: [
        { label:'Income',   data:aInc, backgroundColor:'rgba(15,110,77,0.82)',  borderRadius:6, borderSkipped:false },
        { label:'Expenses', data:aExp, backgroundColor:'rgba(220,38,38,0.78)', borderRadius:6, borderSkipped:false }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { position:'top', labels:{ font:{family:'Inter',size:12}, usePointStyle:true, pointStyleWidth:9, color:cc.labels } },
        tooltip: { callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid:{display:false}, ticks:{font:{family:'Inter',size:12},color:cc.labels} },
        y: { grid:{color:cc.grid}, ticks:{font:{family:'Inter',size:11},color:cc.labels, callback:v=>'₨'+(v>=1000?(v/1000)+'K':v)} }
      }
    }
  });
}

/* ── ADD INCOME ──────────────────────────────────────────── */
function initIncomePage() {
  requireAuth();
  const form = document.getElementById('incomeForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const txns = loadTransactions();
    txns.push({
      id:          Date.now(),
      type:        'income',
      date:        document.getElementById('incDate').value,
      source:      document.getElementById('incSource').value.trim(),
      category:    document.getElementById('incCategory').value,
      amount:      parseFloat(document.getElementById('incAmount').value),
      description: document.getElementById('incDesc').value.trim(),
    });
    saveTransactions(txns);
    showToast('Income record saved successfully!', 'income');
    form.reset();
  });
}

/* ── ADD EXPENSE ─────────────────────────────────────────── */
function initExpensePage() {
  requireAuth();
  const form = document.getElementById('expenseForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const txns = loadTransactions();
    txns.push({
      id:          Date.now(),
      type:        'expense',
      date:        document.getElementById('expDate').value,
      source:      document.getElementById('expTitle').value.trim(),
      category:    document.getElementById('expCategory').value,
      amount:      parseFloat(document.getElementById('expAmount').value),
      description: document.getElementById('expDesc').value.trim(),
    });
    saveTransactions(txns);
    showToast('Expense record saved successfully!', 'expense');
    form.reset();
  });
}

/* ── REPORTS ─────────────────────────────────────────────── */
function initReportsPage() {
  requireAuth();
  renderReportsTable(loadTransactions());
  const btnF = document.getElementById('btnFilter');
  const btnR = document.getElementById('btnReset');
  if (btnF) btnF.addEventListener('click', applyFilter);
  if (btnR) btnR.addEventListener('click', () => {
    document.getElementById('filterType').value  = 'all';
    document.getElementById('filterMonth').value = '';
    renderReportsTable(loadTransactions());
  });
}

function applyFilter() {
  const type  = document.getElementById('filterType').value;
  const month = document.getElementById('filterMonth').value;
  let txns    = loadTransactions();
  if (type  !== 'all') txns = txns.filter(t => t.type === type);
  if (month)           txns = txns.filter(t => t.date.startsWith(month));
  renderReportsTable(txns);
}

function renderReportsTable(txns) {
  const tbody  = document.getElementById('reportsTbody');
  const totals = computeTotals(txns);
  if (!tbody) return;
  if (!txns.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data"><i class="bi bi-search"></i>No records found.</td></tr>';
  } else {
    const sorted = [...txns].sort((a,b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = sorted.map((t,i) => {
      const inc = t.type === 'income';
      return `<tr>
        <td style="color:var(--text-muted);font-size:0.82rem">${i+1}</td>
        <td>${formatDate(t.date)}</td>
        <td><span class="badge-${t.type}">${inc ? '▲ Income' : '▼ Expense'}</span></td>
        <td style="font-weight:500">${t.source}</td>
        <td><span class="badge-cat">${t.category}</span></td>
        <td class="amount-${t.type}">${inc ? '+' : '-'}${fmt(t.amount)}</td>
      </tr>`;
    }).join('');
  }
  setText('sumIncome',  fmt(totals.income));
  setText('sumExpense', fmt(totals.expense));
  setText('sumBalance', fmt(totals.balance));
}

/* ── CALENDAR PAGE ───────────────────────────────────────── */
const CAL = {
  year:  new Date().getFullYear(),
  month: new Date().getMonth(),   // 0-indexed
  selectedDate: null,
};

function initCalendarPage() {
  requireAuth();
  renderCalendar();
  document.getElementById('calPrev').addEventListener('click', () => {
    CAL.month--;
    if (CAL.month < 0) { CAL.month = 11; CAL.year--; }
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    CAL.month++;
    if (CAL.month > 11) { CAL.month = 0; CAL.year++; }
    renderCalendar();
  });
}

function renderCalendar() {
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const txns  = loadTransactions();

  // Month label
  setText('calMonthLabel', `${MONTH_NAMES[CAL.month]} ${CAL.year}`);

  // Month stats
  const monthStr = `${CAL.year}-${String(CAL.month+1).padStart(2,'0')}`;
  const monthTxns = txns.filter(t => t.date.startsWith(monthStr));
  const mt = computeTotals(monthTxns);
  setText('calMonthInc', fmt(mt.income));
  setText('calMonthExp', fmt(mt.expense));
  setText('calMonthBal', fmt(mt.balance));

  // Build calendar grid
  const firstDay = new Date(CAL.year, CAL.month, 1).getDay(); // 0=Sun
  const daysIn   = new Date(CAL.year, CAL.month + 1, 0).getDate();
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Group txns by date
  const txnMap = {};
  monthTxns.forEach(t => {
    if (!txnMap[t.date]) txnMap[t.date] = [];
    txnMap[t.date].push(t);
  });

  const grid = document.getElementById('calGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // Prev month trailing days
  const prevDays = new Date(CAL.year, CAL.month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    cell.innerHTML = `<span class="cal-date">${prevDays - i}</span>`;
    grid.appendChild(cell);
  }

  // Current month days
  for (let d = 1; d <= daysIn; d++) {
    const dateStr = `${CAL.year}-${String(CAL.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell    = document.createElement('div');
    const classes = ['cal-cell'];
    if (dateStr === todayStr)         classes.push('today');
    if (dateStr === CAL.selectedDate) classes.push('selected');
    cell.className = classes.join(' ');

    const dots = txnMap[dateStr] || [];
    const hasInc = dots.some(t => t.type === 'income');
    const hasExp = dots.some(t => t.type === 'expense');

    cell.innerHTML = `
      <span class="cal-date">${d}</span>
      ${dots.length ? `<div class="cal-dot-wrap">
        ${hasInc ? '<div class="cal-dot income-dot"></div>'  : ''}
        ${hasExp ? '<div class="cal-dot expense-dot"></div>' : ''}
      </div>` : ''}`;

    cell.addEventListener('click', () => {
      CAL.selectedDate = dateStr;
      renderCalendar();
      renderDayDetail(dateStr, txnMap[dateStr] || []);
    });
    grid.appendChild(cell);
  }

  // Next month leading days
  const total  = firstDay + daysIn;
  const remain = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remain; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    cell.innerHTML = `<span class="cal-date">${d}</span>`;
    grid.appendChild(cell);
  }

  // If nothing selected, show today's detail
  if (!CAL.selectedDate) {
    renderDayDetail(todayStr, txnMap[todayStr] || []);
  }
}

function renderDayDetail(dateStr, txns) {
  const panel = document.getElementById('calDetail');
  if (!panel) return;
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(dateStr + 'T00:00:00');
  const label = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

  if (!txns.length) {
    panel.innerHTML = `
      <div class="cal-detail-title">
        <i class="bi bi-calendar3"></i>${label}
      </div>
      <div class="cal-detail-empty">
        <i class="bi bi-calendar-x" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:8px"></i>
        No transactions on this day.
      </div>`;
    return;
  }
  const rows = txns.map(t => {
    const inc = t.type === 'income';
    return `<div class="cal-txn-row">
      <div class="cal-txn-icon ${inc ? 'inc' : 'exp'}">
        <i class="bi bi-${inc ? 'arrow-down-circle' : 'arrow-up-circle'}"></i>
      </div>
      <div class="cal-txn-info">
        <div class="cal-txn-name">${t.source}</div>
        <div class="cal-txn-cat">${t.category}</div>
      </div>
      <div class="cal-txn-amt ${inc ? 'p' : 'n'}">${inc ? '+' : '-'}${fmt(t.amount)}</div>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="cal-detail-title">
      <i class="bi bi-calendar-check"></i>${label}
      <span style="font-family:'Inter';font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-left:auto">${txns.length} record${txns.length>1?'s':''}</span>
    </div>
    ${rows}`;
}

/* ── HELPERS ─────────────────────────────────────────────── */
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function showToast(msg, type) {
  document.querySelectorAll('.success-toast').forEach(t => t.remove());
  const color = type === 'income' ? 'var(--primary)' : 'var(--danger)';
  const icon  = type === 'income' ? 'bi-check-circle-fill' : 'bi-dash-circle-fill';
  const toast = document.createElement('div');
  toast.className = 'success-toast';
  toast.style.background = color;
  toast.innerHTML = `<i class="bi ${icon}"></i>${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
function setDefaultDate(id) {
  const el = document.getElementById(id);
  if (el) el.value = new Date().toISOString().split('T')[0];
}
function setTopbarDate() {
  const el = document.getElementById('topbarDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-GB',
    { weekday:'short', day:'numeric', month:'long', year:'numeric' });
}

/* ── AUTO-INIT ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  setTopbarDate();

  // Wire all mode-toggle buttons
  document.querySelectorAll('.mode-toggle').forEach(btn =>
    btn.addEventListener('click', toggleTheme)
  );
  // Wire logout buttons
  document.querySelectorAll('.btn-logout').forEach(btn =>
    btn.addEventListener('click', doLogout)
  );

  const page = document.body.dataset.page;
  switch(page) {
    case 'admin-login':       initAdminLoginPage();                     break;
    case 'user-login':        initUserLoginPage();                      break;
    case 'dashboard':         initDashboard();                          break;
    case 'income':            initIncomePage();  setDefaultDate('incDate'); break;
    case 'expense':           initExpensePage(); setDefaultDate('expDate'); break;
    case 'reports':           initReportsPage();                        break;
    case 'calendar':          initCalendarPage();                       break;
    case 'user-dashboard':    requireUserAuth();                        break;
    case 'user-donations':    requireUserAuth();                        break;
    case 'user-profile':      requireUserAuth();                        break;
    case 'user-projects':     requireUserAuth();                        break;
    case 'user-transparency': requireUserAuth();                        break;
  }
});
