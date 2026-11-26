import 'package:flutter_animate/flutter_animate.dart';
import 'package:material_ui/material_ui.dart';

import '../fmt.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'forms.dart';
import 'report.dart';
import 'website.dart';
import 'widgets.dart';

class PeriodPills extends StatelessWidget {
  const PeriodPills({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final now = DateTime.now();
    return PillRow(children: [
      for (final m in app.months)
        Pill(
          label: m.year == now.year && m.month == now.month ? monthLabel(m).split(' ').first : (m.year == now.year ? monthShort(m) : '${monthShort(m)} ${m.year}'),
          on: app.month == m,
          onTap: () => app.setMonth(m),
        ),
      Pill(label: 'All time', on: app.month == null, onTap: () => app.setMonth(null)),
    ]);
  }
}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final me = app.me!;
    final period = app.month == null ? 'All time' : monthLabel(app.month!).split(' ').first;
    final pend = app.pending.toList();
    final stats = app.statsFor(app.month);
    final recent = <(DateTime, Widget)>[
      for (final s in app.sales.take(6)) (s.date, SaleTile(sale: s)),
      for (final p in app.payments.take(6)) (p.date, PaymentTile(payment: p)),
    ]..sort((a, b) => b.$1.compareTo(a.$1));

    final blocks = <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 14),
        child: Row(children: [
          const LogoMark(),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('ANIMEWEAR.LB', style: display(18)),
              const SizedBox(height: 2),
              Text('Hi ${me.name.split(' ').first} · ${me.role.label}', style: subStyle),
            ]),
          ),
          Avatar(me.initial),
        ]),
      ),
      const WebsiteButton(),
      if (app.lowStock.isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Pressable(
            scale: .97,
            onTap: () => app.tabRequest.value = 'Stock',
            child: Panel(
              color: C.gold.withValues(alpha: .08),
              child: Row(children: [
                const Icon(Icons.inventory_2_rounded, color: C.gold, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${app.lowStock.length} ${app.lowStock.length == 1 ? 'design is' : 'designs are'} running low · ${app.lowStock.take(2).map((p) => p.name).join(', ')}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: C.mute),
              ]),
            ),
          ),
        ),
      const PeriodPills(),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
        child: Panel(
          padding: const EdgeInsets.all(18),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [C.redDeep.withValues(alpha: .55), C.panel],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Label('Net profit · $period')),
              if (app.month != null)
                Pressable(
                  onTap: () => showSheet(context, MonthReport(month: app.month!)),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    child: Text('Full report ›', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: C.gold)),
                  ),
                ),
            ]),
            const SizedBox(height: 6),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              RollingMoney(app.net, format: signedMoney0, style: mono(36, color: app.net >= 0 ? C.up : C.down)),
              const SizedBox(width: 10),
              if (app.month != null) Padding(padding: const EdgeInsets.only(bottom: 6), child: _VsLastMonth(month: app.month!)),
            ]),
            const SizedBox(height: 10),
            Wrap(spacing: 14, runSpacing: 4, children: [
              _Fig('Sales', stats.sales),
              _Fig('Pieces cost', stats.pieceCost),
              _Fig('Expenses', stats.expenses),
            ]),
            if (stats.stockBought > 0) ...[
              const SizedBox(height: 6),
              Text('Stock bought ${money0(stats.stockBought)} · counted as the pieces sell', style: subStyle.copyWith(fontSize: 11)),
            ],
            if (stats.salesWithoutCost > 0) ...[
              const SizedBox(height: 4),
              Text(
                '${stats.salesWithoutCost} ${stats.salesWithoutCost == 1 ? 'sale has' : 'sales have'} no cost (not picked from stock), so profit may read high.',
                style: subStyle.copyWith(fontSize: 11, color: C.gold),
              ),
            ],
          ]),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        child: GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.75,
          padding: EdgeInsets.zero,
          children: [
            _Tile('Tees sold', Text(count(app.piecesSold), style: mono(20)), '${app.orders} orders'),
            _Tile('Avg order', RollingMoney(app.avgOrder, format: money, style: mono(20)), 'per completed sale'),
            _Tile(
              app.leftToRecover > 0 ? 'To earn back' : 'Earned back',
              app.leftToRecover > 0
                  ? RollingMoney(app.leftToRecover, style: mono(20, color: C.gold))
                  : RollingMoney(app.salesAllTime - app.spentAllTime, format: signedMoney0, style: mono(20, color: C.up)),
              app.leftToRecover > 0 ? '${(app.recoveredShare * 100).round()}% of ${money0(app.spentAllTime)} back' : 'all spending covered ✓',
            ),
            _Tile('Pending to pay', RollingMoney(app.pendingTotal, style: mono(20, color: C.red)), '${pend.length} payment${pend.length == 1 ? '' : 's'}'),
          ],
        ),
      ),
      Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 0), child: DailyChart(days: app.daily)),
      Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 0), child: MonthsCard(months: app.lastSixMonths)),
      const Padding(padding: EdgeInsets.fromLTRB(16, 10, 16, 0), child: ReportsButton()),
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
        child: const Label('Latest activity'),
      ),
      if (recent.isEmpty)
        const EmptyState(icon: Icons.bolt_rounded, title: 'Nothing recorded yet', sub: 'Tap + to add your first sale or payment.')
      else
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Panel(padding: EdgeInsets.zero, child: Column(children: [for (final r in recent.take(6)) r.$2])),
        ),
      const SizedBox(height: 120),
    ];

    return MonthEndReport(
      child: ListView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        padding: EdgeInsets.zero,
        children: [for (var i = 0; i < blocks.length; i++) blocks[i].enter(i)],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile(this.label, this.value, this.sub);
  final String label, sub;
  final Widget value;
  @override
  Widget build(BuildContext context) => Panel(
        padding: const EdgeInsets.all(13),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Label(label),
          value,
          Text(sub, style: subStyle.copyWith(fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      );
}

class DailyChart extends StatefulWidget {
  const DailyChart({super.key, required this.days});
  final List<(DateTime, double, double)> days;
  @override
  State<DailyChart> createState() => _DailyChartState();
}

class _DailyChartState extends State<DailyChart> {
  int? _sel;
  @override
  Widget build(BuildContext context) {
    final days = widget.days;
    var max = 1.0;
    for (final d in days) {
      if (d.$2 > max) max = d.$2;
      if (d.$3 > max) max = d.$3;
    }
    final sel = _sel == null ? null : days[_sel!];
    return Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Label('Daily · 14 days')),
          _dot(C.red, 'Sales'),
          const SizedBox(width: 12),
          _dot(C.silver, 'Payments'),
        ]),
        const SizedBox(height: 4),
        AnimatedSwitcher(
          duration: kFast,
          child: Text(
            sel == null ? 'Tap a day for details' : '${dateLabel(sel.$1)} · sales ${money0(sel.$2)} · paid ${money0(sel.$3)}',
            key: ValueKey(_sel),
            style: subStyle.copyWith(fontSize: 11, color: sel == null ? C.mute : C.fg),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 96,
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            for (var i = 0; i < days.length; i++)
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _sel = _sel == i ? null : i),
                  child: AnimatedOpacity(
                    duration: kFast,
                    opacity: _sel == null || _sel == i ? 1 : .35,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        _bar(days[i].$2 / max, C.red, i),
                        const SizedBox(width: 2),
                        _bar(days[i].$3 / max, C.silver.withValues(alpha: .8), i),
                      ]),
                    ),
                  ),
                ),
              ),
          ]),
        ),
        const SizedBox(height: 6),
        Row(children: [
          Text(dayLabelShort(days.first.$1), style: subStyle.copyWith(fontSize: 10)),
          const Spacer(),
          Text(dayLabelShort(days.last.$1), style: subStyle.copyWith(fontSize: 10)),
        ]),
      ]),
    );
  }

  static String dayLabelShort(DateTime d) => '${d.day} ${monthShort(d)}';

  Widget _bar(double f, Color c, int i) => Expanded(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: f.clamp(0, 1)),
          duration: Duration(milliseconds: 700 + i * 25),
          curve: Curves.easeOutCubic,
          builder: (_, v, _) => Container(
            height: (96 * v).clamp(2, 96),
            decoration: BoxDecoration(color: c, borderRadius: const BorderRadius.vertical(top: Radius.circular(3))),
          ),
        ),
      );

  Widget _dot(Color c, String t) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 5),
        Text(t, style: subStyle.copyWith(fontSize: 10.5)),
      ]);
}

