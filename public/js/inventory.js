// ---- Inventory view ----

let inventoryItems = [];

async function renderInventory() {
  const main = document.getElementById('main-content');
  main.innerHTML = `<h1 class="page-title">Inventory</h1>${spinner()}`;

  try {
    inventoryItems = await apiFetch('/api/items');
  } catch (e) {
    main.innerHTML = `<h1 class="page-title">Inventory</h1><div class="alert alert-danger">Failed to load items: ${e.message}</div>`;
    showToast('Failed to load inventory', 'error');
    return;
  }

  main.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <h1 class="page-title mb-0">Inventory</h1>
      <div class="d-flex gap-2">
        <input type="text" class="form-control" id="invSearch" placeholder="Search items…" style="max-width: 220px;" />
        <button class="btn btn-primary" id="addItemBtn"><i class="bi bi-plus-lg"></i> Add Item</button>
      </div>
    </div>
    <div id="outOfStockBanner"></div>
    <div class="row g-3" id="itemGrid"></div>

    <!-- Item modal -->
    <div class="modal fade" id="itemModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="itemForm" enctype="multipart/form-data">
            <div class="modal-header">
              <h5 class="modal-title" id="itemModalTitle">Add Item</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="itemId" />
              <div class="mb-2">
                <label class="form-label">Name *</label>
                <input type="text" class="form-control" id="itemName" required />
              </div>
              <div class="mb-2">
                <label class="form-label">Category</label>
                <input type="text" class="form-control" id="itemCategory" placeholder="food, animal, fruit…" />
              </div>
              <div class="mb-2">
                <label class="form-label">Photo</label>
                <input type="file" class="form-control" id="itemPhoto" accept="image/*" />
              </div>
              <div class="row g-2">
                <div class="col-6">
                  <label class="form-label">Cost Price (QAR)</label>
                  <input type="number" step="0.01" min="0" class="form-control" id="itemCost" required />
                </div>
                <div class="col-6">
                  <label class="form-label">Sell Price (QAR)</label>
                  <input type="number" step="0.01" min="0" class="form-control" id="itemSell" required />
                </div>
              </div>
              <div class="mb-2 mt-2">
                <label class="form-label">Stock Quantity</label>
                <input type="number" min="0" class="form-control" id="itemStock" value="0" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Restock modal -->
    <div class="modal fade" id="restockModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="restockForm">
            <div class="modal-header">
              <h5 class="modal-title">Restock Item</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="restockId" />
              <p class="mb-2">Current stock: <strong id="restockCurrent"></strong></p>
              <label class="form-label">Add Quantity</label>
              <input type="number" min="1" class="form-control" id="restockAdd" value="1" required />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Add Stock</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('addItemBtn').addEventListener('click', openAddItem);
  document.getElementById('invSearch').addEventListener('input', e => drawItemGrid(e.target.value));
  document.getElementById('itemForm').addEventListener('submit', submitItem);
  document.getElementById('restockForm').addEventListener('submit', submitRestock);

  drawItemGrid('');
}

function drawItemGrid(filter) {
  const grid = document.getElementById('itemGrid');
  const banner = document.getElementById('outOfStockBanner');
  const f = (filter || '').toLowerCase();
  const list = inventoryItems.filter(i => i.name.toLowerCase().includes(f));

  const outOfStock = inventoryItems.filter(i => i.stock <= 0);
  banner.innerHTML = outOfStock.length
    ? `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> ${outOfStock.length} item(s) out of stock: ${outOfStock.map(i => i.name).join(', ')}</div>`
    : '';

  if (!list.length) {
    grid.innerHTML = `<div class="col-12 text-center text-muted py-5">No items found.</div>`;
    return;
  }

  grid.innerHTML = list.map(i => {
    const margin = i.sell_price > 0 ? (((i.sell_price - i.cost_price) / i.sell_price) * 100).toFixed(0) : '0';
    const stockBadge = i.stock > 0
      ? `<span class="badge text-bg-success">In stock: ${i.stock}</span>`
      : `<span class="badge text-bg-danger">Out of Stock</span>`;
    const photo = i.photo_path
      ? `<img src="${i.photo_path}" class="card-img-top" style="height:170px;object-fit:cover;border-radius:12px 12px 0 0;" />`
      : `<div class="d-flex align-items-center justify-content-center" style="height:170px;background:var(--border);border-radius:12px 12px 0 0;font-size:2.5rem;">🧸</div>`;
    return `
      <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
        <div class="card h-100">
          ${photo}
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <h6 class="fw-bold mb-1">${i.name}</h6>
              ${stockBadge}
            </div>
            ${i.category ? `<span class="tag-pill mb-2">${i.category}</span>` : ''}
            <div class="mt-2">
              <span style="font-size:1.3rem;font-weight:600;color:var(--primary);">${formatQAR(i.sell_price)}</span>
              <span class="text-muted ms-1" style="font-size:.85rem;">Cost: ${formatQAR(i.cost_price)}</span>
            </div>
            <div class="text-muted" style="font-size:.85rem;">Margin: ${margin}%</div>
            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-sm btn-outline-primary flex-fill" onclick="openEditItem(${i.id})">✏️ Edit</button>
              <button class="btn btn-sm btn-outline-primary flex-fill" onclick="openRestock(${i.id})">📦 Restock</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function openAddItem() {
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('itemModalTitle').textContent = 'Add Item';
  new bootstrap.Modal(document.getElementById('itemModal')).show();
}

function openEditItem(id) {
  const item = inventoryItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('itemModalTitle').textContent = 'Edit Item';
  document.getElementById('itemId').value = item.id;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemCategory').value = item.category || '';
  document.getElementById('itemCost').value = item.cost_price;
  document.getElementById('itemSell').value = item.sell_price;
  document.getElementById('itemStock').value = item.stock;
  document.getElementById('itemPhoto').value = '';
  new bootstrap.Modal(document.getElementById('itemModal')).show();
}

async function submitItem(e) {
  e.preventDefault();
  const id = document.getElementById('itemId').value;
  const fd = new FormData();
  fd.append('name', document.getElementById('itemName').value);
  fd.append('category', document.getElementById('itemCategory').value);
  fd.append('cost_price', document.getElementById('itemCost').value);
  fd.append('sell_price', document.getElementById('itemSell').value);
  fd.append('stock', document.getElementById('itemStock').value);
  const photo = document.getElementById('itemPhoto').files[0];
  if (photo) fd.append('photo', photo);

  try {
    await apiFetch(id ? `/api/items/${id}` : '/api/items', {
      method: id ? 'PUT' : 'POST',
      body: fd,
    });
    bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
    showToast(id ? 'Item updated' : 'Item added');
    inventoryItems = await apiFetch('/api/items');
    drawItemGrid(document.getElementById('invSearch').value);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openRestock(id) {
  const item = inventoryItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('restockId').value = item.id;
  document.getElementById('restockCurrent').textContent = item.stock;
  document.getElementById('restockAdd').value = 1;
  new bootstrap.Modal(document.getElementById('restockModal')).show();
}

async function submitRestock(e) {
  e.preventDefault();
  const id = document.getElementById('restockId').value;
  const add = parseInt(document.getElementById('restockAdd').value);
  try {
    await apiFetch(`/api/items/${id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ add }),
    });
    bootstrap.Modal.getInstance(document.getElementById('restockModal')).hide();
    showToast('Stock added');
    inventoryItems = await apiFetch('/api/items');
    drawItemGrid(document.getElementById('invSearch').value);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
