import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:material_ui/material_ui.dart';

import '../fmt.dart';
import '../theme.dart';

const kFast = Duration(milliseconds: 160);
const kMed = Duration(milliseconds: 320);
const kSlow = Duration(milliseconds: 700);
const kCurve = Curves.easeOutCubic;

/// Everything tappable goes through this: a soft press-down scale plus a
/// light haptic tick, so every button feels the same.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.onLongPress, this.scale = .95, this.haptic = true});
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final bool haptic;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (widget.onTap == null && widget.onLongPress == null) return;
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) HapticFeedback.lightImpact();
              widget.onTap!();
            },
      onLongPress: widget.onLongPress == null
          ? null
          : () {
              HapticFeedback.mediumImpact();
              widget.onLongPress!();
            },
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: _down ? const Duration(milliseconds: 90) : const Duration(milliseconds: 260),
        curve: _down ? Curves.easeOut : Curves.easeOutBack,
        child: AnimatedOpacity(
          opacity: _down ? .85 : 1,
          duration: kFast,
          child: widget.child,
        ),
      ),
    );
  }
}

class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(14), this.color, this.gradient});
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(
          color: gradient == null ? (color ?? C.panel) : null,
          gradient: gradient,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: C.line),
        ),
        child: child,
      );
}

class Label extends StatelessWidget {
  const Label(this.text, {super.key, this.color});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), style: color == null ? labelStyle : labelStyle.copyWith(color: color));
}

class Tag extends StatelessWidget {
  const Tag(this.text, this.color, {super.key});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: .15), borderRadius: BorderRadius.circular(6)),
        child: Text(text.toUpperCase(),
            style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: .6, color: color)),
      );
}

class Avatar extends StatelessWidget {
  const Avatar(this.initial, {super.key, this.color = C.redDeep, this.size = 36});
  final String initial;
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        child: Text(initial, style: TextStyle(fontWeight: FontWeight.w700, fontSize: size * .4, color: Colors.white)),
      );
}

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 44});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(size * .28),
          border: Border.all(color: C.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Transform.scale(scale: 1.18, child: Image.asset('assets/images/mark.png', fit: BoxFit.cover)),
      );
}

/// A number that rolls smoothly to its new value.
class RollingMoney extends StatelessWidget {
  const RollingMoney(this.value, {super.key, required this.style, this.format = money0});
  final double value;
  final TextStyle style;
  final String Function(double) format;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value),
        duration: const Duration(milliseconds: 900),
        curve: Curves.easeOutExpo,
        builder: (_, v, _) => Text(format(v), style: style),
      );
}

/// A row of options with a thumb that slides to the selected one.
class SlidePicker extends StatelessWidget {
  const SlidePicker({super.key, required this.options, required this.selected, required this.onChanged, this.labels});
  final List<String> options;
  final List<String>? labels;
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final i = options.indexOf(selected).clamp(0, options.length - 1);
    return Container(
      height: 42,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: C.ink,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: C.line),
      ),
      child: LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth / options.length;
        return Stack(children: [
          AnimatedPositioned(
            duration: kMed,
            curve: Curves.easeOutBack,
            left: w * i,
            top: 0,
            bottom: 0,
            width: w,
            child: Container(
              decoration: BoxDecoration(
                color: C.panel2,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: C.red.withValues(alpha: .55)),
              ),
            ),
          ),
          Row(children: [
            for (var k = 0; k < options.length; k++)
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onChanged(options[k]);
                  },
                  child: Center(
                    child: AnimatedDefaultTextStyle(
                      duration: kFast,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 12.5,
                        fontWeight: k == i ? FontWeight.w700 : FontWeight.w500,
                        color: k == i ? C.fg : C.mute,
                      ),
                      child: Text(labels?[k] ?? options[k], maxLines: 1, overflow: TextOverflow.fade, softWrap: false),
                    ),
                  ),
                ),
              ),
          ]),
        ]);
      }),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.on, required this.onTap, this.icon, this.color = C.fg});
  final String label;
  final bool on;
  final VoidCallback onTap;
  final IconData? icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        child: AnimatedContainer(
          duration: kMed,
          curve: kCurve,
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            color: on ? color : C.panel,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: on ? color : C.line),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[
              Icon(icon, size: 15, color: on ? C.ink : C.mute),
              const SizedBox(width: 6),
            ],
            AnimatedDefaultTextStyle(
              duration: kFast,
              style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 12,
                fontWeight: on ? FontWeight.w700 : FontWeight.w500,
                color: on ? C.ink : C.mute,
              ),
              child: Text(label),
            ),
          ]),
        ),
      );
}

class PillRow extends StatelessWidget {
  const PillRow({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 36,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: children.length,
          separatorBuilder: (_, _) => const SizedBox(width: 7),
          itemBuilder: (_, i) => children[i],
        ),
      );
}

/// Main action button: label → spinner → check mark, all animated.
class ActionButton extends StatefulWidget {
  const ActionButton({super.key, required this.label, required this.onPressed, this.icon, this.color = C.red, this.filled = true});
  final String label;
  final Future<void> Function()? onPressed;
  final IconData? icon;
  final Color color;
  final bool filled;

