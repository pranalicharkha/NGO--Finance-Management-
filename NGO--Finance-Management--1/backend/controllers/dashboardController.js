const db = require('../config/db');

exports.getDashboardData = (req, res) => {
  const dashboardData = {};

  db.query('SELECT SUM(amount) AS totalIncome FROM income', (err, incomeResult) => {
    if (err) return res.status(500).json(err);

    dashboardData.totalIncome = incomeResult[0].totalIncome || 0;

    db.query('SELECT SUM(amount) AS totalExpense FROM expense', (err, expenseResult) => {
      if (err) return res.status(500).json(err);

      dashboardData.totalExpense = expenseResult[0].totalExpense || 0;
      dashboardData.balance = dashboardData.totalIncome - dashboardData.totalExpense;

      db.query(`
        SELECT MONTHNAME(date) AS month, SUM(amount) AS total
        FROM income
        GROUP BY MONTH(date), MONTHNAME(date)
        ORDER BY MONTH(date)
      `, (err, monthlyIncome) => {
        if (err) return res.status(500).json(err);

        dashboardData.monthlyIncome = monthlyIncome;

        db.query(`
          SELECT MONTHNAME(date) AS month, SUM(amount) AS total
          FROM expense
          GROUP BY MONTH(date), MONTHNAME(date)
          ORDER BY MONTH(date)
        `, (err, monthlyExpense) => {
          if (err) return res.status(500).json(err);

          dashboardData.monthlyExpense = monthlyExpense;

          db.query(`
            SELECT category, SUM(amount) AS total
            FROM expense
            GROUP BY category
          `, (err, categoryExpense) => {
            if (err) return res.status(500).json(err);

            dashboardData.categoryExpense = categoryExpense;

            res.json(dashboardData);
          });
        });
      });
    });
  });
};