// ───────────────────────── list tiles ─────────────────────────

class SaleTile extends StatelessWidget {
  const SaleTile({super.key, required this.sale});
  final Sale sale;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final s = sale;
    final refunded = !s.completed;
    final who = [if (s.customer.isNotEmpty) s.customer, s.channel, timeLabel(s.date)].join(' · ');
    return Pressable(
      scale: .98,
      onTap: () => showSheet(context, app.role.canEditSale ? SaleForm(sale: s) : SaleDetail(sale: s)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))),
        child: Row(children: [
          _IconBox(Icons.checkroom_rounded, refunded ? C.down : C.red),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.label,
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
              const SizedBox(height: 3),
              Text(who, maxLines: 1, overflow: TextOverflow.ellipsis, style: subStyle.copyWith(fontSize: 11.5)),
            ]),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(refunded ? money(-s.totalUsd) : money(s.totalUsd), style: mono(14, color: refunded ? C.down : C.fg)),
            const SizedBox(height: 4),
            refunded ? const Tag('Refunded', C.down) : Tag(s.method, s.method == 'COD' ? C.gold : C.up),
          ]),
        ]),
      ),
    );
  }
}

class PaymentTile extends StatelessWidget {
  const PaymentTile({super.key, required this.payment});
  final Payment payment;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final p = payment;
    final c = categoryOf(p.category);
    final who = [p.category, if (p.payee.isNotEmpty) p.payee, timeLabel(p.date)].join(' · ');
    return Pressable(
      scale: .98,
      onTap: () => showSheet(context, app.role.canEditPayments ? PaymentForm(payment: p) : PaymentDetail(payment: p)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))),
        child: Row(children: [
          _IconBox(c.icon, c.color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.description, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
              const SizedBox(height: 3),
              Text(who, maxLines: 1, overflow: TextOverflow.ellipsis, style: subStyle.copyWith(fontSize: 11.5)),
            ]),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('−${money(p.amountUsd)}', style: mono(14)),
            const SizedBox(height: 4),
            p.paid ? const Tag('Paid', C.up) : const Tag('Pending', C.gold),
          ]),
        ]),
      ),
    );
  }
}

