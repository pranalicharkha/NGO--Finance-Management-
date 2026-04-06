/* ============================================================
NIDIGO — NGO Finance Management & Transparency System
script.js  v2.1 (cleaned & stable)
============================================================ */

/* ── DUMMY DATA ─────────────────────────────────────────── */

const DUMMY_TRANSACTIONS = [];

/* ── STORAGE ───────────────────────────────────────────── */

function loadTransactions(){

const raw = localStorage.getItem("nidigo_transactions");

if (raw) {
    return JSON.parse(raw);
}

localStorage.setItem("nidigo_transactions", JSON.stringify([]));

return [];

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

if (!form) return;

form.addEventListener("submit", function(e) {

    e.preventDefault();

    const date = document.getElementById("incDate").value;
    const source = document.getElementById("incSource").value;
    const category = document.getElementById("incCategory").value;
    const amount = parseFloat(document.getElementById("incAmount").value);
    const description = document.getElementById("incDescription")?.value || "";

    if (!date || !source || !category || !amount) {
        alert("Please fill all required fields");
        return;
    }

    const txns = loadTransactions();

    const newIncome = {
        id: Date.now(),
        type: "income",
        date,
        source,
        category,
        amount: Number(amount),
        description
    };

    const alreadyExists = txns.some(t =>
        t.type === "income" &&
        t.date === newIncome.date &&
        t.source === newIncome.source &&
        t.category === newIncome.category &&
        t.amount === newIncome.amount
    );

    if (alreadyExists) {
        alert("This income already exists");
        return;
    }

    txns.push(newIncome);
    saveTransactions(txns);

    alert("Income added successfully");
    form.reset();
});
}

/* ── ADD EXPENSE ───────────────────────────────── */

