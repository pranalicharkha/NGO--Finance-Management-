let dashboardTrendChart;
let dashboardCategoryChart;
let reportsTrendChart;
let reportsCategoryChart;
let reportTransactionsCache = [];
let transactionModalInstance;
let ngoProjectCache = [];
let userPieChart;
let donationTrendChart;

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
    const userId = getUserId();
    const data = await apiFetchJson(`/user/transactions?userId=${userId}`);
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
            errorBox.style.display = "none";
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
            errorBox.style.display = "none";
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

            alert("Registration successful. Please login.");
            window.location.href = "user-login.html";
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
                <div style="display:flex;justify-content:center;gap:6px;margin-top:6px;flex-wrap:wrap;">
                    ${incomeCount ? `<span class="dot-income"></span><small>${incomeCount}</small>` : ""}
                    ${expenseCount ? `<span class="dot-expense"></span><small>${expenseCount}</small>` : ""}
                </div>
            `;

            cell.addEventListener("click", () => {
                const detailBox = document.getElementById("selectedDayRecords");
                if (!detailBox) return;
                if (!dayTransactions.length) {
                    detailBox.innerHTML = `<p>No transactions on ${dateStr}</p>`;
                    return;
                }
                detailBox.innerHTML = `
                    <h5 style="margin-bottom:10px;">Transactions on ${dateStr}</h5>
                    ${dayTransactions.map((item) => `
                        <div style="margin-bottom:15px; padding:10px; border:1px solid #ddd; border-radius:8px;">
                            <strong>${item.type.toUpperCase()}</strong><br>
                            ${item.source ? `Source: ${item.source}` : `Title: ${item.title}`}<br>
                            Category: ${item.category}<br>
                            Amount: ${formatCurrency(item.amount)}
                        </div>
                    `).join("")}
                `;
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
    if (typeof Chart === "undefined") return;
    const trendCanvas = document.getElementById("reportsTrendChart");
    const categoryCanvas = document.getElementById("reportsCategoryChart");

    if (trendCanvas) {
        const monthlyMap = {};
        transactions.forEach((item) => {
            const label = new Date(`${item.date}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
            if (!monthlyMap[label]) monthlyMap[label] = { income: 0, expense: 0 };
            if (item.type === "income") monthlyMap[label].income += Number(item.amount);
            else monthlyMap[label].expense += Number(item.amount);
        });
        const labels = Object.keys(monthlyMap);
        destroyChart(reportsTrendChart);
        reportsTrendChart = new Chart(trendCanvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    { label: "Income", data: labels.map((label) => monthlyMap[label].income), borderColor: "#0f6e4d", backgroundColor: "rgba(15,110,77,0.12)", tension: 0.35, fill: true },
                    { label: "Expense", data: labels.map((label) => monthlyMap[label].expense), borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.12)", tension: 0.35, fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    if (categoryCanvas) {
        const expenseCategoryMap = {};
        transactions.filter((item) => item.type === "expense").forEach((item) => { expenseCategoryMap[item.category] = (expenseCategoryMap[item.category] || 0) + Number(item.amount); });
        const labels = Object.keys(expenseCategoryMap);
        destroyChart(reportsCategoryChart);
        reportsCategoryChart = new Chart(categoryCanvas, {
            type: "polarArea",
            data: { labels, datasets: [{ data: labels.map((label) => expenseCategoryMap[label]), backgroundColor: ["#0f6e4d", "#1a56db", "#d97706", "#dc2626", "#7c3aed", "#14b8a6"] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

async function initReportsPage() {
    const tbody = document.getElementById("reportsTbody");
    if (!tbody) return;

    const sumIncome = document.getElementById("sumIncome");
    const sumExpense = document.getElementById("sumExpense");
    const sumBalance = document.getElementById("sumBalance");
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

            tbody.innerHTML = transactions.map((item, index) => {
                const amount = Number(item.amount);
                if (item.type === "income") incomeTotal += amount;
                else expenseTotal += amount;
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
            renderReportsCharts(transactions);
        } catch (error) {
            console.error("Reports Error:", error);
            tbody.innerHTML = "<tr><td colspan='8'>Error loading reports</td></tr>";
            sumIncome.innerText = formatCurrency(0);
            sumExpense.innerText = formatCurrency(0);
            sumBalance.innerText = formatCurrency(0);
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
        const transactions = getFilteredTransactions(reportTransactionsCache.length ? reportTransactionsCache : await fetchTransactions());
        exportTransactionsAsCsv(transactions);
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
    const userCanvas = document.getElementById("userPieChart");
    const emptyChartText = document.getElementById("userPieChartEmpty");

    if (!recentContainer) return;

    try {
        const [dashboardData, transactionData, categoryData, ngoData] = await Promise.all([
            apiFetchJson(`/user/dashboard?userId=${getUserId()}`),
            apiFetchJson(`/user/transactions?type=income&userId=${getUserId()}`),
            apiFetchJson(`/user/category-report?userId=${getUserId()}`),
            apiFetchJson(`/user/ngos?userId=${getUserId()}`)
        ]);

        const incomeTransactions = transactionData.transactions || [];
        const ngos = ngoData.ngos || [];
        const projectCount = ngos.reduce((sum, ngo) => sum + (ngo.projects || []).length, 0);
        const latestDonation = incomeTransactions[0] || null;

        setText("userTotalContribution", formatCurrency(dashboardData.totalIncome || 0));
        setText("userDonationCount", String(incomeTransactions.length));
        setText("userNgoCount", String(ngos.length));
        setText("userProjectCount", String(projectCount));
        setText("aboutNgoCount", String(ngos.length));
        setText("aboutProjectCount", String(projectCount));
        setText("aboutContributionCount", String(incomeTransactions.length));
        setText(
            "userDonationLast",
            latestDonation
                ? `Latest donation: ${formatDate(latestDonation.date)}`
                : "No donation history yet"
        );

        const recentProjects = ngos
            .flatMap((ngo) => (ngo.projects || []).map((project) => ({
                ngoName: ngo.ngo_name,
                project
            })))
            .sort((a, b) => b.project.id - a.project.id)
            .slice(0, 4);

        if (!recentProjects.length) {
            recentContainer.innerHTML = `
                <div class="activity-item">
                    <div class="act-info">
                        <div class="act-title">No NGO or project activity yet</div>
                        <div class="act-date">Add NGOs and projects to see updates here.</div>
                    </div>
                </div>
            `;
        } else {
            recentContainer.innerHTML = recentProjects.map((item) => `
                <div class="activity-item">
                    <div class="act-icon income-icon"><i class="bi bi-folder2-open"></i></div>
                    <div class="act-info">
                        <div class="act-title">${escapeHtml(item.project.project_name)}</div>
                        <div class="act-date">${escapeHtml(item.ngoName)} • ${escapeHtml(formatProjectStatus(item.project.status))}</div>
                    </div>
                </div>
            `).join("");
        }

        const labels = (categoryData.categories || []).map((item) => item.category);
        const values = (categoryData.categories || []).map((item) => Number(item.totalExpense || 0));

        if (!labels.length) {
            if (emptyChartText) emptyChartText.style.display = "block";
        } else if (userCanvas && typeof Chart !== "undefined") {
            if (emptyChartText) emptyChartText.style.display = "none";
            destroyChart(userPieChart);
            userPieChart = new Chart(userCanvas, {
                type: "doughnut",
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: ["#0f6e4d", "#1a56db", "#0891b2", "#d97706", "#dc2626", "#14b8a6"]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    } catch (error) {
        console.error("User dashboard error:", error);
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
    const donationForm = document.getElementById("donationForm");
    const messageBox = document.getElementById("donationFormMessage");
    const donationChartCanvas = document.getElementById("donationTrendChart");
    const donationChartEmpty = document.getElementById("donationTrendChartEmpty");
    if (!tbody) return;

    const donationFields = {
        id: document.getElementById("donationId"),
        date: document.getElementById("donationDate"),
        category: document.getElementById("donationCategory"),
        source: document.getElementById("donationSource"),
        method: document.getElementById("donationMethod"),
        amount: document.getElementById("donationAmount"),
        description: document.getElementById("donationDescription")
    };

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

    const resetDonationForm = () => {
        donationForm?.reset();
        donationFields.id.value = "";
    };

    const fillDonationForm = (item) => {
        donationFields.id.value = item.id;
        donationFields.date.value = normalizeDateValue(item.date);
        donationFields.category.value = item.category || "";
        donationFields.source.value = item.source || "";
        donationFields.method.value = item.payment_method || "";
        donationFields.amount.value = item.amount ?? "";
        donationFields.description.value = item.description || "";
        donationFields.source.focus();
    };

    const renderDonationRows = (donations) => {
        if (!donations.length) {
            tbody.innerHTML = "<tr><td colspan='8'>No donation records yet</td></tr>";
            return;
        }

        tbody.innerHTML = donations.map((item) => `
            <tr>
                <td>${item.id}</td>
                <td>${formatDate(item.date)}</td>
                <td>${escapeHtml(item.category || "-")}</td>
                <td>${escapeHtml(item.source || "-")}</td>
                <td>${escapeHtml(formatPaymentMethod(item.payment_method))}</td>
                <td class="amount-income">${formatCurrency(item.amount)}</td>
                <td>${escapeHtml(item.description || "-")}</td>
                <td>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button type="button" class="btn-filter" data-action="edit-income" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;">Edit</button>
                        <button type="button" class="btn-filter" data-action="delete-income" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;background:var(--danger);">Delete</button>
                    </div>
                </td>
            </tr>
        `).join("");
    };

    const renderDonationChart = (donations) => {
        if (!donationChartCanvas || typeof Chart === "undefined") return;

        if (!donations.length) {
            destroyChart(donationTrendChart);
            if (donationChartEmpty) donationChartEmpty.style.display = "block";
            return;
        }

        const grouped = donations
            .slice()
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .reduce((map, item) => {
                const key = normalizeDateValue(item.date);
                map[key] = (map[key] || 0) + Number(item.amount || 0);
                return map;
            }, {});

        const labels = Object.keys(grouped);
        const values = labels.map((label) => grouped[label]);

        if (donationChartEmpty) donationChartEmpty.style.display = "none";
        destroyChart(donationTrendChart);
        donationTrendChart = new Chart(donationChartCanvas, {
            type: "line",
            data: {
                labels: labels.map((label) => formatDate(label)),
                datasets: [{
                    label: "Donation amount",
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

    const loadDonationData = async () => {
        const data = await apiFetchJson(`/user/transactions?type=income&userId=${getUserId()}`);
        const donations = data.transactions || [];
        donationCache = donations;
        const total = donations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const average = donations.length ? total / donations.length : 0;

        setText("donationTotal", formatCurrency(total));
        setText("donationCount", String(donations.length));
        setText("donationAverage", formatCurrency(average));
        renderDonationRows(donations);
        renderDonationChart(donations);
        return donations;
    };

    tbody.addEventListener("click", async (event) => {
        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) return;

        const item = donationCache.find((entry) => String(entry.id) === String(actionButton.dataset.id));
        if (!item) return;

        if (actionButton.dataset.action === "edit-income") {
            fillDonationForm(item);
            setMessage(`Editing income record #${item.id}`, "info");
            return;
        }

        if (actionButton.dataset.action === "delete-income") {
            if (!window.confirm(`Delete income record #${item.id}?`)) return;
            try {
                await apiFetchJson(`/user/income/${item.id}?userId=${getUserId()}`, { method: "DELETE" });
                setMessage(`Income record #${item.id} deleted successfully.`, "success");
                await loadDonationData();
                resetDonationForm();
            } catch (error) {
                setMessage(error.message || "Failed to delete income record.", "error");
            }
        }
    });

    donationForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            userId: getUserId(),
            date: donationFields.date.value,
            category: donationFields.category.value,
            source: donationFields.source.value.trim(),
            payment_method: donationFields.method.value || null,
            amount: donationFields.amount.value,
            description: donationFields.description.value.trim()
        };

        try {
            if (donationFields.id.value) {
                await apiFetchJson(`/user/income/${donationFields.id.value}?userId=${getUserId()}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setMessage(`Income record #${donationFields.id.value} updated successfully.`, "success");
            } else {
                await apiFetchJson("/user/income", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setMessage("New income record added successfully.", "success");
            }

            resetDonationForm();
            await loadDonationData();
        } catch (error) {
            setMessage(error.message || "Failed to save donation entry.", "error");
        }
    });

    document.getElementById("donationCancelBtn")?.addEventListener("click", () => {
        resetDonationForm();
        setMessage("");
    });

    try {
        const donations = await loadDonationData();

        exportButton?.addEventListener("click", () => {
            const rows = [["Record ID", "Date", "Category", "Source", "Payment Method", "Amount", "Description"]];
            donations.forEach((item) => {
                rows.push([
                    item.id,
                    normalizeDateValue(item.date),
                    item.category || "",
                    item.source || "",
                    formatPaymentMethod(item.payment_method),
                    item.amount,
                    item.description || ""
                ]);
            });
            exportRowsAsCsv("donation-history.csv", rows);
        });
    } catch (error) {
        console.error("Donation history error:", error);
        tbody.innerHTML = "<tr><td colspan='8'>Unable to load donation history</td></tr>";
        setMessage(error.message || "Unable to load donation history.", "error");
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

    const updateStats = (year, month) => {
        const monthDonations = donations.filter((item) => {
            const date = new Date(`${normalizeDateValue(item.date)}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        const monthTotal = monthDonations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        setText("calMonthInc", formatCurrency(monthTotal));
        setText("calTotalDonations", String(monthDonations.length));
        setText("calProjectsSupported", String(projects.length));
    };

    const showDayDetails = (date) => {
        const dateStr = normalizeDateValue(date);
        const dayDonations = donations.filter((item) => normalizeDateValue(item.date) === dateStr);

        if (detailTitle) {
            detailTitle.innerHTML = `<i class="bi bi-calendar3"></i> ${new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            })}`;
        }

        if (!detailBox) return;

        if (!dayDonations.length) {
            detailBox.innerHTML = '<div class="cal-detail-empty">No donations recorded on this day.</div>';
            return;
        }

        detailBox.innerHTML = dayDonations.map((donation) => `
            <div class="cal-txn-row">
              <div class="cal-txn-icon inc">
                <i class="bi bi-heart-fill"></i>
              </div>
              <div class="cal-txn-info">
                <div class="cal-txn-name">${escapeHtml(donation.source || "Donation")}</div>
                <div class="cal-txn-cat">${escapeHtml(donation.category || "Donation")} ${donation.payment_method ? `• ${escapeHtml(formatPaymentMethod(donation.payment_method))}` : ""}</div>
              </div>
              <div class="cal-txn-amt p">${escapeHtml(formatCurrency(donation.amount))}</div>
            </div>
        `).join("");
    };

    const createDayCell = (day, isOtherMonth, dateObj) => {
        const cell = document.createElement("div");
        cell.className = "cal-cell";
        if (isOtherMonth) cell.classList.add("other-month");

        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
        const dayDonations = donations.filter((item) => normalizeDateValue(item.date) === dateStr);
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
    const ngoForm = document.getElementById("ngoForm");
    const projectForm = document.getElementById("projectForm");
    const ngoList = document.getElementById("ngoProjectList");
    const ngoSelect = document.getElementById("projectNgo");
    const messageBox = document.getElementById("projectMessage");

    if (!ngoForm || !projectForm || !ngoList || !ngoSelect) return;

    const ngoFields = {
        id: document.getElementById("ngoId"),
        name: document.getElementById("ngoName"),
        registration: document.getElementById("ngoRegistration"),
        email: document.getElementById("ngoEmail"),
        location: document.getElementById("ngoLocation"),
        description: document.getElementById("ngoDescription")
    };

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

        messageBox.style.cssText = `display:block;margin-bottom:16px;padding:12px 14px;border-radius:12px;font-size:0.9rem;${styles[tone] || styles.info}`;
        messageBox.textContent = text;
    };

    const resetNgoForm = () => {
        ngoForm.reset();
        ngoFields.id.value = "";
    };

    const resetProjectForm = () => {
        projectForm.reset();
        projectFields.id.value = "";
        projectFields.status.value = "active";
    };

    const populateNgoOptions = (ngos) => {
        const currentValue = projectFields.ngoId.value;
        ngoSelect.innerHTML = `
            <option value="">Choose NGO</option>
            ${ngos.map((ngo) => `<option value="${ngo.id}">${escapeHtml(ngo.ngo_name)}</option>`).join("")}
        `;
        if (currentValue) {
            ngoSelect.value = currentValue;
        }
    };

    const renderNgoProjectList = (ngos) => {
        setText("ngoCount", String(ngos.length));
        setText("projectCount", String(ngos.reduce((sum, ngo) => sum + ngo.totals.projectCount, 0)));
        setText("projectBudget", formatCurrency(ngos.reduce((sum, ngo) => sum + Number(ngo.totals.totalBudget || 0), 0)));

        if (!ngos.length) {
            ngoList.innerHTML = `
                <div class="chart-card" style="background:var(--surface-2);border-style:dashed;">
                    <div class="chart-title">No NGOs yet</div>
                    <div class="chart-subtitle">Add your first NGO and then attach real projects to it.</div>
                </div>
            `;
            return;
        }

        ngoList.innerHTML = ngos.map((ngo, index) => `
            <details class="chart-card" style="margin-bottom:16px;overflow:hidden;" ${index === 0 ? "open" : ""}>
                <summary style="list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:14px;align-items:flex-start;">
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                            <div style="width:48px;height:48px;border-radius:14px;background:rgba(26,86,219,0.12);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:1.25rem;">
                                <i class="bi bi-buildings"></i>
                            </div>
                            <div>
                                <div style="font-weight:700;font-size:1rem;color:var(--text-primary);">${escapeHtml(ngo.ngo_name)}</div>
                                <div style="font-size:0.82rem;color:var(--text-muted);">${escapeHtml(ngo.location || "Location not added")} • ${ngo.totals.projectCount} project(s)</div>
                            </div>
                        </div>
                        <div style="margin-top:12px;color:var(--text-secondary);font-size:0.88rem;line-height:1.7;">${escapeHtml(ngo.description || "No NGO description added yet.")}</div>
                        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                            <span style="background:rgba(15,110,77,0.1);color:var(--primary);border-radius:999px;padding:5px 10px;font-size:0.75rem;font-weight:700;">Budget ${formatCurrency(ngo.totals.totalBudget)}</span>
                            ${ngo.registration_no ? `<span style="background:var(--surface-2);color:var(--text-muted);border-radius:999px;padding:5px 10px;font-size:0.75rem;">${escapeHtml(ngo.registration_no)}</span>` : ""}
                            ${ngo.contact_email ? `<span style="background:var(--surface-2);color:var(--text-muted);border-radius:999px;padding:5px 10px;font-size:0.75rem;">${escapeHtml(ngo.contact_email)}</span>` : ""}
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                        <button type="button" class="btn-filter" data-action="edit-ngo" data-ngo-id="${ngo.id}">Edit NGO</button>
                        <button type="button" class="btn-filter" data-action="add-project" data-ngo-id="${ngo.id}">Add Project</button>
                        <button type="button" class="btn-filter" data-action="delete-ngo" data-ngo-id="${ngo.id}" style="background:var(--danger);">Delete NGO</button>
                    </div>
                </summary>
                <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:18px;">
                    ${ngo.projects.length ? ngo.projects.map((project) => `
                        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:18px;padding:16px 18px;margin-bottom:12px;">
                            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
                                <div style="flex:1;min-width:220px;">
                                    <div style="font-weight:700;color:var(--text-primary);font-size:0.96rem;">${escapeHtml(project.project_name)}</div>
                                    <div style="margin-top:4px;color:var(--text-muted);font-size:0.8rem;">${escapeHtml(project.focus_area || "Focus area not added")} • ${formatProjectStatus(project.status)}</div>
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
                    `).join("") : `
                        <div style="padding:16px;border:1px dashed var(--border);border-radius:16px;color:var(--text-muted);font-size:0.88rem;">
                            No projects have been added under this NGO yet.
                        </div>
                    `}
                </div>
            </details>
        `).join("");
    };

    const fetchData = async () => {
        const data = await apiFetchJson(`/user/ngos?userId=${getUserId()}`);
        ngoProjectCache = data.ngos || [];
        populateNgoOptions(ngoProjectCache);
        renderNgoProjectList(ngoProjectCache);
        return ngoProjectCache;
    };

    const findNgo = (ngoId) => ngoProjectCache.find((item) => String(item.id) === String(ngoId));
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
        const ngoId = button.dataset.ngoId;
        const projectId = button.dataset.projectId;

        if (action === "edit-ngo") {
            const ngo = findNgo(ngoId);
            if (!ngo) return;
            ngoFields.id.value = ngo.id;
            ngoFields.name.value = ngo.ngo_name || "";
            ngoFields.registration.value = ngo.registration_no || "";
            ngoFields.email.value = ngo.contact_email || "";
            ngoFields.location.value = ngo.location || "";
            ngoFields.description.value = ngo.description || "";
            ngoFields.name.focus();
            return;
        }

        if (action === "add-project") {
            resetProjectForm();
            projectFields.ngoId.value = ngoId || "";
            projectFields.name.focus();
            return;
        }

        if (action === "delete-ngo") {
            if (!window.confirm("Delete this NGO? This works only if all projects under it are removed first.")) return;
            try {
                await apiFetchJson(`/user/ngos/${ngoId}?userId=${getUserId()}`, { method: "DELETE" });
                setMessage("NGO deleted successfully.", "success");
                await fetchData();
                resetNgoForm();
            } catch (error) {
                setMessage(error.message || "Failed to delete NGO.", "error");
            }
            return;
        }

        if (action === "edit-project") {
            const project = findProject(projectId);
            if (!project) return;
            projectFields.id.value = project.id;
            projectFields.ngoId.value = project.ngo_id || "";
            projectFields.name.value = project.project_name || "";
            projectFields.code.value = project.project_code || "";
            projectFields.focusArea.value = project.focus_area || "";
            projectFields.budget.value = project.budget ?? 0;
            projectFields.startDate.value = normalizeDateValue(project.start_date);
            projectFields.endDate.value = normalizeDateValue(project.end_date);
            projectFields.status.value = project.status || "active";
            projectFields.description.value = project.description || "";
            projectFields.name.focus();
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

    ngoForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
            userId: getUserId(),
            ngo_name: ngoFields.name.value.trim(),
            registration_no: ngoFields.registration.value.trim(),
            contact_email: ngoFields.email.value.trim(),
            location: ngoFields.location.value.trim(),
            description: ngoFields.description.value.trim()
        };

        try {
            if (ngoFields.id.value) {
                await apiFetchJson(`/user/ngos/${ngoFields.id.value}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setMessage("NGO updated successfully.", "success");
            } else {
                await apiFetchJson("/user/ngos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setMessage("NGO added successfully.", "success");
            }

            resetNgoForm();
            await fetchData();
        } catch (error) {
            setMessage(error.message || "Failed to save NGO.", "error");
        }
    });

    projectForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payload = {
            ngo_id: projectFields.ngoId.value,
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
                await apiFetchJson(`/user/projects/${projectFields.id.value}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setMessage("Project updated successfully.", "success");
            } else {
                await apiFetchJson("/user/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                setMessage("Project added successfully.", "success");
            }

            resetProjectForm();
            await fetchData();
        } catch (error) {
            setMessage(error.message || "Failed to save project.", "error");
        }
    });

    document.getElementById("ngoCancelBtn")?.addEventListener("click", resetNgoForm);
    document.getElementById("projectCancelBtn")?.addEventListener("click", resetProjectForm);

    try {
        setMessage("Loading NGO and project data...", "info");
        await fetchData();
        setMessage("");
    } catch (error) {
        setMessage(error.message || "Failed to load NGO and project data.", "error");
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
    const passwordHint = document.getElementById("passwordHint");
    const modalLabel = document.getElementById("userModalLabel");

    if (userModal && window.bootstrap) {
        userModalInstance = bootstrap.Modal.getOrCreateInstance(userModal);
    }

    window.openUserModal = () => {
        userIdInput.value = "";
        userNameInput.value = "";
        userEmailInput.value = "";
        userPasswordInput.value = "";
        userPasswordInput.required = true;
        passwordHint.textContent = "";
        errorBox.style.display = "none";
        modalLabel.textContent = "Add New User";
    };

    window.openEditUserModal = (id, name, email) => {
        userIdInput.value = id;
        userNameInput.value = name;
        userEmailInput.value = email;
        userPasswordInput.value = "";
        userPasswordInput.required = false;
        passwordHint.textContent = "(Leave blank to keep unchanged)";
        errorBox.style.display = "none";
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

        errorBox.style.display = "none";

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
            errorBox.style.display = "block";
            errorBox.textContent = error.message || "Failed to save user";
        }
    });

    fetchUsers();
}

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
        case "user-calendar": initUserCalendarPage(); break;
        case "user-projects": initUserProjectsPage(); break;
        case "user-transparency": initUserTransparencyPage(); break;
        case "user-profile": initUserProfilePage(); break;
        case "user-login": initUserLoginPage(); break;
        case "user-register": initUserRegisterPage(); break;
        default: break;
    }
});
