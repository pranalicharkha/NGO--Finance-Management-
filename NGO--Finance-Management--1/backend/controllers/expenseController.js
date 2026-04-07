const db = require('../config/db');

exports.getExpense = (req, res) => {
  const sql = 'SELECT * FROM expense ORDER BY date DESC';

  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }
    res.json(result);
  });
};

exports.addExpense = (req, res) => {
  const { date, category, title, payment_method, amount, description } = req.body;

  const sql = `
    INSERT INTO expense (date, category, title, payment_method, amount, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [date, category, title, payment_method, amount, description],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json(err);
      }
      res.json({ message: 'Expense added successfully' });
    }
  );
};

exports.updateExpense = (req, res) => {
  const { id } = req.params;
  const { date, category, title, payment_method, amount, description } = req.body;

  const sql = `
    UPDATE expense
    SET date=?, category=?, title=?, payment_method=?, amount=?, description=?
    WHERE id=?
  `;

  db.query(
    sql,
    [date, category, title, payment_method, amount, description, id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json(err);
      }
      res.json({ message: 'Expense updated successfully' });
    }
  );
};

exports.deleteExpense = (req, res) => {
  const { id } = req.params;

  const sql = 'DELETE FROM expense WHERE id=?';

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }
    res.json({ message: 'Expense deleted successfully' });
  });
};