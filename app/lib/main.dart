import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'backend.dart';
import 'models.dart';
import 'firebase_config.dart';
import 'state.dart';
import 'theme.dart';
import 'ui/auth.dart';
import 'ui/shell.dart';
import 'ui/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  var demo = const bool.fromEnvironment('DEMO');
  Backend? backend;
  if (!demo) {
    try {
      if (firebaseOptions == null) throw StateError('Firebase not configured yet');
      await Firebase.initializeApp(options: firebaseOptions);
      backend = FirebaseBackend();
    } catch (_) {
      demo = true;
    }
  }
  backend ??= DemoBackend();
  runApp(LedgerApp(state: AppState(backend, demo: demo)));
}

class LedgerApp extends StatelessWidget {
  const LedgerApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) => AppScope(
        state: state,
        child: MaterialApp(
          title: 'animewear.lb',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(),
          home: const _Root(),
        ),
      );
}

class _Root extends StatelessWidget {
  const _Root();
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final Widget page;
    final String key;
    if (!app.authReady) {
      key = 'splash';
      page = const Scaffold(body: Center(child: LogoMark(size: 96)));
    } else if (app.me == null) {
      key = 'auth';
      page = const AuthScreen();
    } else if (!app.role.active) {
      key = 'wait';
      page = const WaitingScreen();
    } else {
      key = 'shell';
      page = const Shell();
    }
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 480),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, a) => FadeTransition(
        opacity: a,
        child: ScaleTransition(scale: Tween(begin: 1.03, end: 1.0).animate(a), child: child),
      ),
      child: KeyedSubtree(key: ValueKey(key), child: page),
    );
  }
}