function initExpensePage(){

const form = document.getElementById("expenseForm");

if (!form) return;

form.addEventListener("submit", function(e) {

    e.preventDefault();

    const date = document.getElementById("expDate").value;
    const title = document.getElementById("expTitle").value;
    const category = document.getElementById("expCategory").value;
    const amount = parseFloat(document.getElementById("expAmount").value);
    const description = document.getElementById("expDescription")?.value || "";

    if (!date || !title || !category || !amount) {
        alert("Please fill all required fields");
        return;
    }

    const txns = loadTransactions();

    const newExpense = {
        id: Date.now(),
        type: "expense",
        date,
        source: title,
        category,
        amount: Number(amount),
        description
    };

    const alreadyExists = txns.some(t =>
        t.type === "expense" &&
        t.date === newExpense.date &&
        t.source === newExpense.source &&
        t.category === newExpense.category &&
        t.amount === newExpense.amount
    );

    if (alreadyExists) {
        alert("This expense already exists");
        return;
    }

    txns.push(newExpense);
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

function initCalendarPage() {

    const grid = document.getElementById("calGrid");
    if (!grid) return;

    let currentDate = new Date();

    function renderCalendar() {

        const txns = loadTransactions();

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();

        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        document.getElementById("calMonthLabel").innerText = `${monthNames[month]} ${year}`;

        grid.innerHTML = "";

        // Empty boxes before first day
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement("div");
            emptyCell.className = "cal-day empty";
            grid.appendChild(emptyCell);
        }

        // Create each day box
        for (let day = 1; day <= totalDays; day++) {

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

            const dayTxns = txns.filter(t => t.date === dateStr);

            const incomeCount = dayTxns.filter(t => t.type === "income").length;
const expenseCount = dayTxns.filter(t => t.type === "expense").length;

            const cell = document.createElement("div");
            cell.className = "cal-day";

            cell.innerHTML = `
    <div class="cal-date-num">${day}</div>

    <div style="display:flex;justify-content:center;gap:6px;margin-top:6px;flex-wrap:wrap;">
        ${incomeCount > 0 ? `<span class="dot-income"></span><small>${incomeCount}</small>` : ""}
        ${expenseCount > 0 ? `<span class="dot-expense"></span><small>${expenseCount}</small>` : ""}
    </div>
`;

            cell.addEventListener("click", () => {
                const detailBox = document.getElementById("selectedDayRecords");

                if (detailBox) {
                    if (dayTxns.length === 0) {
                        detailBox.innerHTML = `<p>No transactions on ${dateStr}</p>`;
                    } else {
                        detailBox.innerHTML = `
                            <h5 style="margin-bottom:10px;">Transactions on ${dateStr}</h5>
                            ${dayTxns.map(t => `
                                <div style="margin-bottom:15px; padding:10px; border:1px solid #ddd; border-radius:8px;">
                                    <strong>${t.type.toUpperCase()}</strong><br>
                                    ${t.type === "income" ? `Source: ${t.source}` : `Title: ${t.title}`}<br>
                                    Category: ${t.category}<br>
                                    Amount: ₹ ${t.amount}
                                </div>
                            `).join("")}
                        `;
                    }
                }
            });

            grid.appendChild(cell);
        }

        // Only calculate totals for current month
        const currentMonthTransactions = txns.filter(t => {
            const txDate = new Date(t.date);
            return (
                txDate.getMonth() === month &&
                txDate.getFullYear() === year
            );
        });

        const monthIncome = currentMonthTransactions
            .filter(t => t.type === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const monthExpense = currentMonthTransactions
            .filter(t => t.type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0);

        document.getElementById("calMonthInc").innerText = "Rs " + monthIncome;
        document.getElementById("calMonthExp").innerText = "Rs " + monthExpense;
        document.getElementById("calMonthBal").innerText = "Rs " + (monthIncome - monthExpense);
    }

    renderCalendar();

    document.getElementById("calPrev")?.addEventListener("click", () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById("calNext")?.addEventListener("click", () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
}


async function initReportsPage() {

    const tbody = document.getElementById("reportsTbody");
    const sumIncome = document.getElementById("sumIncome");
    const sumExpense = document.getElementById("sumExpense");
    const sumBalance = document.getElementById("sumBalance");

    const filterType = document.getElementById("filterType");
    const filterMonth = document.getElementById("filterMonth");
    const btnFilter = document.getElementById("btnFilter");
    const btnReset = document.getElementById("btnReset");

    async function loadReports() {

        tbody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";

        try {
            const response = await fetch("/user/transactions");
            const data = await response.json();

            if (!data.success) {
                tbody.innerHTML = "<tr><td colspan='6'>Failed to load data</td></tr>";
                return;
            }

            let transactions = data.transactions || [];

            const selectedType = filterType.value;
            const selectedMonth = filterMonth.value;

            if (selectedType !== "all") {
                transactions = transactions.filter(t => t.type === selectedType);
            }

            if (selectedMonth) {
                transactions = transactions.filter(t => {
                    const txnDate = new Date(t.date).toISOString().split("T")[0];
                    return txnDate.startsWith(selectedMonth);
                });
            }

            tbody.innerHTML = "";

            let incomeTotal = 0;
            let expenseTotal = 0;

            if (transactions.length === 0) {
                tbody.innerHTML = "<tr><td colspan='6'>No transactions found</td></tr>";

                sumIncome.innerText = "₹ 0";
                sumExpense.innerText = "₹ 0";
                sumBalance.innerText = "₹ 0";

                return;
            }

            transactions.forEach((t, index) => {

                const amount = Number(t.amount);

                if (t.type === "income") {
                    incomeTotal += amount;
                } else {
                    expenseTotal += amount;
                }

                const formattedDate = new Date(t.date).toLocaleDateString("en-GB");

                tbody.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${formattedDate}</td>
                        <td style="text-transform:capitalize;">${t.type}</td>
                        <td>${t.source || t.title || "-"}</td>
                        <td>${t.category || "-"}</td>
                        <td>₹ ${amount}</td>
                    </tr>
                `;
            });

            sumIncome.innerText = "₹ " + incomeTotal;
            sumExpense.innerText = "₹ " + expenseTotal;
            sumBalance.innerText = "₹ " + (incomeTotal - expenseTotal);

        } catch (error) {
            console.log("Reports Error:", error);
            tbody.innerHTML = "<tr><td colspan='6'>Error loading reports</td></tr>";

            sumIncome.innerText = "₹ 0";
            sumExpense.innerText = "₹ 0";
            sumBalance.innerText = "₹ 0";
        }
    }

    btnFilter.addEventListener("click", () => {
        loadReports();
    });

    btnReset.addEventListener("click", () => {
        filterType.value = "all";
        filterMonth.value = "";
        loadReports();
    });

    loadReports();
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

switch(page) {

    case "dashboard":
        initDashboard();
        break;

    case "income":
        initIncomePage();
        break;

    case "expense":
        initExpensePage();
        break;

    case "calendar":
        initCalendarPage();
        break;

    case "reports":
        initReportsPage();
        break;
}

});
