I'm sending you one file: `index.html`. It is the whole app, a single-file spare-parts register for a factory store room (vanilla JS, no framework). Please REVIEW it. Do not rewrite it, do not send a new version, and do not send big code blocks.

**What the app does**
- 4 machines (BLM, BCW3, Bonal, Sollas), parts organised by month, Imported and Local kept separate.
- Receive (stock in) and Transfer (stock out, with a printed issue slip). Every Transfer/Receive changes the part's stock and writes a row in a Transaction log.
- Summary: a machine rating (parts issued this month vs the average of up to 6 earlier months, Gamma-Poisson test, needs 3 months of history), an analysis for flagged machines, and a forecast for next month's need and order quantity.
- Data is saved in a shared store (collections: parts, transactions, consumables, usedParts, equipment, snapshots, snapshotChunks) with a localStorage / IndexedDB fallback.
- Used mostly on a phone in the store room. Data grows every month (now about 1,400 parts and 100 transactions, growing).

**Please look at these areas, in this order**
1. **Stock vs transactions**: can the stock number ever disagree with the transaction log? (editing, deleting a transaction, two people at once, a failed save halfway)
2. **Data loss**: lost connection, failed save, restore from backup, daily copies, closing the tab while a save is pending.
3. **Speed** with 1,500 to 5,000 parts: slow renders, repeated full re-renders, anything that gets worse with more data.
4. **Phone**: layout, touch targets, anything that breaks on a small screen.
5. **The rating and forecast maths** (functions `rateTest`, `rateLevel`, `partForecast`, `scorecard`, `machineAnalysis`): edge cases, off-by-one on days or months, a running month, wrong dates, zero history.
6. **Anything else** that looks wrong, risky or confusing for a store keeper.

**How to answer**
Give me a table, most serious first. One row per finding:

| # | Severity (high / medium / low) | Where (function or line) | What is wrong | How to reproduce | Suggested fix in one or two sentences |

- Only report things you are fairly sure about. If you are guessing, say "not sure".
- Do not suggest new features. Do not suggest changing the design, the colours, the framework, or moving to another database.
- Do not paste whole replacement functions. A short snippet is fine when it makes the fix clear.
- Stop at 15 findings, the most important ones.
