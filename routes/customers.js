const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT c.*,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(oi.quantity * oi.price_at_time) + SUM(DISTINCT COALESCE(o.delivery_fee,0)) + SUM(DISTINCT COALESCE(o.packaging_cost,0)), 0) as total_spent
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json(customers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    customer.orders = db.prepare(`
      SELECT o.*,
        SUM(oi.quantity * oi.price_at_time) + o.delivery_fee + o.packaging_cost as total
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all(req.params.id);
    res.json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
