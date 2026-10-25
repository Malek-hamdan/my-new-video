class Stage {
  const Stage(this.text, this.count);

  final String text;
  final int count;

  Map<String, dynamic> toJson() => {'text': text, 'count': count};

  factory Stage.fromJson(Map<String, dynamic> j) => Stage(j['text'] as String, j['count'] as int);
}

class Tasbih {
  const Tasbih({required this.id, required this.title, required this.stages, this.subtitle, this.custom = false});

  final String id;
  final String title;
  final String? subtitle;
  final List<Stage> stages;
  final bool custom;

  int get total => stages.fold(0, (sum, s) => sum + s.count);

  bool get multiStage => stages.length > 1;

  /// Index of the stage the next bead belongs to. Once the round is complete
  /// this stays on the last stage.
  int stageIndexAt(int count) {
    var end = 0;
    for (var i = 0; i < stages.length; i++) {
      end += stages[i].count;
      if (count < end) return i;
    }
    return stages.length - 1;
  }

  /// How many beads of [stageIndex] are done when [count] beads of the round are done.
  int doneInStage(int count, int stageIndex) {
    var start = 0;
    for (var i = 0; i < stageIndex; i++) {
      start += stages[i].count;
    }
    return (count - start).clamp(0, stages[stageIndex].count);
  }

  /// True when bead number [count] (1-based) is the last bead of a stage.
  bool endsStage(int count) {
    var end = 0;
    for (final s in stages) {
      end += s.count;
      if (count == end) return true;
    }
    return false;
  }

  Tasbih withCount(int count) =>
      Tasbih(id: id, title: title, subtitle: subtitle, custom: custom, stages: [Stage(stages.first.text, count)]);

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'subtitle': subtitle,
    'stages': stages.map((s) => s.toJson()).toList(),
  };

  factory Tasbih.fromJson(Map<String, dynamic> j) => Tasbih(
    id: j['id'] as String,
    title: j['title'] as String,
    subtitle: j['subtitle'] as String?,
    custom: true,
    stages: (j['stages'] as List).map((s) => Stage.fromJson(s as Map<String, dynamic>)).toList(),
  );
}

const zahraId = 'zahra';

const builtInTasbihat = <Tasbih>[
  Tasbih(
    id: zahraId,
    title: 'تسبيحة السيدة الزهراء',
    subtitle: 'سلام الله عليها',
    stages: [Stage('الله أكبر', 34), Stage('الحمد لله', 33), Stage('سبحان الله', 33)],
  ),
  Tasbih(id: 'salawat', title: 'اللهم صلِّ على محمد وآل محمد', stages: [Stage('اللهم صلِّ على محمد وآل محمد', 100)]),
  Tasbih(id: 'istighfar', title: 'أستغفر الله ربي وأتوب إليه', stages: [Stage('أستغفر الله ربي وأتوب إليه', 100)]),
  Tasbih(id: 'tahlil', title: 'لا إله إلا الله', stages: [Stage('لا إله إلا الله', 100)]),
  Tasbih(
    id: 'arba',
    title: 'التسبيحات الأربع',
    subtitle: 'سبحان الله والحمد لله ولا إله إلا الله والله أكبر',
    stages: [Stage('سبحان الله والحمد لله ولا إله إلا الله والله أكبر', 100)],
  ),
  Tasbih(
    id: 'hawqala',
    title: 'لا حول ولا قوة إلا بالله العلي العظيم',
    stages: [Stage('لا حول ولا قوة إلا بالله العلي العظيم', 100)],
  ),
  Tasbih(
    id: 'subhan_azim',
    title: 'سبحان الله وبحمده سبحان الله العظيم',
    stages: [Stage('سبحان الله وبحمده سبحان الله العظيم', 100)],
  ),
  Tasbih(
    id: 'yunusi',
    title: 'الذكر اليونسي',
    subtitle: 'لا إله إلا أنت سبحانك إني كنت من الظالمين',
    stages: [Stage('لا إله إلا أنت سبحانك إني كنت من الظالمين', 100)],
  ),
  Tasbih(id: 'hasbi', title: 'حسبي الله ونعم الوكيل', stages: [Stage('حسبي الله ونعم الوكيل', 100)]),
];
