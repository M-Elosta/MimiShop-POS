const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    const revenue_total = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as val
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'delivered'
    `).get().val;

    const revenue_month = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as val
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'delivered'
        AND strftime('%Y-%m', o.created_at) = strftime('%Y-%m', 'now')
    `).get().val;

    const cogs_total = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity * i.cost_price), 0) as val
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN items i ON oi.item_id = i.id
      WHERE o.status = 'delivered'
    `).get().val;

    const expenses_total = db.prepare(`SELECT COALESCE(SUM(amount), 0) as val FROM expenses`).get().val;
    const profit_total = revenue_total - cogs_total - expenses_total;

    const orders_by_status = db.prepare(`
      SELECT status, COUNT(*) as count FROM orders GROUP BY status
    `).all().reduce((acc, r) => { acc[r.status] = r.count; return acc; }, {});

    const top_items_qty = db.prepare(`
      SELECT i.name, SUM(oi.quantity) as total_qty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN items i ON oi.item_id = i.id
      WHERE o.status = 'delivered'
      GROUP BY oi.item_id
      ORDER BY total_qty DESC LIMIT 5
    `).all();

    const top_items_revenue = db.prepare(`
      SELECT i.name, SUM(oi.quantity * oi.price_at_time) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN items i ON oi.item_id = i.id
      WHERE o.status = 'delivered'
      GROUP BY oi.item_id
      ORDER BY total_revenue DESC LIMIT 5
    `).all();

    const revenue_last_30_days = db.prepare(`
      SELECT date(o.created_at) as date, COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as revenue
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = 'delivered'
        AND date(o.created_at) >= date('now', '-29 days')
      GROUP BY date(o.created_at)
      ORDER BY date ASC
    `).all();

    const delivery_fees_total = db.prepare(`
      SELECT COALESCE(SUM(delivery_fee), 0) as val FROM orders WHERE status = 'delivered'
    `).get().val;

    const packaging_costs_total = db.prepare(`
      SELECT COALESCE(SUM(packaging_cost), 0) as val FROM orders
    `).get().val;

    const pending_count = db.prepare(`SELECT COUNT(*) as val FROM orders WHERE status = 'pending'`).get().val;

    res.json({
      revenue_total,
      revenue_month,
      profit_total,
      orders_by_status,
      top_items_qty,
      top_items_revenue,
      revenue_last_30_days,
      delivery_fees_total,
      packaging_costs_total,
      pending_count
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
