// Program data — copied from the provided table. Edit ONLY this file to add/fix exercises.
// type: "C" = compound, "I" = isolation, "Core" = core (treated like compound for RPE)
// s12 = sets in weeks 1-2, s3 = sets in weeks 3+
// rest = seconds (used by the timer), restLabel = what's displayed
// rpeCap = maximum RPE in any week (back squat & trap bar deadlift)
// search = English name used to build the YouTube search link
window.PROGRAM = {
  mon: [
    { id: "back-squat", name: "Barbell Back Squat", search: "barbell back squat", type: "C", s12: 2, s3: 3, reps: "6-8", rest: 180, restLabel: "3 min", alt: "Hack Squat", rpeCap: 8 },
    { id: "bench-press", name: "Barbell Bench Press", search: "barbell bench press", type: "C", s12: 2, s3: 3, reps: "6-8", rest: 150, restLabel: "2.5 min", alt: "Dumbbell Bench Press" },
    { id: "chest-supported-row", name: "Chest Supported Row", search: "chest supported row", type: "C", s12: 2, s3: 3, reps: "8-10", rest: 120, restLabel: "2 min", alt: "Seated Cable Row" },
    { id: "lying-leg-curl", name: "Lying Leg Curl", search: "lying leg curl", type: "I", s12: 2, s3: 3, reps: "10-12", rest: 90, restLabel: "90 s", alt: null },
    { id: "db-lateral-raise", name: "Dumbbell Lateral Raise", search: "dumbbell lateral raise", type: "I", s12: 2, s3: 3, reps: "12-15", rest: 60, restLabel: "60 s", alt: null },
    { id: "ez-bar-curl", name: "EZ Bar Curl", search: "EZ bar curl", type: "I", s12: 2, s3: 2, reps: "10-12", rest: 60, restLabel: "60 s", alt: null },
    { id: "dead-bug", name: "Dead Bug", search: "dead bug exercise", type: "Core", s12: 2, s3: 2, reps: "8 per side", rest: 45, restLabel: "45 s", alt: null }
  ],
  wed: [
    { id: "trap-bar-deadlift", name: "Trap Bar Deadlift", search: "trap bar deadlift", type: "C", s12: 2, s3: 3, reps: "6-8", rest: 180, restLabel: "3 min", alt: "Dumbbell Romanian Deadlift", rpeCap: 8 },
    { id: "seated-db-shoulder-press", name: "Seated Dumbbell Shoulder Press", search: "seated dumbbell shoulder press", type: "C", s12: 2, s3: 3, reps: "8-10", rest: 120, restLabel: "2 min", alt: "Machine Shoulder Press" },
    { id: "lat-pulldown", name: "Lat Pulldown", search: "lat pulldown", type: "C", s12: 2, s3: 3, reps: "8-10", rest: 120, restLabel: "2 min", alt: "Assisted Pull-Up" },
    { id: "incline-db-press", name: "Incline Dumbbell Press", search: "incline dumbbell press", type: "C", s12: 2, s3: 3, reps: "8-10", rest: 120, restLabel: "2 min", alt: "Smith Machine Incline Press" },
    { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", search: "bulgarian split squat", type: "C", s12: 2, s3: 2, reps: "8-10 per leg", rest: 90, restLabel: "90 s", alt: "Static Dumbbell Lunge" },
    { id: "overhead-cable-triceps", name: "Overhead Cable Triceps Extension", search: "overhead cable triceps extension", type: "I", s12: 2, s3: 3, reps: "10-12", rest: 60, restLabel: "60 s", alt: null },
    { id: "pallof-press", name: "Pallof Press", search: "pallof press", type: "Core", s12: 2, s3: 2, reps: "10 per side", rest: 45, restLabel: "45 s", alt: null }
  ],
  fri: [
    { id: "leg-press", name: "Leg Press", search: "leg press", type: "C", s12: 2, s3: 3, reps: "10-12", rest: 120, restLabel: "2 min", alt: "Goblet Squat" },
    { id: "machine-chest-press", name: "Machine Chest Press", search: "machine chest press", type: "C", s12: 2, s3: 3, reps: "8-12", rest: 120, restLabel: "2 min", alt: "Dips" },
    { id: "one-arm-db-row", name: "One-Arm Dumbbell Row", search: "one arm dumbbell row", type: "C", s12: 2, s3: 3, reps: "10-12 per arm", rest: 90, restLabel: "90 s", alt: "One-Arm Cable Row" },
    { id: "barbell-hip-thrust", name: "Barbell Hip Thrust", search: "barbell hip thrust", type: "C", s12: 2, s3: 3, reps: "8-12", rest: 120, restLabel: "2 min", alt: "Glute Machine or Barbell Glute Bridge" },
    { id: "face-pull", name: "Face Pull", search: "cable face pull", type: "I", s12: 2, s3: 3, reps: "12-15", rest: 60, restLabel: "60 s", alt: null },
    { id: "cable-lateral-raise", name: "Cable Lateral Raise", search: "cable lateral raise", type: "I", s12: 2, s3: 3, reps: "12-15", rest: 60, restLabel: "60 s", alt: null },
    { id: "curl-pushdown-superset", name: "Dumbbell Curl + Rope Triceps Pushdown (superset)", search: "dumbbell curl rope triceps pushdown superset", type: "I", s12: 2, s3: 3, reps: "10-12", rest: 60, restLabel: "60 s after both", alt: null },
    { id: "hanging-knee-raise", name: "Hanging Knee Raise", search: "hanging knee raise", type: "Core", s12: 2, s3: 3, reps: "10-15", rest: 60, restLabel: "60 s", alt: null }
  ]
};

// Paste the exact text here when provided. null = shows a "not provided yet" notice.
window.WARMUP_TEXT = [
  "All days · 8–10 min",
  "",
  "• 5 min bike or brisk walk.",
  "• Bird Dog 2 × 6 per side, Glute Bridge 2 × 10, and Cat-Cow × 8 (to prepare the lower back).",
  "• Before the first compound exercise: empty bar × 10, then 50% × 6, then 70% × 3, then 85% × 1.",
  "• Before the first upper-body exercise: 2 light sets × 8."
].join("\n");

window.PROGRESSION_TEXT = [
  "Weeks 1-2 · Return",
  "Sets: first number · RPE 6-7",
  "Start with 60–70% of your old weights. Focus on technique only.",
  "",
  "Weeks 3-4 · Build",
  "Sets: second number · RPE 7 compound, 8 isolation",
  "Double progression begins.",
  "",
  "Weeks 5-7 · Load",
  "Sets: second number · RPE 8 compound, 9 isolation",
  "Continue double progression.",
  "",
  "Week 8 · Deload",
  "Sets: 2 compound, 1-2 isolation · RPE 6",
  "Same exercises with 10% less weight. Then start a new cycle from your week 7 weights.",
  "",
  "Double progression: when you reach the top of the rep range on all sets at the required RPE, add 2.5 kg for upper-body exercises and 5 kg for lower-body exercises, and go back to the bottom of the range.",
  "",
  "Squat and deadlift: never go above RPE 8. If lower-back pain comes back, return to the previous week's weight and use the alternative for one week."
].join("\n");
