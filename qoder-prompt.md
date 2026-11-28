Build me a web app called **UII — Machine Spare Parts Register**. It is the spare-parts stock register for a factory store room. Build it as **one single HTML file** (HTML + CSS + vanilla JavaScript, no framework, no build step, no server). It must open by double-clicking the file in Microsoft Edge or Chrome, work offline, and save everything in the browser (IndexedDB, with localStorage as a fallback). Language of the interface: English.

## 1. Main structure

- **Two areas**, switched by two big buttons at the top:
  - **Spare Parts**: machine parts, organised by month.
  - **Equipment**: tools, supplies, oils, cleaning items. It has its own list and its own Transaction log.
- **Spare Parts** has a second switch: **Imported parts** (from abroad) and **Local parts** (bought in the country). They are kept fully separate inside the same months.
- **Machines** are tabs: BLM, BCW3, Bonal, Sollas. Each tab shows a count badge. After the machine tabs come **Transaction** and **Summary** tabs.
- **Month navigation**: a year selector (‹ 2026 ›) and month chips (Jan … Dec). The current month is marked with a dot.
- Separate side lists outside the months: **Consumables** and **Used parts**.

## 2. The parts table (one per machine, per month)

Columns: #, Name, Reference, Quantity (with ▲▼ stepper), Line, Min, Unit price, Currency (USD / EUR), Total price (= quantity × unit price, calculated), Date, Delete (trash icon).

- Every cell is editable inline. Saving happens automatically after typing stops, with a small "Saved" status in the corner.
- If Quantity is at or below Min, show a red **ORDER** tag under the Min value.
- Buttons: **Add part** and **New arrival** (a part that just arrived, highlighted).
- Deleting a row needs two clicks: the first click turns the trash icon into a red "Delete?" button, and the second click deletes. Deleting a part also deletes its transactions.
- **New month**: when a new month has no parts yet, show a banner offering to copy last month's parts with their closing stock as the new starting quantity.
- **Past months are closed** (view only). A lock button reopens one past month after entering an unlock code.

## 3. Receive and Transfer (the most important feature)

- **Receive** (stock in) and **Transfer** (stock out) buttons open one dialog:
  - Search a part by reference or name, across all machines.
  - Machine chips: "All machines", each machine, and "Other (not a machine)".
  - Quantity field.
  - For Transfer only: production **Line 1** or **Line 2** chips, plus fields for who gave it, who took it, and where it goes.
- Saving updates the part's quantity **and** writes a row in the **Transaction** log at the same time: date, time, machine, part name, reference, change (+N or −N), stock after, line, slip number.
- **Transfer prints an issue slip** (A5-style) for signature. It shows the slip number (format YYYYMM-NNN, counting up per month), date, the machine with a ✓ on the right one, part, reference, quantity, line, and signature boxes.
- **Transaction tab**: a list of all movements for the month, with a filter by machine. Each row can be:
  - **fixed**: change the quantity with +/− and confirm. The part's stock and every later "stock after" value are recalculated.
  - **deleted**: the transaction is removed and the stock is restored.
- Equipment has the same Receive / Transfer / Transaction flow, but with no machines and no lines.

## 4. Order parts

- An **Order parts** dialog builds a purchase request: suggested parts are the ones at or below Min. The user ticks parts and enters the quantity to order and notes.
- **Print** a request sheet titled "PARTS REQUEST", or "LOCAL PARTS REQUEST" for local parts, with signature lines.
- **Export Excel**: a real .xlsx file with the columns #, Machine, Reference, In stock, Qty to order, Notes. Do **not** include the part name, only the reference. File name: `UII-Order-Request-N-YYYY-MM-DD.xlsx`.

## 5. Other tools

- **Search box**: search by reference or name across every machine and every month. Clicking a result jumps to it.
- **Summary tab**: what came in and went out this month, compared with last month (up or down), most used parts, parts out per machine, and month by month.
- **Export month to Excel**: one real .xlsx with a sheet per machine, plus the Transaction log, formatted (header colours, money format).
- **Blank slips**: print empty issue slips to fill by hand in the store room, and a **week booklet** (Monday to Sunday, with ISO week numbers).
- **Backups**:
  - download a full backup as a readable .xlsx workbook;
  - restore from that file, even after it was opened and saved in Excel;
  - keep automatic **daily copies** inside the app for the last 30 days, with restore.
- **Year archive**: an old year can be exported to its own Excel file, a printed year summary, and then removed from the app to keep it light. The app keeps last year and this year.
- **Password screen** at start, asked once per browser tab. Store only a hash of the code, never the code itself.

## 6. Design

- Dark theme: background near #0b0d12, a blue accent, rounded cards, a clean modern look.
- Large clear buttons. It is used in a store room, often on a phone.
- **Must work on a phone**:
  - the header buttons wrap into a grid;
  - the tables turn into cards, with labels next to each value;
  - nothing scrolls sideways.
- Print layouts for slips and request sheets must fit on A4 or A5 paper.

## 7. Quality rules

- Never lose data:
  - every change is saved right away;
  - if saving fails, show a clear red message;
  - stock numbers must always match the transactions.
- The date and time come from the device. Use the transaction's own date for the month it belongs to.
- No external libraries loaded from the internet. The .xlsx files are built by hand (a zip of XML parts), so it works offline.
- Fill it with realistic test data so I can try it straight away: 4 machines, 3–6 parts each, and two months.

Build it step by step:
1. the parts table;
2. Receive / Transfer with the Transaction log;
3. printing;
4. Excel;
5. backups;
6. phone layout.

Test each step before moving on. At the end, give me a short list of what works and anything you could not finish.
