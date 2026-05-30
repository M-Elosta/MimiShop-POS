const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC').all());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { label, amount, date } = req.body;
    if (!label || amount == null || !date) return res.status(400).json({ error: 'label, amount, date are required' });
    const result = db.prepare('INSERT INTO expenses (label, amount, date) VALUES (?, ?, ?)').run(label, parseFloat(amount), date);
    res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Expense not found' });
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
