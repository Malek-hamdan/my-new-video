import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'data/store.dart';
import 'services/feedback.dart';
import 'services/widget_sync.dart';
import 'ui/tasbih_screen.dart';
import 'ui/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Show any build error as readable text instead of a blank grey box.
  ErrorWidget.builder = (details) => _ErrorText('${details.exception}\n${details.stack}');
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]).ignore();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF080503),
    ),
  );
  // Draw a frame straight away; loading happens behind it.
  runApp(const _Bootstrap());
}

/// Loads saved state, then shows the app. If a step fails or hangs, the
/// error is shown on screen so it can be reported.
class _Bootstrap extends StatefulWidget {
  const _Bootstrap();

  @override
  State<_Bootstrap> createState() => _BootstrapState();
}

class _BootstrapState extends State<_Bootstrap> {
  Store? _store;
  BeadFeedback? _feedback;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    var step = 'storage';
    try {
      final store = await Store.open().timeout(const Duration(seconds: 8));
      step = 'sound';
      final feedback = BeadFeedback();
      // Sound and widgets must never keep the app from opening.
      feedback.init().timeout(const Duration(seconds: 8)).catchError((_) {});
      step = 'widgets';
      WidgetSync(store);
      setState(() {
        _store = store;
        _feedback = feedback;
      });
    } catch (e, st) {
      setState(() => _error = 'step: $step\n$e\n$st');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_store != null) return TasbihApp(store: _store!, feedback: _feedback!);
    if (_error != null) return _ErrorText(_error!);
    return const ColoredBox(color: Color(0xFF080503));
  }
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Directionality(
    textDirection: TextDirection.ltr,
    child: ColoredBox(
      color: const Color(0xFF080503),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Text(text, style: const TextStyle(color: Color(0xFFFFCF7A), fontSize: 12)),
        ),
      ),
    ),
  );
}

class TasbihApp extends StatelessWidget {
  const TasbihApp({super.key, required this.store, required this.feedback});

  final Store store;
  final BeadFeedback feedback;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'تسبيح',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: TasbihScreen(store: store, feedback: feedback),
    );
  }
}
