import { cloze, mc } from "./helpers";
import type { Level, Question } from "./schema";

/**
 * Placement test: 4 items per level from Pre-A1 to C1. The learner is placed at the
 * first level whose section they score below 80% on. Passing C1 places at C2.
 */
export const PLACEMENT: { level: Level; questions: Question[] }[] = [
  {
    level: "PreA1",
    questions: [
      mc("pa1", "I ___ a student.", ["is", "am", "are"], 1),
      mc("pa2", "Which is a colour?", ["blue", "bread", "brother"], 0),
      cloze("pa3", "Hello! My ___ is Ana.", "name"),
      mc("pa4", "It's ___ apple.", ["a", "an", "two"], 1),
    ],
  },
  {
    level: "A1",
    questions: [
      mc("a1", "She ___ in a bank.", ["work", "works", "working"], 1),
      mc("a2", "There ___ two chairs in the kitchen.", ["is", "are", "be"], 1),
      cloze("a3", "I can't ___ a car. (drive)", "drive"),
      mc("a4", "We usually have lunch ___ one o'clock.", ["in", "on", "at"], 2),
    ],
  },
  {
    level: "A2",
    questions: [
      mc("b1", "Yesterday I ___ to the cinema.", ["go", "went", "have gone"], 1),
      mc("b2", "This hotel is ___ than the other one.", ["more cheap", "cheaper", "cheapest"], 1),
      mc("b3", "Have you ever ___ sushi?", ["ate", "eaten", "eat"], 1),
      mc("b4", "I'm going ___ my grandparents next weekend.", ["visit", "to visit", "visiting"], 1),
    ],
  },
  {
    level: "B1",
    questions: [
      mc("c1", "If I ___ more time, I would learn the piano.", ["have", "had", "will have"], 1),
      mc("c2", "I ___ here since 2019.", ["live", "am living", "have lived"], 2),
      mc("c3", "The bridge ___ in 1890.", ["built", "was built", "has built"], 1),
      mc("c4", "She asked me where I ___.", ["live", "lived", "do live"], 1),
    ],
  },
  {
    level: "B2",
    questions: [
      mc("d1", "If she had left earlier, she ___ the train.", ["would catch", "would have caught", "will catch"], 1),
      mc("d2", "He ___ be at home — his car isn't outside.", ["can't", "mustn't", "shouldn't"], 0),
      mc("d3", "___ the rain, the match continued.", ["Although", "Despite", "Even"], 1),
      mc("d4", "I'm getting used to ___ on the left.", ["drive", "driving", "drove"], 1),
    ],
  },
  {
    level: "C1",
    questions: [
      mc("e1", "Never ___ such a beautiful sunset.", ["I have seen", "have I seen", "I saw"], 1),
      mc("e2", "It is essential that every employee ___ the policy.", ["reads", "read", "will read"], 1),
      mc("e3", "Choose the most formal option: \"We need to ___ the problem.\"", ["sort out", "address", "deal with it"], 1),
      mc("e4", "___ they known about the delay, they would have rebooked.", ["If", "Had", "Were"], 1),
    ],
  },
];
