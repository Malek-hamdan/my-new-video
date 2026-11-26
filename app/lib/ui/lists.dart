import 'package:material_ui/material_ui.dart';

import '../fmt.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'dashboard.dart';
import 'website.dart';
import 'widgets.dart';

class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key});
  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  final _q = TextEditingController();
  String? _channel;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final q = _q.text.trim().toLowerCase();
    final list = app.periodSales.where((s) {
      if (_channel != null && s.channel != _channel) return false;
      if (q.isEmpty) return true;
      return '${s.label} ${s.customer} ${s.phone} ${s.byName} ${s.note}'.toLowerCase().contains(q);
    }).toList();
    final total = list.where((s) => s.completed).fold(0.0, (a, s) => a + s.totalUsd);
    final pieces = list.where((s) => s.completed).fold(0, (a, s) => a + s.qty);

    return ListView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: EdgeInsets.zero,
      children: [
        ScreenTitle(
          title: 'Sales',
          sub: Row(children: [
            Text('${list.length} orders · $pieces pcs · '),
            RollingMoney(total, format: money, style: mono(12)),
          ]),
          trailing: const LogoMark(size: 40),
        ).enter(0),
        if (!app.role.canSeeMoney) const WebsiteButton().enter(1),
        if (app.role.canSeeMoney) const PeriodPills().enter(1),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          child: TextField(
            controller: _q,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Search design, customer, phone…',
              prefixIcon: const Icon(Icons.search_rounded, color: C.mute, size: 20),
              suffixIcon: q.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18, color: C.mute),
                      onPressed: () => setState(_q.clear),
                    ),
            ),
          ),
        ).enter(2),
        PillRow(children: [
          Pill(label: 'All', on: _channel == null, onTap: () => setState(() => _channel = null)),
          for (final c in channels) Pill(label: c, on: _channel == c, onTap: () => setState(() => _channel = c)),
        ]).enter(3),
        AnimatedSwitcher(
          duration: kMed,
          switchInCurve: kCurve,
          child: KeyedSubtree(
            key: ValueKey('${app.month}|$_channel|$q|${list.length}'),
            child: list.isEmpty
                ? EmptyState(
                    icon: Icons.checkroom_rounded,
                    title: q.isEmpty ? 'No sales here yet' : 'No match',
                    sub: q.isEmpty ? 'Tap + to record a sale.' : 'Try another name, design or phone.',
                  )
                : Column(children: [
                    for (final (i, w) in groupedByDay(list, (s) => s.date, (s) => SaleTile(sale: s)).indexed) w.enter(i + 4),
                  ]),
          ),
        ),
        const SizedBox(height: 120),
      ],
    );
  }
}

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});
  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  String? _cat;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final period = app.periodPayments;
    final list = period.where((p) => _cat == null || p.category == _cat).toList();
    final paid = period.where((p) => p.paid).fold(0.0, (a, p) => a + p.amountUsd);
    final pend = period.where((p) => !p.paid).fold(0.0, (a, p) => a + p.amountUsd);
    final byCat = app.spentByCategory(periodOnly: true);
    final totalCat = byCat.values.fold(0.0, (a, b) => a + b);
    final usedCats = categories.where((c) => period.any((p) => p.category == c.name)).toList();

    return ListView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: EdgeInsets.zero,
      children: [
        ScreenTitle(
          title: 'Payments',
          sub: Row(children: [
            const Text('Paid '),
            RollingMoney(paid, format: money, style: mono(12)),
            const Text(' · pending '),
            RollingMoney(pend, format: money, style: mono(12, color: C.red)),
          ]),
          trailing: const LogoMark(size: 40),
        ).enter(0),
        const PeriodPills().enter(1),
        if (totalCat > 0)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Panel(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Label('Where the money went'),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    height: 12,
                    child: Row(children: [
                      for (final c in categories.where((c) => (byCat[c.name] ?? 0) > 0))
                        Expanded(
                          flex: ((byCat[c.name]! / totalCat) * 1000).round().clamp(1, 1000),
                          child: TweenAnimationBuilder<double>(
                            tween: Tween(begin: 0, end: 1),
                            duration: kSlow,
                            curve: kCurve,
                            builder: (_, v, _) => Align(
                              alignment: Alignment.centerLeft,
                              child: FractionallySizedBox(
                                widthFactor: v,
                                child: Container(margin: const EdgeInsets.only(right: 2), color: c.color),
                              ),
                            ),
                          ),
                        ),
                    ]),
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(spacing: 12, runSpacing: 6, children: [
                  for (final c in categories.where((c) => (byCat[c.name] ?? 0) > 0))
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      Container(width: 8, height: 8, decoration: BoxDecoration(color: c.color, borderRadius: BorderRadius.circular(2))),
                      const SizedBox(width: 5),
                      Text('${c.name} ${(byCat[c.name]! / totalCat * 100).round()}%', style: subStyle.copyWith(fontSize: 11)),
                    ]),
                ]),
              ]),
            ),
          ).enter(2),
        const SizedBox(height: 12),
        if (usedCats.isNotEmpty)
          PillRow(children: [
            Pill(label: 'All', on: _cat == null, onTap: () => setState(() => _cat = null)),
            for (final c in usedCats) Pill(label: c.name, icon: c.icon, color: c.color, on: _cat == c.name, onTap: () => setState(() => _cat = c.name)),
          ]).enter(3),
        AnimatedSwitcher(
          duration: kMed,
          child: KeyedSubtree(
            key: ValueKey('${app.month}|$_cat|${list.length}'),
            child: list.isEmpty
                ? const EmptyState(icon: Icons.account_balance_wallet_rounded, title: 'No payments here yet', sub: 'Tap + to record money that went out.')
                : Column(children: [
                    for (final (i, w) in groupedByDay(list, (p) => p.date, (p) => PaymentTile(payment: p)).indexed) w.enter(i + 4),
                  ]),
          ),
        ),
        const SizedBox(height: 120),
      ],
    );
  }
}
