import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'data/store.dart';
import 'services/feedback.dart';
import 'services/widget_sync.dart';
import 'ui/tasbih_screen.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF080503),
    ),
  );
  final store = await Store.open();
  final feedback = BeadFeedback();
  feedback.init();
  WidgetSync(store);
  runApp(TasbihApp(store: store, feedback: feedback));
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
