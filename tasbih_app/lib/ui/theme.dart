import 'package:flutter/material.dart';

class Palette {
  static const cream = Color(0xFFF3E6CF);
  static const creamBright = Color(0xFFFFF1D8);
  static const muted = Color(0xFFA8927A);
  static const gold = Color(0xFFD9A441);
  static const flame = Color(0xFFFFCF7A);
  static const green = Color(0xFF7FCF7A);
  static const card = Color(0x0FFFEBC8);
  static const line = Color(0x1FFFDCAA);
  static const ink = Color(0xFF1A0F07);
}

const kufi = 'Kufi';
const amiri = 'Amiri';

ThemeData buildTheme() => ThemeData(
  brightness: Brightness.dark,
  fontFamily: kufi,
  scaffoldBackgroundColor: const Color(0xFF080503),
  colorScheme: ColorScheme.fromSeed(
    seedColor: Palette.gold,
    brightness: Brightness.dark,
    primary: Palette.gold,
    surface: const Color(0xFF1D140D),
  ),
  textTheme: const TextTheme().apply(bodyColor: Palette.cream, displayColor: Palette.cream),
);

/// Warm dark background shared by all screens.
class WarmBackground extends StatelessWidget {
  const WarmBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: RadialGradient(
        center: Alignment(0, -0.1),
        radius: 1.1,
        colors: [Color(0xFF2B1A0F), Color(0xFF160D07), Color(0xFF080503)],
        stops: [0, 0.55, 1],
      ),
    ),
    child: child,
  );
}

class Chip2 extends StatelessWidget {
  const Chip2({super.key, required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Palette.card,
    shape: const StadiumBorder(side: BorderSide(color: Palette.line)),
    child: InkWell(
      customBorder: const StadiumBorder(),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
        child: DefaultTextStyle.merge(style: const TextStyle(fontSize: 13), child: child),
      ),
    ),
  );
}

class StreakChip extends StatelessWidget {
  const StreakChip({super.key, required this.days, this.long = false});

  final int days;
  final bool long;

  @override
  Widget build(BuildContext context) => Chip2(
    child: Text.rich(
      TextSpan(
        children: [
          const TextSpan(text: '🔥 '),
          TextSpan(
            text: '$days',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          TextSpan(text: long ? ' يوم متتالي' : ' يوم'),
        ],
      ),
      style: const TextStyle(color: Palette.flame, fontWeight: FontWeight.w700),
    ),
  );
}
