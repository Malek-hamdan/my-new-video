import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:sensors_plus/sensors_plus.dart';

/// Called when a bead lands on the counted pile. [count] is the new count in
/// the round, [strength] the impact speed mapped to 0..1.
typedef BeadLanded = void Function(int count, double strength);

class FallingBead {
  FallingBead(this.y, this.v);
  double y;
  double v;
}

/// Physics of a hanging string of beads.
///
/// Uncounted beads sit together in the upper part of the screen. A short
/// downward flick pulls the lowest of them off; once released it keeps falling
/// along the string under gravity until it knocks into the counted pile below.
class BeadPhysics extends ChangeNotifier {
  BeadPhysics({required this.total, required this.count});

  int total;
  int count;

  BeadLanded? onLanded;

  // Geometry, set from the painted size.
  double scale = 1;
  double get rx => 24 * scale;
  double get ry => 19.5 * scale;
  double get beadH => ry * 2 - 0.5;
  double topRest = 200; // centre of the lowest uncounted bead
  double pileTop = 340; // centre of the newest counted bead

  // Dynamic state.
  double grab = 0; // how far the lowest bead is pulled down
  double grabVel = 0;
  bool dragging = false;
  double topOffset = 0, topVel = 0; // upper cluster settling after a bead leaves
  double pileOffset = 0, pileVel = 0; // counted pile settling after a landing
  final List<FallingBead> falling = [];

  // Light direction from tilting the phone, -1..1.
  double lightX = 0, lightY = 0;
  double _targetLightX = 0, _targetLightY = 0;

  bool get settled =>
      falling.isEmpty &&
      !dragging &&
      grab.abs() < 0.05 &&
      grabVel.abs() < 1 &&
      topOffset.abs() < 0.05 &&
      topVel.abs() < 1 &&
      pileOffset.abs() < 0.05 &&
      pileVel.abs() < 1 &&
      (lightX - _targetLightX).abs() < 0.005 &&
      (lightY - _targetLightY).abs() < 0.005;

  int get remaining => total - count - falling.length;

  void layout(Size size) {
    scale = (size.width / 390).clamp(0.85, 1.3);
    topRest = size.height * 0.36;
    pileTop = topRest + math.max(beadH * 3.4, size.height * 0.30);
  }

  void reset({required int total, required int count}) {
    this.total = total;
    this.count = count;
    falling.clear();
    grab = grabVel = topOffset = topVel = pileOffset = pileVel = 0;
    dragging = false;
    notifyListeners();
  }

  void setLight(double x, double y) {
    _targetLightX = x.clamp(-1.0, 1.0);
    _targetLightY = y.clamp(-1.0, 1.0);
  }

  void dragStart() {
    if (remaining <= 0) return;
    dragging = true;
    grabVel = 0;
  }

  void dragUpdate(double dy) {
    if (!dragging) return;
    grab = (grab + dy).clamp(-beadH * 0.15, beadH * 0.95);
    // Pulled far enough: the bead slips from under the finger by itself.
    if (grab >= beadH * 0.9) _release(math.max(dy * 60, 260 * scale));
    notifyListeners();
  }

  void dragEnd(double velocity) {
    if (!dragging) return;
    dragging = false;
    if (grab > beadH * 0.22 || velocity > 180 * scale) {
      _release(math.max(velocity * 0.55, 140 * scale));
    }
    notifyListeners();
  }

  void _release(double v) {
    dragging = false;
    falling.add(FallingBead(topRest + topOffset + grab, v));
    grab = 0;
    grabVel = 0;
    // The beads above slide down one place to close the gap.
    topOffset -= beadH;
  }

  static double _spring(double x, double v, double k, double c) => -k * x - c * v;

  void step(double dt) {
    dt = dt.clamp(0.0, 1 / 30);
    final g = 2600 * scale;

    // Falling beads: the lowest first, each one stops on the one below it.
    falling.sort((a, b) => b.y.compareTo(a.y));
    for (var i = 0; i < falling.length; i++) {
      final b = falling[i];
      b.v += g * dt;
      b.y += b.v * dt;
      if (i == 0) {
        final landY = pileTop + pileOffset - beadH;
        if (b.y >= landY) {
          _land(b.v);
          falling.removeAt(0);
          i--;
        }
      } else {
        final ahead = falling[i - 1];
        if (b.y >= ahead.y - beadH) {
          b.y = ahead.y - beadH;
          b.v = math.min(b.v, ahead.v);
        }
      }
    }

    // Lowest uncounted bead springs back when not pulled far enough.
    if (!dragging) {
      grabVel += _spring(grab, grabVel, 520, 34) * dt;
      grab += grabVel * dt;
    }
    topVel += _spring(topOffset, topVel, 210, 26) * dt;
    topOffset += topVel * dt;
    pileVel += _spring(pileOffset, pileVel, 190, 15) * dt;
    pileOffset += pileVel * dt;

    lightX += (_targetLightX - lightX) * math.min(1, dt * 6);
    lightY += (_targetLightY - lightY) * math.min(1, dt * 6);
  }

