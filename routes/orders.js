const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    let query = `
      SELECT o.*, c.name as customer_name,
        COUNT(oi.id) as item_count,
        SUM(oi.quantity * oi.price_at_time) + o.delivery_fee + o.packaging_cost as total
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.status) { query += ' AND o.status = ?'; params.push(req.query.status); }
    if (req.query.from)   { query += ' AND date(o.created_at) >= ?'; params.push(req.query.from); }
    if (req.query.to)     { query += ' AND date(o.created_at) <= ?'; params.push(req.query.to); }
    query += ' GROUP BY o.id ORDER BY o.created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, c.name as customer_name, c.whatsapp, c.area
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.items = db.prepare(`
      SELECT oi.*, i.name as item_name, i.photo_path
      FROM order_items oi LEFT JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ?
    `).all(req.params.id);
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { customer, items, delivery_fee, packaging_cost, source, notes } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'items are required' });

    // Validate stock before any changes
    for (const oi of items) {
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(oi.item_id);
      if (!item) return res.status(400).json({ error: `Item ${oi.item_id} not found` });
      if (item.stock < oi.quantity) {
        return res.status(400).json({ error: `Insufficient stock for "${item.name}". Available: ${item.stock}` });
      }
    }

    const createOrder = db.transaction(() => {
      // Find or create customer
      let cust = null;
      if (customer.whatsapp) {
        cust = db.prepare('SELECT * FROM customers WHERE whatsapp = ?').get(customer.whatsapp);
      }
      if (!cust) {
        const r = db.prepare('INSERT INTO customers (name, whatsapp, area) VALUES (?, ?, ?)').run(
          customer.name, customer.whatsapp || null, customer.area || null
        );
        cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid);
      } else {
        db.prepare('UPDATE customers SET name=?, area=? WHERE id=?').run(customer.name, customer.area || cust.area, cust.id);
      }

      const orderResult = db.prepare(
        'INSERT INTO orders (customer_id, source, delivery_fee, packaging_cost, notes) VALUES (?, ?, ?, ?, ?)'
      ).run(cust.id, source || null, parseFloat(delivery_fee) || 0, parseFloat(packaging_cost) || 0, notes || null);

      const orderId = orderResult.lastInsertRowid;

      for (const oi of items) {
        const item = db.prepare('SELECT * FROM items WHERE id = ?').get(oi.item_id);
        db.prepare(
          'INSERT INTO order_items (order_id, item_id, quantity, price_at_time) VALUES (?, ?, ?, ?)'
        ).run(orderId, oi.item_id, oi.quantity, item.sell_price);
        db.prepare('UPDATE items SET stock = stock - ? WHERE id = ?').run(oi.quantity, oi.item_id);
      }

      return orderId;
    });

    const orderId = createOrder();
    res.status(201).json({ id: orderId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, c.name as cust_name, c.whatsapp, c.area
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot edit a delivered or cancelled order' });
    }

    const { customer, items, delivery_fee, packaging_cost, source, notes } = req.body;

    if (items !== undefined && !items.length) {
      return res.status(400).json({ error: 'Order must have at least one item' });
    }

    const existingItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

    if (items) {
      for (const oi of items) {
        const item = db.prepare('SELECT * FROM items WHERE id = ?').get(oi.item_id);
        if (!item) return res.status(400).json({ error: `Item ${oi.item_id} not found` });
        const oldQty = (existingItems.find(e => e.item_id === oi.item_id) || {}).quantity || 0;
        if (item.stock + oldQty < oi.quantity) {
          return res.status(400).json({ error: `Insufficient stock for "${item.name}". Available: ${item.stock + oldQty}` });
        }
      }
    }

    const updateOrder = db.transaction(() => {
      if (customer && order.customer_id) {
        db.prepare('UPDATE customers SET name=?, whatsapp=?, area=? WHERE id=?').run(
          customer.name, customer.whatsapp || null, customer.area || null, order.customer_id
        );
      }
      db.prepare(
        'UPDATE orders SET source=?, delivery_fee=?, packaging_cost=?, notes=? WHERE id=?'
      ).run(
        source !== undefined ? source : order.source,
        delivery_fee !== undefined ? parseFloat(delivery_fee) || 0 : order.delivery_fee,
        packaging_cost !== undefined ? parseFloat(packaging_cost) || 0 : order.packaging_cost,
        notes !== undefined ? (notes || null) : order.notes,
        req.params.id
      );
      if (items) {
        for (const oi of existingItems) {
          db.prepare('UPDATE items SET stock = stock + ? WHERE id = ?').run(oi.quantity, oi.item_id);
        }
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
        for (const oi of items) {
          const item = db.prepare('SELECT * FROM items WHERE id = ?').get(oi.item_id);
          db.prepare(
            'INSERT INTO order_items (order_id, item_id, quantity, price_at_time) VALUES (?, ?, ?, ?)'
          ).run(req.params.id, oi.item_id, oi.quantity, item.sell_price);
          db.prepare('UPDATE items SET stock = stock - ? WHERE id = ?').run(oi.quantity, oi.item_id);
        }
      }
    });

    updateOrder();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending','confirmed','out_for_delivery','delivered','cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const deleteOrder = db.transaction(() => {
      // Restore stock
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
      for (const oi of orderItems) {
        db.prepare('UPDATE items SET stock = stock + ? WHERE id = ?').run(oi.quantity, oi.item_id);
      }
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    });

    deleteOrder();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
