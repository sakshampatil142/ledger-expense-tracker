# 📖 The Ledger — An Expense Tracker That Audits Itself

A personal expense tracker with an old-ledger-book aesthetic, built around
**prefix sums** for its core queries and a pluggable **AI Auditor** that
sends your spending data to an AI agent (Dify workflow or n8n webhook) for
a natural-language summary — with a graceful local fallback if no agent is
connected.

**[Live Demo →](#)** *(add your GitHub Pages link here once deployed)*

---

## ✨ Why this project

Most beginner expense trackers stop at "add a row, show a total." This one
tries to do two more interesting things:

1. **Reframe a classic DSA pattern as a real feature.** The "highest
   k-day spending window" tool uses the exact same sliding-window-over-a
   -prefix-sum technique used to solve problems like "best 5-over scoring
   window in cricket" — just pointed at expense data instead of runs.
   Range-total queries between any two dates are O(1) lookups once the
   prefix array is built, instead of re-scanning every entry.

2. **Treat the AI feature as optional infrastructure, not a hard
   dependency.** If no AI agent is configured (or the request fails), the
   app falls back to a simple rule-based local summary instead of
   breaking. The UI is transparent about which one produced the result
   (an "Audited by AI Agent" stamp vs. a "Local Audit — fallback" stamp).

---

## 🧠 How the prefix-sum core works

```
expenses (raw list)
      │
      ▼
buildDailyTotals()  →  { dates: [...sorted...], totals: [...per day...] }
      │
      ▼
buildPrefixSum()    →  prefix[i] = sum of totals[0..i-1]
      │
      ├── rangeTotal(start, end)   → prefix[endIdx+1] - prefix[startIdx]      (O(1) after O(log n) lookup)
      └── maxWindow(k)             → max(prefix[i+k] - prefix[i]) over all i  (O(n) sliding window)
```

This is the same trick that powers the cumulative-spend line chart too —
the chart is just the prefix-sum array plotted directly.

---

## 🤖 AI Auditor

The AI Auditor panel lets you plug in either:

- **Dify (Workflow API)** — `POST https://api.dify.ai/v1/workflows/run`
  with an `Authorization: Bearer <your-app-api-key>` header. The workflow
  receives the ledger as a JSON string, and its output must include a
  variable named `summary`.
- **n8n (Webhook)** — any webhook URL that accepts a POST with the ledger
  payload and returns `{ "summary": "..." }`.

If no endpoint is set, or the request fails for any reason (network,
auth, timeout), the app shows a rule-based local summary instead so the
page never feels broken.

> ⚠️ **Note on API keys:** this is a client-side demo, so the API key is
> visible in the browser. That's fine for local testing/demos, but for
> production use you'd want to proxy the request through a small backend
> so the key never reaches the client.

---

## 🛠️ Tech stack

- Vanilla HTML/CSS/JS — no framework, no build step
- [Chart.js](https://www.chartjs.org/) for the category and trend charts
- Google Fonts (Spectral, IBM Plex Mono, Inter) for the ledger-book look
- [Dify](https://dify.ai/) as the AI workflow backend (n8n also supported)

---

## 🚀 Running it locally

No build tools needed — it's static files.

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
# then just open index.html in a browser, or serve it:
python3 -m http.server 8000
# visit http://localhost:8000
```

To use the AI Auditor, you'll need your own Dify app:
1. Create a workflow app in Dify with a `input_text` input variable and a
   `summary` output variable.
2. Grab your app's API key from **API Access → API Key**.
3. Paste the endpoint (`https://api.dify.ai/v1/workflows/run`) and key
   into the AI Auditor panel.

---

## 📌 Known limitations

- Data is in-memory only (resets on page reload) — no persistence layer yet
- API key is stored client-side, which is fine for a demo but not for production
- Single-currency (₹) display only

---

## 📷 Screenshots

*(add a screenshot or GIF of the ledger table, charts, and the AI Auditor
stamp here before publishing)*