class _IconBox extends StatelessWidget {
  const _IconBox(this.icon, this.color);
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: color.withValues(alpha: .14), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: color, size: 20),
      );
}

// ───────────────────── read-only detail sheets ─────────────────────

class _Detail extends StatelessWidget {
  const _Detail({required this.title, required this.amount, required this.rows});
  final String title;
  final String amount;
  final List<(String, String)> rows;
  @override
  Widget build(BuildContext context) => SheetFrame(
        title: title,
        actions: const [],
        items: [
          Text(amount, style: mono(32)),
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Column(children: [
              for (final r in rows.where((r) => r.$2.isNotEmpty))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    SizedBox(width: 96, child: Text(r.$1, style: subStyle)),
                    Expanded(child: Text(r.$2, style: const TextStyle(fontWeight: FontWeight.w600))),
                  ]),
                ),
            ]),
          ),
        ],
      );
}

class SaleDetail extends StatelessWidget {
  const SaleDetail({super.key, required this.sale});
  final Sale sale;
  @override
  Widget build(BuildContext context) => _Detail(title: 'Sale', amount: money(sale.totalUsd), rows: [
        ('Items', sale.items.map((i) => i.label).join('\n')),
        ('Customer', [sale.customer, sale.phone].where((x) => x.isNotEmpty).join(' · ')),
        ('When', '${dateLabel(sale.date)} · ${timeLabel(sale.date)}'),
        ('Paid with', sale.method),
        ('Channel', sale.channel),
        ('Status', sale.completed ? 'Completed' : 'Refunded'),
        ('Added by', sale.byName),
        ('Note', sale.note),
      ]);
}

class PaymentDetail extends StatelessWidget {
  const PaymentDetail({super.key, required this.payment});
  final Payment payment;
  @override
  Widget build(BuildContext context) => _Detail(title: 'Payment', amount: money(payment.amountUsd), rows: [
        ('For', payment.description),
        ('Category', payment.category),
        ('Paid to', payment.payee),
        ('When', '${dateLabel(payment.date)} · ${timeLabel(payment.date)}'),
        ('Method', payment.method),
        ('Status', payment.paid ? 'Paid' : 'Pending'),
        ('Added by', payment.byName),
        ('Note', payment.note),
      ]);
}

