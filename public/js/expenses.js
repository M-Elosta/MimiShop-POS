// ---- Expenses view ----

let expensesCache = [];

async function renderExpenses() {
  const main = document.getElementById('main-content');
  main.innerHTML = `<h1 class="page-title">Expenses</h1>${spinner()}`;

  try {
    expensesCache = await apiFetch('/api/expenses');
  } catch (e) {
    main.innerHTML = `<h1 class="page-title">Expenses</h1><div class="alert alert-danger">Failed to load expenses: ${e.message}</div>`;
    showToast('Failed to load expenses', 'error');
    return;
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTotal = expensesCache
    .filter(e => (e.date || '').startsWith(monthKey))
    .reduce((s, e) => s + e.amount, 0);

  const today = now.toISOString().slice(0, 10);

  main.innerHTML = `
    <h1 class="page-title">Expenses</h1>
    <p class="text-muted" style="margin-top:-12px;">These expenses are subtracted from your profit on the dashboard.</p>

    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <div class="card stat-card" style="min-width:240px;">
        <div class="stat-label">This Month's Expenses</div>
        <div class="stat-value">${formatQAR(monthTotal)}</div>
      </div>
      <button class="btn btn-primary" id="addExpenseBtn"><i class="bi bi-plus-lg"></i> Add Expense</button>
    </div>

    <div class="card p-0">
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead><tr><th>Label</th><th>Amount</th><th>Date</th><th></th></tr></thead>
          <tbody id="expensesBody"></tbody>
        </table>
      </div>
    </div>

    <div class="modal fade" id="expenseModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="expenseForm">
            <div class="modal-header">
              <h5 class="modal-title">Add Expense</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-2">
                <label class="form-label">Label</label>
                <input type="text" class="form-control" id="expLabel" placeholder="Bubble wrap, Thank you cards…" required />
              </div>
              <div class="mb-2">
                <label class="form-label">Amount (QAR)</label>
                <input type="number" step="0.01" min="0" class="form-control" id="expAmount" required />
              </div>
              <div class="mb-2">
                <label class="form-label">Date</label>
                <input type="date" class="form-control" id="expDate" value="${today}" required />
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
  `;

  document.getElementById('addExpenseBtn').addEventListener('click', () => {
    document.getElementById('expenseForm').reset();
    document.getElementById('expDate').value = today;
    new bootstrap.Modal(document.getElementById('expenseModal')).show();
  });
  document.getElementById('expenseForm').addEventListener('submit', submitExpense);

  drawExpenses();
}

function drawExpenses() {
  const body = document.getElementById('expensesBody');
  if (!expensesCache.length) {
    body.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No expenses yet.</td></tr>`;
    return;
  }
  body.innerHTML = expensesCache.map(e => `
    <tr>
      <td>${e.label}</td>
      <td>${formatQAR(e.amount)}</td>
      <td>${formatDateFull(e.date)}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-danger" onclick="deleteExpense(${e.id})">🗑️</button></td>
    </tr>`).join('');
}

async function submitExpense(e) {
  e.preventDefault();
  const payload = {
    label: document.getElementById('expLabel').value.trim(),
    amount: parseFloat(document.getElementById('expAmount').value),
    date: document.getElementById('expDate').value,
  };
  try {
    await apiFetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();
    showToast('Expense added');
    renderExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  try {
    await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
    showToast('Expense deleted');
    renderExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
