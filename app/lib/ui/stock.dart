import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:material_ui/material_ui.dart';

import '../fmt.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'forms.dart';
import 'widgets.dart';

class StockScreen extends StatefulWidget {
  const StockScreen({super.key});
  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  String? _type;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final types = productTypes.where((t) => app.products.any((p) => p.type == t)).toList();
    final list = app.products.where((p) => _type == null || p.type == _type).toList();
    final low = app.lowStock.length;

    final blocks = <Widget>[
      ScreenTitle(
        title: 'Stock',
        sub: Row(children: [
          Text('${count(app.piecesInStock)} pieces'),
          if (app.role.canSeeMoney) ...[
            const Text(' · worth '),
            RollingMoney(app.stockValue, style: mono(12)),
          ],
        ]),
        trailing: const LogoMark(size: 40),
      ),
      if (low > 0)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Panel(
            color: C.gold.withValues(alpha: .08),
            child: Row(children: [
              const Icon(Icons.warning_amber_rounded, color: C.gold),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '$low ${low == 1 ? 'design is' : 'designs are'} running low ($kLowStock or fewer in a size).',
                  style: const TextStyle(fontSize: 12.5),
                ),
              ),
            ]),
          ),
        ),
      if (types.length > 1)
        PillRow(children: [
          Pill(label: 'All', on: _type == null, onTap: () => setState(() => _type = null)),
          for (final t in types) Pill(label: t, on: _type == t, onTap: () => setState(() => _type = t)),
        ]),
      const SizedBox(height: 10),
      if (list.isEmpty)
        EmptyState(
          icon: Icons.inventory_2_rounded,
          title: 'No stock yet',
          sub: app.role.canManageStock
              ? 'Tap + to add a design with how many you have of each size.'
              : 'The owner or a manager adds designs here.',
        )
      else
        for (final p in list)
          Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 10), child: ProductCard(product: p)),
      const SizedBox(height: 110),
    ];

    return ListView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: EdgeInsets.zero,
      children: [for (var i = 0; i < blocks.length; i++) blocks[i].enter(i)],
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final p = product;
    final shown = [for (final s in productSizes) if (p.sizes.containsKey(s)) s];
    return Pressable(
      scale: .98,
      onTap: () => showSheet(context, ProductSheet(productId: p.id)),
      child: Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: C.red.withValues(alpha: .14), borderRadius: BorderRadius.circular(12)),
              child: Icon(_iconFor(p.type), color: C.red, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                const SizedBox(height: 3),
                Text(
                  [
                    p.type,
                    if (app.role.canSeeMoney && p.price > 0) 'sells ${money0(p.price)}',
                    if (app.role.canSeeMoney && p.cost > 0 && p.price > 0) '+${money0(p.profitEach)} each',
                  ].join(' · '),
                  style: subStyle.copyWith(fontSize: 11.5),
                ),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: p.total.toDouble()),
                duration: kSlow,
                curve: Curves.easeOutCubic,
                builder: (_, v, _) => Text('${v.round()}', style: mono(20, color: p.total == 0 ? C.down : C.fg)),
              ),
              const Text('in stock', style: TextStyle(fontSize: 10, color: C.mute)),
            ]),
          ]),
          if (shown.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 6, runSpacing: 6, children: [for (final s in shown) SizeChip(size: s, qty: p.qty(s))]),
          ],
        ]),
      ),
    );
  }
}

IconData _iconFor(String type) => switch (type) {
      'Hoodie' || 'Sweater' => Icons.dry_cleaning_rounded,
      'Other' => Icons.category_rounded,
      _ => Icons.checkroom_rounded,
    };

class SizeChip extends StatelessWidget {
  const SizeChip({super.key, required this.size, required this.qty, this.selected = false});
  final String size;
  final int qty;
  final bool selected;
  @override
  Widget build(BuildContext context) {
    final color = qty <= 0 ? C.down : (qty <= kLowStock ? C.gold : C.up);
    return AnimatedContainer(
      duration: kMed,
      curve: kCurve,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: selected ? C.red : color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: selected ? C.red : color.withValues(alpha: .35)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(size, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: selected ? Colors.white : C.fg)),
        const SizedBox(width: 6),
        Text('$qty', style: mono(12, color: selected ? Colors.white : color)),
      ]),
    );
  }
}

