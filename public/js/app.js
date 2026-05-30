// ---- Shared helpers (used across all views) ----

function formatQAR(n) {
  const num = Number(n) || 0;
  return 'QAR ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

function formatDateFull(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const bg = type === 'error' ? 'text-bg-danger' : 'text-bg-success';
  const el = document.createElement('div');
  el.className = `toast align-items-center ${bg} border-0`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(el);
  const toast = new bootstrap.Toast(el, { delay: 3000 });
  toast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function spinner() {
  return `<div class="loading-wrap"><div class="spinner-border" style="color: var(--primary);" role="status"><span class="visually-hidden">Loading...</span></div></div>`;
}

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---- Hash router ----

const routes = {
  dashboard: () => renderDashboard(),
  inventory: () => renderInventory(),
  orders: () => renderOrders(),
  expenses: () => renderExpenses(),
};

function router() {
  let hash = window.location.hash.replace('#', '') || 'dashboard';
  if (!routes[hash]) hash = 'dashboard';

  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === hash);
  });

  document.getElementById('sidebar')?.classList.remove('open');
  routes[hash]();
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  if (!window.location.hash) window.location.hash = '#dashboard';
  router();

  document.getElementById('mobileToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
});
