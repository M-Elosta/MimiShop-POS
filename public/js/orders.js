// ---- Orders view ----

const SOURCE_META = {
  tiktok:    { label: 'TikTok',    icon: '🎵' },
  instagram: { label: 'Instagram', icon: '📸' },
  whatsapp:  { label: 'WhatsApp',  icon: '💬' },
  inperson:  { label: 'In-person', icon: '🏠' },
};

let ordersCache = [];
let orderCart = [];        // [{item_id, name, sell_price, quantity}]
let orderStockItems = [];  // in-stock items for step 2

async function renderOrders() {
  const main = document.getElementById('main-content');
  main.innerHTML = `<h1 class="page-title">Orders</h1>${spinner()}`;

  main.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <h1 class="page-title mb-0">Orders</h1>
      <button class="btn btn-primary" id="newOrderBtn"><i class="bi bi-plus-lg"></i> New Order</button>
    </div>

    <div class="card p-3 mb-3">
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-4">
          <label class="form-label mb-1">Status</label>
          <select class="form-select" id="filterStatus">
            <option value="">All</option>
            ${Object.keys(STATUS_META).map(s => `<option value="${s}">${STATUS_META[s].label}</option>`).join('')}
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label mb-1">From</label>
          <input type="date" class="form-control" id="filterFrom" />
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label mb-1">To</label>
          <input type="date" class="form-control" id="filterTo" />
        </div>
        <div class="col-12 col-md-2">
          <button class="btn btn-outline-primary w-100" id="applyFilters">Filter</button>
        </div>
      </div>
    </div>

    <div class="card p-0">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>#</th><th>Customer</th><th>Date</th><th>Source</th>
              <th>Items</th><th>Total</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="ordersBody"></tbody>
        </table>
      </div>
    </div>

    ${orderModalHTML()}
    ${orderDetailModalHTML()}
    ${editOrderModalHTML()}
  `;

  document.getElementById('newOrderBtn').addEventListener('click', openNewOrder);
  document.getElementById('applyFilters').addEventListener('click', loadOrders);
  document.getElementById('orderForm').addEventListener('submit', submitOrder);
  document.getElementById('waInput').addEventListener('blur', lookupCustomer);
  document.getElementById('itemSearchInput').addEventListener('input', e => drawStockItems(e.target.value));
  document.getElementById('editOrderForm').addEventListener('submit', submitEditOrder);

  await loadOrders();
}

async function loadOrders() {
  const body = document.getElementById('ordersBody');
  body.innerHTML = `<tr><td colspan="8">${spinner()}</td></tr>`;
  const status = document.getElementById('filterStatus').value;
  const from = document.getElementById('filterFrom').value;
  const to = document.getElementById('filterTo').value;
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    ordersCache = await apiFetch('/api/orders?' + params.toString());
  } catch (e) {
    body.innerHTML = `<tr><td colspan="8" class="text-danger">Failed to load: ${e.message}</td></tr>`;
    return;
  }

  if (!ordersCache.length) {
    body.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No orders found.</td></tr>`;
    return;
  }

  body.innerHTML = ordersCache.map(o => {
    const src = SOURCE_META[o.source] || { label: '—', icon: '' };
    const st = STATUS_META[o.status] || { label: o.status, color: 'secondary' };
    return `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customer_name || '—'}</td>
        <td>${formatDateFull(o.created_at)}</td>
        <td>${src.icon} ${src.label}</td>
        <td>${o.item_count} item(s)</td>
        <td>${formatQAR(o.total)}</td>
        <td><span class="badge text-bg-${st.color}">${st.label}</span></td>
        <td class="d-flex gap-1 flex-wrap">
          <button class="btn btn-sm btn-outline-primary" onclick="openOrderDetail(${o.id})">👁 View</button>
          ${!['delivered','cancelled'].includes(o.status) ? `<button class="btn btn-sm btn-outline-secondary" onclick="openEditOrder(${o.id})">✏️ Edit</button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

// ---- New order (3-step modal) ----

function orderModalHTML() {
  return `
  <div class="modal fade" id="orderModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <form id="orderForm">
          <div class="modal-header">
            <h5 class="modal-title">New Order</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <ul class="nav nav-pills mb-3" id="orderSteps">
              <li class="nav-item"><span class="nav-link active" data-step="1">1. Customer</span></li>
              <li class="nav-item"><span class="nav-link" data-step="2">2. Items</span></li>
              <li class="nav-item"><span class="nav-link" data-step="3">3. Details</span></li>
            </ul>

            <div class="order-step" data-step="1">
              <div class="mb-2">
                <label class="form-label">WhatsApp Number</label>
                <input type="text" class="form-control" id="waInput" placeholder="e.g. 33001122" />
                <small class="text-muted">Leaves field to auto-search existing customers.</small>
              </div>
              <div class="mb-2">
                <label class="form-label">Customer Name *</label>
                <input type="text" class="form-control" id="custName" required />
              </div>
              <div class="mb-2">
                <label class="form-label">Area / Neighborhood</label>
                <input type="text" class="form-control" id="custArea" />
              </div>
            </div>

            <div class="order-step d-none" data-step="2">
              <input type="text" class="form-control mb-2" id="itemSearchInput" placeholder="Search in-stock items…" />
              <div id="stockItemList" style="max-height:220px;overflow:auto;"></div>
              <hr/>
              <h6>Cart</h6>
              <div id="cartList"></div>
              <div class="text-end fw-bold mt-2">Subtotal: <span id="cartSubtotal">QAR 0.00</span></div>
            </div>

            <div class="order-step d-none" data-step="3">
              <div class="mb-2">
                <label class="form-label">Source</label>
                <select class="form-select" id="orderSource">
                  ${Object.keys(SOURCE_META).map(s => `<option value="${s}">${SOURCE_META[s].icon} ${SOURCE_META[s].label}</option>`).join('')}
                </select>
              </div>
              <div class="row g-2">
                <div class="col-6">
                  <label class="form-label">Delivery Fee (QAR)</label>
                  <input type="number" step="0.01" min="0" class="form-control" id="orderDelivery" value="0" oninput="drawSummary()" />
                </div>
                <div class="col-6">
                  <label class="form-label">Packaging Cost (QAR)</label>
                  <input type="number" step="0.01" min="0" class="form-control" id="orderPackaging" value="0" oninput="drawSummary()" />
                </div>
              </div>
              <div class="mb-2 mt-2">
                <label class="form-label">Notes</label>
                <textarea class="form-control" id="orderNotes" rows="2"></textarea>
              </div>
              <div class="card p-3 mt-2" style="background:var(--bg);">
                <h6>Order Summary</h6>
                <div id="orderSummary"></div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" id="stepBack" style="display:none;">Back</button>
            <button type="button" class="btn btn-primary" id="stepNext">Next</button>
            <button type="submit" class="btn btn-primary" id="stepSubmit" style="display:none;">Place Order</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

let currentStep = 1;

function openNewOrder() {
  orderCart = [];
  currentStep = 1;
  document.getElementById('orderForm').reset();
  document.getElementById('custArea').value = '';
  gotoStep(1);
  drawCart();

  apiFetch('/api/items').then(items => {
    orderStockItems = items.filter(i => i.stock > 0);
    drawStockItems('');
  });

  // wire step buttons (idempotent)
  document.getElementById('stepNext').onclick = () => gotoStep(currentStep + 1);
  document.getElementById('stepBack').onclick = () => gotoStep(currentStep - 1);

  new bootstrap.Modal(document.getElementById('orderModal')).show();
}

function gotoStep(step) {
  if (step < 1 || step > 3) return;
  // validation moving forward
  if (step > currentStep) {
    if (currentStep === 1 && !document.getElementById('custName').value.trim()) {
      showToast('Customer name is required', 'error'); return;
    }
    if (currentStep === 2 && !orderCart.length) {
      showToast('Add at least one item', 'error'); return;
    }
  }
  currentStep = step;
  document.querySelectorAll('#orderModal .order-step').forEach(el => {
    el.classList.toggle('d-none', +el.dataset.step !== step);
  });
  document.querySelectorAll('#orderSteps .nav-link').forEach(el => {
    el.classList.toggle('active', +el.dataset.step === step);
  });
  document.getElementById('stepBack').style.display = step > 1 ? '' : 'none';
  document.getElementById('stepNext').style.display = step < 3 ? '' : 'none';
  document.getElementById('stepSubmit').style.display = step === 3 ? '' : 'none';
  if (step === 3) drawSummary();
}

function drawStockItems(filter) {
  const f = (filter || '').toLowerCase();
  const list = orderStockItems.filter(i => i.name.toLowerCase().includes(f));
  const el = document.getElementById('stockItemList');
  if (!el) return;
  el.innerHTML = list.length ? list.map(i => `
    <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
      <span>${i.name} <small class="text-muted">(${formatQAR(i.sell_price)}, stock ${i.stock})</small></span>
      <button type="button" class="btn btn-sm btn-outline-primary" onclick="addToCart(${i.id})">Add</button>
    </div>`).join('') : '<div class="text-muted py-2">No matching in-stock items.</div>';
}

function addToCart(itemId) {
  const item = orderStockItems.find(i => i.id === itemId);
  if (!item) return;
  const existing = orderCart.find(c => c.item_id === itemId);
  const inCart = existing ? existing.quantity : 0;
  if (inCart + 1 > item.stock) { showToast('Not enough stock', 'error'); return; }
  if (existing) existing.quantity++;
  else orderCart.push({ item_id: item.id, name: item.name, sell_price: item.sell_price, quantity: 1, stock: item.stock });
  drawCart();
}

function changeQty(itemId, delta) {
  const c = orderCart.find(x => x.item_id === itemId);
  if (!c) return;
  const next = c.quantity + delta;
  if (next <= 0) { orderCart = orderCart.filter(x => x.item_id !== itemId); }
  else if (next > c.stock) { showToast('Not enough stock', 'error'); return; }
  else c.quantity = next;
  drawCart();
}

function cartSubtotal() {
  return orderCart.reduce((s, c) => s + c.sell_price * c.quantity, 0);
}

function drawCart() {
  const el = document.getElementById('cartList');
  if (!el) return;
  el.innerHTML = orderCart.length ? orderCart.map(c => `
    <div class="d-flex justify-content-between align-items-center py-1">
      <span>${c.name}</span>
      <span class="d-flex align-items-center gap-2">
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="changeQty(${c.item_id}, -1)">−</button>
        <span>${c.quantity}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="changeQty(${c.item_id}, 1)">+</button>
        <span class="ms-2">${formatQAR(c.sell_price * c.quantity)}</span>
      </span>
    </div>`).join('') : '<div class="text-muted">Cart is empty.</div>';
  const sub = document.getElementById('cartSubtotal');
  if (sub) sub.textContent = formatQAR(cartSubtotal());
}

function drawSummary() {
  const delivery = parseFloat(document.getElementById('orderDelivery').value) || 0;
  const packaging = parseFloat(document.getElementById('orderPackaging').value) || 0;
  const sub = cartSubtotal();
  const total = sub + delivery + packaging;
  document.getElementById('orderSummary').innerHTML = `
    ${orderCart.map(c => `<div class="d-flex justify-content-between"><span>${c.name} × ${c.quantity}</span><span>${formatQAR(c.sell_price * c.quantity)}</span></div>`).join('')}
    <hr class="my-2"/>
    <div class="d-flex justify-content-between"><span>Subtotal</span><span>${formatQAR(sub)}</span></div>
    <div class="d-flex justify-content-between"><span>Delivery</span><span>${formatQAR(delivery)}</span></div>
    <div class="d-flex justify-content-between"><span>Packaging</span><span>${formatQAR(packaging)}</span></div>
    <div class="d-flex justify-content-between fw-bold mt-1" style="font-size:1.1rem;"><span>Total</span><span>${formatQAR(total)}</span></div>
  `;
}

async function lookupCustomer() {
  const wa = document.getElementById('waInput').value.trim();
  if (!wa) return;
  try {
    const customers = await apiFetch('/api/customers');
    const match = customers.find(c => c.whatsapp === wa);
    if (match) {
      document.getElementById('custName').value = match.name;
      document.getElementById('custArea').value = match.area || '';
      showToast(`Found existing customer: ${match.name}`);
    }
  } catch (e) { /* silent */ }
}

async function submitOrder(e) {
  e.preventDefault();
  if (!orderCart.length) { showToast('Cart is empty', 'error'); return; }
  const payload = {
    customer: {
      name: document.getElementById('custName').value.trim(),
      whatsapp: document.getElementById('waInput').value.trim(),
      area: document.getElementById('custArea').value.trim(),
    },
    items: orderCart.map(c => ({ item_id: c.item_id, quantity: c.quantity })),
    delivery_fee: parseFloat(document.getElementById('orderDelivery').value) || 0,
    packaging_cost: parseFloat(document.getElementById('orderPackaging').value) || 0,
    source: document.getElementById('orderSource').value,
    notes: document.getElementById('orderNotes').value.trim(),
  };
  try {
    await apiFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();
    showToast('Order placed!');
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Order detail ----

function orderDetailModalHTML() {
  return `
  <div class="modal fade" id="orderDetailModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="orderDetailTitle">Order</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="orderDetailBody"></div>
      </div>
    </div>
  </div>`;
}

async function openOrderDetail(id) {
  const modal = new bootstrap.Modal(document.getElementById('orderDetailModal'));
  document.getElementById('orderDetailBody').innerHTML = spinner();
  modal.show();

  let o;
  try {
    o = await apiFetch(`/api/orders/${id}`);
  } catch (e) {
    document.getElementById('orderDetailBody').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    return;
  }

  const src = SOURCE_META[o.source] || { label: '—', icon: '' };
  const sub = o.items.reduce((s, it) => s + it.quantity * it.price_at_time, 0);
  const total = sub + (o.delivery_fee || 0) + (o.packaging_cost || 0);

  document.getElementById('orderDetailTitle').textContent = `Order #${o.id}`;
  document.getElementById('orderDetailBody').innerHTML = `
    <p class="mb-1"><strong>Customer:</strong> ${o.customer_name || '—'} ${o.whatsapp ? `(${o.whatsapp})` : ''}</p>
    <p class="mb-1"><strong>Area:</strong> ${o.area || '—'}</p>
    <p class="mb-1"><strong>Date:</strong> ${formatDateFull(o.created_at)}</p>
    <p class="mb-1"><strong>Source:</strong> ${src.icon} ${src.label}</p>
    ${o.notes ? `<p class="mb-1"><strong>Notes:</strong> ${o.notes}</p>` : ''}
    <table class="table mt-2">
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
      <tbody>
        ${o.items.map(it => `<tr><td>${it.item_name}</td><td>${it.quantity}</td><td>${formatQAR(it.price_at_time)}</td><td>${formatQAR(it.quantity * it.price_at_time)}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="text-end">
      <div>Subtotal: ${formatQAR(sub)}</div>
      <div>Delivery: ${formatQAR(o.delivery_fee || 0)}</div>
      <div>Packaging: ${formatQAR(o.packaging_cost || 0)}</div>
      <div class="fw-bold" style="font-size:1.1rem;">Total: ${formatQAR(total)}</div>
    </div>
    <hr/>
    <div class="row g-2 align-items-end">
      <div class="col-8">
        <label class="form-label">Update Status</label>
        <select class="form-select" id="detailStatus">
          ${Object.keys(STATUS_META).map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_META[s].label}</option>`).join('')}
        </select>
      </div>
      <div class="col-4">
        <button class="btn btn-primary w-100" onclick="updateOrderStatus(${o.id})">Update</button>
      </div>
    </div>
    <div class="mt-3">
      <a href="/receipt/${o.id}" target="_blank" class="btn btn-outline-primary">🧾 View Receipt</a>
    </div>
  `;
}

async function updateOrderStatus(id) {
  const status = document.getElementById('detailStatus').value;
  try {
    await apiFetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    showToast('Status updated');
    bootstrap.Modal.getInstance(document.getElementById('orderDetailModal')).hide();
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Edit order ----

let editOrderId = null;
let editOrderCart = [];   // [{item_id, name, sell_price, quantity, effectiveStock}]
let editAllItems = [];    // all items from API

function editOrderModalHTML() {
  return `
  <div class="modal fade" id="editOrderModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <form id="editOrderForm">
          <div class="modal-header">
            <h5 class="modal-title" id="editOrderTitle">Edit Order</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">

            <h6 class="fw-semibold text-muted mb-2">Customer</h6>
            <div class="row g-2 mb-3">
              <div class="col-12 col-md-4">
                <label class="form-label">Name *</label>
                <input type="text" class="form-control" id="editCustName" required />
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label">WhatsApp</label>
                <input type="text" class="form-control" id="editCustWa" />
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label">Area</label>
                <input type="text" class="form-control" id="editCustArea" />
              </div>
            </div>

            <h6 class="fw-semibold text-muted mb-2">Items</h6>
            <input type="text" class="form-control mb-2" id="editItemSearch" placeholder="Search to add items…" />
            <div id="editStockList" style="max-height:150px;overflow:auto;" class="mb-2"></div>
            <div id="editCartList"></div>
            <div class="text-end fw-bold mt-1">Subtotal: <span id="editCartSubtotal">QAR 0.00</span></div>

            <h6 class="fw-semibold text-muted mt-3 mb-2">Details</h6>
            <div class="row g-2 mb-2">
              <div class="col-12 col-md-4">
                <label class="form-label">Source</label>
                <select class="form-select" id="editOrderSource">
                  ${Object.keys(SOURCE_META).map(s => `<option value="${s}">${SOURCE_META[s].icon} ${SOURCE_META[s].label}</option>`).join('')}
                </select>
              </div>
              <div class="col-6 col-md-4">
                <label class="form-label">Delivery Fee (QAR)</label>
                <input type="number" step="0.01" min="0" class="form-control" id="editDelivery" value="0" oninput="drawEditSummary()" />
              </div>
              <div class="col-6 col-md-4">
                <label class="form-label">Packaging Cost (QAR)</label>
                <input type="number" step="0.01" min="0" class="form-control" id="editPackaging" value="0" oninput="drawEditSummary()" />
              </div>
            </div>
            <div class="mb-2">
              <label class="form-label">Notes</label>
              <textarea class="form-control" id="editNotes" rows="2"></textarea>
            </div>

            <div class="card p-3 mt-2" style="background:var(--bg);">
              <h6>Order Summary</h6>
              <div id="editOrderSummary"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function openEditOrder(id) {
  let order;
  try {
    order = await apiFetch(`/api/orders/${id}`);
  } catch (e) {
    showToast('Failed to load order', 'error');
    return;
  }

  if (['delivered', 'cancelled'].includes(order.status)) {
    showToast('Cannot edit a delivered or cancelled order', 'error');
    return;
  }

  editOrderId = id;

  try {
    editAllItems = await apiFetch('/api/items');
  } catch (e) {
    showToast('Failed to load items', 'error');
    return;
  }

  // Build cart from order items; restore this order's deducted stock for each item
  editOrderCart = order.items.map(oi => {
    const item = editAllItems.find(i => i.id === oi.item_id);
    return {
      item_id: oi.item_id,
      name: oi.item_name,
      sell_price: oi.price_at_time,
      quantity: oi.quantity,
      effectiveStock: (item ? item.stock : 0) + oi.quantity,
    };
  });

  document.getElementById('editOrderTitle').textContent = `Edit Order #${id}`;
  document.getElementById('editCustName').value = order.customer_name || '';
  document.getElementById('editCustWa').value = order.whatsapp || '';
  document.getElementById('editCustArea').value = order.area || '';
  document.getElementById('editOrderSource').value = order.source || 'whatsapp';
  document.getElementById('editDelivery').value = order.delivery_fee || 0;
  document.getElementById('editPackaging').value = order.packaging_cost || 0;
  document.getElementById('editNotes').value = order.notes || '';

  document.getElementById('editItemSearch').oninput = e => drawEditStockItems(e.target.value);

  drawEditCart();
  drawEditStockItems('');
  drawEditSummary();

  new bootstrap.Modal(document.getElementById('editOrderModal')).show();
}

function drawEditStockItems(filter) {
  const f = (filter || '').toLowerCase();
  const list = editAllItems.filter(i => {
    if (!i.name.toLowerCase().includes(f)) return false;
    const inCart = editOrderCart.find(c => c.item_id === i.id);
    if (inCart) return inCart.quantity < inCart.effectiveStock;
    return i.stock > 0;
  });
  const el = document.getElementById('editStockList');
  if (!el) return;
  el.innerHTML = list.length ? list.map(i => {
    const inCart = editOrderCart.find(c => c.item_id === i.id);
    const avail = inCart ? inCart.effectiveStock : i.stock;
    return `
      <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
        <span>${i.name} <small class="text-muted">(${formatQAR(i.sell_price)}, stock ${avail})</small></span>
        <button type="button" class="btn btn-sm btn-outline-primary" onclick="addToEditCart(${i.id})">Add</button>
      </div>`;
  }).join('') : '<div class="text-muted py-2">No matching in-stock items.</div>';
}

function addToEditCart(itemId) {
  const item = editAllItems.find(i => i.id === itemId);
  if (!item) return;
  const existing = editOrderCart.find(c => c.item_id === itemId);
  if (existing) {
    if (existing.quantity + 1 > existing.effectiveStock) { showToast('Not enough stock', 'error'); return; }
    existing.quantity++;
  } else {
    if (item.stock <= 0) { showToast('Not enough stock', 'error'); return; }
    editOrderCart.push({ item_id: item.id, name: item.name, sell_price: item.sell_price, quantity: 1, effectiveStock: item.stock });
  }
  drawEditCart();
  drawEditSummary();
  drawEditStockItems(document.getElementById('editItemSearch').value);
}

function changeEditQty(itemId, delta) {
  const c = editOrderCart.find(x => x.item_id === itemId);
  if (!c) return;
  const next = c.quantity + delta;
  if (next <= 0) { editOrderCart = editOrderCart.filter(x => x.item_id !== itemId); }
  else if (next > c.effectiveStock) { showToast('Not enough stock', 'error'); return; }
  else c.quantity = next;
  drawEditCart();
  drawEditSummary();
  drawEditStockItems(document.getElementById('editItemSearch').value);
}

function editCartSubtotal() {
  return editOrderCart.reduce((s, c) => s + c.sell_price * c.quantity, 0);
}

function drawEditCart() {
  const el = document.getElementById('editCartList');
  if (!el) return;
  el.innerHTML = editOrderCart.length ? editOrderCart.map(c => `
    <div class="d-flex justify-content-between align-items-center py-1">
      <span>${c.name}</span>
      <span class="d-flex align-items-center gap-2">
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="changeEditQty(${c.item_id}, -1)">−</button>
        <span>${c.quantity}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="changeEditQty(${c.item_id}, 1)">+</button>
        <span class="ms-2">${formatQAR(c.sell_price * c.quantity)}</span>
      </span>
    </div>`).join('') : '<div class="text-muted">No items.</div>';
  const sub = document.getElementById('editCartSubtotal');
  if (sub) sub.textContent = formatQAR(editCartSubtotal());
}

function drawEditSummary() {
  const delivery = parseFloat(document.getElementById('editDelivery')?.value) || 0;
  const packaging = parseFloat(document.getElementById('editPackaging')?.value) || 0;
  const sub = editCartSubtotal();
  const total = sub + delivery + packaging;
  const el = document.getElementById('editOrderSummary');
  if (!el) return;
  el.innerHTML = `
    ${editOrderCart.map(c => `<div class="d-flex justify-content-between"><span>${c.name} × ${c.quantity}</span><span>${formatQAR(c.sell_price * c.quantity)}</span></div>`).join('')}
    <hr class="my-2"/>
    <div class="d-flex justify-content-between"><span>Subtotal</span><span>${formatQAR(sub)}</span></div>
    <div class="d-flex justify-content-between"><span>Delivery</span><span>${formatQAR(delivery)}</span></div>
    <div class="d-flex justify-content-between"><span>Packaging</span><span>${formatQAR(packaging)}</span></div>
    <div class="d-flex justify-content-between fw-bold mt-1" style="font-size:1.1rem;"><span>Total</span><span>${formatQAR(total)}</span></div>
  `;
}

async function submitEditOrder(e) {
  e.preventDefault();
  if (!editOrderCart.length) { showToast('Order must have at least one item', 'error'); return; }
  const payload = {
    customer: {
      name: document.getElementById('editCustName').value.trim(),
      whatsapp: document.getElementById('editCustWa').value.trim(),
      area: document.getElementById('editCustArea').value.trim(),
    },
    items: editOrderCart.map(c => ({ item_id: c.item_id, quantity: c.quantity })),
    source: document.getElementById('editOrderSource').value,
    delivery_fee: parseFloat(document.getElementById('editDelivery').value) || 0,
    packaging_cost: parseFloat(document.getElementById('editPackaging').value) || 0,
    notes: document.getElementById('editNotes').value.trim(),
  };
  try {
    await apiFetch(`/api/orders/${editOrderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    bootstrap.Modal.getInstance(document.getElementById('editOrderModal')).hide();
    showToast('Order updated!');
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
