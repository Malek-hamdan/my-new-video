import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:material_ui/material_ui.dart';

import '../fmt.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'stock.dart';
import 'widgets.dart';

/// Shared sheet layout: grab handle, title, scrolling body, action buttons.
class SheetFrame extends StatelessWidget {
  const SheetFrame({super.key, required this.title, required this.items, required this.actions});
  final String title;
  final List<Widget> items;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * .92),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 10),
          Container(width: 42, height: 4, decoration: BoxDecoration(color: C.line, borderRadius: BorderRadius.circular(4))),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 12, 6),
            child: Row(children: [
              Expanded(child: Text(title, style: display(22))),
              Pressable(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(color: C.panel2, borderRadius: BorderRadius.circular(12)),
                  child: const Icon(Icons.close_rounded, size: 20, color: C.mute),
                ),
              ),
            ]),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              children: [
                for (var i = 0; i < items.length; i++)
                  Padding(padding: const EdgeInsets.only(bottom: 14), child: items[i].enter(i)),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 14),
              child: Column(children: [
                for (final a in actions) Padding(padding: const EdgeInsets.only(bottom: 8), child: a),
              ]),
            ),
          ),
        ]),
      );
}

class Field extends StatelessWidget {
  const Field(this.label, this.child, {super.key});
  final String label;
  final Widget child;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Label(label),
        const SizedBox(height: 7),
        child,
      ]);
}

class Input extends StatelessWidget {
  const Input({super.key, required this.controller, this.hint, this.number = false, this.phone = false, this.onChanged, this.maxLines = 1, this.prefix});
  final TextEditingController controller;
  final String? hint;
  final bool number, phone;
  final int maxLines;
  final String? prefix;
  final ValueChanged<String>? onChanged;
  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        onChanged: onChanged,
        maxLines: maxLines,
        style: number ? mono(15, weight: FontWeight.w500) : const TextStyle(fontSize: 15),
        keyboardType: number
            ? const TextInputType.numberWithOptions(decimal: true)
            : phone
                ? TextInputType.phone
                : TextInputType.text,
        inputFormatters: number ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))] : null,
        textCapitalization: number || phone ? TextCapitalization.none : TextCapitalization.sentences,
        decoration: InputDecoration(
          hintText: hint,
          prefixText: prefix,
          prefixStyle: mono(15, weight: FontWeight.w500, color: C.mute),
        ),
      );
}

class _Tapper extends StatelessWidget {
  const _Tapper({required this.text, required this.icon, required this.onTap});
  final String text;
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(color: C.ink, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
          child: Row(children: [
            Icon(icon, size: 17, color: C.mute),
            const SizedBox(width: 9),
            Expanded(child: Text(text, style: mono(14, weight: FontWeight.w500))),
          ]),
        ),
      );
}

Theme _pickerTheme(BuildContext ctx, Widget? child) => Theme(
      data: Theme.of(ctx).copyWith(
        colorScheme: const ColorScheme.dark(primary: C.red, onPrimary: Colors.white, surface: C.panel, onSurface: C.fg),
      ),
      child: child!,
    );

class DateTimeRow extends StatelessWidget {
  const DateTimeRow({super.key, required this.value, required this.onChanged});
  final DateTime value;
  final ValueChanged<DateTime> onChanged;
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(
          child: Field(
            'Date',
            _Tapper(
              text: dateLabel(value),
              icon: Icons.calendar_today_rounded,
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: value,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                  builder: _pickerTheme,
                );
                if (d != null) onChanged(DateTime(d.year, d.month, d.day, value.hour, value.minute));
              },
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Field(
            'Time',
            _Tapper(
              text: timeLabel(value),
              icon: Icons.schedule_rounded,
              onTap: () async {
                final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(value), builder: _pickerTheme);
                if (t != null) onChanged(DateTime(value.year, value.month, value.day, t.hour, t.minute));
              },
            ),
          ),
        ),
      ]);
}

class CategoryGrid extends StatelessWidget {
  const CategoryGrid({super.key, required this.selected, required this.onChanged});
  final String selected;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: [
        for (final c in categories)
          Pill(
            label: c.name,
            icon: c.icon,
            on: c.name == selected,
            color: c.color,
            onTap: () => onChanged(c.name),
          ),
      ]);
}

