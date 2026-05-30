const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/items',     require('./routes/items'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/expenses',  require('./routes/expenses'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/receipt/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/receipt.html'));
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mimi's Shop running on http://localhost:${PORT}`);
});
