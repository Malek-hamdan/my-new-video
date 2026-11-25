import 'package:material_ui/material_ui.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../fmt.dart';
import '../models.dart';
import '../state.dart';
import '../theme.dart';
import 'forms.dart';
import 'updater.dart';
import 'website.dart';
import 'widgets.dart';

class TeamScreen extends StatelessWidget {
  const TeamScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final me = app.me!;
    final owner = app.role.canManageTeam;
    final order = [Role.pending, Role.owner, Role.manager, Role.seller, Role.accountant];
    final people = [...app.users]..sort((a, b) {
        final r = order.indexOf(a.role).compareTo(order.indexOf(b.role));
        return r != 0 ? r : a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });
    final waiting = people.where((u) => u.role == Role.pending).length;

    final blocks = <Widget>[
      ScreenTitle(title: 'Team', sub: Text(owner ? 'Accounts & permissions' : 'Who works on the ledger')),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Panel(
          child: Row(children: [
            Avatar(me.initial, size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(me.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 2),
                Text(me.email, style: subStyle, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 6),
                Tag(me.role.label, me.role.color),
              ]),
            ),
            Pressable(
              onTap: () => app.backend.signOut(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(color: C.panel2, borderRadius: BorderRadius.circular(12)),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.logout_rounded, size: 16, color: C.mute),
                  SizedBox(width: 6),
                  Text('Sign out', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          ]),
        ),
      ),
      if (owner && waiting > 0)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Panel(
            color: C.gold.withValues(alpha: .08),
            child: Row(children: [
              const Icon(Icons.person_add_alt_1_rounded, color: C.gold),
              const SizedBox(width: 10),
              Expanded(child: Text('$waiting ${waiting == 1 ? 'person is' : 'people are'} waiting for access. Tap them below to choose a role.', style: const TextStyle(fontSize: 12.5))),
            ]),
          ),
        ),
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
        child: Row(children: [
          const Expanded(child: Label('Members')),
          if (owner) Text('Tap someone to change their role', style: subStyle.copyWith(fontSize: 11)),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Panel(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (final u in people)
              Pressable(
                scale: .98,
                onTap: owner && (u.id != app.config.ownerUid || app.demo) ? () => showSheet(context, RoleSheet(user: u)) : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))),
                  child: Row(children: [
                    Avatar(u.initial, color: u.role == Role.pending ? C.panel2 : C.redDeep),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(u.id == me.id ? '${u.name} (you)' : u.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(
                          u.role == Role.owner && u.id != app.config.ownerUid ? 'Everything except removing people' : u.role.blurb,
                          style: subStyle.copyWith(fontSize: 11.5),
                        ),
                      ]),
                    ),
                    Tag(
                      u.role == Role.pending ? 'Waiting' : (u.id == app.config.ownerUid ? 'Main owner' : u.role.label),
                      u.role.color,
                    ),
                  ]),
                ),
              ),
          ]),
        ),
      ),
      const Padding(padding: EdgeInsets.fromLTRB(18, 18, 18, 8), child: Label('What each role can do')),
      const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: _PermTable()),
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
        child: Text('Removing someone\'s access: main owner only.', style: subStyle.copyWith(fontSize: 11.5)),
      ),
      if (owner) ...[
        const Padding(padding: EdgeInsets.fromLTRB(18, 18, 18, 8), child: Label('Settings')),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Pressable(
            scale: .98,
            onTap: () => showSheet(context, const RateSheet()),
            child: Panel(
              child: Row(children: [
                const Icon(Icons.currency_exchange_rounded, color: C.gold),
                const SizedBox(width: 12),
                const Expanded(child: Text('Dollar rate', style: TextStyle(fontWeight: FontWeight.w600))),
                Text('1 \$ = ${lbp(app.config.lbpRate)}', style: mono(12, weight: FontWeight.w500)),
                const Icon(Icons.chevron_right_rounded, color: C.mute),
              ]),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          child: Pressable(
            scale: .98,
            onTap: () => showSheet(context, const WebsiteSheet()),
            child: Panel(
              child: Row(children: [
                const Icon(Icons.language_rounded, color: C.red),
                const SizedBox(width: 12),
                const Expanded(child: Text('Website', style: TextStyle(fontWeight: FontWeight.w600))),
                Flexible(
                  child: Text(siteOf(app).isEmpty ? 'Not set' : prettyUrl(siteOf(app)),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: subStyle.copyWith(fontSize: 12)),
                ),
                const Icon(Icons.chevron_right_rounded, color: C.mute),
              ]),
            ),
          ),
        ),
      ],
      const Padding(padding: EdgeInsets.fromLTRB(16, 18, 16, 0), child: _UpdateRow()),
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 18, 24, 0),
        child: Text(
          'New people install the app and create an account. They show up here as Waiting until the owner gives them a role.',
          textAlign: TextAlign.center,
          style: subStyle.copyWith(fontSize: 11.5),
        ),
      ),
      const SizedBox(height: 120),
    ];

    return ListView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      padding: EdgeInsets.zero,
      children: [for (var i = 0; i < blocks.length; i++) blocks[i].enter(i)],
    );
  }
}

