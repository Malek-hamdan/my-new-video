import 'package:material_ui/material_ui.dart';

import '../fmt.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'forms.dart';
import 'widgets.dart';

class CapitalScreen extends StatelessWidget {
  const CapitalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final canEdit = app.role.canEditCapital;
    final invested = app.capitalIn;
    final spent = app.spentAllTime;
    final alloc = app.allocatedByCategory;
    final spentBy = app.spentByCategory();
    final cats = categories.where((c) => (alloc[c.name] ?? 0) > 0 || (spentBy[c.name] ?? 0) > 0).toList();
    final unallocated = invested - alloc.values.fold(0.0, (a, b) => a + b);
    final usedFrac = invested <= 0 ? 0.0 : (spent / invested).clamp(0.0, 1.0);

    final blocks = <Widget>[
      ScreenTitle(
        title: 'Capital',
        sub: Text(canEdit ? 'Only you can change this' : 'Read only · the owner manages capital'),
        trailing: Tag(app.role.label, app.role.color),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Panel(
          padding: const EdgeInsets.all(18),
          gradient: LinearGradient(colors: [C.redDeep.withValues(alpha: .5), C.panel], begin: Alignment.topLeft, end: Alignment.bottomRight),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Label('Total capital invested'),
            const SizedBox(height: 6),
            RollingMoney(invested, style: mono(36, color: C.gold)),
            const SizedBox(height: 14),
            _Bar(frac: usedFrac, color: usedFrac > .9 ? C.down : C.red, height: 10),
            const SizedBox(height: 10),
            Row(children: [
              const Text('Spent ', style: subStyle),
              RollingMoney(spent, style: mono(13)),
              const Spacer(),
              const Text('Left ', style: subStyle),
              RollingMoney(app.capitalLeft, style: mono(13, color: app.capitalLeft >= 0 ? C.gold : C.down)),
            ]),
            if (app.capitalLeft < 0) ...[
              const SizedBox(height: 8),
              Text('Spending is above capital: the extra is coming from sales.', style: subStyle.copyWith(fontSize: 11, color: C.down)),
            ],
          ]),
        ),
      ),
      if (canEdit)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Row(children: [
            Expanded(child: _ActionChip(icon: Icons.add_card_rounded, label: 'Add capital', onTap: () => showSheet(context, const CapitalForm()))),
            const SizedBox(width: 10),
            Expanded(child: _ActionChip(icon: Icons.donut_large_rounded, label: 'Allocate', onTap: () => showSheet(context, const CapitalForm(kind: 'allocation')))),
          ]),
        ),
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
        child: Row(children: [
          const Expanded(child: Label('Budget vs actual spend')),
          if (invested > 0) Text('Unallocated ${money0(unallocated)}', style: subStyle.copyWith(fontSize: 11)),
        ]),
      ),
      if (cats.isEmpty)
        const EmptyState(icon: Icons.pie_chart_rounded, title: 'No budgets yet', sub: 'Add your capital, then split it into budgets like Stock, Printing and Ads.')
      else
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Panel(
            padding: EdgeInsets.zero,
            child: Column(children: [
              for (final c in cats) _BudgetRow(cat: c, budget: alloc[c.name] ?? 0, spent: spentBy[c.name] ?? 0),
            ]),
          ),
        ),
      const Padding(padding: EdgeInsets.fromLTRB(18, 18, 18, 8), child: Label('History')),
      if (app.capital.isEmpty)
        const SizedBox.shrink()
      else
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Panel(
            padding: EdgeInsets.zero,
            child: Column(children: [
              for (final e in app.capital)
                Pressable(
                  scale: .98,
                  onTap: canEdit ? () => showSheet(context, CapitalForm(entry: e)) : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))),
                    child: Row(children: [
                      Icon(e.isDeposit ? Icons.south_west_rounded : Icons.call_split_rounded, color: e.isDeposit ? C.up : categoryOf(e.category).color, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(e.isDeposit ? (e.label.isEmpty ? 'Capital added' : e.label) : '${e.category} budget',
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                          const SizedBox(height: 3),
                          Text(dateLabel(e.date), style: subStyle.copyWith(fontSize: 11.5)),
                        ]),
                      ),
                      Text(e.isDeposit ? '+${money0(e.amount)}' : money0(e.amount), style: mono(14, color: e.isDeposit ? C.up : C.fg)),
                    ]),
                  ),
                ),
            ]),
          ),
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

class _BudgetRow extends StatelessWidget {
  const _BudgetRow({required this.cat, required this.budget, required this.spent});
  final Category cat;
  final double budget, spent;
  @override
  Widget build(BuildContext context) {
    final frac = budget <= 0 ? 1.0 : spent / budget;
    final over = budget > 0 && spent > budget;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(cat.icon, size: 16, color: cat.color),
          const SizedBox(width: 8),
          Expanded(child: Text(cat.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5))),
          Text('${money0(spent)} / ${budget > 0 ? money0(budget) : 'no budget'}', style: mono(12, weight: FontWeight.w500)),
        ]),
        const SizedBox(height: 8),
        _Bar(frac: frac.clamp(0, 1), color: over || frac > .95 ? C.down : cat.color),
        if (budget > 0 && frac >= .9) ...[
          const SizedBox(height: 5),
          Text(over ? 'Over budget by ${money0(spent - budget)}' : '${(frac * 100).round()}% used',
              style: TextStyle(fontSize: 11, color: over ? C.down : C.gold, fontWeight: FontWeight.w600)),
        ],
      ]),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.frac, required this.color, this.height = 7});
  final double frac;
  final Color color;
  final double height;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        decoration: BoxDecoration(color: C.ink, borderRadius: BorderRadius.circular(height)),
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: frac),
          duration: const Duration(milliseconds: 900),
          curve: Curves.easeOutCubic,
          builder: (_, v, _) => FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: v,
            child: Container(decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(height))),
          ),
        ),
      );
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        child: Container(
          height: 46,
          decoration: BoxDecoration(color: C.panel, borderRadius: BorderRadius.circular(14), border: Border.all(color: C.line)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 18, color: C.gold),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
        ),
      );
}