// ───────────────────────── product details ─────────────────────────

class ProductSheet extends StatelessWidget {
  const ProductSheet({super.key, required this.productId});
  final String productId;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final p = app.productById(productId);
    if (p == null) return const SizedBox(height: 120, child: Center(child: Text('This design was removed.', style: subStyle)));
    final sold = app.sales.where((s) => s.productId == p.id && s.completed).fold(0, (a, s) => a + s.qty);
    final soldMonth = app.periodSales.where((s) => s.productId == p.id && s.completed).fold(0, (a, s) => a + s.qty);
    final manage = app.role.canManageStock;
    return SheetFrame(
      title: p.name,
      items: [
        Text([p.type, if (app.role.canSeeMoney) 'cost ${money(p.cost)} · sells ${money(p.price)}'].join(' · '), style: subStyle),
        Row(children: [
          Expanded(child: _Stat('In stock', '${p.total}', C.fg)),
          const SizedBox(width: 10),
          Expanded(child: _Stat(app.month == null ? 'Sold' : 'Sold · month', '$soldMonth', C.up)),
          const SizedBox(width: 10),
          Expanded(child: _Stat('Sold · ever', '$sold', C.mute)),
        ]),
        const Label('By size'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final s in productSizes)
            if (p.sizes.containsKey(s)) SizeChip(size: s, qty: p.qty(s)),
        ]),
        if (app.role.canSeeMoney && p.cost > 0 && p.price > 0)
          ProfitBox(
            label: 'Profit per piece',
            profit: p.profitEach,
            sub: '${p.marginPct.round()}% of the price · ${money0(p.profitEach * p.total)} if the ${p.total} in stock sell',
          ),
        if (app.role.canSeeMoney && p.cost > 0)
          Text('Stock value at cost: ${money(p.value)}', style: subStyle.copyWith(fontSize: 12)),
      ],
      actions: [
        if (manage)
          ActionButton(
            label: 'Add stock',
            icon: Icons.add_box_rounded,
            onPressed: () async {
              Navigator.pop(context);
              showSheet(context, AddStockSheet(product: p));
            },
          ),
        if (manage)
          ActionButton(
            label: 'Edit design',
            icon: Icons.edit_rounded,
            filled: false,
            onPressed: () async {
              Navigator.pop(context);
              showSheet(context, ProductForm(product: p));
            },
          ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, this.color);
  final String label, value;
  final Color color;
  @override
  Widget build(BuildContext context) => Panel(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: labelStyle.copyWith(fontSize: 9)),
          const SizedBox(height: 4),
          Text(value, style: mono(20, color: color)),
        ]),
      );
}

/// Quantity boxes for each size, with − / + steppers.
class SizeCounts extends StatelessWidget {
  const SizeCounts({super.key, required this.values, required this.onChanged, this.allowNegative = false});
  final Map<String, int> values;
  final ValueChanged<Map<String, int>> onChanged;
  final bool allowNegative;

  @override
  Widget build(BuildContext context) => Column(children: [
        for (final s in productSizes)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              SizedBox(width: 48, child: Text(s, style: const TextStyle(fontWeight: FontWeight.w700))),
              const Spacer(),
              _Step(icon: Icons.remove_rounded, onTap: () => _bump(s, -1)),
              SizedBox(
                width: 56,
                child: AnimatedSwitcher(
                  duration: kFast,
                  transitionBuilder: (c, a) => ScaleTransition(scale: a, child: c),
                  child: Text(
                    '${values[s] ?? 0}',
                    key: ValueKey(values[s] ?? 0),
                    textAlign: TextAlign.center,
                    style: mono(18, color: (values[s] ?? 0) == 0 ? C.mute : C.fg),
                  ),
                ),
              ),
              _Step(icon: Icons.add_rounded, onTap: () => _bump(s, 1)),
              const SizedBox(width: 6),
              _Step(label: '+10', onTap: () => _bump(s, 10)),
            ]),
          ),
      ]);

  void _bump(String size, int by) {
    final next = (values[size] ?? 0) + by;
    if (next < 0 && !allowNegative) return;
    HapticFeedback.selectionClick();
    onChanged({...values, size: next});
  }
}

