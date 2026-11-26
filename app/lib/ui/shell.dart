import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:material_ui/material_ui.dart';

import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'capital.dart';
import 'dashboard.dart';
import 'forms.dart';
import 'lists.dart';
import 'stock.dart';
import 'team.dart';
import 'widgets.dart';

class _Tab {
  const _Tab(this.label, this.icon, this.build, this.add);
  final String label;
  final IconData icon;
  final Widget Function() build;
  final Widget Function()? add;
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  String _current = 'Home';
  AppState? _app;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final app = AppScope.read(context);
    if (!identical(app, _app)) {
      _app?.tabRequest.removeListener(_onTabRequest);
      _app = app..tabRequest.addListener(_onTabRequest);
    }
  }

  void _onTabRequest() {
    final t = _app?.tabRequest.value;
    if (t == null) return;
    _app!.tabRequest.value = null;
    HapticFeedback.selectionClick();
    setState(() => _current = t);
  }

  @override
  void dispose() {
    _app?.tabRequest.removeListener(_onTabRequest);
    super.dispose();
  }

  List<_Tab> _tabs(Role r) => [
        if (r.canSeeMoney) _Tab('Home', Icons.space_dashboard_rounded, () => const DashboardScreen(), r.canAddSale ? () => const QuickAdd() : null),
        _Tab('Sales', Icons.checkroom_rounded, () => const SalesScreen(), r.canAddSale ? () => const SaleForm() : null),
        _Tab('Stock', Icons.inventory_2_rounded, () => const StockScreen(), r.canManageStock ? () => const ProductForm() : null),
        if (r.canSeeMoney) _Tab('Payments', Icons.account_balance_wallet_rounded, () => const PaymentsScreen(), r.canEditPayments ? () => const PaymentForm() : null),
        if (r.canSeeMoney) _Tab('Capital', Icons.pie_chart_rounded, () => const CapitalScreen(), r.canEditCapital ? () => const CapitalForm() : null),
        _Tab('Team', Icons.groups_rounded, () => const TeamScreen(), null),
      ];

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tabs = _tabs(app.role);
    final idx = tabs.indexWhere((t) => t.label == _current);
    final tab = idx < 0 ? tabs.first : tabs[idx];
    final bottom = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      extendBody: true,
      body: Column(children: [
        if (app.demo)
          Container(
            width: double.infinity,
            color: C.gold.withValues(alpha: .12),
            padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 4, bottom: 5),
            child: const Text('DEMO DATA · not connected to Firebase yet',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: .8, color: C.gold)),
          ),
        if (app.error != null)
          Pressable(
            onTap: app.clearError,
            child: Container(
              width: double.infinity,
              color: C.down.withValues(alpha: .15),
              padding: EdgeInsets.fromLTRB(16, app.demo ? 6 : MediaQuery.of(context).padding.top + 6, 16, 6),
              child: Text(
                app.error!.contains('permission') ? 'No permission to read some data. Ask the owner to check your role.' : "Can't reach the server. Showing what's saved on this phone.",
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11.5, color: C.down, fontWeight: FontWeight.w600),
              ),
            ),
          ).animate().fadeIn().slideY(begin: -.5),
        Expanded(
          child: SafeArea(
            top: !app.demo && app.error == null,
            bottom: false,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 340),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              layoutBuilder: (cur, prev) => Stack(fit: StackFit.expand, children: [...prev, ?cur]),
              transitionBuilder: (child, a) => FadeTransition(
                opacity: a,
                child: ScaleTransition(scale: Tween(begin: .97, end: 1.0).animate(a), child: child),
              ),
              child: KeyedSubtree(key: ValueKey(tab.label), child: tab.build()),
            ),
          ),
        ),
      ]),
      floatingActionButton: AnimatedSwitcher(
        duration: kMed,
        transitionBuilder: (c, a) => ScaleTransition(scale: CurvedAnimation(parent: a, curve: Curves.easeOutBack), child: c),
        child: tab.add == null
            ? const SizedBox.shrink(key: ValueKey('none'))
            : Padding(
                key: ValueKey('fab-${tab.label}'),
                padding: EdgeInsets.only(bottom: 4 + (bottom > 0 ? 0 : 6)),
                child: Pressable(
                  scale: .9,
                  onTap: () => showSheet(context, tab.add!()),
                  child: Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: C.red,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: C.red.withValues(alpha: .45), blurRadius: 24, offset: const Offset(0, 10))],
                    ),
                    child: const Icon(Icons.add_rounded, color: Colors.white, size: 30),
                  ),
                ),
              ),
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(8, 8, 8, bottom + 8),
        decoration: BoxDecoration(
          color: C.panel.withValues(alpha: .97),
          border: const Border(top: BorderSide(color: C.line)),
        ),
        child: Row(children: [
          for (final t in tabs)
            Expanded(
              child: _NavItem(
                tab: t,
                on: t.label == tab.label,
                onTap: () {
                  if (t.label == tab.label) return;
                  HapticFeedback.selectionClick();
                  setState(() => _current = t.label);
                },
              ),
            ),
        ]),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.tab, required this.on, required this.onTap});
  final _Tab tab;
  final bool on;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Pressable(
        haptic: false,
        scale: .88,
        onTap: onTap,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          AnimatedContainer(
            duration: kMed,
            curve: Curves.easeOutBack,
            padding: EdgeInsets.symmetric(horizontal: on ? 14 : 8, vertical: 5),
            decoration: BoxDecoration(
              color: on ? C.red.withValues(alpha: .16) : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
            ),
            child: TweenAnimationBuilder<Color?>(
              tween: ColorTween(end: on ? C.red : C.mute),
              duration: kMed,
              builder: (_, c, _) => Icon(tab.icon, color: c, size: 23),
            ),
          ),
          const SizedBox(height: 4),
          AnimatedDefaultTextStyle(
            duration: kMed,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: 10.5,
              fontWeight: on ? FontWeight.w700 : FontWeight.w500,
              color: on ? C.fg : C.mute,
            ),
            child: Text(tab.label),
          ),
        ]),
      );
}
