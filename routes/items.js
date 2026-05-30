const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../public/uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  cb(null, file.mimetype.startsWith('image/'));
}});

router.get('/', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM items ORDER BY name').all();
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', upload.single('photo'), (req, res) => {
  try {
    const { name, category, cost_price, sell_price, stock } = req.body;
    if (!name || cost_price == null || sell_price == null) {
      return res.status(400).json({ error: 'name, cost_price, sell_price are required' });
    }
    const photo_path = req.file ? '/uploads/' + req.file.filename : null;
    const result = db.prepare(
      'INSERT INTO items (name, category, photo_path, cost_price, sell_price, stock) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, category || null, photo_path, parseFloat(cost_price), parseFloat(sell_price), parseInt(stock) || 0);
    res.status(201).json(db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', upload.single('photo'), (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const { name, category, cost_price, sell_price, stock } = req.body;
    const photo_path = req.file ? '/uploads/' + req.file.filename : item.photo_path;
    db.prepare(
      'UPDATE items SET name=?, category=?, photo_path=?, cost_price=?, sell_price=?, stock=? WHERE id=?'
    ).run(
      name ?? item.name,
      category !== undefined ? category : item.category,
      photo_path,
      cost_price != null ? parseFloat(cost_price) : item.cost_price,
      sell_price != null ? parseFloat(sell_price) : item.sell_price,
      stock != null ? parseInt(stock) : item.stock,
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/stock', (req, res) => {
  try {
    const { add } = req.body;
    if (add == null) return res.status(400).json({ error: 'add is required' });
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    db.prepare('UPDATE items SET stock = stock + ? WHERE id = ?').run(parseInt(add), req.params.id);
    res.json(db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
