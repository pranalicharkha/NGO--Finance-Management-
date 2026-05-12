let dashboardTrendChart;
let dashboardCategoryChart;
let reportsTrendChart;
let reportsIncomeMixChart;
let reportsExpenseMixChart;
let reportTransactionsCache = [];
let transactionModalInstance;
let ngoProjectCache = [];
let userPieChart;
let donationTrendChart;
let donationCategoryChart;
let userDonationTrendChart;

async function apiFetchJson(url, options = {}) {
    const response = await fetch(url, {
        cache: "no-store",
        ...options
    });
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    if (!isJson) {
        throw new Error("API route is returning HTML instead of JSON. Restart the server and check that the route exists.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

function normalizeDateValue(value) {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value).split("T")[0];
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getUserId() {
    const user = loadUserSession();
    return user ? user.id : 0;
}

async function loadTransactionsFromApi() {
    const isAdminPage = ["dashboard", "income", "expense", "calendar", "reports", "users"].includes(document.body.dataset.page);
    let data;
    if (isAdminPage) {
        data = await apiFetchJson('/admin/transactions');
    } else {
        const userId = getUserId();
        data = await apiFetchJson(`/user/transactions?userId=${userId}`);
    }
    return (data.transactions || []).map((item) => ({
        ...item,
        date: normalizeDateValue(item.date)
    }));
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));
}

function formatPaymentMethod(value) {
    if (!value) return "Not available";
    const normalized = String(value).trim().toLowerCase();
    const labels = {
        upi: "UPI",
        cash: "Cash",
        card: "Card",
        cheque: "Cheque",
        bank_transfer: "Bank Transfer",
        banktransfer: "Bank Transfer"
    };
    if (labels[normalized]) return labels[normalized];
    return normalized
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatDate(dateValue) {
    return new Date(`${normalizeDateValue(dateValue)}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function initTheme() {
    const saved = localStorage.getItem("nidigo_theme") || "light";
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("nidigo_theme", theme);
    document.querySelectorAll(".mode-toggle i").forEach((icon) => {
        icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
    });
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
}

function loadUserSession() {
    const raw = sessionStorage.getItem("nidigoUser");
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error("Invalid user session:", error);
        sessionStorage.removeItem("nidigoUser");
        return null;
    }
}

function applyUserSession() {
    const user = loadUserSession();
    const userPages = ["user-dashboard", "user-profile", "user-donations", "user-projects", "user-transparency", "user-calendar"];
    const page = document.body.dataset.page;

    if (!user) {
        if (userPages.includes(page)) {
            window.location.href = "user-login.html";
        }
        return;
    }

    const nameEl = document.querySelector(".topbar-user .user-name");
    const avatarEl = document.querySelector(".topbar-user .avatar");

    if (nameEl) nameEl.textContent = user.name;
    if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();

    const profileNameInput = document.getElementById("profileName");
    const profileEmailInput = document.getElementById("profileEmail");

    if (profileNameInput) profileNameInput.value = user.name;
    if (profileEmailInput) profileEmailInput.value = user.email;

    document.querySelectorAll(".btn-logout").forEach((link) => {
        link.addEventListener("click", () => {
            sessionStorage.removeItem("nidigoUser");
        });
    });
}

function initUserLoginPage() {
    const form = document.getElementById("userLoginForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("userEmail").value.trim();
        const password = document.getElementById("userPassword").value.trim();
        const errorBox = document.getElementById("userLoginError");

        if (errorBox) {
            errorBox.classList.add("d-none");
        errorBox.classList.remove("d-block");
            errorBox.textContent = "";
        }

        try {
            const response = await fetch("/user/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                if (errorBox) {
                    errorBox.style.display = "block";
                    errorBox.textContent = data.message || "Invalid email or password";
                }
                return;
            }

            sessionStorage.setItem("nidigoUser", JSON.stringify(data.user));
            localStorage.setItem("nidigoUserProfile", JSON.stringify(data.user));
            window.location.href = "user-dashboard.html";
        } catch (error) {
            console.error("User login error:", error);
            if (errorBox) {
                errorBox.style.display = "block";
                errorBox.textContent = "Server not reachable. Please check backend.";
            }
        }
    });
}

function initUserRegisterPage() {
    const form = document.getElementById("userRegisterForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const password = document.getElementById("registerPassword").value.trim();
        const errorBox = document.getElementById("userRegisterError");

        if (errorBox) {
            errorBox.classList.add("d-none");
        errorBox.classList.remove("d-block");
            errorBox.textContent = "";
        }

        try {
            const response = await fetch("/user/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                if (errorBox) {
                    errorBox.style.display = "block";
                    errorBox.textContent = data.message || "Registration failed";
                }
                return;
            }

            if (data.user) {
                sessionStorage.setItem("nidigoUser", JSON.stringify(data.user));
                localStorage.setItem("nidigoUserProfile", JSON.stringify(data.user));
                window.location.href = "user-dashboard.html";
            } else {
                alert("Registration successful. Please login.");
                window.location.href = "user-login.html";
            }
        } catch (error) {
            console.error("User register error:", error);
            if (errorBox) {
                errorBox.style.display = "block";
                errorBox.textContent = "Server not reachable. Please check backend.";
            }
        }
    });
}

function loadAdminUser() {
    const adminUser = sessionStorage.getItem("adminUser");
    const adminPages = ["dashboard", "income", "expense", "calendar", "reports"];
    if (!adminUser) {
        if (adminPages.includes(document.body.dataset.page)) {
            window.location.href = "admin-login.html";
        }
        return;
    }

    const name = adminUser.charAt(0).toUpperCase() + adminUser.slice(1);
    setText("adminName", name);
    setText("adminAvatar", name.charAt(0));
    setText("dropdownName", name);
}

function initAdminDropdown() {
    const userMenu = document.getElementById("userMenu");
    const dropdown = document.getElementById("userDropdown");
    if (!userMenu || !dropdown) return;

    userMenu.addEventListener("click", () => {
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (event) => {
        if (!userMenu.contains(event.target)) {
            dropdown.style.display = "none";
        }
    });
}

function logoutAdmin() {
    sessionStorage.removeItem("adminUser");
    window.location.href = "admin-login.html";
}

window.logoutAdmin = logoutAdmin;

function setTopbarDate() {
    const element = document.getElementById("topbarDate");
    if (element) {
        element.textContent = new Date().toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }
}

function buildMonthlySeries(monthlyIncome = [], monthlyExpense = []) {
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const incomeMap = Object.fromEntries(monthlyIncome.map((item) => [item.month, Number(item.total || 0)]));
    const expenseMap = Object.fromEntries(monthlyExpense.map((item) => [item.month, Number(item.total || 0)]));
    return {
        labels: monthLabels,
        income: monthLabels.map((month) => incomeMap[month] || 0),
        expense: monthLabels.map((month) => expenseMap[month] || 0)
    };
}

function destroyChart(chart) {
    if (chart) chart.destroy();
}

function renderDashboardCharts(data) {
    if (typeof Chart === "undefined") return;

    const trendCanvas = document.getElementById("dashboardTrendChart");
    const categoryCanvas = document.getElementById("dashboardCategoryChart");

    if (trendCanvas) {
        const monthlySeries = buildMonthlySeries(data.monthlyIncome, data.monthlyExpense);
        destroyChart(dashboardTrendChart);
        dashboardTrendChart = new Chart(trendCanvas, {
            type: "bar",
            data: {
                labels: monthlySeries.labels,
                datasets: [
                    { label: "Income", data: monthlySeries.income, backgroundColor: "#0f6e4d", borderRadius: 8 },
                    { label: "Expense", data: monthlySeries.expense, backgroundColor: "#dc2626", borderRadius: 8 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } }
        });
    }

    if (categoryCanvas) {
        destroyChart(dashboardCategoryChart);
        dashboardCategoryChart = new Chart(categoryCanvas, {
            type: "doughnut",
            data: {
                labels: (data.categoryExpense || []).map((item) => item.category),
                datasets: [{ data: (data.categoryExpense || []).map((item) => Number(item.total || 0)), backgroundColor: ["#0f6e4d", "#1a56db", "#d97706", "#dc2626", "#7c3aed", "#14b8a6"] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
        });
    }
}

function renderRecentActivity(transactions = []) {
    const container = document.getElementById("recentActivity");
    if (!container) return;

    if (!transactions.length) {
        container.innerHTML = "<div class='activity-item'><div class='act-info'><div>No transactions yet</div><div>Add income or expense to see live activity.</div></div></div>";
        return;
    }

    container.innerHTML = transactions.map((item) => {
        const isIncome = item.type === "income";
        return `
            <div class="activity-item">
                <div class="act-icon ${isIncome ? "badge-income" : "badge-expense"}">
                    <i class="bi ${isIncome ? "bi-arrow-down-left" : "bi-arrow-up-right"}"></i>
                </div>
                <div class="act-info">
                    <div>${item.title}</div>
                    <div>${formatDate(item.date)} â€¢ ${item.category}</div>
                </div>
                <div class="${isIncome ? "pos" : "neg"}">${isIncome ? "+" : "-"}${formatCurrency(item.amount)}</div>
            </div>
        `;
    }).join("");
}

async function initDashboard() {
    try {
        const data = await apiFetchJson("/admin/dashboard");
        setText("totalIncome", formatCurrency(data.totalIncome));
        setText("totalExpense", formatCurrency(data.totalExpense));
        setText("totalBalance", formatCurrency(data.balance));
        setText("totalUsers", String(data.totalUsers || 0));
        setText("topExpenseCategory", data.categoryExpense?.[0]?.category || "No expense data");
        setText("topExpenseCategoryAmount", formatCurrency(data.categoryExpense?.[0]?.total || 0));
        setText("topPaymentMethod", formatPaymentMethod(data.paymentMethods?.[0]?.paymentMethod));
        setText("topPaymentMethodAmount", formatCurrency(data.paymentMethods?.[0]?.total || 0));
        renderDashboardCharts(data);
        renderRecentActivity(data.recentTransactions || []);
    } catch (error) {
        console.error("Dashboard load error:", error);
    }
}

async function initIncomePage() {
    const form = document.getElementById("incomeForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
            userId: getUserId(),
            date: document.getElementById("incDate").value,
            category: document.getElementById("incCategory").value,
            source: document.getElementById("incSource").value.trim(),
            payment_method: document.getElementById("incPaymentMethod")?.value || null,
            amount: document.getElementById("incAmount").value,
            description: document.getElementById("incDesc").value.trim()
        };
        if (!payload.date || !payload.category || !payload.source || !payload.amount) {
            alert("Please fill all required fields.");
            return;
        }
        try {
            // Use admin endpoint for admin pages, user endpoint for user pages
            const isAdminPage = ["dashboard", "income", "expense", "calendar", "reports", "users"].includes(document.body.dataset.page);
            const endpoint = isAdminPage ? "/admin/income" : "/user/income";
            const result = await apiFetchJson(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            alert(result.message || "Income added successfully");
            form.reset();
        } catch (error) {
            console.error("Income save error:", error);
            alert(error.message || "Failed to save income");
        }
    });
}

async function initExpensePage() {
    const form = document.getElementById("expenseForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
            userId: getUserId(),
            date: document.getElementById("expDate").value,
            category: document.getElementById("expCategory").value,
            title: document.getElementById("expTitle").value.trim(),
            payment_method: document.getElementById("expPaymentMethod")?.value || null,
            amount: document.getElementById("expAmount").value,
            description: document.getElementById("expDesc").value.trim()
        };
        if (!payload.date || !payload.category || !payload.title || !payload.amount) {
            alert("Please fill all required fields.");
            return;
        }
        try {
            // Use admin endpoint for admin pages, user endpoint for user pages
            const isAdminPage = ["dashboard", "income", "expense", "calendar", "reports", "users"].includes(document.body.dataset.page);
            const endpoint = isAdminPage ? "/admin/expense" : "/user/expense";
            const result = await apiFetchJson(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            alert(result.message || "Expense added successfully");
            form.reset();
        } catch (error) {
            console.error("Expense save error:", error);
            alert(error.message || "Failed to save expense");
        }
    });
}

async function initCalendarPage() {
    const grid = document.getElementById("calGrid");
    if (!grid) return;

    let currentDate = new Date();
    const transactions = await loadTransactionsFromApi();

    if (transactions.length > 0) {
        currentDate = new Date(`${transactions[0].date}T00:00:00`);
    }

    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        setText("calMonthLabel", `${monthNames[month]} ${year}`);
        grid.innerHTML = "";

        for (let i = 0; i < firstDay; i += 1) {
            const emptyCell = document.createElement("div");
            emptyCell.className = "cal-day empty";
            grid.appendChild(emptyCell);
        }

        for (let day = 1; day <= totalDays; day += 1) {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayTransactions = transactions.filter((item) => item.date.startsWith(dateStr));
            const incomeCount = dayTransactions.filter((item) => item.type === "income").length;
            const expenseCount = dayTransactions.filter((item) => item.type === "expense").length;

            const cell = document.createElement("div");
            cell.className = "cal-day";
            cell.innerHTML = `
                <div class="cal-date-num">${day}</div>
                <div class="cal-dot-wrap">
                    ${incomeCount ? `<div class="cal-dot income-dot" title="${incomeCount} Income(s)"></div>` : ""}
                    ${expenseCount ? `<div class="cal-dot expense-dot" title="${expenseCount} Expense(s)"></div>` : ""}
                </div>
            `;

            cell.addEventListener("click", () => {
                const detailBox = document.getElementById("selectedDayRecords");
                if (!detailBox) return;
                
                const txHtml = dayTransactions.length === 0 
                    ? `<p>No transactions on ${dateStr}</p>` 
                    : `<h5 style="margin-bottom:10px;">Transactions on ${dateStr}</h5>
                       ${dayTransactions.map((item) => `
                        <div style="margin-bottom:15px; padding:10px; border:1px solid #ddd; border-radius:8px; position: relative;">
                            <strong>${item.type.toUpperCase()}</strong><br>
                            <strong>${item.source ? 'Source:' : 'Title:'}</strong> ${item.source || item.title}<br>
                            <strong>Category:</strong> ${item.category}<br>
                            <strong>Amount:</strong> ${formatCurrency(item.amount)}
                            <button class="btn-filter" style="position: absolute; right: 10px; top: 10px; background:var(--danger); padding:4px 8px; font-size:0.75rem" onclick="deleteCalendarEntry('${item.type}', ${item.id})">Delete</button>
                        </div>
                       `).join("")}`;
                
                detailBox.innerHTML = `
                    ${txHtml}
                    <hr>
                    <div style="display:flex;gap:10px;margin-bottom:10px;">
                        <button class="btn-submit-income" style="flex:1;padding:8px;font-size:0.8rem;border-radius:6px;border:none;color:white;cursor:pointer;" onclick="showCalendarForm('income', '${dateStr}')">+ Add Income</button>
                        <button class="btn-submit-expense" style="flex:1;padding:8px;font-size:0.8rem;background:var(--danger);border-radius:6px;border:none;color:white;cursor:pointer;" onclick="showCalendarForm('expense', '${dateStr}')">+ Add Expense</button>
                    </div>
                    <div id="calendarFormContainer"></div>
                `;
                
                // Active cell highlighting
                document.querySelectorAll(".cal-day").forEach(c => c.style.border = "");
                cell.style.border = "2px solid var(--accent)";
            });

            grid.appendChild(cell);
        }

        const currentMonthTransactions = transactions.filter((item) => {
            const itemDate = new Date(`${item.date}T00:00:00`);
            return itemDate.getMonth() === month && itemDate.getFullYear() === year;
        });

        const monthIncome = currentMonthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
        const monthExpense = currentMonthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);

        setText("calMonthInc", formatCurrency(monthIncome));
        setText("calMonthExp", formatCurrency(monthExpense));
        setText("calMonthBal", formatCurrency(monthIncome - monthExpense));
    }

    renderCalendar();
    document.getElementById("calPrev")?.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    document.getElementById("calNext")?.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
}

function renderReportsCharts(transactions) {
    try {
        if (typeof Chart === "undefined") return;
        const trendCanvas = document.getElementById("reportsTrendChart");
        const incomeMixCanvas = document.getElementById("reportsIncomeMixChart");
        const expenseMixCanvas = document.getElementById("reportsExpenseMixChart");

        if (trendCanvas) {
            const monthlyMap = {};
            transactions.forEach((item) => {
                const label = new Date(`${item.date}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
                if (!monthlyMap[label]) monthlyMap[label] = { income: 0, expense: 0 };
                if (item.type === "income") monthlyMap[label].income += Number(item.amount);
                else monthlyMap[label].expense += Number(item.amount);
            });
            const labels = Object.keys(monthlyMap).sort((a, b) => new Date("1 " + a) - new Date("1 " + b));
            destroyChart(reportsTrendChart);
            reportsTrendChart = new Chart(trendCanvas, {
                type: "bar",
                data: {
                    labels,
                    datasets: [
                        { label: "Income", data: labels.map((label) => monthlyMap[label].income), backgroundColor: "#0f6e4d", borderRadius: 4 },
                        { label: "Expense", data: labels.map((label) => monthlyMap[label].expense), backgroundColor: "#dc2626", borderRadius: 4 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
            // Store chart reference on canvas for PDF capture
            trendCanvas.chart = reportsTrendChart;
        }

        if (incomeMixCanvas) {
            const incomeMap = {};
            transactions.filter((item) => item.type === "income").forEach((item) => { incomeMap[item.category] = (incomeMap[item.category] || 0) + Number(item.amount); });
            const labels = Object.keys(incomeMap);
            destroyChart(reportsIncomeMixChart);
            if (labels.length > 0) {
                reportsIncomeMixChart = new Chart(incomeMixCanvas, {
                    type: "doughnut",
                    data: { labels, datasets: [{ data: labels.map((label) => incomeMap[label]), backgroundColor: ["#0f6e4d", "#1a56db", "#14b8a6", "#d97706", "#7c3aed"] }] },
                    options: { responsive: true, maintainAspectRatio: false }
                });
                // Store chart reference on canvas for PDF capture
                incomeMixCanvas.chart = reportsIncomeMixChart;
            }
        }

        if (expenseMixCanvas) {
            const expenseMap = {};
            transactions.filter((item) => item.type === "expense").forEach((item) => { expenseMap[item.category] = (expenseMap[item.category] || 0) + Number(item.amount); });
            const labels = Object.keys(expenseMap);
            destroyChart(reportsExpenseMixChart);
            if (labels.length > 0) {
                reportsExpenseMixChart = new Chart(expenseMixCanvas, {
                    type: "doughnut",
                    data: { labels, datasets: [{ data: labels.map((label) => expenseMap[label]), backgroundColor: ["#dc2626", "#d97706", "#1a56db", "#7c3aed", "#14b8a6"] }] },
                    options: { responsive: true, maintainAspectRatio: false }
                });
                // Store chart reference on canvas for PDF capture
                expenseMixCanvas.chart = reportsExpenseMixChart;
            }
        }
    } catch (err) {
        console.error("Error drawing charts:", err);
    }
}

async function initReportsPage() {
    const tbody = document.getElementById("reportsTbody");
    if (!tbody) return;

    const sumIncome = document.getElementById("sumIncome");
    const sumExpense = document.getElementById("sumExpense");
    const sumBalance = document.getElementById("sumBalance");
    const programRatio = document.getElementById("programRatio");
    const filterType = document.getElementById("filterType");
    const filterMonth = document.getElementById("filterMonth");
    const filterSearch = document.getElementById("filterSearch");
    const btnFilter = document.getElementById("btnFilter");
    const btnReset = document.getElementById("btnReset");
    const btnExport = document.getElementById("btnExport");
    const transactionForm = document.getElementById("transactionForm");
    const transactionModal = document.getElementById("transactionModal");

    if (transactionModal && window.bootstrap) {
        transactionModalInstance = bootstrap.Modal.getOrCreateInstance(transactionModal);
    }

    const fetchTransactions = async () => {
        reportTransactionsCache = await loadTransactionsFromApi();
        return reportTransactionsCache;
    };

    const getFilteredTransactions = (transactions) => {
        let filtered = [...transactions];
        if (filterType.value !== "all") filtered = filtered.filter((item) => item.type === filterType.value);
        if (filterMonth.value) filtered = filtered.filter((item) => item.date.startsWith(filterMonth.value));
        if (filterSearch.value.trim()) {
            const keyword = filterSearch.value.trim().toLowerCase();
            filtered = filtered.filter((item) =>
                [item.source, item.title, item.category, item.description, formatPaymentMethod(item.payment_method)]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(keyword))
            );
        }
        return filtered;
    };
    
    // Make getFilteredTransactions globally accessible
    window.getFilteredTransactionsForPDF = getFilteredTransactions;

    const exportTransactionsAsCsv = (transactions) => {
        const rows = [["Date", "Type", "Source/Title", "Category", "Payment Method", "Amount", "Description"]];
        transactions.forEach((item) => {
            rows.push([item.date, item.type, item.source || item.title || "", item.category || "", formatPaymentMethod(item.payment_method), item.amount, item.description || ""]);
        });
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "ngo-financial-report.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const openEditModal = (transaction) => {
        document.getElementById("editType").value = transaction.type;
        document.getElementById("editId").value = transaction.id;
        document.getElementById("editDate").value = normalizeDateValue(transaction.date);
        document.getElementById("editCategory").value = transaction.category || "";
        document.getElementById("editName").value = transaction.source || transaction.title || "";
        document.getElementById("editAmount").value = transaction.amount;
        document.getElementById("editDescription").value = transaction.description || "";
        document.getElementById("transactionModalLabel").textContent = `Edit ${transaction.type}`;
        if (window.bootstrap && transactionModal) {
            transactionModalInstance = bootstrap.Modal.getOrCreateInstance(transactionModal);
            transactionModalInstance.show();
        }
    };

    const deleteTransaction = async (transaction) => {
        if (!window.confirm(`Delete this ${transaction.type} record?`)) return;
        try {
            await apiFetchJson(`/user/${transaction.type}/${transaction.id}?userId=${getUserId()}`, { method: "DELETE" });
            await loadReports();
        } catch (error) {
            console.error("Delete error:", error);
            alert(error.message || "Failed to delete transaction");
        }
    };

    tbody.addEventListener("click", async (event) => {
        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) return;
        const transaction = reportTransactionsCache.find((item) => item.type === actionButton.dataset.type && String(item.id) === String(actionButton.dataset.id));
        if (!transaction) return;
        if (actionButton.dataset.action === "edit") openEditModal(transaction);
        if (actionButton.dataset.action === "delete") await deleteTransaction(transaction);
    });

    const loadReports = async () => {
        tbody.innerHTML = "<tr><td colspan='8'>Loading...</td></tr>";
        try {
            const allTransactions = await fetchTransactions();
            const transactions = getFilteredTransactions(allTransactions);
            let incomeTotal = 0;
            let expenseTotal = 0;

            if (!transactions.length) {
                tbody.innerHTML = "<tr><td colspan='8'>No transactions found</td></tr>";
                setText("sumIncome", formatCurrency(0));
                setText("sumExpense", formatCurrency(0));
                setText("sumBalance", formatCurrency(0));
                renderReportsCharts([]);
                return;
            }

            let adminExpenseTotal = 0;

            tbody.innerHTML = transactions.map((item, index) => {
                const amount = Number(item.amount);
                if (item.type === "income") {
                    incomeTotal += amount;
                } else {
                    expenseTotal += amount;
                    const cat = (item.category || "").toLowerCase();
                    if (cat.includes("admin") || cat.includes("salary") || cat.includes("rent") || cat.includes("util") || cat.includes("office") || cat.includes("software")) {
                        adminExpenseTotal += amount;
                    }
                }
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${formatDate(item.date)}</td>
                        <td style="text-transform:capitalize;">${item.type}</td>
                        <td>${item.source || item.title || "-"}</td>
                        <td>${item.category || "-"}</td>
                        <td>${formatCurrency(amount)}</td>
                        <td>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <button type="button" class="btn-filter" data-action="edit" data-type="${item.type}" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;">Edit</button>
                                <button type="button" class="btn-filter" data-action="delete" data-type="${item.type}" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;background:var(--danger);">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            sumIncome.innerText = formatCurrency(incomeTotal);
            sumExpense.innerText = formatCurrency(expenseTotal);
            sumBalance.innerText = formatCurrency(incomeTotal - expenseTotal);

            if (programRatio) {
                const programExpenseTotal = expenseTotal - adminExpenseTotal;
                const ratioValue = expenseTotal > 0 ? Math.round((programExpenseTotal / expenseTotal) * 100) : 0;
                programRatio.innerText = `${ratioValue}%`;
                programRatio.style.color = ratioValue >= 75 ? 'var(--primary)' : 'var(--danger)';
            }

            renderReportsCharts(transactions);
        } catch (error) {
            console.error("Reports Error:", error);
            tbody.innerHTML = "<tr><td colspan='8'>Error loading reports</td></tr>";
            sumIncome.innerText = formatCurrency(0);
            sumExpense.innerText = formatCurrency(0);
            sumBalance.innerText = formatCurrency(0);
            if (programRatio) programRatio.innerText = "0%";
        }
    };

    transactionForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const type = document.getElementById("editType").value;
        const id = document.getElementById("editId").value;
        const payload = {
            date: document.getElementById("editDate").value,
            category: document.getElementById("editCategory").value.trim(),
            amount: document.getElementById("editAmount").value,
            description: document.getElementById("editDescription").value.trim()
        };
        if (type === "income") payload.source = document.getElementById("editName").value.trim();
        else payload.title = document.getElementById("editName").value.trim();

        try {
            await apiFetchJson(`/user/${type}/${id}?userId=${getUserId()}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...payload, userId: getUserId()}) });
            transactionModalInstance?.hide();
            await loadReports();
        } catch (error) {
            console.error("Update error:", error);
            alert(error.message || "Failed to update transaction");
        }
    });

    btnFilter?.addEventListener("click", loadReports);
    btnReset?.addEventListener("click", () => { filterType.value = "all"; filterMonth.value = ""; filterSearch.value = ""; loadReports(); });
    btnExport?.addEventListener("click", async () => {
        if (typeof html2pdf === 'undefined') {
            alert("PDF generator is still loading.");
            return;
        }
        
        const transactions = getFilteredTransactions(reportTransactionsCache);
        if (!transactions.length) {
            alert("No data to export.");
            return;
        }

        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const container = document.createElement("div");
        container.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="text-align: center; color: #0f6e4d; margin-bottom: 5px;">Transaction Ledger</h2>
                <p style="text-align: center; color: #777; font-size: 14px; margin-bottom: 20px;">Generated On: ${dateStr} | Total Records: ${transactions.length}</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #333;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Date</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Type</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Source / Title</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(t => `
                            <tr style="page-break-inside: avoid;">
                                <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(t.date)}</td>
                                <td style="padding: 8px; border: 1px solid #ddd; text-transform: capitalize; color: ${t.type === 'income' ? '#0f6e4d' : '#dc2626'}">${t.type}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${t.source || t.title || "-"}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${t.category}</td>
                                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(t.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const opt = {
            margin:       10,
            filename:     `Transaction_Ledger_${new Date().toISOString().split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['css', 'legacy'] }
        };
        html2pdf().set(opt).from(container).save();
    });

    loadReports();
}

function exportRowsAsCsv(filename, rows) {
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function initUserDashboardPage() {
    const recentContainer = document.getElementById("userRecentNgoActivity");
    const pieCanvas = document.getElementById("userPieChart");
    const pieEmpty = document.getElementById("userPieChartEmpty");
    const trendCanvas = document.getElementById("userDonationTrendChart");
    const trendEmpty = document.getElementById("userDonationTrendEmpty");
    const fundingContainer = document.getElementById("projectFundingBars");

    if (!recentContainer) return;

    try {
        const [ngoData, donationData] = await Promise.all([
            apiFetchJson(`/user/ngos?userId=${getUserId()}`),
            apiFetchJson(`/user/transactions?type=income&projectLinked=true&userId=${getUserId()}`)
        ]);

        const ngos = ngoData.ngos || [];
        const donations = donationData.transactions || [];
        const allProjects = ngos.flatMap(ngo => (ngo.projects || []).map(p => ({ ...p })));
        const totalBudget = ngos.reduce((sum, ngo) => sum + Number(ngo.totals?.totalBudget || 0), 0);

        const activeCount = allProjects.filter(p => p.status === "active").length;
        const completedCount = allProjects.filter(p => p.status === "completed").length;
        const plannedCount = allProjects.filter(p => p.status === "planned").length;

        // Stat cards
        setText("userProjectCount", String(allProjects.length));
        setText("userTotalBudget", formatCurrency(totalBudget));
        setText("userCompletedCount", String(completedCount));
        setText("userActiveInfo", activeCount + " active, " + plannedCount + " planned");

        // Platform snapshot
        setText("aboutProjectCount", String(allProjects.length));
        setText("aboutActiveCount", String(activeCount));
        setText("aboutTotalBudget", formatCurrency(totalBudget));

        // ===== 1. BUDGET BY FOCUS AREA (Doughnut) =====
        const focusMap = {};
        allProjects.forEach(p => {
            const area = p.focus_area || "General";
            focusMap[area] = (focusMap[area] || 0) + Number(p.budget || 0);
        });
        const pieLabels = Object.keys(focusMap);
        const pieValues = Object.values(focusMap);

        if (!pieLabels.length) {
            if (pieEmpty) pieEmpty.style.display = "block";
        } else if (pieCanvas && typeof Chart !== "undefined") {
            if (pieEmpty) pieEmpty.style.display = "none";
            destroyChart(userPieChart);
            userPieChart = new Chart(pieCanvas, {
                type: "doughnut",
                data: {
                    labels: pieLabels,
                    datasets: [{
                        data: pieValues,
                        backgroundColor: ["#1a56db", "#0f6e4d", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#14b8a6", "#f59e0b"],
                        borderWidth: 2,
                        borderColor: "var(--card-bg)"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "65%",
                    plugins: {
                        legend: { position: "bottom", labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 } },
                        tooltip: {
                            callbacks: { label: function(ctx) { return ctx.label + ": Rs " + Number(ctx.raw).toLocaleString("en-IN"); } }
                        }
                    }
                }
            });
        }

        // ===== 2. PROJECT FUNDING PROGRESS BARS =====
        if (fundingContainer) {
            if (!allProjects.length) {
                fundingContainer.innerHTML = '<div class="chart-subtitle" style="color:var(--text-muted);padding:20px 0;">No projects yet. Add projects to see funding progress.</div>';
            } else {
                const maxBudget = Math.max(...allProjects.map(p => Number(p.budget || 0)), 1);
                const colors = ["#1a56db", "#0f6e4d", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#14b8a6", "#f59e0b"];
                fundingContainer.innerHTML = allProjects.map((project, i) => {
                    const budget = Number(project.budget || 0);
                    const pct = maxBudget > 0 ? Math.round((budget / maxBudget) * 100) : 0;
                    const color = colors[i % colors.length];
                    const statusDot = project.status === "active" ? "\u2705" : project.status === "completed" ? "\u2714\uFE0F" : "\u23F3";
                    return `
                        <div style="margin-bottom:18px;">
                            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
                                <div style="font-weight:600;font-size:0.88rem;color:var(--text-primary);">${statusDot} ${escapeHtml(project.project_name)}</div>
                                <div style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap;margin-left:12px;">${formatCurrency(budget)}</div>
                            </div>
                            <div style="background:var(--surface-2);border-radius:999px;height:22px;overflow:hidden;border:1px solid var(--border);position:relative;">
                                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${color},${color}cc);border-radius:999px;transition:width 0.8s ease;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">
                                    ${pct >= 15 ? '<span style="font-size:0.7rem;font-weight:700;color:white;">' + formatCurrency(budget) + '</span>' : ''}
                                </div>
                            </div>
                            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">${escapeHtml(project.focus_area || "General")} \u2022 ${formatProjectStatus(project.status)}</div>
                        </div>
                    `;
                }).join("");
            }
        }

        // ===== 3. DONATION TREND LINE CHART =====
        if (!donations.length) {
            if (trendEmpty) trendEmpty.style.display = "block";
            destroyChart(userDonationTrendChart);
        } else if (trendCanvas && typeof Chart !== "undefined") {
            if (trendEmpty) trendEmpty.style.display = "none";
            const groupedDonations = donations
                .slice()
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .reduce((map, item) => {
                    const key = normalizeDateValue(item.date);
                    map[key] = (map[key] || 0) + Number(item.amount || 0);
                    return map;
                }, {});
            const donationDates = Object.keys(groupedDonations);
            const firstDate = new Date(`${donationDates[0]}T00:00:00`);
            firstDate.setDate(firstDate.getDate() - 1);
            const baselineDate = normalizeDateValue(firstDate.toISOString().slice(0, 10));
            const trendLabels = [baselineDate, ...donationDates];
            let runningTotal = 0;
            const trendValues = trendLabels.map((label) => {
                runningTotal += Number(groupedDonations[label] || 0);
                return runningTotal;
            });

            destroyChart(userDonationTrendChart);
            userDonationTrendChart = new Chart(trendCanvas, {
                type: "line",
                data: {
                    labels: trendLabels.map((label) => formatDate(label)),
                    datasets: [{
                        label: "Donations",
                        data: trendValues,
                        borderColor: "#0f6e4d",
                        backgroundColor: "rgba(15,110,77,0.14)",
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: "#0f6e4d"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => formatCurrency(context.raw)
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => formatCurrency(value)
                            }
                        }
                    }
                }
            });
        }

        // ===== Recent project activity =====
        const recentProjects = ngos
            .flatMap((ngo) => (ngo.projects || []).map((project) => ({
                ngoName: ngo.ngo_name,
                project
            })))
            .sort((a, b) => b.project.id - a.project.id)
            .slice(0, 5);

        if (!recentProjects.length) {
            recentContainer.innerHTML = `
                <div class="activity-item">
                    <div class="act-info">
                        <div class="act-title">No project activity yet</div>
                        <div class="act-date">Add projects to see updates here.</div>
                    </div>
                </div>
            `;
        } else {
            const statusIcons = { active: "bi-play-circle-fill", completed: "bi-check-circle-fill", planned: "bi-clock-fill", on_hold: "bi-pause-circle-fill" };
            const statusColors = { active: "#1a56db", completed: "#10b981", planned: "#d97706", on_hold: "#dc2626" };
            recentContainer.innerHTML = recentProjects.map((item) => `
                <div class="activity-item">
                    <div class="act-icon" style="background:rgba(26,86,219,0.1);color:${statusColors[item.project.status] || '#1a56db'}"><i class="bi ${statusIcons[item.project.status] || 'bi-folder2-open'}"></i></div>
                    <div class="act-info">
                        <div class="act-title">${escapeHtml(item.project.project_name)}</div>
                        <div class="act-date">${escapeHtml(formatProjectStatus(item.project.status))} \u2022 Budget: ${formatCurrency(item.project.budget || 0)}</div>
                    </div>
                </div>
            `).join("");
        }

    } catch (error) {
        console.error("User dashboard error:", error);
        if (recentContainer) {
            recentContainer.innerHTML = `
                <div class="activity-item">
                    <div class="act-info">
                        <div class="act-title">Unable to load dashboard data</div>
                        <div class="act-date">Please check the backend and database connection.</div>
                    </div>
                </div>
            `;
        }
    }
}

async function initUserTransparencyPage() {
    try {
        const [dashboardData, ngoData, txData] = await Promise.all([
            apiFetchJson(`/user/dashboard?userId=${getUserId()}`),
            apiFetchJson(`/user/ngos?userId=${getUserId()}`),
            apiFetchJson(`/user/transactions?userId=${getUserId()}`)
        ]);

        const incomeCount = (txData.transactions || []).filter((item) => item.type === "income").length;
        const expenseCount = (txData.transactions || []).filter((item) => item.type === "expense").length;
        const projectCount = (ngoData.ngos || []).reduce((sum, ngo) => sum + (ngo.projects || []).length, 0);

        setText("transparencyIncome", formatCurrency(dashboardData.totalIncome || 0));
        setText("transparencyExpense", formatCurrency(dashboardData.totalExpense || 0));
        setText("transparencyBalance", formatCurrency(dashboardData.balance || 0));
        setText("transparencyIncomeCount", String(incomeCount));
        setText("transparencyExpenseCount", String(expenseCount));
        setText("transparencyProjectCount", String(projectCount));
        setText(
            "transparencySummary",
            `The system currently contains ${incomeCount} income entries, ${expenseCount} expense entries, and ${projectCount} project records. All three summary cards above are calculated live from those stored records.`
        );
    } catch (error) {
        console.error("Transparency page error:", error);
        setText("transparencySummary", "Unable to load live transparency data right now.");
    }
}

async function initUserDonationsPage() {
    const tbody = document.getElementById("donationHistoryBody");
    const exportButton = document.getElementById("donationExportBtn");
    const messageBox = document.getElementById("donationFormMessage");
    const donationChartCanvas = document.getElementById("donationPeriodChart");
    const donationRangeSelect = document.getElementById("donationPeriodRange");
    const donationMonthPicker = document.getElementById("donationMonthPicker");
    const donationYearPicker = document.getElementById("donationYearPicker");
    const donationCategoryCanvas = document.getElementById("donationCategoryChart");
    const donationChartEmpty = document.getElementById("donationTrendChartEmpty");
    const donationCategoryChartEmpty = document.getElementById("donationCategoryChartEmpty");
    const projectModalElement = document.getElementById("donationProjectModal");
    const projectModalTitle = document.getElementById("donationProjectModalTitle");
    const projectModalBody = document.getElementById("donationProjectModalBody");
    const filterForm = document.getElementById("donationFilterForm");
    const filterResetButton = document.getElementById("donationFilterReset");
    const filterFields = {
        dateFrom: document.getElementById("donationDateFrom"),
        dateTo: document.getElementById("donationDateTo"),
        project: document.getElementById("donationProjectFilter"),
        minAmount: document.getElementById("donationMinAmount"),
        maxAmount: document.getElementById("donationMaxAmount")
    };
    if (!tbody) return;

    let donationCache = [];

    const setMessage = (text, tone = "info") => {
        if (!messageBox) return;
        if (!text) {
            messageBox.style.display = "none";
            messageBox.textContent = "";
            return;
        }

        const styles = {
            info: "background:rgba(26,86,219,0.08);color:#1a56db;border:1px solid rgba(26,86,219,0.18);",
            success: "background:rgba(15,110,77,0.08);color:var(--primary);border:1px solid rgba(15,110,77,0.18);",
            error: "background:rgba(220,38,38,0.08);color:var(--danger);border:1px solid rgba(220,38,38,0.18);"
        };

        messageBox.style.cssText = `display:block;margin-top:16px;padding:12px 14px;border-radius:12px;font-size:0.9rem;${styles[tone] || styles.info}`;
        messageBox.textContent = text;
    };

    const getProjectProgress = (status) => {
        const progressByStatus = {
            planned: 15,
            active: 60,
            completed: 100,
            on_hold: 40
        };
        return progressByStatus[status] || 25;
    };

    const populateProjectFilter = async () => {
        if (!filterFields.project) return;

        try {
            const data = await apiFetchJson("/user/projects");
            const projects = data.projects || [];
            const currentValue = filterFields.project.value;
            filterFields.project.innerHTML = [
                '<option value="">All projects</option>',
                ...projects.map((project) => `<option value="${project.id}">${escapeHtml(project.project_name)}</option>`)
            ].join("");
            filterFields.project.value = currentValue;
        } catch (error) {
            console.error("Project filter load error:", error);
        }
    };

    const buildDonationQuery = () => {
        const params = new URLSearchParams({
            type: "income",
            projectLinked: "true",
            userId: String(getUserId())
        });

        const addParam = (key, value) => {
            if (value !== undefined && value !== null && String(value).trim() !== "") {
                params.set(key, String(value).trim());
            }
        };

        addParam("dateFrom", filterFields.dateFrom?.value);
        addParam("dateTo", filterFields.dateTo?.value);
        addParam("projectId", filterFields.project?.value);
        addParam("minAmount", filterFields.minAmount?.value);
        addParam("maxAmount", filterFields.maxAmount?.value);

        return params.toString();
    };

    const renderDonationRows = (donations) => {
        if (!donations.length) {
            tbody.innerHTML = "<tr><td colspan='6'>No donation records yet</td></tr>";
            return;
        }

        tbody.innerHTML = donations.map((item) => `
            <tr>
                <td>#${escapeHtml(item.id)}</td>
                <td>
                    <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(item.project_name || "General NGO Fund")}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-top:3px;">${escapeHtml(item.project_focus_area || item.category || "Donation")}</div>
                </td>
                <td class="amount-income">${formatCurrency(item.amount)}</td>
                <td>${formatDate(item.date)}</td>
                <td>${escapeHtml(formatPaymentMethod(item.payment_method))}</td>
                <td>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button type="button" class="btn-filter" data-action="view-project" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;">
                            <i class="bi bi-eye me-1"></i>Project
                        </button>
                        <button type="button" class="btn-filter" data-action="download-receipt" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;background:var(--primary);">
                            <i class="bi bi-file-earmark-pdf me-1"></i>Download Receipt
                        </button>
                    </div>
                </td>
            </tr>
        `).join("");
    };

    const getWeekKey = (dateValue) => {
        const date = new Date(`${normalizeDateValue(dateValue)}T00:00:00`);
        const firstDay = new Date(date.getFullYear(), 0, 1);
        const dayOffset = Math.floor((date - firstDay) / 86400000);
        const weekNumber = Math.ceil((dayOffset + firstDay.getDay() + 1) / 7);
        return `${date.getFullYear()} W${String(weekNumber).padStart(2, "0")}`;
    };

    const getLatestDonationDate = (donations) => {
        const dates = donations.map((item) => normalizeDateValue(item.date)).filter(Boolean).sort();
        return dates[dates.length - 1] || new Date().toISOString().slice(0, 10);
    };

    const setupPeriodPickers = (donations) => {
        const latestDate = getLatestDonationDate(donations);
        if (donationMonthPicker && !donationMonthPicker.value) {
            donationMonthPicker.value = latestDate.slice(0, 7);
        }
        if (donationYearPicker && !donationYearPicker.value) {
            donationYearPicker.value = latestDate.slice(0, 4);
        }
    };

    const syncPeriodPickerVisibility = () => {
        const range = donationRangeSelect?.value || "monthly";
        if (donationMonthPicker) donationMonthPicker.style.display = range === "monthly" ? "block" : "none";
        if (donationYearPicker) donationYearPicker.style.display = range === "yearly" ? "block" : "none";
    };

    const renderDonationChart = (donations, range = "monthly") => {
        if (!donationChartCanvas || typeof Chart === "undefined") return;

        if (!donations.length) {
            destroyChart(donationTrendChart);
            if (donationChartEmpty) donationChartEmpty.style.display = "block";
            return;
        }

        setupPeriodPickers(donations);
        syncPeriodPickerVisibility();

        const selectedMonth = donationMonthPicker?.value || getLatestDonationDate(donations).slice(0, 7);
        const selectedYear = donationYearPicker?.value || getLatestDonationDate(donations).slice(0, 4);
        const chartDonations = donations.filter((item) => {
            const normalizedDate = normalizeDateValue(item.date);
            if (range === "monthly") return normalizedDate.startsWith(selectedMonth);
            if (range === "yearly") return normalizedDate.startsWith(selectedYear);
            return true;
        });

        if (!chartDonations.length) {
            destroyChart(donationTrendChart);
            if (donationChartEmpty) donationChartEmpty.style.display = "block";
            return;
        }

        const grouped = chartDonations
            .slice()
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .reduce((map, item) => {
                const normalizedDate = normalizeDateValue(item.date);
                let key = formatDate(normalizedDate);
                if (range === "weekly") key = getWeekKey(item.date);
                if (range === "yearly") {
                    key = new Date(`${normalizedDate}T00:00:00`).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric"
                    });
                }
                map[key] = (map[key] || 0) + Number(item.amount || 0);
                return map;
            }, {});

        const labels = Object.keys(grouped);
        const values = labels.map((label) => grouped[label]);

        if (donationChartEmpty) donationChartEmpty.style.display = "none";
        destroyChart(donationTrendChart);
        donationTrendChart = new Chart(donationChartCanvas, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Amount donated",
                    data: values,
                    borderColor: "#0f6e4d",
                    backgroundColor: "rgba(15,110,77,0.72)",
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value)
                        }
                    }
                }
            }
        });
    };

    const renderCategoryChart = (donations) => {
        if (!donationCategoryCanvas || typeof Chart === "undefined") return;

        if (!donations.length) {
            destroyChart(donationCategoryChart);
            if (donationCategoryChartEmpty) donationCategoryChartEmpty.style.display = "block";
            return;
        }

        const grouped = donations.reduce((map, item) => {
            const key = item.project_focus_area || item.category || "General";
            map[key] = (map[key] || 0) + Number(item.amount || 0);
            return map;
        }, {});
        const labels = Object.keys(grouped);
        const values = labels.map((label) => grouped[label]);

        if (donationCategoryChartEmpty) donationCategoryChartEmpty.style.display = "none";
        destroyChart(donationCategoryChart);
        donationCategoryChart = new Chart(donationCategoryCanvas, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: ["#1a56db", "#0f6e4d", "#d97706", "#10b981", "#7c3aed", "#0891b2"],
                    borderColor: "var(--surface)",
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",
                plugins: {
                    legend: { position: "bottom", labels: { usePointStyle: true, pointStyleWidth: 10 } },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
                        }
                    }
                }
            }
        });
    };

    const showProjectProgress = (item) => {
        if (!projectModalElement || !projectModalBody || !projectModalTitle || typeof bootstrap === "undefined") return;

        const projectName = item.project_name || "General NGO Fund";
        const status = item.project_status || "active";
        const progress = getProjectProgress(status);
        projectModalTitle.textContent = projectName;
        projectModalBody.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
                <div style="width:44px;height:44px;border-radius:12px;background:rgba(26,86,219,0.1);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.35rem;">
                    <i class="bi bi-folder2-open"></i>
                </div>
                <div>
                    <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(projectName)}</div>
                    <div style="color:var(--text-muted);font-size:0.84rem;margin-top:3px;">${escapeHtml(item.project_focus_area || "General")} project</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);">
                    <div style="font-size:0.74rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Status</div>
                    <div style="margin-top:4px;font-weight:700;color:var(--text-primary);">${escapeHtml(formatProjectStatus(status))}</div>
                </div>
                <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);">
                    <div style="font-size:0.74rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Budget</div>
                    <div style="margin-top:4px;font-weight:700;color:var(--text-primary);">${formatCurrency(item.project_budget || 0)}</div>
                </div>
            </div>
            <div style="margin-bottom:8px;display:flex;justify-content:space-between;color:var(--text-secondary);font-size:0.86rem;font-weight:700;">
                <span>Project Progress</span>
                <span>${progress}%</span>
            </div>
            <div style="height:14px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border);overflow:hidden;">
                <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,var(--accent),var(--primary));"></div>
            </div>
            <div style="margin-top:14px;color:var(--text-muted);font-size:0.84rem;line-height:1.7;">
                ${item.project_start_date ? `Started ${formatDate(item.project_start_date)}. ` : ""}
                ${item.project_end_date ? `Target end date ${formatDate(item.project_end_date)}.` : "End date not added yet."}
            </div>
        `;

        bootstrap.Modal.getOrCreateInstance(projectModalElement).show();
    };

    const downloadReceipt = (item) => {
        const jsPdf = window.jspdf?.jsPDF;
        if (!jsPdf) {
            setMessage("Receipt PDF library is still loading. Please try again in a moment.", "error");
            return;
        }

        const user = loadUserSession() || {};
        const doc = new jsPdf();
        const receiptNo = `NID-${String(item.id).padStart(5, "0")}`;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("Nidigo Donation Receipt", 20, 24);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Receipt No: ${receiptNo}`, 20, 36);
        doc.text(`Generated: ${formatDate(new Date().toISOString().slice(0, 10))}`, 20, 44);

        doc.setDrawColor(15, 110, 77);
        doc.line(20, 52, 190, 52);

        doc.setFont("helvetica", "bold");
        doc.text("Donor Details", 20, 66);
        doc.setFont("helvetica", "normal");
        doc.text(`Name: ${user.name || "Donor User"}`, 20, 76);
        doc.text(`Email: ${user.email || "Not available"}`, 20, 84);

        doc.setFont("helvetica", "bold");
        doc.text("Donation Details", 20, 102);
        doc.setFont("helvetica", "normal");
        doc.text(`Donation ID: #${item.id}`, 20, 112);
        doc.text(`Project: ${item.project_name || "General NGO Fund"}`, 20, 120);
        doc.text(`Category: ${item.category || "Donation"}`, 20, 128);
        doc.text(`Donation Date: ${formatDate(item.date)}`, 20, 136);
        doc.text(`Payment Method: ${formatPaymentMethod(item.payment_method)}`, 20, 144);
        doc.text(`Amount Donated: ${formatCurrency(item.amount)}`, 20, 152);

        if (item.description) {
            doc.text("Note:", 20, 168);
            doc.text(doc.splitTextToSize(String(item.description), 160), 20, 176);
        }

        doc.setFont("helvetica", "bold");
        doc.text("Thank you for supporting Nidigo.", 20, 260);
        doc.save(`${receiptNo}-receipt.pdf`);
    };

    const loadDonationData = async () => {
        const data = await apiFetchJson(`/user/transactions?${buildDonationQuery()}`);
        const donations = data.transactions || [];
        donationCache = donations;
        const total = donations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const supportedProjects = new Set(donations.map((item) => item.project_id || item.project_name).filter(Boolean));
        const highestDonation = donations.reduce((max, item) => Math.max(max, Number(item.amount || 0)), 0);
        const latestDonation = donations[0] || null;

        setText("donationTotal", formatCurrency(total));
        setText("donationProjects", String(supportedProjects.size));
        setText("donationLastDate", latestDonation ? formatDate(latestDonation.date) : "-");
        setText("donationHighest", formatCurrency(highestDonation));
        renderDonationRows(donations);
        renderDonationChart(donations, donationRangeSelect?.value || "monthly");
        renderCategoryChart(donations);
        return donations;
    };

    tbody.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const item = donationCache.find((entry) => String(entry.id) === String(button.dataset.id));
        if (!item) return;

        if (button.dataset.action === "view-project") {
            showProjectProgress(item);
        }

        if (button.dataset.action === "download-receipt") {
            downloadReceipt(item);
        }
    });

    donationRangeSelect?.addEventListener("change", () => {
        renderDonationChart(donationCache, donationRangeSelect.value);
    });

    donationMonthPicker?.addEventListener("change", () => {
        renderDonationChart(donationCache, donationRangeSelect?.value || "monthly");
    });

    donationYearPicker?.addEventListener("change", () => {
        renderDonationChart(donationCache, donationRangeSelect?.value || "yearly");
    });

    filterForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await loadDonationData();
            setMessage("");
        } catch (error) {
            console.error("Donation filter error:", error);
            tbody.innerHTML = "<tr><td colspan='6'>Unable to apply donation filters</td></tr>";
            setMessage(error.message || "Unable to apply donation filters.", "error");
        }
    });

    filterResetButton?.addEventListener("click", async () => {
        filterForm?.reset();
        try {
            await loadDonationData();
            setMessage("");
        } catch (error) {
            setMessage(error.message || "Unable to reset donation filters.", "error");
        }
    });

    try {
        await populateProjectFilter();
        await loadDonationData();

        exportButton?.addEventListener("click", () => {
            const rows = [["Donation ID", "Project Name", "Amount Donated", "Donation Date", "Payment Method", "Category", "Note"]];
            donationCache.forEach((item) => {
                rows.push([
                    item.id,
                    item.project_name || "General NGO Fund",
                    item.amount,
                    normalizeDateValue(item.date),
                    formatPaymentMethod(item.payment_method),
                    item.category || "",
                    item.description || ""
                ]);
            });
            exportRowsAsCsv("donation-history.csv", rows);
        });
    } catch (error) {
        console.error("Donation history error:", error);
        tbody.innerHTML = "<tr><td colspan='6'>Unable to load donation history</td></tr>";
        setMessage(error.message || "Unable to load donation history.", "error");
    }
}

