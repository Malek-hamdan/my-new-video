# Monthly Expenses (PWA)

Single-page phone app: no build step, no backend. Data is stored in the phone's browser storage (`localStorage`) and survives closing the app.

- **Run locally:** `python3 -m http.server -d expense-app` then open `http://localhost:8000`.
- **On the phone:** deploy via GitHub Pages (workflow `.github/workflows/expense-app-pages.yml`, Settings → Pages → Source: GitHub Actions), open the URL, then *Add to Home Screen*.

Totals convert each expense with the exchange rate saved on it; the last rate entered is remembered for new expenses and the Convert tab.
