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
  final Set<String> _bridgedDays = {};
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
    _bridgedDays.addAll(_prefs.getStringList('bridged') ?? const []);
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
    await _prefs.setStringList('bridged', _bridgedDays.toList()..sort());
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

  static DateTime _day(DateTime d, [int offset = 0]) => DateTime(d.year, d.month, d.day + offset);

  bool _qualifies(DateTime d) => countOn(d) >= streakThreshold;

  /// A day that keeps the streak going without adding to it (see [restoreStreak]).
  bool _bridged(DateTime d) => _bridgedDays.contains(dayKey(d));

  /// Walks back from [from] through days that count, letting a single missed
  /// day pass (the streak pauses) but stopping at two missed days in a row.
  /// Returns the number of counting days and the earliest one.
  (int, DateTime?) _run(DateTime from) {
    final earliest = _days.keys.isEmpty ? null : (_days.keys.toList()..sort()).first;
    var d = _day(from);
    var n = 0;
    var misses = 0;
    DateTime? start;
    while (earliest != null && dayKey(d).compareTo(earliest) >= 0) {
      if (_qualifies(d)) {
        n++;
        misses = 0;
        start = d;
      } else if (_bridged(d)) {
        misses = 0;
      } else if (++misses > 1) {
        break;
      }
      d = _day(d, -1);
    }
    return (n, start);
  }

  /// The day the streak is counted back from: today once it counts, else
  /// yesterday, since today only breaks the streak after it is over.
  DateTime get _streakFrom {
    final today = _day(now());
    return _qualifies(today) || _bridged(today) ? today : _day(today, -1);
  }

  /// Days with at least [streakThreshold] beads. Missing one day pauses the
  /// streak instead of ending it; it ends after two missed days in a row.
  int get streak => _run(_streakFrom).$1;

  /// The streak is alive but waiting: yesterday was missed, so today must count.
  bool get streakPaused {
    final today = _day(now());
    final y = _day(today, -1);
    return streak > 0 && !_qualifies(today) && !_bridged(today) && !_qualifies(y) && !_bridged(y);
  }

  /// The streak that ended before the current one, if it can be brought back:
  /// (its length, first missed day, last missed day). Null if nothing was lost.
  (int, DateTime, DateTime)? get lostStreak {
    final (n, start) = _run(_streakFrom);
    // The gap ends the day before the current run, or yesterday when there is none.
    final gapEnd = n > 0 ? _day(start!, -1) : _day(_streakFrom, _qualifies(_streakFrom) ? -1 : 0);
    var d = gapEnd;
    final earliest = _days.keys.isEmpty ? null : (_days.keys.toList()..sort()).first;
    while (earliest != null && dayKey(d).compareTo(earliest) >= 0 && !_qualifies(d) && !_bridged(d)) {
      d = _day(d, -1);
    }
    if (earliest == null || dayKey(d).compareTo(earliest) < 0) return null;
    final gapStart = _day(d, 1);
    // A one-day gap is already covered by the pause.
    if (gapEnd.difference(gapStart).inHours < 20) return null;
    final lost = _run(d).$1;
    return lost > 0 ? (lost, gapStart, gapEnd) : null;
  }

  /// Brings back [lostStreak] by bridging the missed days, and joins it to the current run.
  void restoreStreak() {
    final lost = lostStreak;
    if (lost == null) return;
    for (var d = lost.$2; !d.isAfter(lost.$3); d = _day(d, 1)) {
      _bridgedDays.add(dayKey(d));
    }
    _save();
    notifyListeners();
  }

  /// Last 7 days, oldest first: whether each counted toward the streak.
  List<bool> get week {
    final t = _day(now());
    return [for (var i = 6; i >= 0; i--) _qualifies(_day(t, -i)) || _bridged(_day(t, -i))];
  }

  /// Most recent day with any beads, or null.
  String? get lastActiveDay {
    final keys = _days.entries.where((e) => e.value > 0).map((e) => e.key).toList()..sort();
    return keys.isEmpty ? null : keys.last;
  }

  /// Most recent day that kept the streak going (counted or bridged), or null.
  String? get lastQualifiedDay {
    final keys = [..._days.entries.where((e) => e.value >= streakThreshold).map((e) => e.key), ..._bridgedDays]..sort();
    return keys.isEmpty ? null : keys.last;
  }
}
