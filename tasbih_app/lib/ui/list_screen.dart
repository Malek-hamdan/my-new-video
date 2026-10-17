import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/store.dart';
import '../data/tasbihat.dart';
import 'theme.dart';

class ListScreen extends StatelessWidget {
  const ListScreen({super.key, required this.store});

  final Store store;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: WarmBackground(
        child: SafeArea(
          child: ListenableBuilder(
            listenable: store,
            builder: (context, _) {
              final all = store.tasbihat;
              final featured = all.firstWhere((t) => t.id == zahraId);
              final rest = all.where((t) => t.id != zahraId).toList();
              return CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(8, 4, 16, 0),
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: () => Navigator.pop(context),
                            icon: const Icon(Icons.arrow_forward, color: Palette.cream),
                          ),
                          const Spacer(),
                          StreakChip(days: store.streak, long: true),
                        ],
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(20, 8, 20, 0),
                      child: Text('تسبيحاتي', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        'اختار شو بدك تسبّح، وكل تسبيحة بتحفظ وين وصلت. ضغطة مطوّلة للخيارات.',
                        style: TextStyle(fontSize: 12, color: Palette.muted),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(child: _TodayCard(store: store)),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverToBoxAdapter(
                      child: _Tile(store: store, tasbih: featured, featured: true),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 1.15,
                      ),
                      delegate: SliverChildListDelegate([
                        for (final t in rest) _Tile(store: store, tasbih: t),
                        _AddTile(store: store),
                      ]),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.store});

  final Store store;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: const LinearGradient(colors: [Color(0x2ED9A441), Color(0x0AD9A441)]),
        border: Border.all(color: const Color(0x4DD9A441)),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('مجموع اليوم', style: TextStyle(fontSize: 12, color: Palette.muted)),
              Text(
                '${store.todayCount}',
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: Color(0xFFFFDCA0)),
              ),
            ],
          ),
          const Spacer(),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text('أسبوعك', style: TextStyle(fontSize: 12, color: Palette.muted)),
              const SizedBox(height: 6),
              Row(
                textDirection: TextDirection.ltr,
                children: [
                  for (final d in store.week)
                    Container(
                      width: 9,
                      height: 9,
                      margin: const EdgeInsets.symmetric(horizontal: 2.5),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: d ? Palette.flame : null,
                        border: Border.all(color: Palette.flame),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.store, required this.tasbih, this.featured = false});

  final Store store;
  final Tasbih tasbih;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final t = tasbih;
    final count = store.progressOf(t.id);
    final complete = count >= t.total;
    final stage = t.stageIndexAt(count);
    final where = t.multiStage && !complete
        ? '${t.stages[stage].text} ${t.doneInStage(count, stage)}/${t.stages[stage].count}'
        : '$count${complete ? ' ✓' : ''}';
    final selected = store.current.id == t.id;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          store.select(t.id);
          Navigator.pop(context);
        },
        onLongPress: () => _options(context),
        child: Ink(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: featured ? null : Palette.card,
            gradient: featured
                ? const LinearGradient(
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                    colors: [Color(0x29D9A441), Color(0x1F783C14)],
                  )
                : null,
            border: Border.all(
              color: selected
                  ? Palette.gold
                  : featured
                  ? const Color(0x59D9A441)
                  : Palette.line,
              width: selected ? 1.4 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t.title,
                maxLines: featured ? 1 : 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: amiri,
                  fontSize: featured ? 23 : (t.title.length > 24 ? 17 : 20),
                  height: 1.35,
                  color: Palette.creamBright,
                ),
              ),
              if (t.subtitle != null)
                Text(
                  t.subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10.5, color: featured ? Palette.gold : Palette.muted),
                ),
              if (featured)
                Text(
                  t.stages.map((s) => '${s.text} ${s.count}').join(' · '),
                  style: const TextStyle(fontSize: 10.5, color: Palette.muted),
                ),
              featured ? const SizedBox(height: 10) : const Spacer(),
              Row(
                children: [
                  const Text('وصلت: ', style: TextStyle(fontSize: 11, color: Palette.muted)),
                  Expanded(
                    child: Text(
                      where,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                  Text('/${t.total}', style: const TextStyle(fontSize: 11, color: Palette.muted)),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: t.total == 0 ? 0 : count / t.total,
                  minHeight: 4,
                  backgroundColor: const Color(0x14FFFFFF),
                  color: complete ? Palette.green : Palette.gold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _options(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF1D140D),
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.restart_alt),
              title: const Text('صفّر العدّاد'),
              onTap: () {
                store.resetProgress(tasbih.id);
                Navigator.pop(c);
              },
            ),
            if (!tasbih.multiStage)
              ListTile(
                leading: const Icon(Icons.edit),
                title: const Text('غيّر العدد'),
                onTap: () async {
                  Navigator.pop(c);
                  final n = await _askCount(context, tasbih.total);
                  if (n != null) store.setCount(tasbih.id, n);
                },
              ),
            if (tasbih.custom)
              ListTile(
                leading: const Icon(Icons.delete_outline),
                title: const Text('احذف التسبيحة'),
                onTap: () {
                  store.deleteCustom(tasbih.id);
                  Navigator.pop(c);
                },
              ),
          ],
        ),
      ),
    );
  }
}

Future<int?> _askCount(BuildContext context, int initial) {
  final ctl = TextEditingController(text: '$initial');
  return showDialog<int>(
    context: context,
    builder: (c) => AlertDialog(
      title: const Text('العدد'),
      content: TextField(
        controller: ctl,
        autofocus: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      ),
      actions: [
        TextButton(
          onPressed: () {
            final n = int.tryParse(ctl.text);
            Navigator.pop(c, n != null && n > 0 && n <= 10000 ? n : null);
          },
          child: const Text('تمام'),
        ),
      ],
    ),
  );
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.store});

  final Store store;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => _add(context),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Palette.line),
        ),
        alignment: Alignment.center,
        child: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('+', style: TextStyle(fontSize: 30, color: Palette.gold, height: 1)),
            SizedBox(height: 6),
            Text('أضف تسبيحة', style: TextStyle(fontSize: 13, color: Palette.muted)),
            Text('النص + العدد', style: TextStyle(fontSize: 10.5, color: Palette.muted)),
          ],
        ),
      ),
    );
  }

  Future<void> _add(BuildContext context) async {
    final text = TextEditingController();
    final count = TextEditingController(text: '100');
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('تسبيحة جديدة'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: text,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'شو بدك تسبّح؟'),
            ),
            TextField(
              controller: count,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(labelText: 'العدد'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('أضف')),
        ],
      ),
    );
    final n = int.tryParse(count.text);
    if (ok == true && text.text.trim().isNotEmpty && n != null && n > 0 && n <= 10000) {
      store.addCustom(text.text.trim(), n);
    }
  }
}
