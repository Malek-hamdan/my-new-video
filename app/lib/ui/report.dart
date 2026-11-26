import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fmt.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'forms.dart';
import 'widgets.dart';

/// Everything about one month, compared with the month before.
class MonthReport extends StatelessWidget {
  const MonthReport({super.key, required this.month});
  final DateTime month;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final prevMonth = DateTime(month.year, month.month - 1);
    final now = app.statsFor(month);
    final prev = app.statsFor(prevMonth);
    final hasPrev = !prev.empty;
    bool inside(DateTime d) => d.year == month.year && d.month == month.month;
    final sales = app.sales.where((s) => s.completed && inside(s.date)).toList();
    final refunds = app.sales.where((s) => !s.completed && inside(s.date)).toList();
    final pays = app.payments.where((p) => p.paid && inside(p.date)).toList();
    final current = DateTime.now().year == month.year && DateTime.now().month == month.month;

    // Top designs by pieces sold.
    final byDesign = <String, (int, double)>{};
    for (final s in sales) {
      final k = s.item.isEmpty ? 'Other' : s.item;
      final v = byDesign[k] ?? (0, 0.0);
      byDesign[k] = (v.$1 + s.qty, v.$2 + s.totalUsd);
    }
    final topDesigns = byDesign.entries.toList()..sort((a, b) => b.value.$1.compareTo(a.value.$1));

    Map<String, double> sumBy(Iterable<Sale> l, String Function(Sale) key) {
      final m = <String, double>{};
      for (final s in l) {
        m[key(s)] = (m[key(s)] ?? 0) + s.totalUsd;
      }
      return m;
    }

    final byChannel = sumBy(sales, (s) => s.channel.isEmpty ? 'Other' : s.channel);
    final byMethod = sumBy(sales, (s) => s.method.isEmpty ? 'Other' : s.method);
    final bySeller = sumBy(sales, (s) => s.byName.isEmpty ? 'Someone' : s.byName);
    final byType = <String, int>{};
    for (final s in sales) {
      byType[s.type] = (byType[s.type] ?? 0) + s.qty;
    }
    final byCategory = <String, double>{};
    for (final p in pays) {
      byCategory[p.category] = (byCategory[p.category] ?? 0) + p.amountUsd;
    }
    final byDay = <int, double>{};
    for (final s in sales) {
      byDay[s.date.day] = (byDay[s.date.day] ?? 0) + s.totalUsd;
    }
    final bestDay = byDay.entries.isEmpty ? null : (byDay.entries.toList()..sort((a, b) => b.value.compareTo(a.value))).first;