class TotalBox extends StatelessWidget {
  const TotalBox({super.key, required this.label, required this.usd, required this.rate, this.native, this.currency = 'USD'});
  final String label;
  final double usd, rate;
  final double? native;
  final String currency;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [C.red.withValues(alpha: .16), C.ink]),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: C.red.withValues(alpha: .35)),
        ),
        child: Row(children: [
          Label(label),
          const Spacer(),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            RollingMoney(usd, format: money, style: mono(24)),
            Text(currency == 'USD' ? '≈ ${lbp(usd * rate)}' : lbp(native ?? usd * rate), style: mono(11, weight: FontWeight.w500, color: C.mute)),
          ]),
        ]),
      );
}

// ───────────────────────────── Sale ─────────────────────────────

class SaleForm extends StatefulWidget {
  const SaleForm({super.key, this.sale});
  final Sale? sale;
  @override
  State<SaleForm> createState() => _SaleFormState();
}

class _SaleFormState extends State<SaleForm> {
  late DateTime date = widget.sale?.date ?? DateTime.now();
  late final customer = TextEditingController(text: widget.sale?.customer);
  late final phone = TextEditingController(text: widget.sale?.phone);
  late final item = TextEditingController(text: widget.sale?.item);
  late final qty = TextEditingController(text: '${widget.sale?.qty ?? 1}');
  late final price = TextEditingController(text: widget.sale == null ? '' : _n(widget.sale!.unitPrice));
  late final discount = TextEditingController(text: widget.sale == null || widget.sale!.discount == 0 ? '' : _n(widget.sale!.discount));
  late final note = TextEditingController(text: widget.sale?.note);
  late String size = widget.sale?.size ?? 'M';
  late String method = widget.sale?.method ?? 'Cash';
  late String channel = widget.sale?.channel ?? 'Instagram';
  late String currency = widget.sale?.currency ?? 'USD';
  late String status = widget.sale?.status ?? 'completed';
  late String productId = widget.sale?.productId ?? '';
  late String type = widget.sale?.type ?? 'T-shirt';
  late double unitCost = widget.sale?.unitCost ?? 0;
  bool tried = false;

  void _pick(Product? p) {
    setState(() {
      if (p == null) {
        productId = '';
        unitCost = 0;
        return;
      }
      productId = p.id;
      type = p.type;
      unitCost = p.cost;
      item.text = p.name;
      if (p.price > 0) price.text = _n(p.price);
      // Jump to a size that still has stock if the current one is empty.
      if (p.qty(size) <= 0) {
        for (final s in sizes) {
          if (p.qty(s) > 0) {
            size = s;
            break;
          }
        }
      }
    });
  }

  /// Pieces of the chosen size available to this sale (an edited sale's own
  /// pieces count as available).
  int _available(Product p, String s) {
    final own = widget.sale != null && widget.sale!.productId == p.id && widget.sale!.size == s && widget.sale!.completed ? widget.sale!.qty : 0;
    return p.qty(s) + own;
  }

