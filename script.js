// ---------- STATE ----------
// In-memory only (no localStorage) — data resets on reload, add persistence
// via your own backend/n8n if you need it to survive.
let expenses = [
  // A few seed rows so the ledger + charts aren't empty on first load.
  { id: 1, date: "2026-07-01", category: "Food", amount: 450, note: "groceries" },
  { id: 2, date: "2026-07-02", category: "Travel", amount: 120, note: "auto" },
  { id: 3, date: "2026-07-04", category: "Bills", amount: 1200, note: "electricity" },
  { id: 4, date: "2026-07-06", category: "Food", amount: 300, note: "dinner out" },
  { id: 5, date: "2026-07-08", category: "Shopping", amount: 899, note: "shoes" },
  { id: 6, date: "2026-07-10", category: "Entertainment", amount: 250, note: "movie" },
];
let nextId = 7;

// ---------- PREFIX SUM CORE ----------
// Everything below is built on ONE idea: turn the day-by-day expense list
// into a sorted array of {date, total}, then take a running (prefix) sum
// over it. Once that prefix array exists, any "total between two dates"
// question is a subtraction — O(1) — instead of re-scanning every entry.

function buildDailyTotals(list) {
  const byDate = {};
  for (const e of list) {
    byDate[e.date] = (byDate[e.date] || 0) + Number(e.amount);
  }
  const dates = Object.keys(byDate).sort(); // chronological
  const totals = dates.map(d => byDate[d]);
  return { dates, totals };
}

function buildPrefixSum(totals) {
  const prefix = new Array(totals.length + 1).fill(0);
  for (let i = 0; i < totals.length; i++) {
    prefix[i + 1] = prefix[i] + totals[i];
  }
  return prefix; // prefix[i] = sum of totals[0..i-1]
}

// Range total between two ISO date strings, inclusive. O(log n) to find the
// boundary indices (binary search over sorted dates) + O(1) subtraction.
function rangeTotal(dates, prefix, startDate, endDate) {
  const startIdx = dates.findIndex(d => d >= startDate);
  let endIdx = -1;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] <= endDate) { endIdx = i; break; }
  }
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return 0;
  return prefix[endIdx + 1] - prefix[startIdx];
}

// The cricket "best 5-over scoring window" problem, transplanted onto spend
// data: which contiguous k-day window has the highest total? Same sliding
// window over a prefix sum, O(n) instead of O(n*k).
function maxWindow(dates, totals, prefix, k) {
  if (totals.length < k) return null;
  let best = -Infinity, bestStart = 0;
  for (let i = 0; i + k <= totals.length; i++) {
    const sum = prefix[i + k] - prefix[i];
    if (sum > best) { best = sum; bestStart = i; }
  }
  return { total: best, startDate: dates[bestStart], endDate: dates[bestStart + k - 1] };
}