  void _land(double v) {
    count++;
    // The new bead joins the pile where it hit; the pile then sinks one place,
    // pushed a little further by the impact so it rocks before settling.
    pileOffset -= beadH;
    pileVel += v * 0.18;
    final strength = (v / (1500 * scale)).clamp(0.0, 1.0);
    onLanded?.call(count, strength);
  }
}

/// The interactive string of beads.
class BeadString extends StatefulWidget {
  const BeadString({super.key, required this.physics});

  final BeadPhysics physics;

  @override
  State<BeadString> createState() => _BeadStringState();
}

class _BeadStringState extends State<BeadString> with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  Duration _last = Duration.zero;
  StreamSubscription<AccelerometerEvent>? _tilt;

  BeadPhysics get p => widget.physics;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
    p.addListener(_wake);
    try {
      _tilt = accelerometerEventStream(samplingPeriod: SensorInterval.uiInterval).listen(
        (e) {
          p.setLight(-e.x / 6, (e.y - 9) / 5);
          _wake();
        },
        onError: (_) {},
        cancelOnError: true,
      );
    } catch (_) {
      // No accelerometer: fixed light.
    }
  }

  void _wake() {
    if (!_ticker.isActive) {
      _last = Duration.zero;
      _ticker.start();
    }
  }

  void _onTick(Duration elapsed) {
    final dt = _last == Duration.zero ? 1 / 60 : (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    p.step(dt);
    setState(() {});
    if (p.settled) _ticker.stop();
  }

  @override
  void dispose() {
    _tilt?.cancel();
    p.removeListener(_wake);
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onVerticalDragStart: (_) {
        p.dragStart();
        _wake();
      },
      onVerticalDragUpdate: (d) => p.dragUpdate(d.delta.dy),
      onVerticalDragEnd: (d) => p.dragEnd(d.velocity.pixelsPerSecond.dy),
      onVerticalDragCancel: () => p.dragEnd(0),
      child: LayoutBuilder(
        builder: (context, c) {
          p.layout(c.biggest);
          return CustomPaint(size: c.biggest, painter: _BeadPainter(p));
        },
      ),
    );
  }
}

class _BeadPainter extends CustomPainter {
  _BeadPainter(this.p);

  final BeadPhysics p;

  static const _amber = [Color(0xFFFFF0C2), Color(0xFFF7C055), Color(0xFFD27A17), Color(0xFF8A3A08), Color(0xFF3D1603)];

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final bounds = Offset.zero & size;
    canvas.saveLayer(bounds, Paint());

    // String.
    canvas.drawLine(
      Offset(cx, -10),
      Offset(cx, size.height + 10),
      Paint()
        ..color = const Color(0xCCC9B28A)
        ..strokeWidth = 1.6 * p.scale,
    );

    // Uncounted beads, lowest first.
    final visibleTop = (p.topRest / p.beadH).ceil() + 2;
    final upper = math.min(p.remaining, visibleTop);
    for (var k = upper - 1; k >= 0; k--) {
      final y = p.topRest + p.topOffset - k * p.beadH + (k == 0 ? p.grab : 0);
      _bead(canvas, cx, y);
    }

    // Falling beads, with a short motion trail when fast.
    for (final b in p.falling) {
      final trail = (b.v / (900 * p.scale)).clamp(0.0, 1.0);
      for (var i = 4; i >= 1 && trail > 0.05; i--) {
        _bead(canvas, cx, b.y - i * b.v * 0.006, alpha: 0.10 * trail * (5 - i) / 4, shadow: false);
      }
      _bead(canvas, cx, b.y);
    }

    // Counted pile, newest on top, then the imam bead and tassel under the first.
    final pileY = p.pileTop + p.pileOffset;
    for (var j = 0; j < p.count; j++) {
      final y = pileY + j * p.beadH;
      if (y - p.beadH > size.height) break;
      _bead(canvas, cx, y);
    }
    final imamTop = pileY + (p.count - 0.5) * p.beadH + 1;
    if (imamTop < size.height + 10) _imam(canvas, cx, imamTop);