  @override
  State<ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<ActionButton> {
  int _phase = 0; // 0 idle, 1 working, 2 done

  Future<void> _run() async {
    if (_phase != 0 || widget.onPressed == null) return;
    setState(() => _phase = 1);
    try {
      await widget.onPressed!();
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() => _phase = 2);
      await Future.delayed(const Duration(milliseconds: 650));
    } catch (_) {
      HapticFeedback.heavyImpact();
      rethrow;
    } finally {
      if (mounted) setState(() => _phase = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fg = widget.filled ? Colors.white : widget.color;
    final child = switch (_phase) {
      1 => SizedBox(
          key: const ValueKey(1),
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2.4, color: fg),
        ),
      2 => Icon(Icons.check_rounded, key: const ValueKey(2), color: fg, size: 26)
          .animate()
          .scale(begin: const Offset(.4, .4), duration: kMed, curve: Curves.easeOutBack),
      _ => Row(key: const ValueKey(0), mainAxisSize: MainAxisSize.min, children: [
          if (widget.icon != null) ...[Icon(widget.icon, color: fg, size: 19), const SizedBox(width: 8)],
          Text(widget.label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: fg)),
        ]),
    };
    return Pressable(
      onTap: widget.onPressed == null ? null : () => _run().catchError((_) {}),
      child: AnimatedContainer(
        duration: kMed,
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: widget.filled
              ? (widget.onPressed == null ? widget.color.withValues(alpha: .4) : widget.color)
              : widget.color.withValues(alpha: .12),
          borderRadius: BorderRadius.circular(16),
          boxShadow: widget.filled && widget.onPressed != null
              ? [BoxShadow(color: widget.color.withValues(alpha: .35), blurRadius: 22, offset: const Offset(0, 8))]
              : null,
        ),
        child: AnimatedSwitcher(
          duration: kMed,
          transitionBuilder: (c, a) => FadeTransition(opacity: a, child: ScaleTransition(scale: a, child: c)),
          child: child,
        ),
      ),
    );
  }
}

/// Two-tap delete: the first tap arms it, the second confirms.
class DeleteButton extends StatefulWidget {
  const DeleteButton({super.key, required this.onConfirm});
  final Future<void> Function() onConfirm;
  @override
  State<DeleteButton> createState() => _DeleteButtonState();
}

class _DeleteButtonState extends State<DeleteButton> {
  bool _armed = false;
  Timer? _t;

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Pressable(
        onTap: () async {
          if (_armed) {
            _t?.cancel();
            HapticFeedback.heavyImpact();
            await widget.onConfirm();
            return;
          }
          setState(() => _armed = true);
          _t = Timer(const Duration(seconds: 3), () {
            if (mounted) setState(() => _armed = false);
          });
        },
        child: AnimatedContainer(
          duration: kMed,
          curve: kCurve,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _armed ? C.down : C.down.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(16),
          ),
          child: AnimatedSwitcher(
            duration: kFast,
            child: Text(
              _armed ? 'Tap again to delete' : 'Delete',
              key: ValueKey(_armed),
              style: TextStyle(fontWeight: FontWeight.w700, color: _armed ? Colors.white : C.down),
            ),
          ),
        ),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.sub});
  final IconData icon;
  final String title, sub;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
        child: Column(children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: C.red.withValues(alpha: .12), borderRadius: BorderRadius.circular(20)),
            child: Icon(icon, color: C.red, size: 30),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .moveY(begin: 0, end: -6, duration: 1400.ms, curve: Curves.easeInOut),
          const SizedBox(height: 16),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 6),
          Text(sub, textAlign: TextAlign.center, style: subStyle),
        ]),
      ).animate().fadeIn(duration: kMed);
}

/// Floating toast that slides in from the top and fades away.
void toast(BuildContext context, String message, {IconData icon = Icons.check_circle_rounded, Color color = C.up}) {
  final overlay = Overlay.of(context, rootOverlay: true);
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (ctx) => Positioned(
      top: MediaQuery.of(ctx).padding.top + 10,
      left: 16,
      right: 16,
      child: IgnorePointer(
        child: Material(
          color: Colors.transparent,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: C.panel2,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: color.withValues(alpha: .4)),
                boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 24, offset: Offset(0, 10))],
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: 10),
                Flexible(child: Text(message, style: const TextStyle(fontWeight: FontWeight.w600))),
              ]),
            )
                .animate()
                .slideY(begin: -1.2, duration: 420.ms, curve: Curves.easeOutBack)
                .fadeIn(duration: 200.ms)
                .then(delay: 1600.ms)
                .slideY(end: -1.2, duration: 300.ms, curve: Curves.easeInCubic)
                .fadeOut(duration: 300.ms),
          ),
        ),
      ),
    ),
  );
  overlay.insert(entry);
  Future.delayed(const Duration(milliseconds: 2500), entry.remove);
}

Future<T?> showSheet<T>(BuildContext context, Widget child) => showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: C.panel,
      barrierColor: Colors.black.withValues(alpha: .6),
      sheetAnimationStyle: const AnimationStyle(
        duration: Duration(milliseconds: 420),
        reverseDuration: Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
      ),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: child,
      ),
    );

/// Staggered entrance for list children.
extension Entrance on Widget {
  Widget enter(int i) => animate()
      .fadeIn(duration: 380.ms, delay: (40 * i.clamp(0, 10)).ms, curve: kCurve)
      .slideY(begin: .12, end: 0, duration: 420.ms, delay: (40 * i.clamp(0, 10)).ms, curve: kCurve);
}

class ScreenTitle extends StatelessWidget {
  const ScreenTitle({super.key, required this.title, required this.sub, this.trailing});
  final String title;
  final Widget sub;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title.toUpperCase(), style: display(24)),
              const SizedBox(height: 4),
              DefaultTextStyle(style: subStyle, child: sub),
            ]),
          ),
          ?trailing,
        ]),
      );
}