class _Step extends StatelessWidget {
  const _Step({this.icon, this.label, required this.onTap});
  final IconData? icon;
  final String? label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Pressable(
        haptic: false,
        scale: .85,
        onTap: onTap,
        child: Container(
          width: label == null ? 40 : 48,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: C.ink, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
          child: label == null
              ? Icon(icon, size: 20, color: C.fg)
              : Text(label!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: C.mute)),
        ),
      );
}

// ───────────────────────── new / edit design ─────────────────────────

class ProductForm extends StatefulWidget {
  const ProductForm({super.key, this.product});
  final Product? product;
  @override
  State<ProductForm> createState() => _ProductFormState();
}

class _ProductFormState extends State<ProductForm> {
  late final name = TextEditingController(text: widget.product?.name);
  late final cost = TextEditingController(text: _n(widget.product?.cost));
  late final price = TextEditingController(text: _n(widget.product?.price));
  late String type = widget.product?.type ?? 'T-shirt';
  late Map<String, int> counts = {...?widget.product?.sizes};
  bool tried = false;

  static String _n(double? v) => v == null || v == 0 ? '' : (v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2));

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final editing = widget.product != null;
    final valid = name.text.trim().isNotEmpty;
    final total = counts.values.fold(0, (a, b) => a + b);
    return SheetFrame(
      title: editing ? 'Edit design' : 'New design',
      items: [
        Field('Design name', Input(controller: name, hint: 'e.g. Akatsuki Cloud Tee', onChanged: (_) => setState(() {}))),
        Field('Type', SlidePicker(options: productTypes, labels: const ['Tee', 'Oversize', 'Hoodie', 'Sweater', 'Other'], selected: type, onChanged: (v) => setState(() => type = v))),
        Row(children: [
          Expanded(child: Field('Cost per piece', Input(controller: cost, number: true, hint: '0', prefix: r'$ ', onChanged: (_) => setState(() {})))),
          const SizedBox(width: 12),
          Expanded(child: Field('Selling price', Input(controller: price, number: true, hint: '0', prefix: r'$ ', onChanged: (_) => setState(() {})))),
        ]),
        if (parseNum(cost.text) > 0 && parseNum(price.text) > 0)
          ProfitBox(
            label: 'Profit per piece',
            profit: parseNum(price.text) - parseNum(cost.text),
            sub: '${((parseNum(price.text) - parseNum(cost.text)) / parseNum(price.text) * 100).round()}% of the price'
                '${counts.values.fold(0, (a, b) => a + b) > 0 ? ' · ${money0((parseNum(price.text) - parseNum(cost.text)) * counts.values.fold(0, (a, b) => a + b))} if all ${counts.values.fold(0, (a, b) => a + b)} sell' : ''}',
          ),
        Row(children: [
          Label(editing ? 'Pieces in stock now' : 'How many you have'),
          const Spacer(),
          Text('$total total', style: mono(12, color: C.mute)),
        ]),
        SizeCounts(values: counts, onChanged: (v) => setState(() => counts = v)),
        if (editing)
          const Text('Changing these numbers corrects the count. To record new pieces you bought, use Add stock instead.', style: subStyle),
        if (tried && !valid)
          const Text('Give the design a name to save.', style: TextStyle(color: C.down, fontSize: 12)).animate().shakeX(hz: 5, amount: 3),
      ],
      actions: [
        ActionButton(
          label: editing ? 'Save changes' : 'Add design',
          icon: Icons.check_rounded,
          onPressed: () async {
            if (!valid) {
              setState(() => tried = true);
              HapticFeedback.heavyImpact();
              return;
            }
            final p = Product(
              id: widget.product?.id ?? '',
              name: name.text.trim(),
              type: type,
              cost: parseNum(cost.text),
              price: parseNum(price.text),
              // Keep sizes set to 0 so they still show as sold out.
              sizes: {for (final s in productSizes) if (counts.containsKey(s)) s: counts[s]!},
            );
            await guard(context, () => app.backend.saveProduct(p));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, editing ? 'Design updated' : '${p.name} added · ${p.total} pieces');
            }
          },
        ),
        if (editing)
          DeleteButton(onConfirm: () async {
            await guard(context, () => app.backend.archiveProduct(widget.product!.id));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, 'Design removed from stock', icon: Icons.delete_rounded, color: C.down);
            }
          }),
      ],
    );
  }
}