    return SheetFrame(
      title: monthLabel(month),
      actions: const [],
      items: [
        Text(
          current ? 'This month so far · ${hasPrev ? 'compared with ${monthLabel(prevMonth)}' : 'no earlier month to compare'}' : (hasPrev ? 'Compared with ${monthLabel(prevMonth)}' : 'No earlier month to compare with'),
          style: subStyle,
        ),
        // Profit
        Panel(
          padding: const EdgeInsets.all(18),
          gradient: LinearGradient(colors: [C.redDeep.withValues(alpha: .5), C.panel], begin: Alignment.topLeft, end: Alignment.bottomRight),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Label('Net profit'),
            const SizedBox(height: 6),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              RollingMoney(now.profit, format: signedMoney0, style: mono(34, color: now.profit >= 0 ? C.up : C.down)),
              const SizedBox(width: 10),
              if (hasPrev) Padding(padding: const EdgeInsets.only(bottom: 6), child: Change(now.profit, prev.profit, money: true)),
            ]),
            const SizedBox(height: 12),
            _Line('Sales', now.sales),
            _Line('− Cost of pieces sold', now.pieceCost),
            _Line('− Expenses', now.expenses),
            const Divider(color: C.line, height: 16),
            _Line('= Profit', now.profit, bold: true),
            if (now.stockBought > 0) ...[
              const SizedBox(height: 8),
              Text('Stock bought this month: ${money0(now.stockBought)} (counted as the pieces sell)', style: subStyle.copyWith(fontSize: 11.5)),
            ],
          ]),
        ),
        // Key numbers
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.7,
          children: [
            _Kpi('Sales', money0(now.sales), hasPrev ? Change(now.sales, prev.sales) : null),
            _Kpi('Orders', '${now.orders}', hasPrev ? Change(now.orders.toDouble(), prev.orders.toDouble()) : null),
            _Kpi('Pieces sold', '${now.pieces}', hasPrev ? Change(now.pieces.toDouble(), prev.pieces.toDouble()) : null),
            _Kpi('Avg order', money(now.orders == 0 ? 0 : now.sales / now.orders),
                hasPrev ? Change(now.orders == 0 ? 0 : now.sales / now.orders, prev.orders == 0 ? 0 : prev.sales / prev.orders) : null),
          ],
        ),
        if (bestDay != null || refunds.isNotEmpty)
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (bestDay != null)
                Text('Best day: ${dateLabel(DateTime(month.year, month.month, bestDay.key))} · ${money0(bestDay.value)}',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              if (refunds.isNotEmpty) ...[
                if (bestDay != null) const SizedBox(height: 6),
                Text('${refunds.length} refunded ${refunds.length == 1 ? 'sale' : 'sales'} · ${money0(refunds.fold(0.0, (a, s) => a + s.totalUsd))}',
                    style: const TextStyle(color: C.down, fontSize: 12.5)),
              ],
            ]),
          ),
        if (topDesigns.isNotEmpty)
          _Section('Top designs', [
            for (final (i, e) in topDesigns.take(5).indexed)
              _Row(
                lead: '${i + 1}',
                title: e.key,
                value: '${e.value.$1} pcs',
                sub: money0(e.value.$2),
                frac: e.value.$1 / topDesigns.first.value.$1,
                color: C.red,
              ),
          ]),
        if (byType.length > 1) _Section('By type', [for (final e in _sortedInt(byType)) _Row(title: e.key, value: '${e.value} pcs', frac: e.value / _maxInt(byType), color: C.silver)]),
        if (byChannel.isNotEmpty) _Section('Where sales came from', _moneyRows(byChannel, now.sales, C.gold)),
        if (byMethod.isNotEmpty) _Section('How customers paid', _moneyRows(byMethod, now.sales, C.up)),
        if (byCategory.isNotEmpty)
          _Section('Where the money went', [
            for (final e in _sorted(byCategory))
              _Row(title: e.key, value: money0(e.value), frac: e.value / _sorted(byCategory).first.value, color: categoryOf(e.key).color),
          ]),
        if (bySeller.length > 1) _Section('Sales by person', _moneyRows(bySeller, now.sales, C.silver)),
        if (now.salesWithoutCost > 0)
          Text('${now.salesWithoutCost} ${now.salesWithoutCost == 1 ? 'sale was' : 'sales were'} not picked from stock, so their cost is unknown and profit may read high.',
              style: subStyle.copyWith(fontSize: 11.5, color: C.gold)),
        if (now.empty) const EmptyState(icon: Icons.event_note_rounded, title: 'Nothing recorded this month', sub: 'Sales and payments from this month will show here.'),
      ],
    );
  }

  static List<MapEntry<String, double>> _sorted(Map<String, double> m) => m.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
  static List<MapEntry<String, int>> _sortedInt(Map<String, int> m) => m.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
  static int _maxInt(Map<String, int> m) => m.values.fold(1, (a, b) => b > a ? b : a);

  static List<Widget> _moneyRows(Map<String, double> m, double total, Color c) => [
        for (final e in _sorted(m))
          _Row(
            title: e.key,
            value: money0(e.value),
            sub: total <= 0 ? null : '${(e.value / total * 100).round()}%',
            frac: total <= 0 ? 0 : e.value / total,
            color: c,
          ),
      ];
}

/// Shows how [now] moved against [before]: ▲ 12% (or the money difference).
class Change extends StatelessWidget {
  const Change(this.now, this.before, {super.key, this.money = false});
  final double now, before;
  final bool money;
  @override
  Widget build(BuildContext context) {
    final diff = now - before;
    final c = diff >= 0 ? C.up : C.down;
    final String text;
    if (money) {
      text = '${diff >= 0 ? '▲' : '▼'} ${money0(diff.abs())}';
    } else if (before == 0) {
      text = now == 0 ? '—' : '▲ new';
    } else {
      text = '${diff >= 0 ? '▲' : '▼'} ${(diff.abs() / before.abs() * 100).round()}%';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: c.withValues(alpha: .12), borderRadius: BorderRadius.circular(7)),
      child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c)),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.label, this.value, {this.bold = false});
  final String label;
  final double value;
  final bool bold;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(label, style: bold ? const TextStyle(fontWeight: FontWeight.w700) : subStyle.copyWith(fontSize: 13))),
          Text(bold ? signedMoney0(value) : money0(value), style: mono(13.5, color: bold ? (value >= 0 ? C.up : C.down) : C.fg)),
        ]),
      );
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.label, this.value, this.change);
  final String label, value;
  final Widget? change;
  @override
  Widget build(BuildContext context) => Panel(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Label(label),
          Text(value, style: mono(19)),
          ?change,
        ]),
      );
}

