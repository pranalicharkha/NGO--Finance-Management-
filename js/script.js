/* ============================================================
NIDIGO — NGO Finance Management & Transparency System
script.js  v2.1 (cleaned & stable)
============================================================ */

/* ── DUMMY DATA ─────────────────────────────────────────── */

const DUMMY_TRANSACTIONS = [
{ id:1,type:'income',date:'2025-01-05',source:'UNICEF Grant',category:'Grant',amount:250000 },
{ id:2,type:'expense',date:'2025-01-08',source:'Staff Salaries',category:'Salary',amount:85000 },
{ id:3,type:'income',date:'2025-01-15',source:'Public Donation Drive',category:'Donation',amount:42000 },
{ id:4,type:'expense',date:'2025-01-20',source:'School Supply Project',category:'Project',amount:30000 },
{ id:5,type:'expense',date:'2025-01-25',source:'Office Utilities',category:'Utilities',amount:8500 }
];

/* ── STORAGE ───────────────────────────────────────────── */

function loadTransactions(){

const raw = localStorage.getItem("nidigo_transactions");

if(raw) return JSON.parse(raw);

localStorage.setItem("nidigo_transactions",JSON.stringify(DUMMY_TRANSACTIONS));

return DUMMY_TRANSACTIONS;

}

function saveTransactions(txns){

localStorage.setItem("nidigo_transactions",JSON.stringify(txns));

}

function computeTotals(txns){

let income = 0;
let expense = 0;

txns.forEach(t=>{

if(t.type==="income") income += t.amount;
if(t.type==="expense") expense += t.amount;

});

return {
income,
expense,
balance: income-expense
};

}

function fmt(n){

return "₨ " + n.toLocaleString("en-IN");

}

/* ── DARK / LIGHT MODE ───────────────────────────────── */

function initTheme(){

const saved = localStorage.getItem("nidigo_theme") || "light";

applyTheme(saved);

}

function applyTheme(theme){

document.documentElement.setAttribute("data-theme",theme);

localStorage.setItem("nidigo_theme",theme);

document.querySelectorAll(".mode-toggle i").forEach(icon=>{
icon.className = theme==="dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
});

}

function toggleTheme(){

const current = document.documentElement.getAttribute("data-theme") || "light";

applyTheme(current==="dark" ? "light" : "dark");

}

/* ── ADMIN SESSION ───────────────────────────────── */

function loadAdminUser(){

const adminUser = sessionStorage.getItem("adminUser");

if(adminUser){

const name = adminUser.charAt(0).toUpperCase() + adminUser.slice(1);

const nameEl = document.getElementById("adminName");
const avatarEl = document.getElementById("adminAvatar");
const dropdownEl = document.getElementById("dropdownName");

if(nameEl) nameEl.innerText = name;
if(avatarEl) avatarEl.innerText = name.charAt(0);
if(dropdownEl) dropdownEl.innerText = name;

}else{

if(document.body.dataset.page!=="admin-login"){
window.location.href="admin-login.html";
}

}

}

/* ── ADMIN DROPDOWN ───────────────────────────────── */

function initAdminDropdown(){

const userMenu = document.getElementById("userMenu");
const dropdown = document.getElementById("userDropdown");

if(!userMenu || !dropdown) return;

userMenu.addEventListener("click",()=>{

dropdown.style.display =
dropdown.style.display==="block" ? "none" : "block";

});

}

/* ── LOGOUT ───────────────────────────────── */

function logoutAdmin(){

sessionStorage.removeItem("adminUser");

window.location.href="admin-login.html";

}

/* ── DASHBOARD ───────────────────────────────── */

function initDashboard(){

const txns = loadTransactions();
const totals = computeTotals(txns);

setText("totalIncome",fmt(totals.income));
setText("totalExpense",fmt(totals.expense));
setText("totalBalance",fmt(totals.balance));

renderRecentActivity(txns.slice(-6).reverse());
renderPieChart(txns);
renderBarChart(txns);

}