async function initUserExpensesPage() {
    const tbody = document.getElementById("expenseHistoryBody");
    const exportButton = document.getElementById("expenseExportBtn");
    const expenseForm = document.getElementById("expenseForm");
    const messageBox = document.getElementById("expenseFormMessage");
    const expenseChartCanvas = document.getElementById("expenseTrendChart");
    const expenseChartEmpty = document.getElementById("expenseTrendChartEmpty");
    if (!tbody) return;

    const expenseFields = {
        id: document.getElementById("expenseId"),
        date: document.getElementById("expenseDate"),
        category: document.getElementById("expenseCategory"),
        title: document.getElementById("expenseTitle"),
        method: document.getElementById("expenseMethod"),
        amount: document.getElementById("expenseAmount"),
        description: document.getElementById("expenseDescription")
    };

    let expenseCache = [];

    const setMessage = (text, tone = "info") => {
        if (!messageBox) return;
        if (!text) {
            messageBox.style.display = "none";
            messageBox.textContent = "";
            return;
        }

        const styles = {
            info: "background:rgba(26,86,219,0.08);color:#1a56db;border:1px solid rgba(26,86,219,0.18);",
            success: "background:rgba(15,110,77,0.08);color:var(--primary);border:1px solid rgba(15,110,77,0.18);",
            error: "background:rgba(220,38,38,0.08);color:var(--danger);border:1px solid rgba(220,38,38,0.18);"
        };

        messageBox.style.cssText = `display:block;margin-top:16px;padding:12px 14px;border-radius:12px;font-size:0.9rem;${styles[tone] || styles.info}`;
        messageBox.textContent = text;
    };

    const resetExpenseForm = () => {
        expenseForm?.reset();
        expenseFields.id.value = "";
    };

    const fillExpenseForm = (item) => {
        expenseFields.id.value = item.id;
        expenseFields.date.value = normalizeDateValue(item.date);
        expenseFields.category.value = item.category || "";
        expenseFields.title.value = item.title || "";
        expenseFields.method.value = item.payment_method || "";
        expenseFields.amount.value = item.amount ?? "";
        expenseFields.description.value = item.description || "";
        expenseFields.title.focus();
    };

    const renderExpenseRows = (expenses) => {
        if (!expenses.length) {
            tbody.innerHTML = "<tr><td colspan='8'>No expense records yet</td></tr>";
            return;
        }

        tbody.innerHTML = expenses.map((item) => `
            <tr>
                <td>${item.id}</td>
                <td>${formatDate(item.date)}</td>
                <td>${escapeHtml(item.category || "-")}</td>
                <td>${escapeHtml(item.title || "-")}</td>
                <td>${escapeHtml(formatPaymentMethod(item.payment_method))}</td>
                <td class="amount-expense">${formatCurrency(item.amount)}</td>
                <td>${escapeHtml(item.description || "-")}</td>
                <td>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button type="button" class="btn-filter" data-action="edit-expense" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;">Edit</button>
                        <button type="button" class="btn-filter" data-action="delete-expense" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;background:var(--danger);">Delete</button>
                    </div>
                </td>
            </tr>
        `).join("");
    };

    const renderExpenseChart = (expenses) => {
        if (!expenseChartCanvas || typeof Chart === "undefined") return;

        if (!expenses.length) {
            destroyChart(expenseTrendChart);
            if (expenseChartEmpty) expenseChartEmpty.style.display = "block";
            return;
        }

        const grouped = expenses
            .slice()
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .reduce((map, item) => {
                const key = normalizeDateValue(item.date);
                map[key] = (map[key] || 0) + Number(item.amount || 0);
                return map;
            }, {});

        const labels = Object.keys(grouped);
        const values = labels.map((label) => grouped[label]);

        if (expenseChartEmpty) expenseChartEmpty.style.display = "none";
        destroyChart(expenseTrendChart);
        expenseTrendChart = new Chart(expenseChartCanvas, {
            type: "line",
            data: {
                labels: labels.map((label) => formatDate(label)),
                datasets: [{
                    label: "Expense amount",
                    data: values,
                    borderColor: "#0f6e4d",
                    backgroundColor: "rgba(15,110,77,0.14)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value)
                        }
                    }
                }
            }
        });
    };

    const loadExpenseData = async () => {
        const data = await apiFetchJson(`/user/transactions?type=expense&userId=${getUserId()}`);
        const expenses = data.transactions || [];
        expenseCache = expenses;
        const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const average = expenses.length ? total / expenses.length : 0;

        setText("expenseTotal", formatCurrency(total));
        setText("expenseCount", String(expenses.length));
        setText("expenseAverage", formatCurrency(average));
        renderExpenseRows(expenses);
        renderExpenseChart(expenses);
        return expenses;
    };

    tbody.addEventListener("click", async (event) => {
        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) return;

        const item = expenseCache.find((entry) => String(entry.id) === String(actionButton.dataset.id));
        if (!item) return;

        if (actionButton.dataset.action === "edit-expense") {
            fillExpenseForm(item);
            setMessage(`Editing expense record #${item.id}`, "info");
            return;
        }

        if (actionButton.dataset.action === "delete-expense") {
            if (!window.confirm(`Delete expense record #${item.id}?`)) return;
            try {
                await apiFetchJson(`/user/expense/${item.id}?userId=${getUserId()}`, { method: "DELETE" });
                setMessage(`Expense record #${item.id} deleted successfully.`, "success");
                await loadExpenseData();
                resetExpenseForm();
            } catch (error) {
                setMessage(error.message || "Failed to delete expense record.", "error");
            }
        }
    });

    expenseForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            userId: getUserId(),
            date: expenseFields.date.value,
            category: expenseFields.category.value,
            title: expenseFields.title.value.trim(),
            payment_method: expenseFields.method.value || null,
            amount: expenseFields.amount.value,
            description: expenseFields.description.value.trim()
        };

        try {
            if (expenseFields.id.value) {
                await apiFetchJson(`/user/expense/${expenseFields.id.value}?userId=${getUserId()}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setMessage(`Expense record #${expenseFields.id.value} updated successfully.`, "success");
            } else {
                await apiFetchJson("/user/expense", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setMessage("New expense record added successfully.", "success");
            }

            resetExpenseForm();
            await loadExpenseData();
        } catch (error) {
            setMessage(error.message || "Failed to save expense entry.", "error");
        }
    });

    document.getElementById("expenseCancelBtn")?.addEventListener("click", () => {
        resetExpenseForm();
        setMessage("");
    });

    try {
        const expenses = await loadExpenseData();

        exportButton?.addEventListener("click", () => {
            const rows = [["Record ID", "Date", "Category", "Title", "Payment Method", "Amount", "Description"]];
            expenses.forEach((item) => {
                rows.push([
                    item.id,
                    normalizeDateValue(item.date),
                    item.category || "",
                    item.title || "",
                    formatPaymentMethod(item.payment_method),
                    item.amount,
                    item.description || ""
                ]);
            });
            exportRowsAsCsv("expense-history.csv", rows);
        });
    } catch (error) {
        console.error("Expense history error:", error);
        tbody.innerHTML = "<tr><td colspan='8'>Unable to load expense history</td></tr>";
        setMessage(error.message || "Unable to load expense history.", "error");
    }
}

