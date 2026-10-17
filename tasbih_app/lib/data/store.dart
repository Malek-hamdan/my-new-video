import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'tasbihat.dart';

/// Beads needed in a day for that day to count toward the streak.
const streakThreshold = 33;

String dayKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// All persisted state: progress per tasbih, daily totals, custom tasbihat.
class Store extends ChangeNotifier {
  Store(this._prefs) {
    _load();
  }

  static Future<Store> open() async => Store(await SharedPreferences.getInstance());

  final SharedPreferences _prefs;

  final Map<String, int> _progress = {};
  final Map<String, int> _countOverrides = {};
  final Map<String, int> _days = {};
  final Map<String, int> _roundsDone = {};
  final List<Tasbih> _custom = [];
  String _lastId = zahraId;

  /// Clock, replaceable in tests.
  DateTime Function() now = DateTime.now;

  void _load() {
    Map<String, int> intMap(String key) {
      final raw = _prefs.getString(key);
      if (raw == null) return {};
      return (jsonDecode(raw) as Map<String, dynamic>).map((k, v) => MapEntry(k, v as int));
    }

    _progress.addAll(intMap('progress'));
    _countOverrides.addAll(intMap('counts'));
    _days.addAll(intMap('days'));
    _roundsDone.addAll(intMap('rounds'));
    final custom = _prefs.getString('custom');
    if (custom != null) {
      _custom.addAll((jsonDecode(custom) as List).map((j) => Tasbih.fromJson(j as Map<String, dynamic>)));
    }
    _lastId = _prefs.getString('last') ?? zahraId;
  }

  Future<void> _save() async {
    // Keep a bit more than a year of daily history.
    if (_days.length > 400) {
      final keys = _days.keys.toList()..sort();
      for (final k in keys.take(_days.length - 400)) {
        _days.remove(k);
        _roundsDone.remove(k);
      }
    }
    await _prefs.setString('progress', jsonEncode(_progress));
    await _prefs.setString('counts', jsonEncode(_countOverrides));
    await _prefs.setString('days', jsonEncode(_days));
    await _prefs.setString('rounds', jsonEncode(_roundsDone));
    await _prefs.setString('custom', jsonEncode(_custom.map((t) => t.toJson()).toList()));
    await _prefs.setString('last', _lastId);
  }

  List<Tasbih> get tasbihat => [
    for (final t in builtInTasbihat)
      !t.multiStage && _countOverrides[t.id] != null ? t.withCount(_countOverrides[t.id]!) : t,
    ..._custom,
  ];

  Tasbih byId(String id) => tasbihat.firstWhere((t) => t.id == id, orElse: () => builtInTasbihat.first);

  Tasbih get current => byId(_lastId);

  bool get soundOn => _prefs.getBool('sound') ?? true;

  set soundOn(bool on) {
    _prefs.setBool('sound', on);
    notifyListeners();
  }

  void select(String id) {
    _lastId = id;
    _save();
    notifyListeners();
  }

  int progressOf(String id) => (_progress[id] ?? 0).clamp(0, byId(id).total);

  /// Records one bead for [id]. Returns the new count in the round.
  int addBead(String id) {
    final t = byId(id);
    final n = (progressOf(id) + 1).clamp(0, t.total);
    _progress[id] = n;
    final today = dayKey(now());
    _days[today] = (_days[today] ?? 0) + 1;
    if (n == t.total) _roundsDone[today] = (_roundsDone[today] ?? 0) + 1;
    _save();
    notifyListeners();
    return n;
  }

  void resetProgress(String id) {
    _progress[id] = 0;
    _save();
    notifyListeners();
  }

  void setCount(String id, int count) {
    final t = byId(id);
    if (t.multiStage) return;
    if (t.custom) {
      final i = _custom.indexWhere((c) => c.id == id);
      _custom[i] = t.withCount(count);
    } else {
      _countOverrides[id] = count;
    }
    _progress[id] = progressOf(id).clamp(0, count);
    _save();
    notifyListeners();
  }

  void addCustom(String text, int count) {
    final id = 'c${now().millisecondsSinceEpoch}';
    _custom.add(Tasbih(id: id, title: text, custom: true, stages: [Stage(text, count)]));
    _save();
    notifyListeners();
  }

  void deleteCustom(String id) {
    _custom.removeWhere((t) => t.id == id);
    _progress.remove(id);
    if (_lastId == id) _lastId = zahraId;
    _save();
    notifyListeners();
  }

  int countOn(DateTime d) => _days[dayKey(d)] ?? 0;

  int get todayCount => countOn(now());

  bool get doneToday => (_roundsDone[dayKey(now())] ?? 0) > 0;

  /// Days in a row with at least [streakThreshold] beads. Today only breaks the
  /// streak once it is over, so an unfinished today still shows yesterday's run.
  int get streak {
    var d = now();
    if (countOn(d) < streakThreshold) d = d.subtract(const Duration(days: 1));
    var n = 0;
    while (countOn(d) >= streakThreshold) {
      n++;
      d = d.subtract(const Duration(days: 1));
    }
    return n;
  }

  /// Last 7 days, oldest first: whether each counted toward the streak.
  List<bool> get week {
    final t = now();
    return [for (var i = 6; i >= 0; i--) countOn(t.subtract(Duration(days: i))) >= streakThreshold];
  }

  /// Most recent day with any beads, or null.
  String? get lastActiveDay {
    final keys = _days.entries.where((e) => e.value > 0).map((e) => e.key).toList()..sort();
    return keys.isEmpty ? null : keys.last;
  }

  /// Most recent day that counted toward the streak, or null.
  String? get lastQualifiedDay {
    final keys = _days.entries.where((e) => e.value >= streakThreshold).map((e) => e.key).toList()..sort();
    return keys.isEmpty ? null : keys.last;
  }
}