function renderRecentActivity(txns){

const c = document.getElementById("recentActivity");

if(!c) return;

if(!txns.length){

c.innerHTML = "<div>No transactions yet</div>";
return;

}

c.innerHTML = txns.map(t=>{

const inc = t.type==="income";

return `

<div class="activity-item">

<div class="act-info">
<div>${t.source}</div>
<div>${formatDate(t.date)} • ${t.category}</div>
</div>

<div class="${inc?'pos':'neg'}">
${inc?'+':'-'}${fmt(t.amount)}
</div>

</div>
`;

}).join("");

}

/* ── CHARTS ───────────────────────────────── */

function renderPieChart(txns){

const canvas = document.getElementById("pieChart");

if(!canvas) return;

const expenses = txns.filter(t=>t.type==="expense");

const catMap = {};

expenses.forEach(t=>{
catMap[t.category]=(catMap[t.category]||0)+t.amount;
});

new Chart(canvas,{
type:"doughnut",
data:{
labels:Object.keys(catMap),
datasets:[{
data:Object.values(catMap),
backgroundColor:["#0f6e4d","#1a56db","#d97706","#dc2626","#7c3aed"]
}]
},
options:{responsive:true}
});

}

function renderBarChart(txns){

const canvas = document.getElementById("barChart");

if(!canvas) return;

const months = ["Jan","Feb","Mar","Apr","May","Jun"];

const income=[0,0,0,0,0,0];
const expense=[0,0,0,0,0,0];

txns.forEach(t=>{

const m = new Date(t.date).getMonth();

if(t.type==="income") income[m]+=t.amount;
if(t.type==="expense") expense[m]+=t.amount;

});

new Chart(canvas,{
type:"bar",
data:{
labels:months,
datasets:[
{label:"Income",data:income,backgroundColor:"#0f6e4d"},
{label:"Expense",data:expense,backgroundColor:"#dc2626"}
]
}
});

}

/* ── ADD INCOME ───────────────────────────────── */

function initIncomePage(){

const form = document.getElementById("incomeForm");

if(!form) return;

form.addEventListener("submit",function(e){

e.preventDefault();

const txns = loadTransactions();

txns.push({

id:Date.now(),
type:"income",
date:document.getElementById("incDate").value,
source:document.getElementById("incSource").value,
category:document.getElementById("incCategory").value,
amount:parseFloat(document.getElementById("incAmount").value)

});

saveTransactions(txns);

alert("Income added successfully");

form.reset();

});

}

/* ── ADD EXPENSE ───────────────────────────────── */

function initExpensePage(){

const form = document.getElementById("expenseForm");

if(!form) return;

form.addEventListener("submit",function(e){

e.preventDefault();

const txns = loadTransactions();

txns.push({

id:Date.now(),
type:"expense",
date:document.getElementById("expDate").value,
source:document.getElementById("expTitle").value,
category:document.getElementById("expCategory").value,
amount:parseFloat(document.getElementById("expAmount").value)

});

saveTransactions(txns);

alert("Expense added successfully");

form.reset();

});

}

/* ── HELPERS ───────────────────────────────── */

function setText(id,text){

const el = document.getElementById(id);

if(el) el.textContent=text;

}

function formatDate(str){

const d = new Date(str+"T00:00:00");

return d.toLocaleDateString("en-GB",{
day:"2-digit",
month:"short",
year:"numeric"
});

}

function setTopbarDate(){

const el = document.getElementById("topbarDate");

if(el){

el.textContent=new Date().toLocaleDateString("en-GB",{
weekday:"short",
day:"numeric",
month:"long",
year:"numeric"
});

}

}

/* ── AUTO INIT ───────────────────────────────── */

document.addEventListener("DOMContentLoaded",function(){

initTheme();
setTopbarDate();
loadAdminUser();
initAdminDropdown();

document.querySelectorAll(".mode-toggle").forEach(btn=>{
btn.addEventListener("click",toggleTheme);
});

const page = document.body.dataset.page;

switch(page){

case "dashboard":
initDashboard();
break;

case "income":
initIncomePage();
break;

case "expense":
initExpensePage();
break;

}

});