async function initUserCalendarPage() {
    const grid = document.getElementById("calGrid");
    const detailBox = document.getElementById("selectedDayRecords");
    const detailTitle = document.querySelector(".cal-detail-title");
    if (!grid) return;

    let currentDate = new Date();
    let selectedDate = null;
    let donations = [];
    let projects = [];

    try {
        const [txData, projectData] = await Promise.all([
            apiFetchJson(`/user/transactions?type=income&userId=${getUserId()}`),
            apiFetchJson("/user/projects")
        ]);
        donations = txData.transactions || [];
        projects = projectData.projects || [];
    } catch (error) {
        console.error("User calendar data error:", error);
        if (detailBox) {
            detailBox.innerHTML = `<div class="cal-detail-empty">${escapeHtml(error.message || "Unable to load donation calendar data.")}</div>`;
        }
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const normalizeProjectDate = (value) => {
        const normalized = normalizeDateValue(value);
        return normalized || "";
    };

    const getProjectStartsForDate = (dateStr) =>
        projects.filter((project) => normalizeProjectDate(project.start_date) === dateStr);

    const getProjectEndsForDate = (dateStr) =>
        projects.filter((project) => normalizeProjectDate(project.end_date) === dateStr);

    const updateStats = (year, month) => {
        const monthDonations = donations.filter((item) => {
            const date = new Date(`${normalizeDateValue(item.date)}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() === month;
        });
        const monthProjectStarts = projects.filter((project) => {
            const startDate = normalizeProjectDate(project.start_date);
            if (!startDate) return false;
            const date = new Date(`${startDate}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() === month;
        });
        const monthProjectEnds = projects.filter((project) => {
            const endDate = normalizeProjectDate(project.end_date);
            if (!endDate) return false;
            const date = new Date(`${endDate}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        const monthTotal = monthDonations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        setText("calMonthInc", formatCurrency(monthTotal));
        setText("calTotalDonations", String(monthDonations.length));
        setText("calProjectsSupported", String(projects.length));
        setText("calProjectStarts", String(monthProjectStarts.length));
        setText("calProjectEnds", String(monthProjectEnds.length));
    };

    const showDayDetails = (date) => {
        const dateStr = normalizeDateValue(date);
        const dayDonations = donations.filter((item) => normalizeDateValue(item.date) === dateStr);
        const projectStarts = getProjectStartsForDate(dateStr);
        const projectEnds = getProjectEndsForDate(dateStr);

        if (detailTitle) {
            detailTitle.innerHTML = `<i class="bi bi-calendar3"></i> ${new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            })}`;
        }

        if (!detailBox) return;

        if (!dayDonations.length && !projectStarts.length && !projectEnds.length) {
            detailBox.innerHTML = '<div class="cal-detail-empty">No donations or project milestones recorded on this day.</div>';
            return;
        }

        const donationSection = dayDonations.length ? `
            <div style="font-size:0.78rem;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px;">Donations</div>
            ${dayDonations.map((donation) => `
            <div class="cal-txn-row">
              <div class="cal-txn-icon inc">
                <i class="bi bi-heart-fill"></i>
              </div>
              <div class="cal-txn-info">
                <div class="cal-txn-name">${escapeHtml(donation.source || "Donation")}</div>
                <div class="cal-txn-cat">${escapeHtml(donation.category || "Donation")}${donation.payment_method ? ` • ${escapeHtml(formatPaymentMethod(donation.payment_method))}` : ""}${donation.description ? ` • ${escapeHtml(donation.description)}` : ""}</div>
              </div>
              <div class="cal-txn-amt p">${escapeHtml(formatCurrency(donation.amount))}</div>
            </div>
            `).join("")}
        ` : "";

        const startSection = projectStarts.length ? `
            <div style="font-size:0.78rem;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:var(--text-muted);margin:${dayDonations.length ? "16px" : "0"} 0 10px 0;">Project Starts</div>
            ${projectStarts.map((project) => `
                <div style="padding:12px 14px;border:1px solid rgba(26,86,219,0.16);background:rgba(26,86,219,0.05);border-radius:14px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                        <div>
                            <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(project.project_name || "Project")}</div>
                            <div style="margin-top:4px;color:var(--text-muted);font-size:0.8rem;">${escapeHtml(project.ngo_name || "NGO")} ${project.focus_area ? `• ${escapeHtml(project.focus_area)}` : ""}</div>
                        </div>
                        <span style="background:rgba(26,86,219,0.10);color:var(--accent);border-radius:999px;padding:4px 9px;font-size:0.74rem;font-weight:700;">Start</span>
                    </div>
                </div>
            `).join("")}
        ` : "";

        const endSection = projectEnds.length ? `
            <div style="font-size:0.78rem;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:var(--text-muted);margin:${(dayDonations.length || projectStarts.length) ? "16px" : "0"} 0 10px 0;">Project Ends</div>
            ${projectEnds.map((project) => `
                <div style="padding:12px 14px;border:1px solid rgba(217,119,6,0.16);background:rgba(217,119,6,0.05);border-radius:14px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                        <div>
                            <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(project.project_name || "Project")}</div>
                            <div style="margin-top:4px;color:var(--text-muted);font-size:0.8rem;">${escapeHtml(project.ngo_name || "NGO")} ${project.focus_area ? `• ${escapeHtml(project.focus_area)}` : ""}</div>
                        </div>
                        <span style="background:rgba(217,119,6,0.10);color:var(--gold);border-radius:999px;padding:4px 9px;font-size:0.74rem;font-weight:700;">End</span>
                    </div>
                </div>
            `).join("")}
        ` : "";

        detailBox.innerHTML = `${donationSection}${startSection}${endSection}`;
    };

    const createDayCell = (day, isOtherMonth, dateObj) => {
        const cell = document.createElement("div");
        cell.className = "cal-cell";
        if (isOtherMonth) cell.classList.add("other-month");

        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
        const dayDonations = donations.filter((item) => normalizeDateValue(item.date) === dateStr);
        const projectStarts = getProjectStartsForDate(dateStr);
        const projectEnds = getProjectEndsForDate(dateStr);
        const todayStr = normalizeDateValue(new Date());

        if (dateStr === todayStr) cell.classList.add("today");
        if (selectedDate && dateStr === normalizeDateValue(selectedDate)) cell.classList.add("selected");

        const dateNum = document.createElement("div");
        dateNum.className = "cal-date";
        dateNum.textContent = String(day);
        cell.appendChild(dateNum);

        if (dayDonations.length) {
            const dotWrap = document.createElement("div");
            dotWrap.className = "cal-dot-wrap";

            const dot = document.createElement("div");
            dot.className = "cal-dot income-dot";
            dotWrap.appendChild(dot);

            const count = document.createElement("small");
            count.textContent = String(dayDonations.length);
            count.style.color = "var(--primary)";
            count.style.fontWeight = "700";
            dotWrap.appendChild(count);

            cell.appendChild(dotWrap);
        }

        if (projectStarts.length || projectEnds.length) {
            const markerWrap = document.createElement("div");
            markerWrap.style.display = "flex";
            markerWrap.style.justifyContent = "center";
            markerWrap.style.gap = "4px";
            markerWrap.style.marginTop = dayDonations.length ? "4px" : "8px";
            markerWrap.style.flexWrap = "wrap";

            if (projectStarts.length) {
                const startTag = document.createElement("span");
                startTag.textContent = "S";
                startTag.style.cssText = "min-width:18px;height:18px;border-radius:999px;background:rgba(26,86,219,0.10);border:1px solid rgba(26,86,219,0.25);display:flex;align-items:center;justify-content:center;font-size:0.66rem;color:var(--accent);font-weight:700;";
                markerWrap.appendChild(startTag);
            }

            if (projectEnds.length) {
                const endTag = document.createElement("span");
                endTag.textContent = "E";
                endTag.style.cssText = "min-width:18px;height:18px;border-radius:999px;background:rgba(217,119,6,0.10);border:1px solid rgba(217,119,6,0.25);display:flex;align-items:center;justify-content:center;font-size:0.66rem;color:var(--gold);font-weight:700;";
                markerWrap.appendChild(endTag);
            }

            cell.appendChild(markerWrap);
        }

        cell.addEventListener("click", () => {
            selectedDate = dateObj;
            renderCalendar();
            showDayDetails(dateStr);
        });

        return cell;
    };

    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        setText("calMonthLabel", `${monthNames[month]} ${year}`);
        grid.innerHTML = "";

        for (let i = firstDay - 1; i >= 0; i -= 1) {
            const day = daysInPrevMonth - i;
            grid.appendChild(createDayCell(day, true, new Date(year, month - 1, day)));
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            grid.appendChild(createDayCell(day, false, new Date(year, month, day)));
        }

        const remainingCells = 42 - grid.children.length;
        for (let day = 1; day <= remainingCells; day += 1) {
            grid.appendChild(createDayCell(day, true, new Date(year, month + 1, day)));
        }

        updateStats(year, month);
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

async function initUserProfilePage() {
    const user = loadUserSession();
    if (!user) return;

    setText("profileEmailStatus", user.email ? "Email available in session" : "Email not available");

    const profileForm = document.getElementById("profileDetailsForm");
    const profileResetBtn = document.getElementById("profileResetBtn");
    const profileMessage = document.getElementById("profileFormMessage");
    const changePasswordForm = document.getElementById("changePasswordForm");
    const changePasswordMessage = document.getElementById("changePasswordMessage");
    let profileSnapshot = null;

    const profileFields = {
        name: document.getElementById("profileName"),
        email: document.getElementById("profileEmail"),
        phone: document.getElementById("profilePhone"),
        pan: document.getElementById("profilePan"),
        address: document.getElementById("profileAddress"),
        memberSince: document.getElementById("profileMemberSince")
    };

    const setProfileMessage = (text, tone = "info") => {
        if (!profileMessage) return;
        if (!text) {
            profileMessage.style.display = "none";
            profileMessage.textContent = "";
            return;
        }

        const styles = {
            info: "background:rgba(26,86,219,0.08);color:#1a56db;border:1px solid rgba(26,86,219,0.18);",
            success: "background:rgba(15,110,77,0.08);color:var(--primary);border:1px solid rgba(15,110,77,0.18);",
            error: "background:rgba(220,38,38,0.08);color:var(--danger);border:1px solid rgba(220,38,38,0.18);"
        };

        profileMessage.style.cssText = `display:block;margin-top:14px;padding:12px 14px;border-radius:12px;font-size:0.88rem;${styles[tone] || styles.info}`;
        profileMessage.textContent = text;
    };

    const setPasswordMessage = (text, tone = "info") => {
        if (!changePasswordMessage) return;
        if (!text) {
            changePasswordMessage.style.display = "none";
            changePasswordMessage.textContent = "";
            return;
        }

        const styles = {
            info: "background:rgba(26,86,219,0.08);color:#1a56db;border:1px solid rgba(26,86,219,0.18);",
            success: "background:rgba(15,110,77,0.08);color:var(--primary);border:1px solid rgba(15,110,77,0.18);",
            error: "background:rgba(220,38,38,0.08);color:var(--danger);border:1px solid rgba(220,38,38,0.18);"
        };

        changePasswordMessage.style.cssText = `display:block;margin-top:12px;padding:12px 14px;border-radius:12px;font-size:0.88rem;${styles[tone] || styles.info}`;
        changePasswordMessage.textContent = text;
    };

    const populateProfileForm = (profile) => {
        profileSnapshot = profile;
        if (profileFields.name) profileFields.name.value = profile.name || "";
        if (profileFields.email) profileFields.email.value = profile.email || "";
        if (profileFields.phone) profileFields.phone.value = profile.phone || "";
        if (profileFields.pan) profileFields.pan.value = profile.pan_number || "";
        if (profileFields.address) profileFields.address.value = profile.address || "";
        if (profileFields.memberSince) {
            profileFields.memberSince.value = profile.created_at
                ? formatDate(String(profile.created_at).split("T")[0].split(" ")[0])
                : "Current session";
        }
    };

    const syncSessionUser = (profile) => {
        const updatedUser = {
            ...user,
            id: profile.id || user.id,
            name: profile.name || user.name,
            email: profile.email || user.email
        };
        sessionStorage.setItem("nidigoUser", JSON.stringify(updatedUser));
        applyUserSession();
    };

    try {
        const profileResponse = await apiFetchJson(`/user/profile/${user.id}`);
        if (profileResponse.user) {
            populateProfileForm(profileResponse.user);
            syncSessionUser(profileResponse.user);
        }
    } catch (error) {
        console.error("Profile load error:", error);
        populateProfileForm(user);
        setProfileMessage(error.message || "Unable to load full profile details right now.", "error");
    }

    try {
        const txData = await apiFetchJson(`/user/transactions?type=income&userId=${getUserId()}`);
        const donations = txData.transactions || [];
        const total = donations.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        let label = "New Supporter";
        let meta = "No recorded donations yet";
        let icon = "bi bi-person-fill";
        let background = "linear-gradient(135deg,#94a3b8,#64748b)";

        if (total >= 100000) {
            label = "Gold Supporter";
            meta = `Recorded contributions: ${formatCurrency(total)}`;
            icon = "bi bi-star-fill";
            background = "linear-gradient(135deg,var(--gold),#f59e0b)";
        } else if (total >= 50000) {
            label = "Silver Supporter";
            meta = `Recorded contributions: ${formatCurrency(total)}`;
            icon = "bi bi-award-fill";
            background = "linear-gradient(135deg,#cbd5e1,#94a3b8)";
        } else if (total > 0) {
            label = "Active Supporter";
            meta = `Recorded contributions: ${formatCurrency(total)}`;
            icon = "bi bi-heart-fill";
            background = "linear-gradient(135deg,var(--accent),#60a5fa)";
        }

        setText("profileStatusLabel", label);
        setText("profileStatusMeta", meta);

        const statusIcon = document.getElementById("profileStatusIcon");
        if (statusIcon) {
            statusIcon.style.background = background;
            statusIcon.innerHTML = `<i class="${icon}"></i>`;
        }
    } catch (error) {
        console.error("Profile page error:", error);
        setText("profileStatusMeta", "Unable to load donation history right now");
    }

    profileForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            name: profileFields.name?.value.trim(),
            email: profileFields.email?.value.trim(),
            phone: profileFields.phone?.value.trim(),
            pan_number: profileFields.pan?.value.trim(),
            address: profileFields.address?.value.trim()
        };

        if (!payload.name || !payload.email) {
            setProfileMessage("Name and email are required.", "error");
            return;
        }

        try {
            const result = await apiFetchJson(`/user/profile/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            populateProfileForm({
                ...profileSnapshot,
                ...result.user,
                created_at: profileSnapshot?.created_at || null
            });
            syncSessionUser(result.user || payload);
            setProfileMessage(result.message || "Profile updated successfully.", "success");
        } catch (error) {
            setProfileMessage(error.message || "Failed to update profile.", "error");
        }
    });

    profileResetBtn?.addEventListener("click", () => {
        if (profileSnapshot) {
            populateProfileForm(profileSnapshot);
        } else {
            populateProfileForm(user);
        }
        setProfileMessage("");
    });

    changePasswordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const currentPassword = document.getElementById("currentPassword").value.trim();
        const newPassword = document.getElementById("newPassword").value.trim();
        const confirmPassword = document.getElementById("confirmPassword").value.trim();

        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordMessage("Please fill in all password fields.", "error");
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMessage("New password must be at least 6 characters long.", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage("New password and confirm password do not match.", "error");
            return;
        }

        try {
            const result = await apiFetchJson("/user/change-password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.id,
                    currentPassword,
                    newPassword
                })
            });

            changePasswordForm.reset();
            setPasswordMessage(result.message || "Password changed successfully.", "success");
        } catch (error) {
            setPasswordMessage(error.message || "Failed to change password.", "error");
        }
    });
}

