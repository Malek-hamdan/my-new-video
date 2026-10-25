import 'dart:async';
import 'dart:convert';

import 'package:home_widget/home_widget.dart';

import '../data/phrases.dart';
import '../data/store.dart';

/// Pushes the state the home-screen widgets need. The widgets pick the phrase
/// of the day themselves (see WidgetRenderer.kt), so they stay right after
/// midnight even when the app is not opened.
class WidgetSync {
  WidgetSync(this.store) {
    store.addListener(_schedule);
    _schedule();
  }

  final Store store;
  Timer? _timer;

  static const _providers = [
    'com.hamdan.tasbih.widget.LargeWidget',
    'com.hamdan.tasbih.widget.CounterWidget',
    'com.hamdan.tasbih.widget.VerseWidget',
  ];

  void _schedule() {
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 700), push);
  }

  Future<void> push() async {
    final t = store.current;
    final count = store.progressOf(t.id);
    final stage = t.stageIndexAt(count);
    final data = <String, String>{
      'today_key': dayKey(store.now()),
      'today_count': '${store.todayCount}',
      'done_today': store.doneToday ? '1' : '0',
      'last_active_day': store.lastActiveDay ?? '',
      'last_qualified_day': store.lastQualifiedDay ?? '',
      'streak': '${store.streak}',
      'title': t.title,
      'stage_text': t.stages[stage].text,
      'stage_done': '${t.doneInStage(count, stage)}',
      'stage_total': '${t.stages[stage].count}',
      'progress': '$count',
      'total': '${t.total}',
      'phrases': jsonEncode({
        'morning': Phrases.morning,
        'notYet': Phrases.notYet,
        'yesterday': Phrases.yesterday,
        'paused': Phrases.paused,
        'partial': Phrases.partial,
        'done': Phrases.done,
        'night': Phrases.night,
        'streak': Phrases.streak,
        'milestones': Phrases.milestones.map((k, v) => MapEntry('$k', v)),
        'verses': Phrases.verses,
      }),
    };
    try {
      for (final e in data.entries) {
        await HomeWidget.saveWidgetData<String>(e.key, e.value);
      }
      for (final p in _providers) {
        await HomeWidget.updateWidget(qualifiedAndroidName: p);
      }
    } catch (_) {
      // No widget host (tests, unsupported platform): nothing to update.
    }
  }

  void dispose() {
    _timer?.cancel();
    store.removeListener(_schedule);
  }
}