  static String _n(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  double get total => (parseNum(qty.text) * parseNum(price.text) - parseNum(discount.text)).clamp(0, double.infinity);

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final rate = app.config.lbpRate;
    final usd = currency == 'USD' ? total : total / rate;
    final editing = widget.sale != null;
    final valid = item.text.trim().isNotEmpty && parseNum(qty.text) > 0 && parseNum(price.text) > 0;
    final product = productId.isEmpty ? null : app.productById(productId);
    final avail = product == null ? null : _available(product, size);
    final short = avail != null && status == 'completed' && parseNum(qty.text) > avail;

    return SheetFrame(
      title: editing ? 'Edit sale' : 'New sale',
      items: [
        if (app.products.isNotEmpty) Field('From stock', ProductPicker(selectedId: productId, onChanged: _pick)),
        DateTimeRow(value: date, onChanged: (d) => setState(() => date = d)),
        Row(children: [
          Expanded(flex: 3, child: Field('Customer', Input(controller: customer, hint: 'Name'))),
          const SizedBox(width: 12),
          Expanded(flex: 2, child: Field('Phone', Input(controller: phone, hint: '70 123 456', phone: true))),
        ]),
        Field('Design / item', Input(controller: item, hint: 'e.g. Akatsuki Cloud Tee', onChanged: (_) => setState(() {}))),
        if (product == null)
          Field('Type', SlidePicker(options: productTypes, labels: const ['Tee', 'Oversize', 'Hoodie', 'Sweater', 'Other'], selected: type, onChanged: (v) => setState(() => type = v))),
        Field(
          'Size',
          SlidePicker(
            options: sizes,
            labels: product == null ? null : [for (final s in sizes) '$s·${_available(product, s)}'],
            selected: size,
            onChanged: (v) => setState(() => size = v),
          ),
        ),
        Row(children: [
          Expanded(child: Field('Qty', Input(controller: qty, number: true, onChanged: (_) => setState(() {})))),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: Field('Unit price', Input(controller: price, number: true, hint: '0', prefix: currency == 'USD' ? r'$ ' : 'LBP ', onChanged: (_) => setState(() {}))),
          ),
        ]),
        Row(children: [
          Expanded(child: Field('Currency', SlidePicker(options: const ['USD', 'LBP'], selected: currency, onChanged: (v) => setState(() => currency = v)))),
          const SizedBox(width: 12),
          Expanded(child: Field('Discount', Input(controller: discount, number: true, hint: '0', onChanged: (_) => setState(() {})))),
        ]),
        if (short)
          Text(
            avail <= 0 ? 'Size $size is out of stock. Saving will put the count below zero.' : 'Only $avail left in size $size.',
            style: const TextStyle(color: C.gold, fontSize: 12.5, fontWeight: FontWeight.w600),
          ).animate().fadeIn(duration: kFast),
        Field('Paid with', SlidePicker(options: saleMethods, selected: method, onChanged: (v) => setState(() => method = v))),
        Field(
          'Channel',
          SlidePicker(options: channels, labels: const ['Insta', 'WhatsApp', 'TikTok', 'Store', 'Web'], selected: channel, onChanged: (v) => setState(() => channel = v)),
        ),
        if (editing)
          Field(
            'Status',
            SlidePicker(options: const ['completed', 'refunded'], labels: const ['Completed', 'Refunded'], selected: status, onChanged: (v) => setState(() => status = v)),
          ),
        Field('Note', Input(controller: note, hint: 'Optional')),
        TotalBox(label: 'Total', usd: usd, rate: rate, native: total, currency: currency),
        if (app.role.canSeeMoney && unitCost > 0 && parseNum(qty.text) > 0)
          ProfitBox(
            label: 'Profit on this sale',
            profit: usd - unitCost * parseNum(qty.text),
            sub: 'cost ${money(unitCost)} × ${parseNum(qty.text).round()}',
          ),
        if (tried && !valid)
          const Text('Add the item, a quantity and a price to save.', style: TextStyle(color: C.down, fontSize: 12)).animate().shakeX(hz: 5, amount: 3),
      ],
      actions: [
        ActionButton(
          label: editing ? 'Save changes' : 'Save sale',
          icon: Icons.check_rounded,
          onPressed: () async {
            if (!valid) {
              setState(() => tried = true);
              HapticFeedback.heavyImpact();
              return;
            }
            final s = Sale(
              id: widget.sale?.id ?? '',
              date: date,
              customer: customer.text.trim(),
              phone: phone.text.trim(),
              item: item.text.trim(),
              size: size,
              currency: currency,
              method: method,
              channel: channel,
              status: status,
              productId: productId,
              type: type,
              unitCost: unitCost,
              note: note.text.trim(),
              by: widget.sale?.by ?? app.myId,
              byName: widget.sale?.byName ?? app.myName,
              qty: parseNum(qty.text).round(),
              unitPrice: parseNum(price.text),
              discount: parseNum(discount.text),
              total: total,
              totalUsd: usd,
            );
            await guard(context, () => app.backend.saveSale(s, previous: widget.sale));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, editing ? 'Sale updated' : 'Sale saved · ${money(usd)}');
            }
          },
        ),
        if (editing && app.role.canEditSale)
          DeleteButton(onConfirm: () async {
            await guard(context, () => app.backend.deleteSale(widget.sale!));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, 'Sale deleted', icon: Icons.delete_rounded, color: C.down);
            }
          }),
      ],
    );
  }
}

// ──────────────────────────── Payment ────────────────────────────

class PaymentForm extends StatefulWidget {
  const PaymentForm({super.key, this.payment});
  final Payment? payment;
  @override
  State<PaymentForm> createState() => _PaymentFormState();
}

