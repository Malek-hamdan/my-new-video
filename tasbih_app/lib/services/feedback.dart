import 'dart:math';

import 'package:flutter/services.dart';
import 'package:vibration/vibration.dart';

/// Bead click sounds (native SoundPool, see TickPlayer.kt) and vibration.
class BeadFeedback {
  static const _channel = MethodChannel('tasbih/sound');
  static const _tickCount = 5;

  final _rand = Random();
  int _lastTick = 0;
  bool _amplitude = false;
  bool _vibrator = false;

  /// Turned off from the speaker button on the tasbih screen.
  bool soundOn = true;

  /// Why sound isn't working, if it isn't. Shown when the speaker button is long-pressed.
  String? soundError;

  Future<void> init() async {
    try {
      await _channel.invokeMethod('load', {
        'names': [for (var i = 1; i <= _tickCount; i++) 'tick_$i', 'separator'],
      });
    } catch (e) {
      soundError = '$e';
    }
    try {
      _vibrator = await Vibration.hasVibrator();
      _amplitude = await Vibration.hasAmplitudeControl();
    } catch (_) {
      // No vibration backend (tests).
    }
  }

  void _play(String name, double volume) {
    if (!soundOn) return;
    _channel
        .invokeMethod<bool>('play', {'name': name, 'volume': volume})
        .then((ok) {
          if (ok == false) soundError ??= 'sound "$name" not loaded';
        })
        .catchError((Object e) {
          soundError = '$e';
        });
  }

  /// [strength] 0..1 from the bead's impact speed.
  void tick(double strength, {bool separator = false}) {
    final s = strength.clamp(0.0, 1.0);
    if (separator) {
      _play('separator', 1.0);
    } else {
      // Random variant, never the same one twice in a row.
      _lastTick = (_lastTick + 1 + _rand.nextInt(_tickCount - 1)) % _tickCount;
      _play('tick_${_lastTick + 1}', 0.45 + 0.55 * s);
    }
    if (!_vibrator) return;
    if (separator) {
      Vibration.vibrate(duration: 38, amplitude: _amplitude ? 230 : -1);
    } else {
      Vibration.vibrate(duration: 12 + (8 * s).round(), amplitude: _amplitude ? (70 + 110 * s).round() : -1);
    }
  }

  void complete() {
    if (!_vibrator) return;
    Vibration.vibrate(pattern: [0, 40, 90, 40, 90, 70], intensities: [0, 200, 0, 200, 0, 255]);
  }
}
