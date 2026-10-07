# Monthly Expenses (PWA)

Single-page phone app: no build step, no backend. Data is stored in the phone's browser storage (`localStorage`) and survives closing the app.

- **Run locally:** `python3 -m http.server -d expense-app` then open `http://localhost:8000`.
- **On the phone:** Settings → Pages → *Deploy from a branch* → `main` / `(root)`, then open `https://malek-hamdan.github.io/my-new-video/expense-app/` and *Add to Home Screen*.

Totals convert each expense with the exchange rate saved on it; the last rate entered is remembered for new expenses and the Convert tab.