/// Groups dated items under day headers.
List<Widget> groupedByDay<T>(List<T> items, DateTime Function(T) dateOf, Widget Function(T) tile) {
  final out = <Widget>[];
  String? last;
  var group = <Widget>[];
  void flush() {
    if (group.isEmpty) return;
    out.add(Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Panel(padding: EdgeInsets.zero, child: Column(children: group)),
    ));
    group = [];
  }

  for (final it in items) {
    final label = dayLabel(dateOf(it));
    if (label != last) {
      flush();
      out.add(Padding(padding: const EdgeInsets.fromLTRB(18, 16, 18, 8), child: Label(label)));
      last = label;
    }
    group.add(tile(it));
  }
  flush();
  return out;
}

extension FadeKey on Widget {
  Widget fadeKey(Object key) => KeyedSubtree(key: ValueKey(key), child: animate().fadeIn(duration: kMed));
}

class _Fig extends StatelessWidget {
  const _Fig(this.label, this.value);
  final String label;
  final double value;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Text('$label ', style: subStyle),
        RollingMoney(value, style: mono(13)),
      ]);
}

/// "▲ $120 vs Oct" next to the month's profit.
class _VsLastMonth extends StatelessWidget {
  const _VsLastMonth({required this.month});
  final DateTime month;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final prevMonth = DateTime(month.year, month.month - 1);
    final prev = app.statsFor(prevMonth);
    if (prev.empty) return const SizedBox.shrink();
    final diff = app.statsFor(month).profit - prev.profit;
    final c = diff >= 0 ? C.up : C.down;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: c.withValues(alpha: .12), borderRadius: BorderRadius.circular(8)),
      child: Text(
        '${diff >= 0 ? '▲' : '▼'} ${money0(diff.abs())} vs ${monthShort(prevMonth)}',
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: c),
      ),
    ).animate().fadeIn(duration: kMed).slideX(begin: .2);
  }
}

/// Last six months side by side: sales and profit bars plus a small table.
class MonthsCard extends StatelessWidget {
  const MonthsCard({super.key, required this.months});
  final List<MonthStats> months;

  @override
  Widget build(BuildContext context) {
    var top = 1.0;
    for (final m in months) {
      if (m.sales > top) top = m.sales;
      if (m.profit.abs() > top) top = m.profit.abs();
    }
    return Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Label('Month by month')),
          _dot(C.red, 'Sales'),
          const SizedBox(width: 12),
          _dot(C.up, 'Profit'),
        ]),
        const SizedBox(height: 14),
        SizedBox(
          height: 110,
          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            for (var i = 0; i < months.length; i++)
              Expanded(
                child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                  Expanded(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.center, children: [
                      _bar(months[i].sales / top, C.red, i),
                      const SizedBox(width: 3),
                      _bar(months[i].profit.abs() / top, months[i].profit >= 0 ? C.up : C.down, i),
                    ]),
                  ),
                  const SizedBox(height: 6),
                  Text(monthShort(months[i].month!), style: subStyle.copyWith(fontSize: 10.5)),
                ]),
              ),
          ]),
        ),
        const SizedBox(height: 12),
        const Divider(color: C.line, height: 1),
        for (final m in months.reversed.where((m) => !m.empty))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(children: [
              SizedBox(width: 44, child: Text(monthShort(m.month!), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5))),
              Expanded(child: Text('${m.orders} orders · ${m.pieces} pcs', style: subStyle.copyWith(fontSize: 11.5))),
              Text(money0(m.sales), style: mono(12.5, weight: FontWeight.w500)),
              const SizedBox(width: 12),
              SizedBox(
                width: 64,
                child: Text(signedMoney0(m.profit), textAlign: TextAlign.right, style: mono(12.5, color: m.profit >= 0 ? C.up : C.down)),
              ),
            ]),
          ),
        if (months.every((m) => m.empty))
          const Padding(padding: EdgeInsets.only(top: 10), child: Text('Months appear here as you record sales.', style: subStyle)),
      ]),
    );
  }

  Widget _bar(double f, Color c, int i) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: f.clamp(0, 1)),
        duration: Duration(milliseconds: 700 + i * 60),
        curve: Curves.easeOutCubic,
        builder: (_, v, _) => Container(
          width: 12,
          height: (88 * v).clamp(2, 88),
          decoration: BoxDecoration(color: c, borderRadius: const BorderRadius.vertical(top: Radius.circular(3))),
        ),
      );

  Widget _dot(Color c, String t) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 5),
        Text(t, style: subStyle.copyWith(fontSize: 10.5)),
      ]);
}
