// Exercise library. anim = cartoon key in anim.js (defaults to id).
// type: C = compound, I = isolation, Core. reps/rest = defaults when added to a day.
(function () {
  function x(id, name, muscle, type, reps, rest, opts) {
    var o = { id: id, name: name, muscle: muscle, type: type, reps: reps, rest: rest, search: name.toLowerCase() };
    for (var k in (opts || {})) o[k] = opts[k];
    return o;
  }
  var cap = { rpeCap: 8 };
  window.LIBRARY = [
    // Legs (quads)
    x("back-squat", "Barbell Back Squat", "Legs", "C", "6-8", 180, { rpeCap: 8, search: "barbell back squat", alt: "Hack Squat" }),
    x("front-squat", "Barbell Front Squat", "Legs", "C", "6-8", 180, cap),
    x("goblet-squat", "Goblet Squat", "Legs", "C", "8-12", 90),
    x("hack-squat", "Hack Squat", "Legs", "C", "8-12", 120),
    x("smith-squat", "Smith Machine Squat", "Legs", "C", "8-12", 120, { anim: "back-squat" }),
    x("leg-press", "Leg Press", "Legs", "C", "10-12", 120, { alt: "Goblet Squat" }),
    x("bulgarian-split-squat", "Bulgarian Split Squat", "Legs", "C", "8-10 per leg", 90, { alt: "Static Dumbbell Lunge" }),
    x("static-db-lunge", "Static Dumbbell Lunge", "Legs", "C", "8-10 per leg", 90, { anim: "lunge" }),
    x("walking-lunge", "Walking Lunge", "Legs", "C", "10 per leg", 90, { anim: "lunge" }),
    x("reverse-lunge", "Reverse Lunge", "Legs", "C", "8-10 per leg", 90, { anim: "lunge" }),
    x("step-up", "Dumbbell Step-Up", "Legs", "C", "8-10 per leg", 90),
    x("leg-extension", "Leg Extension", "Legs", "I", "12-15", 60),
    x("standing-calf-raise", "Standing Calf Raise", "Legs", "I", "12-15", 60, { anim: "calf-raise" }),
    x("seated-calf-raise", "Seated Calf Raise", "Legs", "I", "12-15", 60),

    // Glutes & hamstrings
    x("trap-bar-deadlift", "Trap Bar Deadlift", "Glutes & Hamstrings", "C", "6-8", 180, { rpeCap: 8, alt: "Dumbbell Romanian Deadlift" }),
    x("conventional-deadlift", "Conventional Deadlift", "Glutes & Hamstrings", "C", "5-6", 180, { rpeCap: 8, anim: "trap-bar-deadlift", search: "barbell deadlift" }),
    x("sumo-deadlift", "Sumo Deadlift", "Glutes & Hamstrings", "C", "5-6", 180, { rpeCap: 8, anim: "trap-bar-deadlift" }),
    x("romanian-deadlift", "Barbell Romanian Deadlift", "Glutes & Hamstrings", "C", "8-10", 120),
    x("db-romanian-deadlift", "Dumbbell Romanian Deadlift", "Glutes & Hamstrings", "C", "8-10", 120, { anim: "romanian-deadlift" }),
    x("good-morning", "Good Morning", "Glutes & Hamstrings", "C", "8-10", 120),
    x("barbell-hip-thrust", "Barbell Hip Thrust", "Glutes & Hamstrings", "C", "8-12", 120, { alt: "Glute Machine or Barbell Glute Bridge" }),
    x("glute-bridge", "Barbell Glute Bridge", "Glutes & Hamstrings", "C", "10-12", 90),
    x("lying-leg-curl", "Lying Leg Curl", "Glutes & Hamstrings", "I", "10-12", 90),
    x("seated-leg-curl", "Seated Leg Curl", "Glutes & Hamstrings", "I", "10-12", 90),
    x("back-extension", "Back Extension (45°)", "Glutes & Hamstrings", "I", "10-15", 60, { search: "45 degree back extension" }),
    x("kettlebell-swing", "Kettlebell Swing", "Glutes & Hamstrings", "C", "15-20", 60),

    // Chest
    x("bench-press", "Barbell Bench Press", "Chest", "C", "6-8", 150, { alt: "Dumbbell Bench Press" }),
    x("db-bench-press", "Dumbbell Bench Press", "Chest", "C", "8-10", 120, { anim: "bench-press" }),
    x("close-grip-bench", "Close-Grip Bench Press", "Chest", "C", "8-10", 120, { anim: "bench-press" }),
    x("incline-db-press", "Incline Dumbbell Press", "Chest", "C", "8-10", 120, { alt: "Smith Machine Incline Press" }),
    x("incline-barbell-press", "Incline Barbell Press", "Chest", "C", "6-8", 150, { anim: "incline-db-press" }),
    x("smith-incline-press", "Smith Machine Incline Press", "Chest", "C", "8-10", 120, { anim: "incline-db-press" }),
    x("machine-chest-press", "Machine Chest Press", "Chest", "C", "8-12", 120, { alt: "Dips" }),
    x("dips", "Dips", "Chest", "C", "8-12", 120, { search: "chest dips" }),
    x("push-up", "Push-Up", "Chest", "C", "10-20", 60),
    x("cable-crossover", "Cable Crossover", "Chest", "I", "12-15", 60),
    x("pec-deck", "Pec Deck Fly", "Chest", "I", "12-15", 60, { anim: "cable-crossover" }),
    x("db-fly", "Dumbbell Fly", "Chest", "I", "10-12", 60, { anim: "cable-crossover", search: "dumbbell chest fly" }),

    // Back
    x("lat-pulldown", "Lat Pulldown", "Back", "C", "8-10", 120, { alt: "Assisted Pull-Up" }),
    x("pull-up", "Pull-Up", "Back", "C", "6-10", 120),
    x("chin-up", "Chin-Up", "Back", "C", "6-10", 120, { anim: "pull-up" }),
    x("assisted-pull-up", "Assisted Pull-Up", "Back", "C", "8-10", 120, { anim: "pull-up", search: "assisted pull up machine" }),
    x("chest-supported-row", "Chest Supported Row", "Back", "C", "8-10", 120, { alt: "Seated Cable Row" }),
    x("seated-cable-row", "Seated Cable Row", "Back", "C", "8-12", 120),
    x("barbell-row", "Barbell Bent-Over Row", "Back", "C", "6-10", 120, { search: "barbell bent over row" }),
    x("t-bar-row", "T-Bar Row", "Back", "C", "8-10", 120, { anim: "barbell-row" }),
    x("one-arm-db-row", "One-Arm Dumbbell Row", "Back", "C", "10-12 per arm", 90, { alt: "One-Arm Cable Row" }),
    x("one-arm-cable-row", "One-Arm Cable Row", "Back", "C", "10-12 per arm", 90, { anim: "seated-cable-row" }),
    x("straight-arm-pulldown", "Straight-Arm Pulldown", "Back", "I", "12-15", 60),
    x("shrug", "Dumbbell Shrug", "Back", "I", "10-15", 60),

    // Shoulders
    x("seated-db-shoulder-press", "Seated Dumbbell Shoulder Press", "Shoulders", "C", "8-10", 120, { alt: "Machine Shoulder Press" }),
    x("machine-shoulder-press", "Machine Shoulder Press", "Shoulders", "C", "8-12", 120, { anim: "seated-db-shoulder-press" }),
    x("overhead-press", "Standing Barbell Overhead Press", "Shoulders", "C", "6-8", 150, { search: "barbell overhead press" }),
    x("arnold-press", "Arnold Press", "Shoulders", "C", "8-12", 90, { anim: "seated-db-shoulder-press" }),
    x("db-lateral-raise", "Dumbbell Lateral Raise", "Shoulders", "I", "12-15", 60),
    x("cable-lateral-raise", "Cable Lateral Raise", "Shoulders", "I", "12-15", 60),
    x("front-raise", "Dumbbell Front Raise", "Shoulders", "I", "10-12", 60),
    x("upright-row", "Upright Row", "Shoulders", "I", "10-12", 60),
    x("face-pull", "Face Pull", "Shoulders", "I", "12-15", 60, { search: "cable face pull" }),

    // Arms
    x("ez-bar-curl", "EZ Bar Curl", "Arms", "I", "10-12", 60),
    x("db-curl", "Dumbbell Curl", "Arms", "I", "10-12", 60, { anim: "curl-pushdown-superset" }),
    x("hammer-curl", "Hammer Curl", "Arms", "I", "10-12", 60, { anim: "curl-pushdown-superset" }),
    x("cable-curl", "Cable Curl", "Arms", "I", "10-15", 60, { anim: "ez-bar-curl" }),
    x("preacher-curl", "Preacher Curl", "Arms", "I", "10-12", 60),
    x("triceps-pushdown", "Rope Triceps Pushdown", "Arms", "I", "10-15", 60, { search: "rope triceps pushdown" }),
    x("overhead-cable-triceps", "Overhead Cable Triceps Extension", "Arms", "I", "10-12", 60),
    x("skull-crusher", "Skull Crusher", "Arms", "I", "10-12", 60, { search: "ez bar skull crusher" }),
    x("curl-pushdown-superset", "Dumbbell Curl + Rope Triceps Pushdown (superset)", "Arms", "I", "10-12", 60,
      { search: "dumbbell curl rope triceps pushdown superset", restLabel: "60 s after both" }),

    // Core
    x("dead-bug", "Dead Bug", "Core", "Core", "8 per side", 45, { search: "dead bug exercise" }),
    x("pallof-press", "Pallof Press", "Core", "Core", "10 per side", 45),
    x("plank", "Plank", "Core", "Core", "30-60 s", 45, { search: "forearm plank" }),
    x("crunch", "Crunch", "Core", "Core", "15-20", 45),
    x("cable-crunch", "Cable Crunch", "Core", "Core", "12-15", 60),
    x("lying-leg-raise", "Lying Leg Raise", "Core", "Core", "10-15", 45),
    x("hanging-knee-raise", "Hanging Knee Raise", "Core", "Core", "10-15", 60),
    x("hanging-leg-raise", "Hanging Leg Raise", "Core", "Core", "8-12", 60),
    x("mountain-climber", "Mountain Climber", "Core", "Core", "20 per side", 45),

    // Full body / conditioning
    x("farmers-walk", "Farmer's Walk", "Full body", "C", "30-40 m", 90, { search: "farmers walk" }),
    x("jumping-jack", "Jumping Jacks", "Full body", "Core", "30-45 s", 30, { search: "jumping jacks" })
  ];
  window.MUSCLES = ["Legs", "Glutes & Hamstrings", "Chest", "Back", "Shoulders", "Arms", "Core", "Full body"];
  window.LIB = {};
  window.LIBRARY.forEach(function (e) { window.LIB[e.id] = e; });
})();
