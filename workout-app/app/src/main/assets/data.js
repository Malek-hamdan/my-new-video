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
    { id: "incline-db-press", name: "Incline Dumbbell Press", search: "incline dumbbell press", type: "C", s12: 2, s3: 3, reps: "8-10", rest: 120, restLabel: "2 min", alt: "Smith Machine Incline Press" }
    // TODO: Bulgarian Split Squat — row was cut off in the message (no type/sets/reps/rest given)
    // TODO: rest of Wednesday, if any
  ],
  fri: [
    // TODO: Friday exercises were not included in the message
  ]
};

// Paste the exact text here when provided. null = shows a "not provided yet" notice.
window.WARMUP_TEXT = null;
window.PROGRESSION_TEXT = null;
