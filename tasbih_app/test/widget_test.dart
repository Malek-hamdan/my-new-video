import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasbih/data/phrases.dart';
import 'package:tasbih/data/store.dart';
import 'package:tasbih/data/tasbihat.dart';
import 'package:tasbih/main.dart';
import 'package:tasbih/services/feedback.dart';
import 'package:tasbih/ui/bead_string.dart';

Future<Store> freshStore(DateTime now) async {
  SharedPreferences.setMockInitialValues({});
  final s = await Store.open();
  s.now = () => now;
  return s;
}

void main() {
  group('Tasbih al-Zahra stages', () {
    final z = builtInTasbihat.firstWhere((t) => t.id == zahraId);

    test('34 + 33 + 33 in the right order', () {
      expect(z.total, 100);
      expect(z.stages.map((s) => s.text), ['الله أكبر', 'الحمد لله', 'سبحان الله']);
      expect(z.stages.map((s) => s.count), [34, 33, 33]);
    });

    test('stage boundaries', () {
      expect(z.stageIndexAt(0), 0);
      expect(z.stageIndexAt(33), 0);
      expect(z.stageIndexAt(34), 1);
      expect(z.stageIndexAt(67), 2);
      expect(z.stageIndexAt(100), 2);
      expect(z.doneInStage(47, 1), 13);
      expect(z.endsStage(34), isTrue);
      expect(z.endsStage(67), isTrue);
      expect(z.endsStage(100), isTrue);
      expect(z.endsStage(35), isFalse);
    });
  });

  group('Store', () {
    test('progress is saved and survives reopening', () async {
      final s = await freshStore(DateTime(2026, 10, 17, 9));
      for (var i = 0; i < 47; i++) {
        s.addBead(zahraId);
      }
      await Future<void>.delayed(Duration.zero);
      final reopened = Store(await SharedPreferences.getInstance());
      expect(reopened.progressOf(zahraId), 47);
      expect(reopened.countOn(DateTime(2026, 10, 17)), 47);
    });

    test('a round never goes past its total and is marked done', () async {
      final s = await freshStore(DateTime(2026, 10, 17, 9));
      for (var i = 0; i < 105; i++) {
        s.addBead('tahlil');
      }
      expect(s.progressOf('tahlil'), 100);
      expect(s.doneToday, isTrue);
    });

    test('streak counts days with at least 33 beads, today pending', () async {
      var now = DateTime(2026, 10, 15, 10);
      final s = await freshStore(now);
      s.now = () => now;
      void beads(int n) {
        for (var i = 0; i < n; i++) {
          s.addBead('tahlil');
        }
      }

      beads(40); // the 15th
      now = DateTime(2026, 10, 16, 10);
      beads(33); // the 16th
      now = DateTime(2026, 10, 17, 10);
      expect(s.streak, 2, reason: 'today not done yet keeps yesterday\'s streak');
      beads(10);
      expect(s.streak, 2);
      beads(23);
      expect(s.streak, 3);
      now = DateTime(2026, 10, 19, 10);
      expect(s.streak, 3, reason: 'one missed day (the 18th) only pauses it');
      expect(s.streakPaused, isTrue);
      beads(33);
      expect(s.streak, 4);
      expect(s.streakPaused, isFalse);
      now = DateTime(2026, 10, 22, 10);
      expect(s.streak, 0, reason: 'missed the 20th and 21st');
    });

    test('a lost streak can be restored', () async {
      var now = DateTime(2026, 10, 10, 10);
      final s = await freshStore(now);
      s.now = () => now;
      for (var day = 10; day <= 14; day++) {
        now = DateTime(2026, 10, day, 10);
        for (var i = 0; i < 40; i++) {
          s.addBead('tahlil');
        }
      }
      now = DateTime(2026, 10, 18, 9); // missed the 15th..17th
      expect(s.streak, 0);
      final lost = s.lostStreak!;
      expect(lost.$1, 5);
      s.restoreStreak();
      expect(s.streak, 5);
      expect(s.lostStreak, isNull);
      for (var i = 0; i < 33; i++) {
        s.addBead('tahlil');
      }
      expect(s.streak, 6);
    });

    test('restoring joins the lost streak to a new one', () async {
      var now = DateTime(2026, 10, 1, 10);
      final s = await freshStore(now);
      s.now = () => now;
      void dayOf(int day) {
        now = DateTime(2026, 10, day, 10);
        for (var i = 0; i < 33; i++) {
          s.addBead('tahlil');
        }
      }

      for (final d in [1, 2, 3]) {
        dayOf(d);
      }
      dayOf(7); // came back after missing the 4th..6th
      expect(s.streak, 1);
      expect(s.lostStreak!.$1, 3);
      s.restoreStreak();
      expect(s.streak, 4);
    });

    test('custom tasbih and count change', () async {
      final s = await freshStore(DateTime(2026, 10, 17));
      s.addCustom('يا الله', 33);
      final c = s.tasbihat.last;
      expect(c.title, 'يا الله');
      expect(c.total, 33);
      s.setCount('istighfar', 70);
      expect(s.byId('istighfar').total, 70);
      s.deleteCustom(c.id);
      expect(s.tasbihat.any((t) => t.id == c.id), isFalse);
    });
  });

  group('Phrases', () {
    test('placeholders are filled', () {
      expect(Phrases.fill('باقيلك {left} حبة', left: 12), 'باقيلك 12 حبة');
    });

    test('phrase of the day walks the whole list before repeating', () {
      final seen = {
        for (var i = 0; i < Phrases.done.length; i++)
          Phrases.ofDay(Phrases.done, DateTime(2026, 1, 1).add(Duration(days: i))),
      };
      expect(seen.length, Phrases.done.length);
    });
  });

  group('Bead physics', () {
    BeadPhysics make() => BeadPhysics(total: 100, count: 0)..layout(const Size(390, 520));

    void run(BeadPhysics p, double seconds) {
      for (var t = 0.0; t < seconds; t += 1 / 60) {
        p.step(1 / 60);
      }
    }

    test('a short flick and release lets the bead fall and count', () {
      final p = make();
      var landed = 0;
      p.onLanded = (c, s) => landed = c;
      p.dragStart();
      p.dragUpdate(12);
      p.dragEnd(400);
      expect(p.falling, hasLength(1));
      run(p, 1.5);
      expect(landed, 1);
      expect(p.count, 1);
      expect(p.settled, isTrue);
    });

    test('a tiny nudge without speed springs back', () {
      final p = make();
      p.dragStart();
      p.dragUpdate(3);
      p.dragEnd(0);
      run(p, 1);
      expect(p.count, 0);
      expect(p.falling, isEmpty);
    });

    test('pulling far enough releases the bead without lifting the finger', () {
      final p = make();
      p.dragStart();
      p.dragUpdate(p.beadH);
      expect(p.falling, hasLength(1));
    });

    test('cannot pull beads past the end of the round', () {
      final p = BeadPhysics(total: 2, count: 2)..layout(const Size(390, 520));
      p.dragStart();
      p.dragUpdate(50);
      expect(p.falling, isEmpty);
    });
  });

  testWidgets('app opens on the tasbih screen', (tester) async {
    final s = await freshStore(DateTime(2026, 10, 17, 9));
    await tester.pumpWidget(TasbihApp(store: s, feedback: BeadFeedback()));
    await tester.pump();
    expect(find.text('تسبيحة الزهراء (ع)'), findsOneWidget);
    expect(find.text('الله أكبر'), findsOneWidget);
    expect(find.text('من 100'), findsOneWidget);
  });
}