let userModalInstance;

function formatProjectStatus(value) {
    const labels = {
        planned: "Planned",
        active: "Active",
        completed: "Completed",
        on_hold: "On Hold"
    };
    return labels[value] || value || "Unknown";
}

async function initUserProjectsPage() {
    const projectForm = document.getElementById("projectForm");
    const ngoList = document.getElementById("ngoProjectList");
    const messageBox = document.getElementById("projectMessage");

    if (!projectForm || !ngoList) return;

    const projectFields = {
        id: document.getElementById("projectId"),
        ngoId: document.getElementById("projectNgo"),
        name: document.getElementById("projectName"),
        code: document.getElementById("projectCode"),
        focusArea: document.getElementById("projectFocus"),
        budget: document.getElementById("projectBudgetInput"),
        startDate: document.getElementById("projectStart"),
        endDate: document.getElementById("projectEnd"),
        status: document.getElementById("projectStatus"),
        description: document.getElementById("projectDescription")
    };

    const setMessage = (text, tone = "info") => {
        if (!messageBox) return;
        if (!text) { messageBox.style.display = "none"; messageBox.textContent = ""; return; }
        const styles = {
            info: "background:rgba(26,86,219,0.08);color:#1a56db;border:1px solid rgba(26,86,219,0.18);",
            success: "background:rgba(15,110,77,0.08);color:var(--primary);border:1px solid rgba(15,110,77,0.18);",
            error: "background:rgba(220,38,38,0.08);color:var(--danger);border:1px solid rgba(220,38,38,0.18);"
        };
        messageBox.style.cssText = `display:block;margin-bottom:16px;padding:12px 14px;border-radius:12px;font-size:0.9rem;${styles[tone] || styles.info}`;
        messageBox.textContent = text;
    };

    const resetProjectForm = () => {
        projectForm.reset();
        projectFields.id.value = "";
        projectFields.status.value = "active";
        if (ngoProjectCache.length && projectFields.ngoId) {
            projectFields.ngoId.value = ngoProjectCache[0].id;
        }
    };

    const renderProjectList = (ngos) => {
        const allProjects = ngos.reduce((sum, ngo) => sum + ngo.totals.projectCount, 0);
        const totalBudget = ngos.reduce((sum, ngo) => sum + Number(ngo.totals.totalBudget || 0), 0);
        setText("projectCount", String(allProjects));
        setText("projectBudget", formatCurrency(totalBudget));
        const projects = ngos.flatMap((ngo) => (ngo.projects || []).map((p) => ({ ...p, ngo_id: ngo.id })));
        if (!projects.length) {
            ngoList.innerHTML = `<div class="chart-card" style="background:var(--surface-2);border-style:dashed;"><div class="chart-title">No projects yet</div><div class="chart-subtitle">Add your first project using the form above.</div></div>`;
            return;
        }
        ngoList.innerHTML = projects.map((project) => `
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:18px;padding:16px 18px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                    <div style="flex:1;min-width:220px;">
                        <div style="font-weight:700;color:var(--text-primary);font-size:0.96rem;">${escapeHtml(project.project_name)}</div>
                        <div style="margin-top:4px;color:var(--text-muted);font-size:0.8rem;">${escapeHtml(project.focus_area || "Focus area not added")} \u2022 ${formatProjectStatus(project.status)}</div>
                        <div style="margin-top:10px;color:var(--text-secondary);font-size:0.87rem;line-height:1.65;">${escapeHtml(project.description || "No project description added yet.")}</div>
                    </div>
                    <div style="text-align:right;min-width:180px;">
                        <div style="font-weight:700;color:var(--gold);">${formatCurrency(project.budget)}</div>
                        <div style="margin-top:4px;color:var(--text-muted);font-size:0.8rem;">${project.start_date ? formatDate(project.start_date) : "No start"}${project.end_date ? ` to ${formatDate(project.end_date)}` : ""}</div>
                        ${project.project_code ? `<div style="margin-top:4px;color:var(--text-muted);font-size:0.78rem;">Code: ${escapeHtml(project.project_code)}</div>` : ""}
                    </div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
                    <button type="button" class="btn-filter" data-action="edit-project" data-project-id="${project.id}">Edit Project</button>
                    <button type="button" class="btn-filter" data-action="delete-project" data-project-id="${project.id}" style="background:var(--danger);">Delete Project</button>
                </div>
            </div>
        `).join("");
    };

    const fetchData = async () => {
        const data = await apiFetchJson(`/user/ngos?userId=${getUserId()}`);
        ngoProjectCache = data.ngos || [];
        if (ngoProjectCache.length && projectFields.ngoId) {
            projectFields.ngoId.value = ngoProjectCache[0].id;
        }
        renderProjectList(ngoProjectCache);
        return ngoProjectCache;
    };

    const findProject = (projectId) => {
        for (const ngo of ngoProjectCache) {
            const project = (ngo.projects || []).find((item) => String(item.id) === String(projectId));
            if (project) return project;
        }
        return null;
    };

    ngoList.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const projectId = button.dataset.projectId;

        if (action === "edit-project") {
            const project = findProject(projectId);
            if (!project) return;
            projectFields.id.value = project.id;
            projectFields.ngoId.value = project.ngo_id || (ngoProjectCache.length ? ngoProjectCache[0].id : "");
            projectFields.name.value = project.project_name || "";
            projectFields.code.value = project.project_code || "";
            projectFields.focusArea.value = project.focus_area || "";
            projectFields.budget.value = project.budget != null ? project.budget : 0;
            projectFields.startDate.value = normalizeDateValue(project.start_date);
            projectFields.endDate.value = normalizeDateValue(project.end_date);
            projectFields.status.value = project.status || "active";
            projectFields.description.value = project.description || "";
            projectFields.name.focus();
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (action === "delete-project") {
            if (!window.confirm("Delete this project?")) return;
            try {
                await apiFetchJson(`/user/projects/${projectId}?userId=${getUserId()}`, { method: "DELETE" });
                setMessage("Project deleted successfully.", "success");
                await fetchData();
                resetProjectForm();
            } catch (error) {
                setMessage(error.message || "Failed to delete project.", "error");
            }
        }
    });

    projectForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const ngoId = (projectFields.ngoId && projectFields.ngoId.value) || (ngoProjectCache.length ? ngoProjectCache[0].id : "");
        if (!ngoId) {
            setMessage("No NGO found in the system. Please contact the admin.", "error");
            return;
        }
        const payload = {
            ngo_id: ngoId,
            project_name: projectFields.name.value.trim(),
            project_code: projectFields.code.value.trim(),
            focus_area: projectFields.focusArea.value.trim(),
            budget: projectFields.budget.value,
            start_date: projectFields.startDate.value,
            end_date: projectFields.endDate.value,
            status: projectFields.status.value,
            description: projectFields.description.value.trim()
        };
        try {
            if (projectFields.id.value) {
                await apiFetchJson(`/user/projects/${projectFields.id.value}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                setMessage("Project updated successfully.", "success");
            } else {
                await apiFetchJson("/user/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                setMessage("Project added successfully.", "success");
            }
            resetProjectForm();
            await fetchData();
        } catch (error) {
            setMessage(error.message || "Failed to save project.", "error");
        }
    });

    document.getElementById("projectCancelBtn")?.addEventListener("click", resetProjectForm);

    try {
        setMessage("Loading project data...", "info");
        await fetchData();
        setMessage("");
    } catch (error) {
        setMessage(error.message || "Failed to load project data.", "error");
    }
}

async function initUsersPage() {
    const tbody = document.getElementById("usersTbody");
    const userForm = document.getElementById("userForm");
    const userModal = document.getElementById("userModal");
    const userIdInput = document.getElementById("userId");
    const userNameInput = document.getElementById("userName");
    const userEmailInput = document.getElementById("userEmail");
    const userPasswordInput = document.getElementById("userPassword");
    const errorBox = document.getElementById("userFormError");
    const errorBoxText = document.getElementById("userFormErrorText");
    const passwordHint = document.getElementById("passwordHint");
    const modalLabel = document.getElementById("userModalLabel");

    if (userModal && window.bootstrap) {
        userModalInstance = new bootstrap.Modal(userModal);
    }

    window.openUserModal = () => {
        userIdInput.value = "";
        userNameInput.value = "";
        userEmailInput.value = "";
        userPasswordInput.value = "";
        userPasswordInput.required = true;
        passwordHint.textContent = "Minimum 6 characters";
        errorBox.classList.add("d-none");
        errorBox.classList.remove("d-block");
        modalLabel.textContent = "Add New User";
        
        // Show the modal
        if (userModalInstance) {
            userModalInstance.show();
        }
    };

    window.openEditUserModal = (id, name, email) => {
        userIdInput.value = id;
        userNameInput.value = name;
        userEmailInput.value = email;
        userPasswordInput.value = "";
        userPasswordInput.required = false;
        passwordHint.textContent = "(Leave blank to keep unchanged)";
        errorBox.classList.add("d-none");
        errorBox.classList.remove("d-block");
        modalLabel.textContent = "Edit User";
        if (userModalInstance) {
            userModalInstance.show();
        }
    };

    window.deleteUser = async (id) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        try {
            await apiFetchJson(`/admin/users/${id}`, { method: "DELETE" });
            fetchUsers();
        } catch (error) {
            console.error("Delete Error:", error);
            alert(error.message || "Failed to delete user");
        }
    };

    const fetchUsers = async () => {
        if (!tbody) return;
        tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";
        try {
            const data = await apiFetchJson("/admin/users");
            const users = data.users || [];
            
            if (!users.length) {
                tbody.innerHTML = "<tr><td colspan='4'>No users found</td></tr>";
                return;
            }

            tbody.innerHTML = users.map(user => {
                const safeName = (user.name || "").replace(/'/g, "\\'");
                const safeEmail = (user.email || "").replace(/'/g, "\\'");
                return `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.name || "-"}</td>
                    <td>${user.email || "-"}</td>
                    <td>
                        <button class="btn-action btn-edit" onclick="openEditUserModal('${user.id}', '${safeName}', '${safeEmail}')">Edit</button>
                        <button class="btn-action btn-delete" onclick="deleteUser('${user.id}')">Delete</button>
                    </td>
                </tr>
                `;
            }).join("");
        } catch (error) {
            console.error("Fetch Users Error:", error);
            tbody.innerHTML = "<tr><td colspan='4'>Error loading users</td></tr>";
        }
    };

    userForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = userIdInput.value;
        const name = userNameInput.value.trim();
        const email = userEmailInput.value.trim();
        const password = userPasswordInput.value.trim();

        errorBox.classList.add("d-none");
        errorBox.classList.remove("d-block");

        // Validation
        if (!name || name.length < 2) {
            errorBox.classList.remove("d-none");
            errorBox.classList.add("d-block");
            errorBoxText.textContent = "Name must be at least 2 characters long";
            return;
        }

        if (!email || !email.includes('@')) {
            errorBox.classList.remove("d-none");
            errorBox.classList.add("d-block");
            errorBoxText.textContent = "Please enter a valid email address";
            return;
        }

        if (!id && (!password || password.length < 6)) {
            errorBox.classList.remove("d-none");
            errorBox.classList.add("d-block");
            errorBoxText.textContent = "Password must be at least 6 characters long";
            return;
        }

        const payload = { name, email };
        if (password) payload.password = password;

        try {
            if (id) {
                // Update User
                await apiFetchJson(`/admin/users/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            } else {
                // Add User
                await apiFetchJson("/admin/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password })
                });
            }
            
            userModalInstance?.hide();
            fetchUsers();
        } catch (error) {
            errorBox.classList.remove("d-none");
            errorBox.classList.add("d-block");
            errorBoxText.textContent = error.message || "Failed to save user";
        }
    });
    fetchUsers();
}

