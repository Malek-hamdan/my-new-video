import 'dart:math';

import 'package:flutter/material.dart';

import '../data/phrases.dart';
import '../data/store.dart';
import '../data/tasbihat.dart';
import '../services/feedback.dart';
import 'bead_string.dart';
import 'list_screen.dart';
import 'theme.dart';

class TasbihScreen extends StatefulWidget {
  const TasbihScreen({super.key, required this.store, required this.feedback});

  final Store store;
  final BeadFeedback feedback;

  @override
  State<TasbihScreen> createState() => _TasbihScreenState();
}

class _TasbihScreenState extends State<TasbihScreen> {
  late BeadPhysics _physics;
  late String _id;
  String? _completePhrase;

  Store get store => widget.store;

  @override
  void initState() {
    super.initState();
    _id = store.current.id;
    _physics = BeadPhysics(total: store.current.total, count: store.progressOf(_id))..onLanded = _landed;
    store.addListener(_storeChanged);
    if (store.progressOf(_id) >= store.current.total) _completePhrase = _pickDonePhrase();
  }

  @override
  void dispose() {
    store.removeListener(_storeChanged);
    _physics.dispose();
    super.dispose();
  }

  void _storeChanged() {
    final t = store.current;
    final count = store.progressOf(t.id);
    // Switched tasbih, reset, or changed count: start the string from the stored state.
    if (t.id != _id || t.total != _physics.total || count < _physics.count) {
      _id = t.id;
      _physics.reset(total: t.total, count: count);
      _completePhrase = count >= t.total ? _pickDonePhrase() : null;
    }
    setState(() {});
  }

  void _landed(int count, double strength) {
    final t = store.current;
    final n = store.addBead(t.id);
    final complete = n >= t.total;
    widget.feedback.tick(strength, separator: t.multiStage && t.endsStage(n) && !complete);
    if (complete) {
      widget.feedback.tick(1, separator: true);
      Future.delayed(const Duration(milliseconds: 450), () {
        if (!mounted) return;
        widget.feedback.complete();
        setState(() => _completePhrase = _pickDonePhrase());
      });
    }
  }

  String _pickDonePhrase() {
    final streak = store.streak;
    final milestone = Phrases.milestones[streak];
    if (milestone != null) return milestone;
    final r = Random();
    final List<String> pool;
    if (store.now().hour >= 21) {
      pool = Phrases.night;
    } else if (streak >= 3 && r.nextInt(4) == 0) {
      pool = Phrases.streak;
    } else {
      pool = Phrases.done;
    }
    return Phrases.fill(pool[r.nextInt(pool.length)], count: store.todayCount, streak: streak);
  }

  void _newRound() {
    store.resetProgress(store.current.id);
  }

