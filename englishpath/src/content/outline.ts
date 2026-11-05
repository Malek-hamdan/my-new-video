import type { Level, UnitOutline } from "./schema";

type Row = [title: string, canDo: string, grammar: string[], vocab: string[], lessons: [string, string, string]];

/**
 * Full curriculum outline, Pre-A1 → C2. Original outline written for EnglishPath,
 * aligned to the public CEFR "can-do" descriptors (no third-party course content).
 */
const ROWS: Record<Level, Row[]> = {
  PreA1: [
    ["First Words", "Greet people, say your name and count to ten.", ["I am / You are", "a / an", "What is your name?"], ["greetings", "numbers 1–10", "polite words"], ["Hello and Goodbye", "Numbers 1 to 10", "What's Your Name?"]],
    ["People and Family", "Name family members and say who people are.", ["This is my …", "He is / She is", "I am … years old"], ["family", "people", "numbers 11–20"], ["My Family", "He and She", "How Old Are You?"]],
    ["Things Around Me", "Name colours, everyday objects and food you like.", ["It is + colour", "a / an + noun", "I like / I don't like"], ["colours", "objects", "food"], ["Colours", "In My Bag", "Food I Like"]],
    ["Where Is It?", "Say where things are in a room.", ["in / on / under", "Where is …?", "plural -s"], ["furniture", "prepositions", "plurals"], ["In the Room", "Where Is My Key?", "One Cat, Two Cats"]],
    ["My Body and Clothes", "Name parts of the body and clothes.", ["I have / I don't have", "these / those", "big / small"], ["body", "clothes", "sizes"], ["My Body", "What I Wear", "Big and Small"]],
    ["Days and Weather", "Say the day and describe the weather.", ["It is + day", "It is sunny / It is raining", "today / tomorrow"], ["days of the week", "weather", "time words"], ["Days of the Week", "The Weather", "Today and Tomorrow"]],
  ],
  A1: [
    ["My Day", "Describe your daily routine and tell the time.", ["present simple (I/you/we/they)", "at + time", "present simple -s (he/she/it)"], ["routines", "time", "work and study"], ["Daily Routine", "Telling the Time", "He Works, She Studies"]],
    ["Home and Town", "Describe your home and give simple directions.", ["there is / there are", "prepositions of place", "imperatives"], ["rooms", "places in town", "directions"], ["Rooms in My Home", "Places in Town", "Asking the Way"]],
    ["Free Time", "Talk about hobbies, frequency and ability.", ["like + -ing", "adverbs of frequency", "can / can't"], ["hobbies", "frequency", "skills"], ["My Hobbies", "How Often?", "Can You Swim?"]],
    ["Shopping", "Buy things, ask prices and talk about quantities.", ["How much / How many", "this / that / these / those", "countable and uncountable"], ["shops", "money", "quantities"], ["At the Market", "How Much Is It?", "Some and Any"]],
    ["Food and Drink", "Order food and talk about meals.", ["I'd like …", "some / any", "a lot of"], ["meals", "restaurant", "containers"], ["Breakfast, Lunch, Dinner", "At the Café", "A Healthy Week"]],
    ["People I Know", "Describe people's looks and character.", ["have got", "adjective order (basic)", "possessive 's"], ["appearance", "personality", "relationships"], ["What Does She Look Like?", "Friendly and Kind", "My Friend's House"]],
    ["Right Now", "Say what is happening now.", ["present continuous", "present simple vs continuous", "Wh- questions"], ["actions", "phone and messages", "now / at the moment"], ["What Are You Doing?", "Every Day or Now?", "Questions, Questions"]],
    ["Last Weekend", "Talk about past events with simple verbs.", ["was / were", "past simple regular", "past simple irregular (common)"], ["weekend activities", "time expressions", "feelings"], ["Where Were You?", "I Played, I Watched", "I Went, I Saw"]],
  ],
  A2: [
    ["Stories from the Past", "Tell a short story about the past.", ["past simple questions", "past continuous", "when / while"], ["life events", "sequencers", "accidents"], ["Did You Enjoy It?", "I Was Walking When…", "Telling a Story"]],
    ["Plans and Future", "Talk about plans, intentions and predictions.", ["be going to", "present continuous for arrangements", "will for predictions"], ["plans", "calendar", "the future"], ["My Plans", "Meeting on Friday", "What Will Happen?"]],
    ["Comparing Things", "Compare people, places and things.", ["comparatives", "superlatives", "as … as"], ["cities", "products", "adjectives"], ["Bigger and Better", "The Best in the World", "Not as Hot as…"]],
    ["Travel", "Book travel, check in and ask for help.", ["have to / don't have to", "should for advice", "too / enough"], ["transport", "hotels", "airports"], ["Getting There", "At the Hotel", "Travel Problems"]],
    ["Health", "Describe symptoms and follow advice.", ["should / shouldn't", "What's the matter?", "adverbs of manner"], ["illness", "body (advanced)", "the doctor"], ["I Feel Sick", "At the Doctor's", "Healthy Habits"]],
    ["Experiences", "Talk about life experiences.", ["present perfect (ever/never)", "present perfect vs past simple", "been / gone"], ["experiences", "travel", "achievements"], ["Have You Ever…?", "I Went There Last Year", "Been and Gone"]],
    ["Work and Jobs", "Describe jobs, duties and workplaces.", ["must / mustn't", "verb + to / -ing", "adverbs of degree"], ["jobs", "workplace", "duties"], ["What Do You Do?", "Rules at Work", "I Enjoy Helping People"]],
    ["On the Phone", "Make simple phone calls and leave messages.", ["Could you …? / Can I …?", "will for offers", "object pronouns"], ["phone language", "messages", "appointments"], ["Hello, Who's Calling?", "Can I Take a Message?", "Making an Appointment"]],
  ],
  B1: [
    ["Life Changes", "Talk about how life has changed.", ["used to", "present perfect continuous", "for / since"], ["life stages", "habits", "change"], ["I Used to Live…", "How Long Have You Been…?", "Then and Now"]],
    ["If…", "Talk about real and imaginary situations.", ["first conditional", "second conditional", "unless / as long as"], ["choices", "money", "dreams"], ["If It Rains…", "If I Won the Lottery", "Unless You Hurry"]],
    ["The Media", "Discuss news, stories and opinions.", ["passive (present and past)", "reported statements", "relative clauses (who/which/that)"], ["news", "social media", "opinions"], ["It Was Made in…", "She Said That…", "The Man Who…"]],
    ["Small Talk", "Start and keep a casual conversation going.", ["question tags", "so / neither do I", "indirect questions"], ["conversation fillers", "interests", "weather and weekends"], ["Nice Day, Isn't It?", "So Do I!", "Do You Know Where…?"]],
    ["Work Life", "Discuss workplace situations and problems.", ["modals of obligation (past)", "make / let / allow", "phrasal verbs (work)"], ["office", "meetings", "deadlines"], ["I Had to Stay Late", "They Let Us Work from Home", "Setting Up a Meeting"]],
    ["The Environment", "Discuss environmental problems and solutions.", ["passive with modals", "quantifiers (few, little)", "linking words of cause and result"], ["environment", "energy", "recycling"], ["It Should Be Recycled", "Too Little Time", "Because of the Weather"]],
    ["Feelings and Relationships", "Describe feelings and give advice.", ["-ed / -ing adjectives", "wish + past", "advice structures"], ["emotions", "relationships", "advice"], ["Bored or Boring?", "I Wish I Had…", "If I Were You…"]],
    ["Learning and Skills", "Talk about learning, goals and progress.", ["gerunds and infinitives", "verb patterns", "future continuous"], ["education", "skills", "goals"], ["Learning to Learn", "I Stopped to…", "This Time Next Year"]],
  ],
  B2: [
    ["Job Interviews", "Perform well in a job interview.", ["past perfect", "narrative tenses", "describing achievements"], ["careers", "strengths", "CV language"], ["Tell Me About Yourself", "Before I Had Joined…", "Your Greatest Achievement"]],
    ["Hypotheses", "Speculate about the past and present.", ["third conditional", "mixed conditionals", "modals of deduction"], ["regret", "possibility", "mystery"], ["If I Had Known…", "She Must Have Left", "What Might Have Happened"]],
    ["Persuasion", "Present arguments and persuade others.", ["cleft sentences", "emphasis with do/does", "concession (although, despite)"], ["debate", "marketing", "argument"], ["What I Mean Is…", "I Do Agree", "Despite the Cost"]],
    ["Science and Technology", "Discuss innovations and their impact.", ["passive (advanced forms)", "have something done", "future perfect"], ["technology", "science", "innovation"], ["It Is Said That…", "Getting It Fixed", "By 2040 We Will Have…"]],
    ["Culture and Society", "Compare cultures and social norms.", ["articles (advanced)", "be used to / get used to", "participle clauses"], ["customs", "society", "identity"], ["The Rules of Politeness", "Getting Used to It", "Having Lived Abroad…"]],
    ["Money and Business", "Discuss finance, deals and business news.", ["reported questions and commands", "wish / if only", "linking for contrast"], ["finance", "business", "economy"], ["She Asked Whether…", "If Only We Had Invested", "Profit Versus Purpose"]],
    ["Negotiation Basics", "Make proposals and reach agreements.", ["conditionals for bargaining", "softening language", "modal verbs for suggestions"], ["negotiation", "contracts", "compromise"], ["What If We Offered…?", "I'm Afraid That Might Be Difficult", "Meeting Halfway"]],
    ["Health and Wellbeing", "Discuss lifestyle, stress and healthcare.", ["verb patterns (advanced)", "quantifiers (advanced)", "compound adjectives"], ["wellbeing", "stress", "healthcare"], ["Remember to Breathe", "Hardly Any Sleep", "A Well-Balanced Life"]],
  ],
  C1: [
    ["Nuance and Tone", "Adjust tone for formal and informal contexts.", ["inversion for emphasis", "formal vs informal register", "hedging"], ["register", "tone", "politeness"], ["Never Have I Seen…", "Dear Sir or Hey There?", "It Would Seem That…"]],
    ["Complex Arguments", "Build and critique complex arguments.", ["advanced linking", "nominalisation", "fronting"], ["logic", "evidence", "critique"], ["Notwithstanding…", "The Implementation of…", "Rarely Does It…"]],
    ["Professional Communication", "Write and speak effectively at work.", ["passive for distance", "ellipsis and substitution", "phrasal verbs (business)"], ["emails", "reports", "presentations"], ["It Has Been Decided", "Hope So / Think Not", "Following Up"]],
    ["Advanced Negotiation", "Negotiate complex deals with tact.", ["conditionals (advanced)", "modal perfects for criticism", "vague language"], ["leverage", "terms", "concessions"], ["Should You Accept…", "You Could Have Told Us", "Roughly Speaking"]],
    ["Media and Persuasion", "Analyse bias and rhetoric.", ["reporting verbs", "subjunctive", "rhetorical devices"], ["journalism", "rhetoric", "bias"], ["He Claimed That…", "It Is Essential That He Be…", "Rule of Three"]],
    ["Idiomatic English", "Understand and use idioms naturally.", ["idioms", "collocations", "binomials"], ["idioms", "collocations", "fixed phrases"], ["Under the Weather", "Make a Decision, Do Research", "Sooner or Later"]],
    ["Society and Ethics", "Discuss ethical dilemmas in depth.", ["conditionals without if", "would rather / it's time", "cleft sentences (advanced)"], ["ethics", "law", "rights"], ["Had They Known…", "It's High Time We…", "What Matters Most Is…"]],
    ["Academic English", "Read and write academic texts.", ["academic hedging", "citation language", "complex noun phrases"], ["research", "academic words", "data"], ["The Evidence Suggests…", "According to…", "A Significant Increase in…"]],
  ],
  C2: [
    ["Precision", "Express fine shades of meaning precisely.", ["near-synonyms", "intensifiers and downtoners", "word formation"], ["precision vocabulary", "connotation", "affixes"], ["Slim, Slender, Skinny", "Utterly or Somewhat?", "Building New Words"]],
    ["Style and Rhetoric", "Write with style and rhetorical control.", ["parallelism", "inversion (literary)", "periodic sentences"], ["style", "rhetoric", "literary devices"], ["Not Only Fast But Also…", "Little Did They Know", "Saving the Best for Last"]],
    ["Humour and Irony", "Understand and use humour, irony and understatement.", ["understatement", "irony markers", "wordplay"], ["humour", "irony", "puns"], ["Not Bad at All", "Oh, Great…", "Playing with Words"]],
    ["Leadership Language", "Lead meetings, motivate and resolve conflict.", ["diplomatic language", "mitigation", "assertive language"], ["leadership", "conflict", "motivation"], ["Let's Take a Step Back", "With Respect, I Disagree", "Owning the Decision"]],
    ["Global Issues", "Debate global issues with authority.", ["complex conditionals", "concessive clauses", "evaluative language"], ["globalisation", "policy", "sustainability"], ["Were It Not for…", "Much as I Admire…", "Arguably the Most…"]],
    ["The Art of Storytelling", "Tell vivid, engaging stories.", ["narrative tenses (mastery)", "descriptive language", "direct and free indirect speech"], ["narrative", "description", "dialogue"], ["Setting the Scene", "Show, Don't Tell", "Voices in a Story"]],
    ["Expert Debate", "Win debates with logic and poise.", ["rebuttal language", "conceding and countering", "rhetorical questions"], ["debate", "fallacies", "persuasion"], ["That Simply Isn't True", "Granted, But…", "Who Would Argue Otherwise?"]],
    ["Mastery Workshop", "Use English flexibly in any situation.", ["register switching", "cohesion", "editing"], ["mixed advanced", "collocations", "style"], ["Same Story, Three Voices", "Holding It Together", "The Final Edit"]],
  ],
};

export const OUTLINE: UnitOutline[] = (Object.keys(ROWS) as Level[]).flatMap((level) =>
  ROWS[level].map(([title, canDo, grammarFocus, vocabTopics, lessonTitles], i) => ({
    id: `${level}-u${i + 1}`,
    level,
    index: i + 1,
    title,
    canDo,
    grammarFocus,
    vocabTopics,
    lessonTitles,
  })),
);

export const unitsForLevel = (level: Level) => OUTLINE.filter((u) => u.level === level);
export const lessonId = (unitId: string, n: number) => `${unitId}-l${n}`;

/** Themes for the endless engine after the fixed C2 outline is complete. */
export const ENDLESS_THEMES = [
  "Breaking news analysis", "Philosophy of everyday life", "Startup pitches", "Courtroom language",
  "Travel writing", "Scientific breakthroughs", "Diplomacy and international relations", "Film and literary criticism",
  "Personal finance", "Urban design", "Psychology of habits", "History's turning points",
  "Food culture", "Sports commentary", "Artificial intelligence and society", "Public speaking",
];