window.generatePDF = async function() {
    if (typeof html2pdf === 'undefined') {
        alert("PDF generator is still loading. Please try again in a few seconds.");
        return;
    }

    // Get filter values from DOM
    const filterType = document.getElementById("filterType");
    const filterMonth = document.getElementById("filterMonth");
    const filterSearch = document.getElementById("filterSearch");
    
    // Apply filtering logic directly in PDF generation
    let transactions = typeof reportTransactionsCache !== "undefined" ? [...reportTransactionsCache] : [];
    
    // If no transactions in cache, try to load them
    if (transactions.length === 0) {
        try {
            const isAdminPage = ["dashboard", "income", "expense", "calendar", "reports", "users"].includes(document.body.dataset.page);
            let data;
            if (isAdminPage) {
                data = await apiFetchJson('/admin/transactions');
            } else {
                const userId = getUserId();
                data = await apiFetchJson(`/user/transactions?userId=${userId}`);
            }
            transactions = (data.transactions || []).map((item) => ({
                ...item,
                date: normalizeDateValue(item.date)
            }));
        } catch (error) {
            console.error("Failed to load transactions for PDF:", error);
        }
    }
    
    if (filterType && filterType.value !== "all") {
        transactions = transactions.filter((item) => item.type === filterType.value);
    }
    if (filterMonth && filterMonth.value) {
        transactions = transactions.filter((item) => item.date.startsWith(filterMonth.value));
    }
    if (filterSearch && filterSearch.value.trim()) {
        const keyword = filterSearch.value.trim().toLowerCase();
        transactions = transactions.filter((item) =>
            [item.source, item.title, item.category, item.description, formatPaymentMethod(item.payment_method)]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(keyword))
        );
    }

    let incomeTotal = 0;
    let expenseTotal = 0;
    
    transactions.forEach(t => {
        if (t.type === 'income') incomeTotal += Number(t.amount);
        else expenseTotal += Number(t.amount);
    });
    
    const balance = incomeTotal - expenseTotal;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Ensure charts are rendered and capture chart images
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const trendCanvas = document.getElementById("reportsTrendChart");
    const incomeCanvas = document.getElementById("reportsIncomeMixChart");
    const expenseCanvas = document.getElementById("reportsExpenseMixChart");

    // Enhanced chart capture with better error handling
    const getCanvasImage = (canvas) => {
        try {
            if (!canvas || !canvas.getContext) return "";
            // Force chart to render before capturing
            if (window.Chart && canvas.chart) {
                canvas.chart.update();
            }
            return canvas.toDataURL("image/png", 0.9);
        } catch (error) {
            console.warn("Failed to capture chart:", error);
            return "";
        }
    };

    const trendImg = getCanvasImage(trendCanvas);
    const incomeImg = getCanvasImage(incomeCanvas);
    const expenseImg = getCanvasImage(expenseCanvas);

    const reportContainer = document.createElement("div");
    reportContainer.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 800px; margin: auto;">
            <!-- 1. Header -->
            <div style="text-align: center; border-bottom: 3px solid #0f6e4d; padding-bottom: 20px; margin-bottom: 20px;">
                <h1 style="margin: 0; color: #0f6e4d; font-size: 28px;">Nidigo Finance System</h1>
                <h2 style="margin: 5px 0; color: #555; font-size: 20px;">Financial Summary Report</h2>
                <p style="margin: 5px 0 0; font-size: 14px; color: #777;">Generated By: Admin | Generated On: ${dateStr}</p>
            </div>
            
            <!-- 2. Executive Summary -->
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; color: #444;">1. Executive Summary</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                <tr>
                    <td style="padding: 12px; border: 1px solid #ddd; background: #f9f9f9; width: 25%;"><strong>Total Income</strong></td>
                    <td style="padding: 12px; border: 1px solid #ddd; width: 25%; color: #0f6e4d; font-weight: bold;">${formatCurrency(incomeTotal)}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; background: #f9f9f9; width: 25%;"><strong>Total Expenses</strong></td>
                    <td style="padding: 12px; border: 1px solid #ddd; width: 25%; color: #dc2626; font-weight: bold;">${formatCurrency(expenseTotal)}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Current Balance</strong></td>
                    <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: ${balance >= 0 ? '#0f6e4d' : '#dc2626'}">${formatCurrency(balance)}</td>
                    <td style="padding: 12px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Total Records</strong></td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${transactions.length} Transactions</td>
                </tr>
            </table>

            <!-- 3. Visual Analytics -->
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; color: #444; page-break-before: always;">2. Visual Analytics</h3>
            <div style="text-align: center; margin-bottom: 30px;">
                <h4 style="margin-bottom: 10px; color: #555;">Filtered Trend Analysis</h4>
                ${trendImg ? `<img src="${trendImg}" style="max-width: 100%; height: 260px; object-fit: contain;">` : '<p>No data available</p>'}
            </div>
            <div style="display: flex; justify-content: space-around; margin-bottom: 30px;">
                <div style="text-align: center; width: 45%;">
                    <h4 style="margin-bottom: 10px; color: #555;">Income Mix</h4>
                    ${incomeImg ? `<img src="${incomeImg}" style="max-width: 100%; height: 200px; object-fit: contain;">` : '<p>No data available</p>'}
                </div>
                <div style="text-align: center; width: 45%;">
                    <h4 style="margin-bottom: 10px; color: #555;">Expense Mix</h4>
                    ${expenseImg ? `<img src="${expenseImg}" style="max-width: 100%; height: 200px; object-fit: contain;">` : '<p>No data available</p>'}
                </div>
            </div>

            <!-- 4. Donation / Income Report -->
            <div style="page-break-before: always;"></div>
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; color: #444;">3. Donation & Income Report</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px;">
                <thead>
                    <tr style="background: #0f6e4d; color: white;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Date</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Donor / Source</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.filter(t=>t.type==='income').map(t => `
                        <tr style="page-break-inside: avoid;">
                            <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(t.date)}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${t.source || t.title || "-"}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${t.category}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #0f6e4d;">${formatCurrency(t.amount)}</td>
                        </tr>
                    `).join('')}
                    ${transactions.filter(t=>t.type==='income').length === 0 ? '<tr><td colspan="4" style="padding: 10px; text-align: center;">No income records found</td></tr>' : ''}
                </tbody>
            </table>

            <!-- 5. Expense Report -->
            <div style="page-break-before: always;"></div>
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; color: #444;">4. Expense Report</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px;">
                <thead>
                    <tr style="background: #dc2626; color: white;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Date</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Title / Vendor</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.filter(t=>t.type==='expense').map(t => `
                        <tr style="page-break-inside: avoid;">
                            <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(t.date)}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${t.source || t.title || "-"}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${t.category}</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #dc2626;">${formatCurrency(t.amount)}</td>
                        </tr>
                    `).join('')}
                    ${transactions.filter(t=>t.type==='expense').length === 0 ? '<tr><td colspan="4" style="padding: 10px; text-align: center;">No expense records found</td></tr>' : ''}
                </tbody>
            </table>
            
            <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
                This is an electronically generated report by the Nidigo Finance System.
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `NGO_Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(reportContainer).save();
};

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setTopbarDate();
    applyUserSession();
    document.querySelectorAll(".mode-toggle").forEach((button) => button.addEventListener("click", toggleTheme));
    
    
    const page = document.body.dataset.page;

    if (["dashboard", "income", "expense", "calendar", "reports", "users"].includes(page)) {
        loadAdminUser();
        initAdminDropdown();
    }

    switch (page) {
        case "dashboard": initDashboard(); break;
        case "income": initIncomePage(); break;
        case "expense": initExpensePage(); break;
        case "calendar": initCalendarPage(); break;
        case "reports": initReportsPage(); break;
        case "users": initUsersPage(); break;
        case "user-dashboard": initUserDashboardPage(); break;
        case "user-donations": initUserDonationsPage(); break;
        case "user-expenses": initUserExpensesPage(); break;
        case "user-calendar": initUserCalendarPage(); break;
        case "user-projects": initUserProjectsPage(); break;
        case "user-transparency": initUserTransparencyPage(); break;
        case "user-profile": initUserProfilePage(); break;
        case "user-login": initUserLoginPage(); break;
        case "user-register": initUserRegisterPage(); break;
        default: break;
    }
});