  Future<void> _confirmReset() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('تصفير العدّاد؟'),
        content: const Text('بترجع التسبيحة من الأول.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('لا')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('صفّر')),
        ],
      ),
    );
    if (ok == true) store.resetProgress(store.current.id);
  }

  void _openList() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ListScreen(store: store)));
  }

  @override
  Widget build(BuildContext context) {
    final t = store.current;
    final count = store.progressOf(t.id);
    final stage = t.stageIndexAt(count);
    final done = t.doneInStage(count, stage);

    return Scaffold(
      body: WarmBackground(
        child: SafeArea(
          child: Stack(
            children: [
              Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: Row(
                      children: [
                        Flexible(
                          fit: FlexFit.loose,
                          child: Align(
                            alignment: AlignmentDirectional.centerStart,
                            child: Chip2(
                              onTap: _openList,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.menu, size: 16, color: Palette.cream),
                                  const SizedBox(width: 6),
                                  Flexible(child: Text(_shortTitle(t), overflow: TextOverflow.ellipsis)),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        StreakChip(days: store.streak),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onLongPress: _confirmReset,
                    child: Column(
                      children: [
                        ShaderMask(
                          shaderCallback: (r) => const LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0xFFFFF3D6), Palette.gold],
                          ).createShader(r),
                          child: Text(
                            '$count',
                            style: const TextStyle(
                              fontSize: 66,
                              fontWeight: FontWeight.w700,
                              height: 1.15,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        Text('من ${t.total}', style: const TextStyle(fontSize: 13, color: Palette.muted)),
                      ],
                    ),
                  ),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 350),
                    child: Padding(
                      key: ValueKey('${t.id}-$stage'),
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text(
                        t.stages[stage].text,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: TextStyle(
                          fontFamily: amiri,
                          fontSize: t.stages[stage].text.length > 22 ? 22 : 30,
                          height: 1.5,
                          color: Palette.creamBright,
                        ),
                      ),
                    ),
                  ),
                  if (t.multiStage) ...[const SizedBox(height: 4), _StagePills(tasbih: t, count: count)],
                  Expanded(child: BeadString(physics: _physics)),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                    child: _SavedCard(
                      text: t.multiStage
                          ? '${t.stages[stage].text} — $done من ${t.stages[stage].count}'
                          : '$count من ${t.total}',
                    ),
                  ),
                ],
              ),
              if (_completePhrase != null)
                _CompleteOverlay(
                  phrase: _completePhrase!,
                  todayCount: store.todayCount,
                  onAgain: _newRound,
                  onList: () {
                    _newRound();
                    _openList();
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _shortTitle(Tasbih t) => t.id == zahraId ? 'تسبيحة الزهراء (ع)' : t.title;
}

class _StagePills extends StatelessWidget {
  const _StagePills({required this.tasbih, required this.count});

  final Tasbih tasbih;
  final int count;

  @override
  Widget build(BuildContext context) {
    final current = tasbih.stageIndexAt(count);
    final complete = count >= tasbih.total;
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 6,
      runSpacing: 6,
      children: [
        for (var i = 0; i < tasbih.stages.length; i++)
          () {
            final s = tasbih.stages[i];
            final isDone = i < current || complete;
            final isCur = i == current && !complete;
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: isCur ? Palette.gold : null,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isCur
                      ? Palette.gold
                      : isDone
                      ? const Color(0x599FD39A)
                      : Palette.line,
                ),
              ),
              child: Text(
                isDone
                    ? '✓ ${s.text} ${s.count}'
                    : isCur
                    ? '${s.text} ${tasbih.doneInStage(count, i)}/${s.count}'
                    : '${s.text} 0/${s.count}',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isCur ? FontWeight.w700 : FontWeight.w400,
                  color: isCur
                      ? Palette.ink
                      : isDone
                      ? const Color(0xFF9FD39A)
                      : Palette.muted,
                ),
              ),
            );
          }(),
      ],
    );
  }
}

class _SavedCard extends StatelessWidget {
  const _SavedCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
    decoration: BoxDecoration(
      color: const Color(0xBF140C06),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Palette.line),
    ),
    child: Row(
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: const BoxDecoration(
            color: Palette.green,
            shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: Palette.green, blurRadius: 6)],
          ),
        ),
        const SizedBox(width: 8),
        const Text('وصلت: ', style: TextStyle(fontSize: 12.5)),
        Expanded(
          child: Text(
            text,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, color: Palette.gold, fontWeight: FontWeight.w700),
          ),
        ),
        const Text('محفوظ تلقائياً', style: TextStyle(fontSize: 11, color: Palette.muted)),
      ],
    ),
  );
}

class _CompleteOverlay extends StatelessWidget {
  const _CompleteOverlay({required this.phrase, required this.todayCount, required this.onAgain, required this.onList});

  final String phrase;
  final int todayCount;
  final VoidCallback onAgain;
  final VoidCallback onList;

  @override
  Widget build(BuildContext context) => Positioned.fill(
    child: TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 500),
      builder: (context, v, child) => Opacity(opacity: v, child: child),
      child: Container(
        color: const Color(0xD90A0604),
        alignment: Alignment.center,
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '✓ تقبّل الله',
              style: TextStyle(color: Palette.green, fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 14),
            Text(
              phrase,
              textAlign: TextAlign.center,
              style: const TextStyle(fontFamily: amiri, fontSize: 30, height: 1.5, color: Palette.creamBright),
            ),
            const SizedBox(height: 12),
            Text('مجموع اليوم: $todayCount', style: const TextStyle(color: Palette.muted, fontSize: 13)),
            const SizedBox(height: 28),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: Palette.gold, foregroundColor: Palette.ink),
                  onPressed: onAgain,
                  child: const Text('دورة جديدة', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 12),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Palette.cream,
                    side: const BorderSide(color: Palette.line),
                  ),
                  onPressed: onList,
                  child: const Text('تسبيحاتي'),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}