class _PaymentFormState extends State<PaymentForm> {
  late DateTime date = widget.payment?.date ?? DateTime.now();
  late String category = widget.payment?.category ?? 'Stock';
  late final desc = TextEditingController(text: widget.payment?.description);
  late final payee = TextEditingController(text: widget.payment?.payee);
  late final amount = TextEditingController(text: widget.payment == null ? '' : _SaleFormState._n(widget.payment!.amount));
  late final note = TextEditingController(text: widget.payment?.note);
  late String currency = widget.payment?.currency ?? 'USD';
  late String method = widget.payment?.method ?? 'Cash';
  late String status = widget.payment?.status ?? 'paid';
  bool tried = false;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final rate = app.config.lbpRate;
    final a = parseNum(amount.text);
    final usd = currency == 'USD' ? a : a / rate;
    final editing = widget.payment != null;
    final valid = desc.text.trim().isNotEmpty && a > 0;

    return SheetFrame(
      title: editing ? 'Edit payment' : 'New payment',
      items: [
        DateTimeRow(value: date, onChanged: (d) => setState(() => date = d)),
        Field('Category', CategoryGrid(selected: category, onChanged: (v) => setState(() => category = v))),
        Field('What for', Input(controller: desc, hint: 'e.g. Blank tees · 100 pcs', onChanged: (_) => setState(() {}))),
        Field('Paid to', Input(controller: payee, hint: 'Supplier, shop, person')),
        Row(children: [
          Expanded(
            flex: 3,
            child: Field('Amount', Input(controller: amount, number: true, hint: '0', prefix: currency == 'USD' ? r'$ ' : 'LBP ', onChanged: (_) => setState(() {}))),
          ),
          const SizedBox(width: 12),
          Expanded(flex: 2, child: Field('Currency', SlidePicker(options: const ['USD', 'LBP'], selected: currency, onChanged: (v) => setState(() => currency = v)))),
        ]),
        Field('Method', SlidePicker(options: payMethods, selected: method, onChanged: (v) => setState(() => method = v))),
        Field('Status', SlidePicker(options: const ['paid', 'pending'], labels: const ['Paid', 'Pending'], selected: status, onChanged: (v) => setState(() => status = v))),
        Field('Note', Input(controller: note, hint: 'Optional')),
        TotalBox(label: status == 'paid' ? 'Paid' : 'To pay', usd: usd, rate: rate, native: a, currency: currency),
        if (tried && !valid)
          const Text('Add what it was for and an amount to save.', style: TextStyle(color: C.down, fontSize: 12)).animate().shakeX(hz: 5, amount: 3),
      ],
      actions: [
        ActionButton(
          label: editing ? 'Save changes' : 'Save payment',
          icon: Icons.check_rounded,
          onPressed: () async {
            if (!valid) {
              setState(() => tried = true);
              HapticFeedback.heavyImpact();
              return;
            }
            final p = Payment(
              id: widget.payment?.id ?? '',
              date: date,
              category: category,
              description: desc.text.trim(),
              payee: payee.text.trim(),
              currency: currency,
              method: method,
              status: status,
              note: note.text.trim(),
              by: widget.payment?.by ?? app.myId,
              byName: widget.payment?.byName ?? app.myName,
              amount: a,
              amountUsd: usd,
            );
            await guard(context, () => app.backend.savePayment(p));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, editing ? 'Payment updated' : 'Payment saved · ${money(usd)}');
            }
          },
        ),
        if (editing)
          DeleteButton(onConfirm: () async {
            await guard(context, () => app.backend.deletePayment(widget.payment!.id));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, 'Payment deleted', icon: Icons.delete_rounded, color: C.down);
            }
          }),
      ],
    );
  }
}

// ──────────────────────────── Capital ────────────────────────────

class CapitalForm extends StatefulWidget {
  const CapitalForm({super.key, this.entry, this.kind = 'deposit'});
  final CapitalEntry? entry;
  final String kind;
  @override
  State<CapitalForm> createState() => _CapitalFormState();
}