window.deleteCalendarEntry = async function(type, id) {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
        await apiFetchJson(`/user/${type}/${id}?userId=${getUserId()}`, { method: "DELETE" });
        alert("Entry deleted");
        initCalendarPage(); // Refresh calendar
    } catch(err) {
        alert("Failed to delete: " + err.message);
    }
};

window.showCalendarForm = function(type, dateStr) {
    const container = document.getElementById("calendarFormContainer");
    if (!container) return;
    
    // Basic form HTML
    container.innerHTML = `
        <form id="calInlineForm" style="padding:15px; border:1px solid #eee; border-radius:8px; background:#f9fafb; margin-top:10px;">
            <p style="margin-top:0;font-weight:bold;color:var(--text-main)">Add ${type === 'income' ? 'Income' : 'Expense'} for ${dateStr}</p>
            <input type="hidden" id="calDate" value="${dateStr}">
            <div class="form-group mb-2">
                <label class="form-label" style="font-size:0.8rem">Category</label>
                <select id="calCat" class="form-select form-select-sm" required>
                    <option value="">Select...</option>
                    ${type === 'income' 
                        ? '<option value="Donation">Donation</option><option value="Grant">Grant</option><option value="Sponsorship">Sponsorship</option><option value="Other">Other</option>'
                        : '<option value="Salary">Salary</option><option value="Project">Project</option><option value="Rent">Rent</option><option value="Other">Other</option>'}
                </select>
            </div>
            <div class="form-group mb-2">
                <label class="form-label" style="font-size:0.8rem">${type === 'income' ? 'Source / Donor' : 'Expense Title'}</label>
                <input type="text" id="calTitle" class="form-control form-control-sm" required>
            </div>
            <div class="form-group mb-3">
                <label class="form-label" style="font-size:0.8rem">Amount (Rs)</label>
                <input type="number" id="calAmt" class="form-control form-control-sm" required min="1">
            </div>
            <div style="display:flex;gap:10px;">
                <button type="submit" class="${type === 'income' ? 'btn-submit-income' : 'btn-submit-expense'}" style="flex:1;padding:6px;font-size:0.8rem;border:none;border-radius:6px;color:white">Save</button>
                <button type="button" class="btn-reset" style="flex:1;padding:6px;font-size:0.8rem" onclick="document.getElementById('calendarFormContainer').innerHTML=''">Cancel</button>
            </div>
        </form>
    `;
    
    document.getElementById("calInlineForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
            userId: getUserId(),
            date: document.getElementById("calDate").value,
            category: document.getElementById("calCat").value,
            amount: document.getElementById("calAmt").value
        };
        
        if (type === 'income') {
            payload.source = document.getElementById("calTitle").value.trim();
        } else {
            payload.title = document.getElementById("calTitle").value.trim();
        }
        
        try {
            await apiFetchJson(`/user/${type}?userId=${getUserId()}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            alert(`${type === 'income' ? 'Income' : 'Expense'} added !`);
            container.innerHTML = "";
            initCalendarPage(); // Refresh calendar completely
        } catch (err) {
            alert("Failed to save: " + err.message);
        }
    });
};
