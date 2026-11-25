import 'dart:async';

import 'package:material_ui/material_ui.dart';

import 'backend.dart';
import 'models.dart';

class AppState extends ChangeNotifier {
  AppState(this.backend, {this.demo = false}) {
    _meSub = backend.me().listen((u) {
      final changed = u?.id != me?.id || u?.role != me?.role;
      me = u;
      authReady = true;
      if (changed) _resubscribe();
      notifyListeners();
    }, onError: (Object e) {
      authReady = true;
      error = '$e';
      notifyListeners();
    });
  }

  final Backend backend;
  final bool demo;

  AppUser? me;
  bool authReady = false;
  bool loaded = false;
  String? error;

  List<Sale> sales = [];
  List<Payment> payments = [];
  List<CapitalEntry> capital = [];
  List<AppUser> users = [];
  AppConfig config = const AppConfig();

  /// Selected period: first day of a month, or null for all time.
  DateTime? month = DateTime(DateTime.now().year, DateTime.now().month);

  StreamSubscription? _meSub;
  final _subs = <StreamSubscription>[];

  Role get role => me?.role ?? Role.pending;

  void _resubscribe() {
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
    sales = [];
    payments = [];
    capital = [];
    users = [];
    loaded = false;
    if (me == null || !role.active) return;

    void onErr(Object e) {
      error = '$e';
      notifyListeners();
    }

    _subs.add(backend.sales().listen((v) {
      sales = v;
      loaded = true;
      notifyListeners();
    }, onError: onErr));
    _subs.add(backend.users().listen((v) {
      users = v;
      notifyListeners();
    }, onError: onErr));
    _subs.add(backend.config().listen((v) {
      config = v;
      notifyListeners();
    }, onError: onErr));
    if (role.canSeeMoney) {
      _subs.add(backend.payments().listen((v) {
        payments = v;
        notifyListeners();
      }, onError: onErr));
      _subs.add(backend.capital().listen((v) {
        capital = v;
        notifyListeners();
      }, onError: onErr));
    }
  }

  void setMonth(DateTime? m) {
    month = m;
    notifyListeners();
  }

  void clearError() {
    error = null;
    notifyListeners();
  }

  bool inPeriod(DateTime d) => month == null || (d.year == month!.year && d.month == month!.month);

  List<Sale> get periodSales => sales.where((s) => inPeriod(s.date)).toList();
  List<Payment> get periodPayments => payments.where((p) => inPeriod(p.date)).toList();

  double get revenue => periodSales.where((s) => s.completed).fold(0, (a, s) => a + s.totalUsd);
  double get spent => periodPayments.where((p) => p.paid).fold(0, (a, p) => a + p.amountUsd);
  double get net => revenue - spent;
  int get piecesSold => periodSales.where((s) => s.completed).fold(0, (a, s) => a + s.qty);
  int get orders => periodSales.where((s) => s.completed).length;
  double get avgOrder => orders == 0 ? 0 : revenue / orders;

  double get capitalIn => capital.where((c) => c.isDeposit).fold(0, (a, c) => a + c.amount);
  double get spentAllTime => payments.where((p) => p.paid).fold(0, (a, p) => a + p.amountUsd);
  double get capitalLeft => capitalIn - spentAllTime;
  Iterable<Payment> get pending => payments.where((p) => !p.paid);
  double get pendingTotal => pending.fold(0, (a, p) => a + p.amountUsd);

  Map<String, double> get allocatedByCategory {
    final m = <String, double>{};
    for (final c in capital.where((c) => !c.isDeposit)) {
      m[c.category] = (m[c.category] ?? 0) + c.amount;
    }
    return m;
  }

  Map<String, double> spentByCategory({bool periodOnly = false}) {
    final m = <String, double>{};
    for (final p in (periodOnly ? periodPayments : payments).where((p) => p.paid)) {
      m[p.category] = (m[p.category] ?? 0) + p.amountUsd;
    }
    return m;
  }

  /// Sales and payments per day for the 14 days ending at the period's end.
  List<(DateTime, double, double)> get daily {
    final now = DateTime.now();
    var end = DateTime(now.year, now.month, now.day);
    if (month != null && (month!.year != now.year || month!.month != now.month)) {
      end = DateTime(month!.year, month!.month + 1, 0);
    }
    final out = <(DateTime, double, double)>[];
    for (var i = 13; i >= 0; i--) {
      final d = DateTime(end.year, end.month, end.day - i);
      bool same(DateTime x) => x.year == d.year && x.month == d.month && x.day == d.day;
      final s = sales.where((x) => x.completed && same(x.date)).fold(0.0, (a, x) => a + x.totalUsd);
      final p = payments.where((x) => x.paid && same(x.date)).fold(0.0, (a, x) => a + x.amountUsd);
      out.add((d, s, p));
    }
    return out;
  }

  /// Months that have data, newest first, always including this month.
  List<DateTime> get months {
    final now = DateTime.now();
    final set = <DateTime>{DateTime(now.year, now.month)};
    for (final s in sales) {
      set.add(DateTime(s.date.year, s.date.month));
    }
    for (final p in payments) {
      set.add(DateTime(p.date.year, p.date.month));
    }
    final l = set.toList()..sort((a, b) => b.compareTo(a));
    return l.take(12).toList();
  }

  String get myName => me?.name ?? '';
  String get myId => me?.id ?? '';

  @override
  void dispose() {
    _meSub?.cancel();
    for (final s in _subs) {
      s.cancel();
    }
    super.dispose();
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  static AppState read(BuildContext context) =>
      context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