// ───────────────────────────── add stock ─────────────────────────────

class AddStockSheet extends StatefulWidget {
  const AddStockSheet({super.key, required this.product});
  final Product product;
  @override
  State<AddStockSheet> createState() => _AddStockSheetState();
}

class _AddStockSheetState extends State<AddStockSheet> {
  Map<String, int> add = {};
  late bool record = AppScope.read(context).role.canEditPayments;
  late final amount = TextEditingController();
  final payee = TextEditingController();
  bool amountTouched = false;

  int get pieces => add.values.fold(0, (a, b) => a + b);

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final p = widget.product;
    if (!amountTouched) {
      final v = pieces * p.cost;
      amount.text = v == 0 ? '' : (v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2));
    }
    return SheetFrame(
      title: 'Add stock',
      items: [
        Text('${p.name} · new pieces you got', style: subStyle),
        SizeCounts(values: add, onChanged: (v) => setState(() => add = v)),
        if (app.role.canEditPayments) ...[
          Pressable(
            scale: .98,
            onTap: () => setState(() => record = !record),
            child: Row(children: [
              AnimatedContainer(
                duration: kMed,
                width: 46,
                height: 28,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(color: record ? C.red : C.panel2, borderRadius: BorderRadius.circular(99)),
                child: AnimatedAlign(
                  duration: kMed,
                  curve: Curves.easeOutBack,
                  alignment: record ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(width: 22, height: 22, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)),
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(child: Text('Also record what I paid as a Stock payment', style: TextStyle(fontSize: 13))),
            ]),
          ),
          AnimatedSize(
            duration: kMed,
            curve: kCurve,
            child: !record
                ? const SizedBox(width: double.infinity)
                : Row(children: [
                    Expanded(
                      child: Field(
                        'Amount paid',
                        Input(
                          controller: amount,
                          number: true,
                          hint: '0',
                          prefix: r'$ ',
                          onChanged: (_) => amountTouched = true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Field('Paid to', Input(controller: payee, hint: 'Supplier'))),
                  ]),
          ),
        ],
      ],
      actions: [
        ActionButton(
          label: pieces == 0 ? 'Add pieces' : 'Add $pieces pieces',
          icon: Icons.add_box_rounded,
          onPressed: pieces <= 0
              ? null
              : () async {
                  final adds = {for (final e in add.entries) if (e.value > 0) e.key: e.value};
                  await guard(context, () async {
                    await app.backend.addStock(p.id, adds);
                    final paid = parseNum(amount.text);
                    if (record && paid > 0) {
                      await app.backend.savePayment(Payment(
                        date: DateTime.now(),
                        category: 'Stock',
                        description: '${p.name} · $pieces pcs',
                        payee: payee.text.trim(),
                        amount: paid,
                        amountUsd: paid,
                        by: app.myId,
                        byName: app.myName,
                      ));
                    }
                  });
                  if (context.mounted) {
                    Navigator.pop(context);
                    toast(context, '+$pieces ${p.name}');
                  }
                },
        ),
      ],
    );
  }
}

/// Picker used by the sale form: choose a design from stock.
class ProductPicker extends StatelessWidget {
  const ProductPicker({super.key, required this.selectedId, required this.onChanged});
  final String selectedId;
  final ValueChanged<Product?> onChanged;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    if (app.products.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 64,
      child: ListView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        children: [
          _PickTile(title: 'Not from stock', sub: 'type it below', on: selectedId.isEmpty, onTap: () => onChanged(null)),
          for (final p in app.products)
            _PickTile(title: p.name, sub: '${p.type} · ${p.total} left', on: p.id == selectedId, empty: p.total == 0, onTap: () => onChanged(p)),
        ],
      ),
    );
  }
}

class _PickTile extends StatelessWidget {
  const _PickTile({required this.title, required this.sub, required this.on, required this.onTap, this.empty = false});
  final String title, sub;
  final bool on, empty;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Pressable(
          onTap: onTap,
          child: AnimatedContainer(
            duration: kMed,
            curve: kCurve,
            width: 150,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: on ? C.red.withValues(alpha: .16) : C.ink,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: on ? C.red : C.line, width: on ? 1.5 : 1),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              const SizedBox(height: 3),
              Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: empty ? C.down : C.mute)),
            ]),
          ),
        ),
      );
}