// ---------- RENDER: TABLE ----------
function renderTable() {
  const body = document.getElementById("ledgerBody");
  const empty = document.getElementById("emptyState");
  body.innerHTML = "";
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.category || "Uncategorised"}</td>
      <td class="num">₹${Number(e.amount).toFixed(2)}</td>
      <td>${e.note || ""}</td>
      <td><button class="del-btn" data-id="${e.id}">remove</button></td>
    `;
    body.appendChild(tr);
  }
  empty.style.display = expenses.length ? "none" : "block";

  document.querySelectorAll(".del-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      expenses = expenses.filter(e => e.id !== Number(btn.dataset.id));
      refreshAll();
    });
  });

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  document.getElementById("totalBalance").textContent = "₹" + total.toFixed(2);
}

// ---------- RENDER: CHARTS ----------
let categoryChart, trendChart;
function renderCharts() {
  const byCategory = {};
  for (const e of expenses) {
    const c = e.category || "Uncategorised";
    byCategory[c] = (byCategory[c] || 0) + Number(e.amount);
  }
  const catLabels = Object.keys(byCategory);
  const catData = Object.values(byCategory);

  const { dates, totals } = buildDailyTotals(expenses);
  const prefix = buildPrefixSum(totals);
  const cumulative = prefix.slice(1); // prefix[1..n] = running total per day

  const ctx1 = document.getElementById("categoryChart");
  const ctx2 = document.getElementById("trendChart");

  if (categoryChart) categoryChart.destroy();
  if (trendChart) trendChart.destroy();

  categoryChart = new Chart(ctx1, {
    type: "doughnut",
    data: {
      labels: catLabels,
      datasets: [{ data: catData, backgroundColor: ["#8a6a2f","#2f6f53","#a13a2f","#52605a","#c9a44c","#4b5a50","#8a3f3f"] }]
    },
    options: { plugins: { legend: { position: "bottom", labels: { font: { family: "Inter" } } } } }
  });

  trendChart = new Chart(ctx2, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        label: "Cumulative spend (₹)",
        data: cumulative,
        borderColor: "#8a6a2f",
        backgroundColor: "rgba(138,106,47,0.15)",
        fill: true,
        tension: 0.25
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function refreshAll() {
  renderTable();
  renderCharts();
}

// ---------- FORM: ADD ENTRY ----------
document.getElementById("entryForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const date = document.getElementById("fDate").value;
  const category = document.getElementById("fCategory").value;
  const amount = document.getElementById("fAmount").value;
  const note = document.getElementById("fNote").value;
  if (!date || !amount) return;

  expenses.push({ id: nextId++, date, category, amount: Number(amount), note });
  ev.target.reset();
  refreshAll();
});

// ---------- PREFIX SUM TOOL BUTTONS ----------
document.getElementById("rangeBtn").addEventListener("click", () => {
  const start = document.getElementById("rangeStart").value;
  const end = document.getElementById("rangeEnd").value;
  const out = document.getElementById("rangeResult");
  if (!start || !end) { out.textContent = "Pick both dates."; return; }
  const { dates, totals } = buildDailyTotals(expenses);
  const prefix = buildPrefixSum(totals);
  const total = rangeTotal(dates, prefix, start, end);
  out.textContent = `Total from ${start} to ${end}: ₹${total.toFixed(2)}`;
});

document.getElementById("windowBtn").addEventListener("click", () => {
  const k = Number(document.getElementById("windowK").value) || 7;
  const out = document.getElementById("windowResult");
  const { dates, totals } = buildDailyTotals(expenses);
  const prefix = buildPrefixSum(totals);
  const result = maxWindow(dates, totals, prefix, k);
  if (!result) { out.textContent = `Not enough days of data for a ${k}-day window yet.`; return; }
  out.textContent = `Highest ${k}-day window: ${result.startDate} → ${result.endDate}, total ₹${result.total.toFixed(2)}`;
});

// ---------- AI AUDITOR (now calls our own serverless proxy — no key needed from the user) ----------
document.getElementById("auditBtn").addEventListener("click", async () => {
  const stampWrap = document.getElementById("auditStampWrap");
  const output = document.getElementById("auditOutput");
  stampWrap.innerHTML = "";
  output.textContent = "Contacting AI agent...";

  const { dates, totals } = buildDailyTotals(expenses);
  const prefix = buildPrefixSum(totals);
  const payload = {
    expenses,
    totalSpend: prefix[prefix.length - 1] || 0,
    daysTracked: dates.length,
  };

  try {
    const res = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ledger: payload }),
    });
    const data = await res.json();

    if (data.fallback || !data.summary) {
      output.textContent = localFallbackSummary(payload);
      stampWrap.innerHTML = `<div class="audit-stamp">Local Audit — fallback</div>`;
    } else {
      output.textContent = data.summary;
      stampWrap.innerHTML = `<div class="audit-stamp">Audited by AI Agent</div>`;
    }
  } catch (err) {
    output.textContent = "Could not reach the AI agent. Showing a local summary instead:\n\n"
      + localFallbackSummary(payload);
    stampWrap.innerHTML = `<div class="audit-stamp">Local Audit — fallback</div>`;
  }
});

// Simple rule-based stand-in so the demo still works with zero setup.
// The real AI reasoning happens server-side in api/audit.js.
function localFallbackSummary(payload) {
  const byCategory = {};
  for (const e of payload.expenses) {
    const c = e.category || "Uncategorised";
    byCategory[c] = (byCategory[c] || 0) + Number(e.amount);
  }
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const lines = [
    `Tracked ₹${payload.totalSpend.toFixed(2)} across ${payload.daysTracked} day(s).`,
    top ? `Biggest category: ${top[0]} at ₹${top[1].toFixed(2)}.` : "",
    "This summary is auto-generated — no setup needed on your end.",
  ];
  return lines.filter(Boolean).join("\n");
}

// ---------- INIT ----------
refreshAll();