class _CapitalFormState extends State<CapitalForm> {
  late String kind = widget.entry?.kind ?? widget.kind;
  late DateTime date = widget.entry?.date ?? DateTime.now();
  late final amount = TextEditingController(text: widget.entry == null ? '' : _SaleFormState._n(widget.entry!.amount));
  late final label = TextEditingController(text: widget.entry?.label);
  late String category = widget.entry?.category.isNotEmpty == true ? widget.entry!.category : 'Stock';
  bool tried = false;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final a = parseNum(amount.text);
    final editing = widget.entry != null;
    final deposit = kind == 'deposit';
    return SheetFrame(
      title: editing ? 'Edit entry' : (deposit ? 'Add capital' : 'Allocate budget'),
      items: [
        SlidePicker(
          options: const ['deposit', 'allocation'],
          labels: const ['Money in', 'Budget for a category'],
          selected: kind,
          onChanged: (v) => setState(() => kind = v),
        ),
        Field('Amount (USD)', Input(controller: amount, number: true, hint: '0', prefix: r'$ ', onChanged: (_) => setState(() {}))),
        AnimatedSize(
          duration: kMed,
          curve: kCurve,
          child: deposit
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Field('Category', CategoryGrid(selected: category, onChanged: (v) => setState(() => category = v))),
                ),
        ),
        Field(deposit ? 'Source' : 'Note', Input(controller: label, hint: deposit ? 'e.g. Owner savings, partner' : 'Optional')),
        DateTimeRow(value: date, onChanged: (d) => setState(() => date = d)),
        if (tried && a <= 0)
          const Text('Enter an amount to save.', style: TextStyle(color: C.down, fontSize: 12)).animate().shakeX(hz: 5, amount: 3),
      ],
      actions: [
        ActionButton(
          label: editing ? 'Save changes' : 'Save',
          icon: Icons.check_rounded,
          onPressed: () async {
            if (a <= 0) {
              setState(() => tried = true);
              HapticFeedback.heavyImpact();
              return;
            }
            final e = CapitalEntry(
              id: widget.entry?.id ?? '',
              kind: kind,
              date: date,
              amount: a,
              label: label.text.trim(),
              category: deposit ? '' : category,
              by: widget.entry?.by ?? app.myId,
              byName: widget.entry?.byName ?? app.myName,
            );
            await guard(context, () => app.backend.saveCapital(e));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, deposit ? 'Capital added · ${money0(a)}' : '$category budget set · ${money0(a)}');
            }
          },
        ),
        if (editing)
          DeleteButton(onConfirm: () async {
            await guard(context, () => app.backend.deleteCapital(widget.entry!.id));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, 'Entry deleted', icon: Icons.delete_rounded, color: C.down);
            }
          }),
      ],
    );
  }
}

// ─────────────────────────── Quick add ───────────────────────────

class QuickAdd extends StatelessWidget {
  const QuickAdd({super.key});
  @override
  Widget build(BuildContext context) {
    final role = AppScope.of(context).role;
    final items = <(String, String, IconData, Color, Widget)>[
      if (role.canAddSale) ('New sale', 'A customer bought something', Icons.checkroom_rounded, C.red, const SaleForm()),
      if (role.canEditPayments) ('New payment', 'Money that went out', Icons.account_balance_wallet_rounded, C.silver, const PaymentForm()),
      if (role.canEditCapital) ('Capital', 'Money in or a budget', Icons.pie_chart_rounded, C.gold, const CapitalForm()),
    ];
    return SheetFrame(
      title: 'Add',
      actions: const [],
      items: [
        for (final it in items)
          Pressable(
            onTap: () {
              Navigator.pop(context);
              showSheet(context, it.$5);
            },
            child: Panel(
              child: Row(children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(color: it.$4.withValues(alpha: .14), borderRadius: BorderRadius.circular(14)),
                  child: Icon(it.$3, color: it.$4),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(it.$1, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(height: 3),
                    Text(it.$2, style: subStyle),
                  ]),
                ),
                const Icon(Icons.chevron_right_rounded, color: C.mute),
              ]),
            ),
          ),
      ],
    );
  }
}

/// Runs a write; shows a readable error instead of crashing.
Future<void> guard(BuildContext context, Future<void> Function() f) async {
  try {
    await f();
  } catch (e) {
    final msg = '$e'.contains('permission') ? "You don't have permission for that." : 'Could not save. Check your connection and try again.';
    if (context.mounted) toast(context, msg, icon: Icons.error_rounded, color: C.down);
    rethrow;
  }
}
