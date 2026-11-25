import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:material_ui/material_ui.dart';
import 'package:ota_update/ota_update.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../theme.dart';
import 'forms.dart';
import 'widgets.dart';

/// Where every build is published. version.json sits next to the APK.
const _base = 'https://github.com/Malek-hamdan/my-new-video/releases/download/animewear-latest';
const kApkUrl = '$_base/AnimeWear.apk';
const _versionUrl = '$_base/version.json';

class UpdateInfo {
  const UpdateInfo(this.version, this.build, this.notes);
  final String version;
  final int build;
  final String notes;
}

/// Returns the published build when it is newer than this one, else null.
/// Any network problem simply means "no update right now".
Future<UpdateInfo?> checkForUpdate() async {
  if (kIsWeb) return null;
  try {
    final info = await PackageInfo.fromPlatform();
    final current = int.tryParse(info.buildNumber) ?? 0;
    final res = await http
        .get(Uri.parse('$_versionUrl?t=${DateTime.now().millisecondsSinceEpoch}'))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) return null;
    final m = jsonDecode(res.body) as Map<String, dynamic>;
    final build = (m['build'] as num?)?.toInt() ?? 0;
    if (build <= current) return null;
    return UpdateInfo('${m['version'] ?? ''}', build, '${m['notes'] ?? ''}');
  } catch (_) {
    return null;
  }
}

/// Checks once when the main screen opens and offers the update in a sheet.
class UpdateWatcher extends StatefulWidget {
  const UpdateWatcher({super.key, required this.child});
  final Widget child;
  @override
  State<UpdateWatcher> createState() => _UpdateWatcherState();
}

class _UpdateWatcherState extends State<UpdateWatcher> {
  static bool _askedThisLaunch = false;

  @override
  void initState() {
    super.initState();
    if (_askedThisLaunch) return;
    _askedThisLaunch = true;
    Future.delayed(const Duration(milliseconds: 1500), () async {
      final u = await checkForUpdate();
      if (u != null && mounted) showSheet(context, UpdateSheet(info: u));
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class UpdateSheet extends StatefulWidget {
  const UpdateSheet({super.key, required this.info});
  final UpdateInfo info;
  @override
  State<UpdateSheet> createState() => _UpdateSheetState();
}

class _UpdateSheetState extends State<UpdateSheet> {
  StreamSubscription<OtaEvent>? _sub;
  double? _progress; // null = not started
  String? _error;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() {
      _progress = 0;
      _error = null;
    });
    final done = Completer<void>();
    try {
      _sub = OtaUpdate().execute(kApkUrl, destinationFilename: 'animewear-update.apk').listen((e) {
        if (!mounted) return;
        switch (e.status) {
          case OtaStatus.DOWNLOADING:
            setState(() => _progress = (double.tryParse(e.value ?? '') ?? 0) / 100);
          case OtaStatus.INSTALLING:
          case OtaStatus.INSTALLATION_DONE:
            setState(() => _progress = 1);
            if (!done.isCompleted) done.complete();
          case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
            setState(() {
              _progress = null;
              _error = 'Allow "Install unknown apps" for animewear.lb, then tap Update again.';
            });
            if (!done.isCompleted) done.completeError('permission');
          default:
            setState(() {
              _progress = null;
              _error = 'The update could not be downloaded. Check your internet and try again.';
            });
            if (!done.isCompleted) done.completeError('${e.value}');
        }
      }, onError: (Object err) {
        if (!mounted) return;
        setState(() {
          _progress = null;
          _error = 'The update could not be downloaded. Check your internet and try again.';
        });
        if (!done.isCompleted) done.completeError(err);
      });
      await done.future;
    } catch (_) {
      HapticFeedback.heavyImpact();
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _progress;
    return SheetFrame(
      title: 'Update ready',
      items: [
        Row(children: [
          const LogoMark(size: 52),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Version ${widget.info.version}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 3),
              const Text('A new version of the app is available.', style: subStyle),
            ]),
          ),
        ]),
        if (widget.info.notes.isNotEmpty)
          Panel(child: Text(widget.info.notes, style: const TextStyle(fontSize: 13, height: 1.45))),
        AnimatedSize(
          duration: kMed,
          curve: kCurve,
          child: p == null
              ? const SizedBox(width: double.infinity)
              : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Label(p >= 1 ? 'Opening installer' : 'Downloading'),
                    const Spacer(),
                    Text('${(p * 100).round()}%', style: mono(12)),
                  ]),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(end: p),
                      duration: kMed,
                      builder: (_, v, _) => LinearProgressIndicator(value: v, minHeight: 8, color: C.red, backgroundColor: C.ink),
                    ),
                  ),
                ]),
        ),
        if (_error != null) Text(_error!, style: const TextStyle(color: C.down, fontSize: 12.5)),
        const Text('Android will ask you to confirm. Your data stays safe online.', style: subStyle),
      ],
      actions: [
        ActionButton(label: 'Update now', icon: Icons.system_update_rounded, onPressed: p == null ? _start : null),
        Pressable(
          onTap: () => Navigator.pop(context),
          child: const Padding(
            padding: EdgeInsets.all(10),
            child: Center(child: Text('Later', style: TextStyle(color: C.mute, fontWeight: FontWeight.w600))),
          ),
        ),
      ],
    );
  }
}
