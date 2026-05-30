// ---- Dashboard view ----

let dashCharts = { revenue: null, topItems: null };

const STATUS_META = {
  pending:          { label: 'Pending',          color: 'warning' },
  confirmed:        { label: 'Confirmed',         color: 'info' },
  out_for_delivery: { label: 'Out for Delivery',  color: 'primary' },
  delivered:        { label: 'Delivered',         color: 'success' },
  cancelled:        { label: 'Cancelled',         color: 'danger' },
};

async function renderDashboard() {
  const main = document.getElementById('main-content');
  main.innerHTML = `<h1 class="page-title">Dashboard</h1>${spinner()}`;

  let d;
  try {
    d = await apiFetch('/api/dashboard');
  } catch (e) {
    main.innerHTML = `<h1 class="page-title">Dashboard</h1><div class="alert alert-danger">Failed to load dashboard: ${e.message}</div>`;
    showToast('Failed to load dashboard', 'error');
    return;
  }

  const profitPositive = d.profit_total >= 0;
  const profitColor = profitPositive ? '#2e9e5b' : '#d9534f';

  main.innerHTML = `
    <h1 class="page-title">Dashboard</h1>

    <div class="row g-3 mb-4">
      <div class="col-6 col-lg-3">
        <div class="card stat-card h-100">
          <div class="stat-label">💰 Total Revenue</div>
          <div class="stat-value">${formatQAR(d.revenue_total)}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card stat-card h-100">
          <div class="stat-label">📈 This Month</div>
          <div class="stat-value">${formatQAR(d.revenue_month)}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card stat-card h-100" style="border-left: 5px solid ${profitColor};">
          <div class="stat-label">🟢 Net Profit</div>
          <div class="stat-value" style="color: ${profitColor};">${formatQAR(d.profit_total)}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card stat-card h-100">
          <div class="stat-label">⏳ Pending Orders</div>
          <div class="stat-value">${d.pending_count}</div>
        </div>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-12 col-lg-7">
        <div class="card p-3 h-100">
          <h5 class="mb-3">Revenue — Last 30 Days</h5>
          <canvas id="revenueChart" height="120"></canvas>
        </div>
      </div>
      <div class="col-12 col-lg-5">
        <div class="card p-3 h-100">
          <h5 class="mb-3">Top 5 Best-Sellers (Qty)</h5>
          <canvas id="topItemsChart" height="160"></canvas>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-lg-7">
        <div class="card p-3 h-100">
          <h5 class="mb-3">Orders by Status</h5>
          <div class="d-flex flex-wrap gap-2">
            ${Object.keys(STATUS_META).map(s => `
              <span class="badge text-bg-${STATUS_META[s].color} p-2">
                ${STATUS_META[s].label}: ${d.orders_by_status[s] || 0}
              </span>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3 mt-1">
      <div class="col-6 col-lg-3">
        <div class="card stat-card h-100">
          <div class="stat-label">🚚 Delivery Fees Earned</div>
          <div class="stat-value">${formatQAR(d.delivery_fees_total)}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="card stat-card h-100">
          <div class="stat-label">📦 Packaging Costs</div>
          <div class="stat-value">${formatQAR(d.packaging_costs_total)}</div>
        </div>
      </div>
    </div>
  `;

  // ---- Charts ----
  if (dashCharts.revenue) dashCharts.revenue.destroy();
  if (dashCharts.topItems) dashCharts.topItems.destroy();

  const revData = d.revenue_last_30_days || [];
  dashCharts.revenue = new Chart(document.getElementById('revenueChart'), {
    type: 'line',
    data: {
      labels: revData.map(r => formatDateShort(r.date)),
      datasets: [{
        label: 'Revenue (QAR)',
        data: revData.map(r => r.revenue),
        borderColor: '#C9847A',
        backgroundColor: 'rgba(201, 132, 122, 0.15)',
        fill: true,
        tension: 0.3,
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  const topData = d.top_items_qty || [];
  dashCharts.topItems = new Chart(document.getElementById('topItemsChart'), {
    type: 'bar',
    data: {
      labels: topData.map(r => r.name),
      datasets: [{
        label: 'Quantity Sold',
        data: topData.map(r => r.total_qty),
        backgroundColor: '#8B4A47',
        borderRadius: 6,
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}
