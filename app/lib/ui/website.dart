import '../models.dart';

import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../state.dart';
import '../theme.dart';
import 'forms.dart';
import 'widgets.dart';

/// The business website shown to everyone. A link saved by the owner in the
/// app (Team → Website) takes priority over this one.
const kBusinessWebsite = 'https://animewearlb.com/';

String siteOf(AppState app) => app.config.website.isNotEmpty ? app.config.website : kBusinessWebsite;

String normalizeUrl(String raw) {
  var s = raw.trim();
  if (s.isEmpty) return '';
  if (!s.startsWith('http://') && !s.startsWith('https://')) s = 'https://$s';
  return s;
}

String prettyUrl(String url) =>
    url.replaceFirst(RegExp(r'^https?://'), '').replaceFirst(RegExp(r'^www\.'), '').replaceFirst(RegExp(r'/$'), '');

Future<void> openWebsite(BuildContext context, String url) async {
  final uri = Uri.tryParse(url);
  final ok = uri != null && await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    toast(context, "Couldn't open the website", icon: Icons.error_rounded, color: C.down);
  }
}

/// One tap opens the business website. The owner sets the link; if none is
/// set yet the owner sees an "Add website" prompt and everyone else sees nothing.
class WebsiteButton extends StatelessWidget {
  const WebsiteButton({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final url = siteOf(app);
    if (url.isEmpty && !app.role.canManageTeam) return const SizedBox.shrink();
    final empty = url.isEmpty;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Pressable(
        scale: .97,
        onTap: () => empty ? showSheet(context, const WebsiteSheet()) : openWebsite(context, url),
        onLongPress: app.role.canManageTeam ? () => showSheet(context, const WebsiteSheet()) : null,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                C.red.withValues(alpha: empty ? .06 : .22),
                C.panel,
              ],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: C.red.withValues(alpha: empty ? .25 : .5)),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(color: C.red, borderRadius: BorderRadius.circular(12)),
                child: Icon(empty ? Icons.add_link_rounded : Icons.language_rounded, color: Colors.white, size: 21),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(empty ? 'Add your website' : 'Visit website', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(
                      empty ? 'Put your store link here for one-tap access' : prettyUrl(url),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: subStyle.copyWith(fontSize: 11.5),
                    ),
                  ],
                ),
              ),
              Icon(empty ? Icons.chevron_right_rounded : Icons.open_in_new_rounded, color: C.mute, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class WebsiteSheet extends StatefulWidget {
  const WebsiteSheet({super.key});
  @override
  State<WebsiteSheet> createState() => _WebsiteSheetState();
}

class _WebsiteSheetState extends State<WebsiteSheet> {
  late final c = TextEditingController(text: siteOf(AppScope.read(context)));

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return SheetFrame(
      title: 'Website',
      items: [
        const Text('Everyone on the team gets a button that opens this link.', style: subStyle),
        Field(
          'Link',
          TextField(
            controller: c,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: const InputDecoration(
              hintText: 'animewear.lb',
              prefixIcon: Icon(Icons.language_rounded, color: C.mute, size: 20),
            ),
          ),
        ),
      ],
      actions: [
        ActionButton(
          label: 'Save link',
          icon: Icons.check_rounded,
          onPressed: () async {
            final url = normalizeUrl(c.text);
            await guard(context, () => app.backend.setWebsite(url));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, url.isEmpty ? 'Website removed' : 'Website saved');
            }
          },
        ),
      ],
    );
  }
}
