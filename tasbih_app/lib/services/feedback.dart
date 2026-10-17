import 'dart:math';

import 'package:audioplayers/audioplayers.dart';
import 'package:vibration/vibration.dart';

/// Bead click sounds and vibration.
class BeadFeedback {
  final _rand = Random();
  final List<AudioPlayer> _ticks = [];
  final List<AudioPlayer> _separators = [];
  int _next = 0;
  int _nextSep = 0;
  bool _amplitude = false;
  bool _ready = false;

  Future<void> init() async {
    try {
      // A short sound effect: don't pause the user's music or podcast.
      await AudioPlayer.global.setAudioContext(
        AudioContext(
          android: const AudioContextAndroid(
            contentType: AndroidContentType.sonification,
            usageType: AndroidUsageType.assistanceSonification,
            audioFocus: AndroidAudioFocus.none,
          ),
        ),
      );
      // Two players per variant so quick flicks can overlap.
      for (var round = 0; round < 2; round++) {
        for (var i = 1; i <= 5; i++) {
          _ticks.add(await _player('sounds/tick_$i.wav'));
        }
        _separators.add(await _player('sounds/separator.wav'));
      }
      _amplitude = await Vibration.hasAmplitudeControl();
      _ready = true;
    } catch (_) {
      // No audio/vibration backend (e.g. tests): stay silent.
    }
  }

  Future<AudioPlayer> _player(String asset) async {
    final p = AudioPlayer();
    await p.setPlayerMode(PlayerMode.lowLatency);
    await p.setReleaseMode(ReleaseMode.stop);
    await p.setSource(AssetSource(asset));
    return p;
  }

  /// [strength] 0..1 from the bead's impact speed.
  void tick(double strength, {bool separator = false}) {
    if (!_ready) return;
    final s = strength.clamp(0.0, 1.0);
    final AudioPlayer p;
    if (separator) {
      p = _separators[_nextSep++ % _separators.length];
    } else {
      // Random variant, never the same player twice in a row.
      _next = (_next + 1 + _rand.nextInt(_ticks.length - 1)) % _ticks.length;
      p = _ticks[_next];
    }
    final volume = separator ? 1.0 : 0.45 + 0.55 * s;
    p.stop().then((_) => p.setVolume(volume)).then((_) => p.resume()).catchError((_) {});

    if (separator) {
      Vibration.vibrate(duration: 38, amplitude: _amplitude ? 230 : -1);
    } else {
      Vibration.vibrate(duration: 12 + (8 * s).round(), amplitude: _amplitude ? (70 + 110 * s).round() : -1);
    }
  }

  void complete() {
    if (!_ready) return;
    Vibration.vibrate(pattern: [0, 40, 90, 40, 90, 70], intensities: [0, 200, 0, 200, 0, 255]);
  }
}