class _PermTable extends StatelessWidget {
  const _PermTable();
  @override
  Widget build(BuildContext context) {
    const roles = [Role.owner, Role.manager, Role.seller, Role.accountant];
    final rows = <(String, bool Function(Role))>[
      ('Add sale', (r) => r.canAddSale),
      ('Edit / delete sale', (r) => r.canEditSale),
      ('Add payment', (r) => r.canEditPayments),
      ('See profit & payments', (r) => r.canSeeMoney),
      ('Edit capital', (r) => r.canEditCapital),
      ('Give roles', (r) => r.canManageTeam),
    ];
    Widget cell(Widget c, {bool left = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
          child: Align(alignment: left ? Alignment.centerLeft : Alignment.center, child: c),
        );
    return Panel(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      child: Table(
        columnWidths: const {0: FlexColumnWidth(2.2)},
        border: const TableBorder(horizontalInside: BorderSide(color: C.line)),
        children: [
          TableRow(children: [
            cell(const Label('Action'), left: true),
            for (final r in roles) cell(Text(r.label.substring(0, r == Role.accountant ? 4 : 3).toUpperCase(), style: labelStyle.copyWith(color: r.color))),
          ]),
          for (final row in rows)
            TableRow(children: [
              cell(Text(row.$1, style: subStyle.copyWith(fontSize: 12)), left: true),
              for (final r in roles)
                cell(row.$2(r)
                    ? const Icon(Icons.check_rounded, size: 16, color: C.up)
                    : const Text('—', style: TextStyle(color: Color(0xFF5A4F51)))),
            ]),
        ],
      ),
    );
  }
}

class RoleSheet extends StatelessWidget {
  const RoleSheet({super.key, required this.user});
  final AppUser user;
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final current = app.users.firstWhere((u) => u.id == user.id, orElse: () => user);
    // Only the main owner (the first account) can take someone's access away.
    final mainOwner = app.myId == app.config.ownerUid || app.demo;
    final options = [Role.manager, Role.seller, Role.accountant, Role.owner, if (mainOwner) Role.pending];
    return SheetFrame(
      title: current.name,
      actions: const [],
      items: [
        Text(current.email, style: subStyle),
        for (final r in options)
          Pressable(
            scale: .98,
            onTap: () async {
              await guard(context, () => app.backend.setRole(current.id, r));
              if (context.mounted) {
                Navigator.pop(context);
                toast(context, r == Role.pending ? '${current.name} has no access now' : '${current.name} is now ${r.label}');
              }
            },
            child: AnimatedContainer(
              duration: kMed,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: current.role == r ? r.color.withValues(alpha: .1) : C.ink,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: current.role == r ? r.color : C.line, width: current.role == r ? 1.5 : 1),
              ),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r == Role.pending ? 'Remove access' : r.label, style: TextStyle(fontWeight: FontWeight.w700, color: r == Role.pending ? C.down : C.fg)),
                    const SizedBox(height: 3),
                    Text(r == Role.pending ? 'They stay signed in but see nothing' : r.blurb, style: subStyle),
                  ]),
                ),
                AnimatedScale(
                  scale: current.role == r ? 1 : 0,
                  duration: kMed,
                  curve: Curves.easeOutBack,
                  child: Icon(Icons.check_circle_rounded, color: r.color),
                ),
              ]),
            ),
          ),
      ],
    );
  }
}

class RateSheet extends StatefulWidget {
  const RateSheet({super.key});
  @override
  State<RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends State<RateSheet> {
  late final c = TextEditingController(text: AppScope.read(context).config.lbpRate.round().toString());
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return SheetFrame(
      title: 'Dollar rate',
      items: [
        const Text('Used to convert amounts entered in Lebanese pounds.', style: subStyle),
        Field('LBP for 1 USD', Input(controller: c, number: true)),
      ],
      actions: [
        ActionButton(
          label: 'Save rate',
          icon: Icons.check_rounded,
          onPressed: () async {
            final v = parseNum(c.text);
            if (v <= 0) return;
            await guard(context, () => app.backend.setRate(v));
            if (context.mounted) {
              Navigator.pop(context);
              toast(context, 'Rate saved');
            }
          },
        ),
      ],
    );
  }
}

class _UpdateRow extends StatefulWidget {
  const _UpdateRow();
  @override
  State<_UpdateRow> createState() => _UpdateRowState();
}

class _UpdateRowState extends State<_UpdateRow> {
  String _version = '';
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((i) {
      if (mounted) setState(() => _version = '${i.version} (${i.buildNumber})');
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) => Pressable(
        scale: .98,
        onTap: _checking
            ? null
            : () async {
                setState(() => _checking = true);
                final u = await checkForUpdate();
                if (!mounted || !context.mounted) return;
                setState(() => _checking = false);
                if (u != null) {
                  showSheet(context, UpdateSheet(info: u));
                } else {
                  toast(context, "You're on the latest version");
                }
              },
        child: Panel(
          child: Row(children: [
            const Icon(Icons.system_update_rounded, color: C.up),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Check for updates', style: TextStyle(fontWeight: FontWeight.w600)),
                if (_version.isNotEmpty) Text('Version $_version', style: subStyle.copyWith(fontSize: 11.5)),
              ]),
            ),
            AnimatedSwitcher(
              duration: kFast,
              child: _checking
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: C.mute))
                  : const Icon(Icons.chevron_right_rounded, color: C.mute),
            ),
          ]),
        ),
      );
}
