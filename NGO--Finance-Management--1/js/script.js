let dashboardTrendChart;
let dashboardCategoryChart;
let reportsTrendChart;
let reportsCategoryChart;
let reportTransactionsCache = [];
let transactionModalInstance;

async function apiFetchJson(url, options = {}) {
    const response = await fetch(url, options);
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

async function loadTransactionsFromApi() {
    const data = await apiFetchJson("/user/transactions");
    return (data.transactions || []).map((item) => ({
        ...item,
        date: normalizeDateValue(item.date)
    }));
}

function normalizeDateValue(value) {
    if (!value) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value).split("T")[0];
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));
}

function formatPaymentMethod(value) {
    if (!value) {
        return "Not available";
    }

    const normalized = String(value).trim().toLowerCase();
    const labels = {
        upi: "UPI",
        cash: "Cash",
        card: "Card",
        cheque: "Cheque",
        bank_transfer: "Bank Transfer",
        banktransfer: "Bank Transfer"
    };

    if (labels[normalized]) {
        return labels[normalized];
    }

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

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
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

function loadAdminUser() {
    const adminUser = sessionStorage.getItem("adminUser");

    if (!adminUser) {
        if (document.body.dataset.page !== "admin-login") {
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

    if (!userMenu || !dropdown) {
        return;
    }

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
    if (chart) {
        chart.destroy();
    }
}

function renderDashboardCharts(data) {
    if (typeof Chart === "undefined") {
        return;
    }

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
                    {
                        label: "Income",
                        data: monthlySeries.income,
                        backgroundColor: "#0f6e4d",
                        borderRadius: 8
                    },
                    {
                        label: "Expense",
                        data: monthlySeries.expense,
                        backgroundColor: "#dc2626",
                        borderRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top"
                    }
                }
            }
        });
    }

    if (categoryCanvas) {
        destroyChart(dashboardCategoryChart);

        dashboardCategoryChart = new Chart(categoryCanvas, {
            type: "doughnut",
            data: {
                labels: (data.categoryExpense || []).map((item) => item.category),
                datasets: [
                    {
                        data: (data.categoryExpense || []).map((item) => Number(item.total || 0)),
                        backgroundColor: ["#0f6e4d", "#1a56db", "#d97706", "#dc2626", "#7c3aed", "#14b8a6"]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        });
    }
}

function renderRecentActivity(transactions = []) {
    const container = document.getElementById("recentActivity");
    if (!container) {
        return;
    }

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
                    <div>${formatDate(item.date)} • ${item.category}</div>
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
    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
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
            const result = await apiFetchJson("/user/income", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

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
    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
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
            const result = await apiFetchJson("/user/expense", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

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
    if (!grid) {
        return;
    }

    let currentDate = new Date();
    const transactions = await loadTransactionsFromApi();

    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

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
                if (!detailBox) {
                    return;
                }

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
            const itemDate = new Date(item.date);
            return itemDate.getMonth() === month && itemDate.getFullYear() === year;
        });

        const monthIncome = currentMonthTransactions
            .filter((item) => item.type === "income")
            .reduce((sum, item) => sum + Number(item.amount), 0);

        const monthExpense = currentMonthTransactions
            .filter((item) => item.type === "expense")
            .reduce((sum, item) => sum + Number(item.amount), 0);

        setText("calMonthInc", formatCurrency(monthIncome));
        setText("calMonthExp", formatCurrency(monthExpense));
        setText("calMonthBal", formatCurrency(monthIncome - monthExpense));
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

function renderReportsCharts(transactions) {
    if (typeof Chart === "undefined") {
        return;
    }

    const trendCanvas = document.getElementById("reportsTrendChart");
    const categoryCanvas = document.getElementById("reportsCategoryChart");

    if (trendCanvas) {
        const monthlyMap = {};

        transactions.forEach((item) => {
            const label = new Date(item.date).toLocaleDateString("en-GB", {
                month: "short",
                year: "2-digit"
            });

            if (!monthlyMap[label]) {
                monthlyMap[label] = { income: 0, expense: 0 };
            }

            if (item.type === "income") {
                monthlyMap[label].income += Number(item.amount);
            } else {
                monthlyMap[label].expense += Number(item.amount);
            }
        });

        const labels = Object.keys(monthlyMap);
        destroyChart(reportsTrendChart);

        reportsTrendChart = new Chart(trendCanvas, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Income",
                        data: labels.map((label) => monthlyMap[label].income),
                        borderColor: "#0f6e4d",
                        backgroundColor: "rgba(15,110,77,0.12)",
                        tension: 0.35,
                        fill: true
                    },
                    {
                        label: "Expense",
                        data: labels.map((label) => monthlyMap[label].expense),
                        borderColor: "#dc2626",
                        backgroundColor: "rgba(220,38,38,0.12)",
                        tension: 0.35,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    if (categoryCanvas) {
        const expenseCategoryMap = {};

        transactions
            .filter((item) => item.type === "expense")
            .forEach((item) => {
                expenseCategoryMap[item.category] = (expenseCategoryMap[item.category] || 0) + Number(item.amount);
            });

        const labels = Object.keys(expenseCategoryMap);
        destroyChart(reportsCategoryChart);

        reportsCategoryChart = new Chart(categoryCanvas, {
            type: "polarArea",
            data: {
                labels,
                datasets: [
                    {
                        data: labels.map((label) => expenseCategoryMap[label]),
                        backgroundColor: ["#0f6e4d", "#1a56db", "#d97706", "#dc2626", "#7c3aed", "#14b8a6"]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

async function initReportsPage() {
    const tbody = document.getElementById("reportsTbody");
    if (!tbody) {
        return;
    }

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

        if (filterType.value !== "all") {
            filtered = filtered.filter((item) => item.type === filterType.value);
        }

        if (filterMonth.value) {
            filtered = filtered.filter((item) => item.date.startsWith(filterMonth.value));
        }

        if (filterSearch.value.trim()) {
            const keyword = filterSearch.value.trim().toLowerCase();
            filtered = filtered.filter((item) =>
                [item.source, item.title, item.category, item.description]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(keyword))
            );
        }

        return filtered;
    };

    const exportTransactionsAsCsv = (transactions) => {
        const rows = [
            ["Date", "Type", "Source/Title", "Category", "Amount", "Description"]
        ];

        transactions.forEach((item) => {
            rows.push([
                item.date,
                item.type,
                item.source || item.title || "",
                item.category || "",
                item.amount,
                item.description || ""
            ]);
        });

        const csv = rows
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");

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
        const confirmed = window.confirm(`Delete this ${transaction.type} record?`);
        if (!confirmed) {
            return;
        }

        try {
            await apiFetchJson(`/user/${transaction.type}/${transaction.id}`, {
                method: "DELETE"
            });
            await loadReports();
        } catch (error) {
            console.error("Delete error:", error);
            alert(error.message || "Failed to delete transaction");
        }
    };

    tbody.addEventListener("click", async (event) => {
        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) {
            return;
        }

        const transaction = reportTransactionsCache.find((item) =>
            item.type === actionButton.dataset.type && String(item.id) === String(actionButton.dataset.id)
        );
        if (!transaction) {
            return;
        }

        if (actionButton.dataset.action === "edit") {
            openEditModal(transaction);
        }

        if (actionButton.dataset.action === "delete") {
            await deleteTransaction(transaction);
        }
    });

    const loadReports = async () => {
        tbody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";

        try {
            const allTransactions = await fetchTransactions();
            const transactions = getFilteredTransactions(allTransactions);

            let incomeTotal = 0;
            let expenseTotal = 0;

            if (!transactions.length) {
                tbody.innerHTML = "<tr><td colspan='7'>No transactions found</td></tr>";
                setText("sumIncome", formatCurrency(0));
                setText("sumExpense", formatCurrency(0));
                setText("sumBalance", formatCurrency(0));
                renderReportsCharts([]);
                return;
            }

            tbody.innerHTML = transactions.map((item, index) => {
                const amount = Number(item.amount);
                if (item.type === "income") {
                    incomeTotal += amount;
                } else {
                    expenseTotal += amount;
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
                                <button type="button" class="btn-filter" data-action="edit" data-type="${item.type}" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;">
                                    Edit
                                </button>
                                <button type="button" class="btn-filter" data-action="delete" data-type="${item.type}" data-id="${item.id}" style="padding:6px 10px;font-size:0.75rem;background:var(--danger);">
                                    Delete
                                </button>
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
            tbody.innerHTML = "<tr><td colspan='7'>Error loading reports</td></tr>";
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

        if (type === "income") {
            payload.source = document.getElementById("editName").value.trim();
        } else {
            payload.title = document.getElementById("editName").value.trim();
        }

        try {
            await apiFetchJson(`/user/${type}/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            transactionModalInstance?.hide();
            await loadReports();
        } catch (error) {
            console.error("Update error:", error);
            alert(error.message || "Failed to update transaction");
        }
    });

    btnFilter?.addEventListener("click", loadReports);
    btnReset?.addEventListener("click", () => {
        filterType.value = "all";
        filterMonth.value = "";
        filterSearch.value = "";
        loadReports();
    });
    btnExport?.addEventListener("click", async () => {
        const transactions = getFilteredTransactions(reportTransactionsCache.length ? reportTransactionsCache : await fetchTransactions());
        exportTransactionsAsCsv(transactions);
    });

    loadReports();
}

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setTopbarDate();
    loadAdminUser();
    initAdminDropdown();

    document.querySelectorAll(".mode-toggle").forEach((button) => {
        button.addEventListener("click", toggleTheme);
    });

    switch (document.body.dataset.page) {
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
        default:
            break;
    }
});
