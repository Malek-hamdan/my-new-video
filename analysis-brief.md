I run a spare-parts store for a factory (4 production machines: BLM, BCW3, Bonal, Sollas; 2 production lines: Line 1 and Line 2). We record stock in a web app. I want a **correct, data-driven method** to (1) detect when a machine is consuming too many spare parts and (2) suggest what to do next month, **without anyone typing the cause of the problem**. The store staff only record movements; they do not diagnose faults.

Please give me the **method**, not finished code: exact formulas, thresholds, edge cases, and test cases with expected numbers. I will have it implemented and tested in my existing app.

## Data we have (nothing else)

For every part, per month:
- machine, part name, reference (one of them can be empty), quantity in stock, minimum quantity, unit price, currency (EUR or USD).

For every stock movement (transaction):
- date, time, machine, part name, reference, quantity (+ in / − out);
- stock after the movement;
- production line (1 or 2, for parts going out);
- who issued the part and who received it.

History: a few months so far, growing every month. The monthly volume is small: a machine typically uses 0–15 parts a month, and one part 0–5 a month.

Not available today, but could be added if you think it matters: production output per line per day (cartons produced). Tell me if consumption should be measured per production volume, and how.

## What we do now (please check it, and improve it or replace it)

- **Rating per machine:** parts issued this month compared with the average of up to the 3 previous months that have data. While a month is running, every month is cut at the same day number.
  - Levels: Excellent ≤ −30%; Good ≤ 0%; Watch < +30%, or fewer than 3 parts more than average; High +30% to +100%; Very high ≥ +100%.
- **Analysis for machines rated High or Very high:**
  - the parts that drove the increase (this month vs their own average);
  - how often each part was changed (average days between issues);
  - share per line;
  - who received the parts;
  - next month's need = this month's pace;
  - quantity to order = need + minimum − stock.

## What I need from you

1. Is this method statistically sound for such small numbers? If not, what should replace it? For example: Poisson or control-chart limits, mean time between replacements, a minimum number of months before rating, or seasonality.
2. A better way to find the likely cause **from the records alone**, for example:
   - a part replaced again much sooner than its usual life;
   - parts that are always replaced together;
   - one line or one shift standing out;
   - a sudden change after a certain date.

   Explain what each pattern usually means mechanically.
3. A forecasting rule for next month's need and the order quantity, including safety stock, that won't over-order on one bad month.
4. A short list of maintenance suggestions linked to each pattern, written for factory mechanics, with clear "this is a hint, not a diagnosis" wording.
5. Edge cases: a new machine with no history, a month with zero use, parts recorded with a name but no reference (or the opposite), a month still running, and data entered with a wrong date.
6. 6–10 test cases: input numbers and the exact expected output (rating level, flagged parts, forecast, order quantity), so the implementation can be checked.

Keep it practical: a small factory store, not a big data system. Explain each rule in one or two plain sentences.
