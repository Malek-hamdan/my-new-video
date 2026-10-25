import 'package:flutter/material.dart';

import '../data/store.dart';
import 'theme.dart';

/// Streak details, the pause rule, and bringing back a lost streak.
void showStreakSheet(BuildContext context, Store store) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: const Color(0xFF1D140D),
    builder: (c) => ListenableBuilder(
      listenable: store,
      builder: (c, _) {
        final lost = store.lostStreak;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${store.streakPaused ? '⏸' : '🔥'} ${store.streak} يوم',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: store.streakPaused ? Palette.cream : Palette.flame,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  store.streakPaused
                      ? 'الستريك واقف لأنك فوّتت مبارح. سبّح اليوم ولو $streakThreshold حبة حتى يكمّل.'
                      : 'كل يوم بتسبّح فيه $streakThreshold حبة أو أكتر بيزيد الستريك.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13.5, height: 1.6),
                ),
                const SizedBox(height: 10),
                const Text(
                  'إذا فوّتت يوم، الستريك ما بيروح: بيوقف ⏸ وبيستناك لآخر اليوم اللي بعده. بيروح بس إذا فوّتت يومين ورا بعض.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, height: 1.6, color: Palette.muted),
                ),
                if (lost != null) ...[
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Palette.gold,
                      foregroundColor: Palette.ink,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () {
                      store.restoreStreak();
                      ScaffoldMessenger.of(context)
                          .showSnackBar(SnackBar(content: Text('رجع الستريك: ${store.streak} يوم 🔥')));
                      Navigator.pop(c);
                    },
                    icon: const Icon(Icons.history_rounded),
                    label: Text(
                      'رجّع الستريك القديم (${lost.$1} يوم)',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    ),
  );
}