class _Section extends StatelessWidget {
  const _Section(this.title, this.rows);
  final String title;
  final List<Widget> rows;
  @override
  Widget build(BuildContext context) => Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Label(title),
          const SizedBox(height: 10),
          ...rows,
        ]),
      );
}

class _Row extends StatelessWidget {
  const _Row({required this.title, required this.value, required this.frac, required this.color, this.sub, this.lead});
  final String title, value;
  final String? sub, lead;
  final double frac;
  final Color color;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            if (lead != null) SizedBox(width: 20, child: Text(lead!, style: mono(12, color: C.mute))),
            Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
            if (sub != null) ...[Text(sub!, style: subStyle.copyWith(fontSize: 11.5)), const SizedBox(width: 10)],
            Text(value, style: mono(13)),
          ]),
          const SizedBox(height: 6),
          Container(
            height: 6,
            decoration: BoxDecoration(color: C.ink, borderRadius: BorderRadius.circular(6)),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: frac.clamp(0, 1)),
              duration: kSlow,
              curve: Curves.easeOutCubic,
              builder: (_, v, _) => FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: v,
                child: Container(decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6))),
              ),
            ),
          ),
        ]),
      );
}

/// List of months with data; each opens its report.
class ReportsSheet extends StatelessWidget {
  const ReportsSheet({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final months = app.months;
    return SheetFrame(
      title: 'Monthly reports',
      actions: const [],
      items: [
        for (final m in months)
          () {
            final st = app.statsFor(m);
            final prev = app.statsFor(DateTime(m.year, m.month - 1));
            return Pressable(
              scale: .98,
              onTap: () {
                Navigator.pop(context);
                showSheet(context, MonthReport(month: m));
              },
              child: Panel(
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(monthLabel(m), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                      const SizedBox(height: 3),
                      Text('${st.orders} orders · ${st.pieces} pcs · sales ${money0(st.sales)}', style: subStyle.copyWith(fontSize: 11.5)),
                    ]),
                  ),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(signedMoney0(st.profit), style: mono(14, color: st.profit >= 0 ? C.up : C.down)),
                    if (!prev.empty) ...[const SizedBox(height: 4), Change(st.profit, prev.profit, money: true)],
                  ]),
                  const Icon(Icons.chevron_right_rounded, color: C.mute),
                ]),
              ),
            );
          }(),
      ],
    );
  }
}

/// Button on Home that opens the reports list.
class ReportsButton extends StatelessWidget {
  const ReportsButton({super.key});
  @override
  Widget build(BuildContext context) => Pressable(
        scale: .97,
        onTap: () => showSheet(context, const ReportsSheet()),
        child: Panel(
          child: Row(children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(color: C.gold.withValues(alpha: .15), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.summarize_rounded, color: C.gold, size: 20),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Monthly reports', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                SizedBox(height: 2),
                Text('Full summary of every month, compared', style: subStyle),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, color: C.mute),
          ]),
        ),
      );
}

/// When a new month starts, opens last month's report once on this phone.
class MonthEndReport extends StatefulWidget {
  const MonthEndReport({super.key, required this.child});
  final Widget child;
  @override
  State<MonthEndReport> createState() => _MonthEndReportState();
}

class _MonthEndReportState extends State<MonthEndReport> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 4), _check);
  }

  Future<void> _check() async {
    if (!mounted) return;
    final app = AppScope.read(context);
    if (!app.role.canSeeMoney) return;
    final now = DateTime.now();
    final last = DateTime(now.year, now.month - 1);
    if (app.statsFor(last).empty) return;
    final key = 'report_shown_${last.year}_${last.month}';
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool(key) == true) return;
      await prefs.setBool(key, true);
    } catch (_) {
      return;
    }
    if (!mounted) return;
    toast(context, '${monthLabel(last)} report is ready', icon: Icons.summarize_rounded, color: C.gold);
    await Future.delayed(const Duration(milliseconds: 600));
    if (mounted) showSheet(context, MonthReport(month: last));
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
