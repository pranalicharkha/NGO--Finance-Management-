const db = require('../config/db');

exports.getIncome = (req, res) => {
  const sql = 'SELECT * FROM income ORDER BY date DESC';

  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }
    res.json(result);
  });
};

exports.addIncome = (req, res) => {
  const { date, category, source, payment_method, amount, description } = req.body;

  const sql = `
    INSERT INTO income (date, category, source, payment_method, amount, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [date, category, source, payment_method, amount, description],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json(err);
      }
      res.json({ message: 'Income added successfully' });
    }
  );
};

exports.updateIncome = (req, res) => {
  const { id } = req.params;
  const { date, category, source, payment_method, amount, description } = req.body;

  const sql = `
    UPDATE income
    SET date=?, category=?, source=?, payment_method=?, amount=?, description=?
    WHERE id=?
  `;

  db.query(
    sql,
    [date, category, source, payment_method, amount, description, id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json(err);
      }
      res.json({ message: 'Income updated successfully' });
    }
  );
};

exports.deleteIncome = (req, res) => {
  const { id } = req.params;

  const sql = 'DELETE FROM income WHERE id=?';

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }
    res.json({ message: 'Income deleted successfully' });
  });
};