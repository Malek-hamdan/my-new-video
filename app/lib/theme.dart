
import 'package:material_ui/material_ui.dart';

/// Brand palette taken from the animewear.lb logo: black, crimson, white.
class C {
  static const ink = Color(0xFF0B0A0B);
  static const panel = Color(0xFF171415);
  static const panel2 = Color(0xFF241D1F);
  static const line = Color(0xFF332A2C);
  static const fg = Color(0xFFF6F2F2);
  static const mute = Color(0xFFA89C9D);
  static const red = Color(0xFFE01E2B);
  static const redDeep = Color(0xFF7A1016);
  static const gold = Color(0xFFFFC845);
  static const up = Color(0xFF3DDC97);
  static const down = Color(0xFFFF6B5E);
  static const silver = Color(0xFFD9D2D2);
}

const kDisplay = 'DelaGothic';
const kMono = 'JetBrainsMono';

TextStyle display(double size, {Color color = C.fg}) =>
    TextStyle(fontFamily: kDisplay, fontSize: size, color: color, height: 1.1, letterSpacing: .4);

TextStyle mono(double size, {FontWeight weight = FontWeight.w700, Color color = C.fg}) => TextStyle(
      fontFamily: kMono,
      fontSize: size,
      fontWeight: weight,
      color: color,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

const labelStyle = TextStyle(
  fontSize: 10.5,
  fontWeight: FontWeight.w700,
  letterSpacing: 1.1,
  color: C.mute,
);

const subStyle = TextStyle(fontSize: 12, color: C.mute);

ThemeData buildTheme() {
  OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c, width: w),
      );
  return ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    fontFamily: 'Inter',
    scaffoldBackgroundColor: C.ink,
    canvasColor: C.ink,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    colorScheme: const ColorScheme.dark(
      primary: C.red,
      onPrimary: Colors.white,
      secondary: C.gold,
      surface: C.panel,
      onSurface: C.fg,
      error: C.down,
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: C.red,
      selectionColor: C.red.withValues(alpha: .35),
      selectionHandleColor: C.red,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.ink,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      hintStyle: const TextStyle(color: Color(0xFF6E6365), fontSize: 14),
      border: border(C.line),
      enabledBorder: border(C.line),
      focusedBorder: border(C.red, 1.6),
      errorBorder: border(C.down),
      focusedErrorBorder: border(C.down, 1.6),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: C.panel,
      modalBackgroundColor: C.panel,
      surfaceTintColor: Colors.transparent,
      showDragHandle: false,
    ),
    datePickerTheme: const DatePickerThemeData(
      backgroundColor: C.panel,
      surfaceTintColor: Colors.transparent,
    ),
    timePickerTheme: const TimePickerThemeData(
      backgroundColor: C.panel,
    ),
  );
}
