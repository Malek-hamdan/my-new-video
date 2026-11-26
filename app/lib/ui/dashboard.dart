import 'package:flutter_animate/flutter_animate.dart';
import 'package:material_ui/material_ui.dart';

import '../fmt.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'forms.dart';
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
            Label('Net profit · $period'),
            const SizedBox(height: 6),
            RollingMoney(app.net, format: signedMoney0, style: mono(36, color: app.net >= 0 ? C.up : C.down)),
            const SizedBox(height: 10),
            Row(children: [
              const Text('Sales ', style: subStyle),
              RollingMoney(app.revenue, style: mono(13)),
              const SizedBox(width: 18),
              const Text('Payments ', style: subStyle),
              RollingMoney(app.spent, style: mono(13)),
            ]),
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
            _Tile('Capital left', RollingMoney(app.capitalLeft, style: mono(20, color: C.gold)), 'of ${money0(app.capitalIn)}'),
            _Tile('Pending to pay', RollingMoney(app.pendingTotal, style: mono(20, color: C.red)), '${pend.length} payment${pend.length == 1 ? '' : 's'}'),
          ],
        ),
      ),
      Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 0), child: DailyChart(days: app.daily)),
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

    return ListView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: EdgeInsets.zero,
      children: [for (var i = 0; i < blocks.length; i++) blocks[i].enter(i)],
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
              Text('${s.item} · ${s.size}${s.qty > 1 ? ' ×${s.qty}' : ''}',
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
        ('Item', '${sale.item} · ${sale.size} ×${sale.qty}'),
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