    // Fade the string out at both ends so it reads as continuing off screen.
    final fade = Paint()
      ..blendMode = BlendMode.dstIn
      ..shader = ui.Gradient.linear(
        Offset(0, 0),
        Offset(0, size.height),
        const [Color(0x00FFFFFF), Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0x00FFFFFF)],
        [0.0, 0.16, 0.9, 1.0],
      );
    canvas.drawRect(bounds, fade);
    canvas.restore();
  }

  void _bead(Canvas canvas, double cx, double y, {double alpha = 1, bool shadow = true}) {
    final rx = p.rx, ry = p.ry;
    final rect = Rect.fromCenter(center: Offset(cx, y), width: rx * 2, height: ry * 2);
    final a = (alpha * 255).round();
    if (shadow) {
      canvas.drawOval(
        rect.shift(Offset(5 * p.scale - p.lightX * 3, 7 * p.scale - p.lightY * 2)),
        Paint()
          ..color = Color.fromARGB((0.55 * a).round(), 0, 0, 0)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
      );
    }
    final lx = -0.24 + p.lightX * 0.18, ly = -0.36 + p.lightY * 0.14;
    canvas.drawOval(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: Alignment(lx, ly),
          radius: 0.75,
          colors: [for (final c in _amber) c.withAlpha(a)],
          stops: const [0, 0.18, 0.5, 0.8, 1],
        ).createShader(rect),
    );
    // Warm light passing through the resin, opposite the highlight.
    canvas.drawOval(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: Alignment(0.4 - p.lightX * 0.2, 0.6 - p.lightY * 0.15),
          radius: 0.45,
          colors: [Color.fromARGB((0.55 * a).round(), 0xFF, 0xB3, 0x47), const Color(0x00FFB347)],
        ).createShader(rect),
    );
    // Specular highlight.
    canvas.save();
    final hx = cx - rx * 0.35 + p.lightX * 4 * p.scale, hy = y - ry * 0.42 + p.lightY * 3 * p.scale;
    canvas.translate(hx, hy);
    canvas.rotate(-0.35);
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: rx * 0.6, height: ry * 0.42),
      Paint()
        ..color = Color.fromARGB((0.75 * a).round(), 255, 255, 255)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 0.8),
    );
    canvas.restore();
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx + rx * 0.38, y + ry * 0.48), width: rx * 0.34, height: ry * 0.2),
      Paint()..color = Color.fromARGB((0.3 * a).round(), 0xFF, 0xE0, 0xA0),
    );
    // String hole.
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx, y - ry + 1.5), width: 6 * p.scale, height: 2.8 * p.scale),
      Paint()..color = Color.fromARGB((0.7 * a).round(), 0x2A, 0x0F, 0x02),
    );
  }

  void _imam(Canvas canvas, double cx, double top) {
    final s = p.scale;
    final rect = Rect.fromLTWH(cx - 13 * s, top, 26 * s, 44 * s);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect.shift(Offset(5 * s, 6 * s)), Radius.circular(12 * s)),
      Paint()
        ..color = const Color(0x80000000)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(12 * s)),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment(-1 + p.lightX * 0.2, 0),
          end: Alignment(1 + p.lightX * 0.2, 0),
          colors: const [Color(0xFF4A1C04), Color(0xFFE39A2C), Color(0xFFFFE2A0), Color(0xFFC76D14), Color(0xFF3D1603)],
          stops: const [0, 0.3, 0.45, 0.6, 1],
        ).createShader(rect),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(cx - 6 * s, top + 4 * s, 3 * s, 34 * s), Radius.circular(1.5 * s)),
      Paint()..color = const Color(0x73FFFFFF),
    );
    // Tassel.
    final base = top + 44 * s;
    for (var i = -6; i <= 6; i++) {
      final path = Path()
        ..moveTo(cx, base)
        ..quadraticBezierTo(
          cx + i * 1.5 * s + p.lightX * 2,
          base + 19 * s,
          cx + i * 3.2 * s + p.lightX * 4,
          base + 40 * s,
        );
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4 * s
          ..color = i.isOdd ? const Color(0xD9A05A1C) : const Color(0xD9D89A45),
      );
    }
  }

  @override
  bool shouldRepaint(_BeadPainter old) => true;
}
