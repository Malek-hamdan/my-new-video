import { cloze, lesson, mc, order, v } from "../helpers";

/** Fully written A1 content: units 1–3 (original material). */
export const A1_LESSONS = [
  // ───────────────────────── Unit 1 · My Day ─────────────────────────
  lesson({
    id: "A1-u1-l1",
    unitId: "A1-u1",
    title: "Daily Routine",
    goal: "Describe what you do every day with the present simple.",
    vocab: [
      v("wake-up", "wake up", "verb", "To stop sleeping.", "I wake up at seven.", "⏰"),
      v("have-breakfast", "have breakfast", "phrase", "To eat the first meal of the day.", "We have breakfast together.", "🥐"),
      v("go-to-work", "go to work", "phrase", "To travel to your job.", "I go to work by bus.", "🚌"),
      v("study", "study", "verb", "To learn about a subject.", "I study English in the evening.", "📚"),
      v("cook", "cook", "verb", "To make food hot and ready to eat.", "My parents cook dinner.", "🍳"),
      v("go-to-bed", "go to bed", "phrase", "To lie down to sleep at night.", "I go to bed at eleven.", "🛏️"),
    ],
    grammar: {
      id: "g-present-simple-i-you",
      title: "Present simple: I / you / we / they",
      explanation: [
        "Use the present simple for routines and things that are always true.",
        "With **I, you, we, they** use the base verb: I **work**, they **live**.",
        "Negative: **don't** + verb (I don't work). Question: **Do** + subject + verb? (Do you work?)",
      ],
      examples: [
        { en: "I wake up at 6:30." },
        { en: "We don't work on Sundays." },
        { en: "Do you study at night? — Yes, I do." },
      ],
      mistakes: [
        { wrong: "I am wake up at seven.", right: "I wake up at seven.", why: "Don't add am to a present simple verb." },
        { wrong: "You work on Saturday?", right: "Do you work on Saturday?", why: "Questions need do." },
      ],
      practice: [
        cloze("p1", "We ___ breakfast at eight. (have)", "have"),
        cloze("p2", "They ___ work on Sundays. (not)", "don't", "Negative: don't + verb.", ["do not"]),
        mc("p3", "___ you cook every day?", ["Are", "Do", "Is"], 1),
      ],
    },
    reading: {
      title: "Marco's day",
      text: "Marco is a nurse. He tells us about his day: \"I wake up at six. I have breakfast with my wife and we drink coffee. I go to work by bike. In the evening, I study English for thirty minutes. We cook dinner together and I go to bed at ten thirty.\"",
      questions: [
        mc("r1", "How does Marco go to work?", ["by bus", "by bike", "by car"], 1, undefined, "reading"),
        mc("r2", "When does he study English?", ["in the morning", "at work", "in the evening"], 2, undefined, "reading"),
      ],
    },
    listening: {
      title: "A busy student",
      script: [
        { speaker: "Interviewer", text: "What time do you wake up?" },
        { speaker: "Aisha", text: "I wake up at seven and I have breakfast at seven thirty." },
        { speaker: "Interviewer", text: "Do you work?" },
        { speaker: "Aisha", text: "Yes, I work in a café in the afternoon. I study in the morning." },
      ],
      questions: [
        mc("l1", "When does Aisha have breakfast?", ["7:00", "7:30", "8:00"], 1, undefined, "listening"),
        mc("l2", "Where does she work?", ["in a shop", "in a café", "in a school"], 1, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["I wake up at seven.", "We have breakfast together.", "Do you go to work by bus?", "I don't work on Sundays."] },
    writing: {
      prompt: "Describe your weekday routine in 4–5 sentences.",
      minWords: 25,
      targetWords: ["wake up", "breakfast", "go to bed"],
      model: "I wake up at half past six. I have breakfast at seven. I go to work by train. In the evening I cook dinner and study English. I go to bed at eleven.",
    },
    quizExtra: [mc("q1", "The first meal of the day is…", ["dinner", "lunch", "breakfast"], 2)],
  }),
  lesson({
    id: "A1-u1-l2",
    unitId: "A1-u1",
    title: "Telling the Time",
    goal: "Ask and say the time and talk about parts of the day.",
    vocab: [
      v("oclock", "o'clock", "adverb", "Used for exact hours: 3:00 = three o'clock.", "The film starts at nine o'clock.", "🕘"),
      v("half-past", "half past", "phrase", "Thirty minutes after the hour: 4:30 = half past four.", "I finish work at half past five.", "🕠"),
      v("quarter", "quarter", "noun", "Fifteen minutes: quarter past / quarter to.", "It's quarter past two.", "🕑"),
      v("morning", "morning", "noun", "The time from when you wake up until 12:00.", "I run in the morning.", "🌅"),
      v("afternoon", "afternoon", "noun", "The time from 12:00 until about 6 pm.", "We have a meeting in the afternoon.", "☀️"),
      v("evening", "evening", "noun", "The time from about 6 pm until night.", "I watch TV in the evening.", "🌆"),
    ],
    grammar: {
      id: "g-time-prepositions",
      title: "What time is it? / at + time, in the + part of day",
      explanation: [
        "Ask: **What time is it?** Answer: **It's** + time (It's ten o'clock.)",
        "Use **at** with clock times: at 7:00, at half past three. Also **at night**.",
        "Use **in the** with parts of the day: in the morning, in the afternoon, in the evening.",
      ],
      examples: [
        { en: "What time is it? — It's quarter to nine." },
        { en: "The shop opens at nine o'clock." },
        { en: "I read in the evening and sleep at night." },
      ],
      mistakes: [
        { wrong: "I start work in 8 o'clock.", right: "I start work at 8 o'clock.", why: "Clock times use at." },
        { wrong: "at the morning", right: "in the morning", why: "Parts of the day use in the (except at night)." },
      ],
      practice: [
        cloze("p1", "The class starts ___ ten o'clock.", "at"),
        cloze("p2", "I go running ___ the morning.", "in"),
        mc("p3", "4:30 is…", ["half past four", "half past five", "quarter past four"], 0),
      ],
    },
    reading: {
      title: "Train times",
      text: "The first train to the city leaves at quarter past six in the morning. There is a train every thirty minutes. The last train leaves at eleven o'clock at night. On Sundays, the first train leaves at eight o'clock.",
      questions: [
        mc("r1", "When does the first train leave on weekdays?", ["6:15", "6:45", "8:00"], 0, undefined, "reading"),
        mc("r2", "How often is there a train?", ["every 15 minutes", "every 30 minutes", "every hour"], 1, undefined, "reading"),
      ],
    },
    listening: {
      title: "Meeting a friend",
      script: [
        { speaker: "Leo", text: "What time is the film?" },
        { speaker: "Sara", text: "It starts at half past seven in the evening." },
        { speaker: "Leo", text: "OK, let's meet at seven o'clock at the café." },
      ],
      questions: [
        mc("l1", "When does the film start?", ["7:00", "7:30", "8:30"], 1, undefined, "listening"),
        mc("l2", "Where do they meet?", ["at the cinema", "at the café", "at home"], 1, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["What time is it?", "It's half past four.", "I study in the evening.", "The shop opens at nine o'clock."] },
    writing: {
      prompt: "Write about your day with times: when you start, eat lunch and finish.",
      minWords: 20,
      targetWords: ["at", "in the morning", "o'clock"],
      model: "I start work at nine o'clock in the morning. I have lunch at half past twelve. I finish at five o'clock and go home.",
    },
    quizExtra: [mc("q1", "2:15 is…", ["quarter to two", "quarter past two", "half past two"], 1)],
  }),
  lesson({
    id: "A1-u1-l3",
    unitId: "A1-u1",
    title: "He Works, She Studies",
    goal: "Use the present simple with he, she and it.",
    vocab: [
      v("works", "works", "verb", "He/she form of work: to do a job.", "My brother works in a bank.", "💼"),
      v("watches", "watches", "verb", "He/she form of watch: to look at something for a time.", "She watches the news every night.", "📺"),
      v("goes", "goes", "verb", "He/she form of go: to move to a place.", "He goes to the gym on Mondays.", "🏋️"),
      v("has", "has", "verb", "He/she form of have.", "She has two children.", "🧺"),
      v("does", "does", "verb", "He/she form of do.", "He does his homework after dinner.", "📝"),
      v("finishes", "finishes", "verb", "He/she form of finish: to end.", "The class finishes at noon.", "🏁"),
    ],
    grammar: {
      id: "g-present-simple-s",
      title: "Present simple: he / she / it + -s",
      explanation: [
        "With **he, she, it** add **-s** to the verb: she **works**, he **lives**.",
        "Add **-es** after -sh, -ch, -s, -x, -o: watch → watch**es**, go → go**es**. Consonant + y → **-ies**: study → stud**ies**.",
        "Irregular: have → **has**. Negative: **doesn't** + base verb. Question: **Does** + he/she + base verb?",
      ],
      examples: [
        { en: "She studies medicine." },
        { en: "He doesn't like coffee." },
        { en: "Does your sister work? — Yes, she does." },
      ],
      mistakes: [
        { wrong: "She work in a hospital.", right: "She works in a hospital.", why: "He/she/it needs -s." },
        { wrong: "He doesn't works.", right: "He doesn't work.", why: "After doesn't use the base verb." },
        { wrong: "She haves a car.", right: "She has a car.", why: "Have is irregular: has." },
      ],
      practice: [
        cloze("p1", "My father ___ TV every evening. (watch)", "watches"),
        cloze("p2", "Laura ___ English at university. (study)", "studies"),
        mc("p3", "___ he play tennis?", ["Do", "Does", "Is"], 1),
        cloze("p4", "Tom ___ two brothers. (have)", "has"),
      ],
    },
    reading: {
      title: "Two sisters",
      text: "Elena and Clara are sisters, but they are very different. Elena works in an office. She gets up early and goes to work by train. Clara is a student. She studies music and practises the piano every day. She doesn't get up early! In the evening, Elena watches TV, but Clara goes out with friends.",
      questions: [
        mc("r1", "What does Clara study?", ["art", "music", "medicine"], 1, undefined, "reading"),
        mc("r2", "Who gets up early?", ["Elena", "Clara", "both"], 0, undefined, "reading"),
      ],
    },
    listening: {
      title: "My neighbour",
      script: [
        { speaker: "Ravi", text: "My neighbour Mr Jones is a chef. He works in a hotel." },
        { speaker: "Ravi", text: "He finishes work at midnight, so he sleeps late. He doesn't cook at home!" },
      ],
      questions: [
        mc("l1", "What is Mr Jones's job?", ["a waiter", "a chef", "a driver"], 1, undefined, "listening"),
        mc("l2", "When does he finish work?", ["at midnight", "at noon", "at six"], 0, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["She works in an office.", "He watches TV in the evening.", "Does she study music?", "He doesn't cook at home."] },
    writing: {
      prompt: "Describe a friend's or family member's day using he or she.",
      minWords: 25,
      targetWords: ["works", "goes", "doesn't"],
      model: "My sister is a teacher. She wakes up at six and goes to school by bus. She teaches children. She doesn't work on Saturdays. In the evening she reads books.",
    },
    quizExtra: [mc("q1", "Choose the correct sentence.", ["He go to school.", "He goes to school.", "He going to school."], 1)],
  }),

  // ───────────────────────── Unit 2 · Home and Town ─────────────────────────
  lesson({
    id: "A1-u2-l1",
    unitId: "A1-u2",
    title: "Rooms in My Home",
    goal: "Describe a home with there is and there are.",
    vocab: [
      v("kitchen", "kitchen", "noun", "The room where you cook.", "There is a big table in the kitchen.", "🍽️"),
      v("bedroom", "bedroom", "noun", "The room where you sleep.", "My bedroom is upstairs.", "🛌"),
      v("bathroom", "bathroom", "noun", "The room with a shower or bath.", "The bathroom is next to my bedroom.", "🛁"),
      v("living-room", "living room", "noun", "The room where you relax and watch TV.", "We watch films in the living room.", "🛋️"),
      v("window", "window", "noun", "Glass in a wall that lets in light.", "There are two windows in my room.", "🪟"),
      v("garden", "garden", "noun", "Land with grass and flowers next to a house.", "Our garden is small but pretty.", "🌷"),
    ],
    grammar: {
      id: "g-there-is-are",
      title: "There is / There are",
      explanation: [
        "Use **there is** (there's) + one thing, and **there are** + two or more things.",
        "Negative: **there isn't a …**, **there aren't any …**. Question: **Is there a …? / Are there any …?**",
      ],
      examples: [
        { en: "There's a sofa in the living room." },
        { en: "There are three bedrooms." },
        { en: "Is there a garden? — No, there isn't." },
      ],
      mistakes: [
        { wrong: "There is two bathrooms.", right: "There are two bathrooms.", why: "Plural nouns use there are." },
        { wrong: "Have a park near my house.", right: "There is a park near my house.", why: "Use there is to say something exists." },
      ],
      practice: [
        cloze("p1", "There ___ four chairs in the kitchen.", "are"),
        cloze("p2", "___ there a bathroom upstairs?", "Is", undefined, ["is"]),
        mc("p3", "Choose the correct sentence.", ["There aren't any windows.", "There isn't any windows.", "There no windows."], 0),
      ],
    },
    reading: {
      title: "Flat for rent",
      text: "Modern flat in the city centre. There are two bedrooms and one bathroom. There is a big kitchen with a new fridge. The living room has a large window and a balcony. There isn't a garden, but there is a park near the building.",
      questions: [
        mc("r1", "How many bedrooms are there?", ["one", "two", "three"], 1, undefined, "reading"),
        mc("r2", "Is there a garden?", ["Yes, a big one.", "No, but there's a park near.", "Yes, with a balcony."], 1, undefined, "reading"),
      ],
    },
    listening: {
      title: "A new house",
      script: [
        { speaker: "Mia", text: "Is there a garden in your new house?" },
        { speaker: "Jack", text: "Yes, there is! And there are three bedrooms." },
        { speaker: "Mia", text: "Is there a bath?" },
        { speaker: "Jack", text: "No, there isn't. There's only a shower." },
      ],
      questions: [
        mc("l1", "How many bedrooms are in Jack's house?", ["two", "three", "four"], 1, undefined, "listening"),
        mc("l2", "What is in the bathroom?", ["a bath", "a shower", "a bath and a shower"], 1, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["There is a big kitchen.", "There are two bedrooms.", "Is there a garden?", "There aren't any windows in the bathroom."] },
    writing: {
      prompt: "Describe your home. Use there is and there are.",
      minWords: 25,
      targetWords: ["there is", "there are", "kitchen"],
      model: "I live in a small flat. There are two bedrooms and a bathroom. There is a kitchen with a window. There isn't a garden, but there is a balcony.",
    },
    quizExtra: [mc("q1", "You sleep in the…", ["kitchen", "bedroom", "garden"], 1)],
  }),
  lesson({
    id: "A1-u2-l2",
    unitId: "A1-u2",
    title: "Places in Town",
    goal: "Name places in a town and say where they are.",
    vocab: [
      v("bank", "bank", "noun", "A place that keeps and lends money.", "The bank opens at nine.", "🏦"),
      v("supermarket", "supermarket", "noun", "A big shop that sells food and other things.", "I buy food at the supermarket.", "🛒"),
      v("hospital", "hospital", "noun", "A place where doctors help sick people.", "My mother works at the hospital.", "🏥"),
      v("station", "station", "noun", "A place where trains or buses stop.", "The station is near my house.", "🚉"),
      v("park", "park", "noun", "A public green area with grass and trees.", "Children play in the park.", "🌳"),
      v("pharmacy", "pharmacy", "noun", "A shop that sells medicine.", "Is there a pharmacy near here?", "💊"),
    ],
    grammar: {
      id: "g-prep-place",
      title: "Prepositions of place",
      explanation: [
        "**next to** = at the side of. **opposite** = on the other side, facing.",
        "**between** = in the middle of two things. **near** = not far from.",
        "**on** + street name: on King Street. **in** + town/area: in the city centre.",
      ],
      examples: [
        { en: "The bank is next to the supermarket." },
        { en: "The pharmacy is opposite the park." },
        { en: "The café is between the bank and the station." },
      ],
      mistakes: [
        { wrong: "The bank is next the café.", right: "The bank is next to the café.", why: "Next always takes to." },
        { wrong: "between the bank or the café", right: "between the bank and the café", why: "Between … and …" },
      ],
      practice: [
        cloze("p1", "The station is ___ to the park.", "next"),
        mc("p2", "The café is ___ the bank and the hospital.", ["opposite", "between", "next"], 1),
        cloze("p3", "The hospital is ___ Green Street.", "on"),
      ],
    },
    reading: {
      title: "My town",
      text: "I live in a small town. In the centre there is a square. The bank is on the square, next to a big supermarket. Opposite the bank there's a pharmacy. The station is near the park, and the hospital is between the park and the school.",
      questions: [
        mc("r1", "What is next to the bank?", ["the pharmacy", "the supermarket", "the station"], 1, undefined, "reading"),
        mc("r2", "Where is the hospital?", ["opposite the bank", "between the park and the school", "on the square"], 1, undefined, "reading"),
      ],
    },
    listening: {
      title: "Where's the pharmacy?",
      script: [
        { speaker: "Tourist", text: "Excuse me, is there a pharmacy near here?" },
        { speaker: "Local", text: "Yes, there's one on Bridge Street. It's opposite the station, next to a bank." },
      ],
      questions: [
        mc("l1", "Which street is the pharmacy on?", ["Bridge Street", "King Street", "Park Street"], 0, undefined, "listening"),
        mc("l2", "The pharmacy is opposite the…", ["bank", "station", "park"], 1, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["The bank is next to the supermarket.", "Is there a pharmacy near here?", "The park is opposite the station.", "The café is between the bank and the hotel."] },
    writing: {
      prompt: "Describe three places near your home and where they are.",
      minWords: 25,
      targetWords: ["next to", "opposite", "near"],
      model: "There is a supermarket near my home. It is next to a bank. Opposite the supermarket there is a small park. The station is between the park and a school.",
    },
    quizExtra: [mc("q1", "You buy medicine at the…", ["bank", "pharmacy", "station"], 1)],
  }),
  lesson({
    id: "A1-u2-l3",
    unitId: "A1-u2",
    title: "Asking the Way",
    goal: "Ask for and give simple directions.",
    vocab: [
      v("turn-left", "turn left", "phrase", "Go in the direction of your left hand.", "Turn left at the bank.", "⬅️"),
      v("turn-right", "turn right", "phrase", "Go in the direction of your right hand.", "Turn right after the bridge.", "➡️"),
      v("go-straight-on", "go straight on", "phrase", "Continue in the same direction.", "Go straight on for two minutes.", "⬆️"),
      v("corner", "corner", "noun", "The place where two streets meet.", "The café is on the corner.", "📐"),
      v("traffic-lights", "traffic lights", "noun", "Red, yellow and green lights for cars.", "Turn left at the traffic lights.", "🚦"),
      v("map", "map", "noun", "A drawing of an area with streets.", "Can you show me on the map?", "🗺️"),
    ],
    grammar: {
      id: "g-imperatives",
      title: "Imperatives for directions",
      explanation: [
        "Give directions with the base verb, no subject: **Turn left. Go straight on. Take the second street.**",
        "Negative imperative: **Don't** + verb: **Don't cross the bridge.**",
        "Ask politely: **Excuse me, how do I get to …? / Where is …?**",
      ],
      examples: [
        { en: "Go straight on and turn right at the corner." },
        { en: "Take the first street on the left." },
        { en: "Don't turn here — it's the next street." },
      ],
      mistakes: [
        { wrong: "You turn left, please go.", right: "Turn left.", why: "Directions use the simple base verb." },
        { wrong: "No cross the road.", right: "Don't cross the road.", why: "Negative imperative uses don't." },
      ],
      practice: [
        cloze("p1", "___ left at the traffic lights. (turn)", "Turn", undefined, ["turn"]),
        cloze("p2", "___ cross here. It's dangerous.", "Don't", undefined, ["don't", "Do not"]),
        order("p3", "Excuse me, how do I get to the station?"),
      ],
    },
    reading: {
      title: "Directions to the party",
      text: "From the station, go straight on along Hill Road. At the traffic lights, turn left into Rose Street. Take the second street on the right. My house is on the corner, number 12, opposite a small park. Don't go into the park — it's closed at night!",
      questions: [
        mc("r1", "Where do you turn left?", ["at the station", "at the traffic lights", "at the park"], 1, undefined, "reading"),
        mc("r2", "Where is the house?", ["next to the station", "on the corner, opposite a park", "in the park"], 1, undefined, "reading"),
      ],
    },
    listening: {
      title: "To the museum",
      script: [
        { speaker: "Visitor", text: "Excuse me, how do I get to the museum?" },
        { speaker: "Guide", text: "Go straight on, then turn right at the corner. The museum is on the left, next to a big hotel." },
      ],
      questions: [
        mc("l1", "Where does the visitor turn right?", ["at the corner", "at the hotel", "at the lights"], 0, undefined, "listening"),
        mc("l2", "What is next to the museum?", ["a park", "a hotel", "a bank"], 1, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["Excuse me, where is the station?", "Go straight on.", "Turn left at the traffic lights.", "It's on the corner."] },
    writing: {
      prompt: "Write directions from your home to a shop or café near you.",
      minWords: 25,
      targetWords: ["turn", "go straight on", "on the"],
      model: "Leave my house and turn right. Go straight on for five minutes. At the traffic lights turn left. The café is on the corner, next to the bank.",
    },
    quizExtra: [mc("q1", "⬆️ means…", ["turn left", "go straight on", "turn right"], 1)],
  }),

  // ───────────────────────── Unit 3 · Free Time ─────────────────────────
  lesson({
    id: "A1-u3-l1",
    unitId: "A1-u3",
    title: "My Hobbies",
    goal: "Talk about hobbies with like, love, enjoy + -ing.",
    vocab: [
      v("play-football", "play football", "phrase", "To play the ball game with two teams.", "We play football on Saturdays.", "⚽"),
      v("read", "read", "verb", "To look at and understand words in a book.", "I love reading novels.", "📖"),
      v("swim", "swim", "verb", "To move through water using your arms and legs.", "She swims every morning.", "🏊"),
      v("listen-to-music", "listen to music", "phrase", "To hear songs because you enjoy them.", "I listen to music on the bus.", "🎧"),
      v("dance", "dance", "verb", "To move your body to music.", "They dance at parties.", "💃"),
      v("take-photos", "take photos", "phrase", "To make pictures with a camera or phone.", "He enjoys taking photos of nature.", "📷"),
    ],
    grammar: {
      id: "g-like-ing",
      title: "like / love / enjoy / hate + -ing",
      explanation: [
        "After **like, love, enjoy, hate** we often use the verb + **-ing**: I **love dancing**.",
        "Spelling: swim → swi**mming**, dance → danc**ing**, play → play**ing**.",
        "**don't mind** = it's OK for me: I don't mind cooking.",
      ],
      examples: [
        { en: "I enjoy swimming in the sea." },
        { en: "She hates getting up early." },
        { en: "Do you like reading? — Yes, I love it!" },
      ],
      mistakes: [
        { wrong: "I enjoy to swim.", right: "I enjoy swimming.", why: "Enjoy is always followed by -ing." },
        { wrong: "I like swiming.", right: "I like swimming.", why: "Double the m: swim → swimming." },
      ],
      practice: [
        cloze("p1", "I love ___ to music. (listen)", "listening"),
        cloze("p2", "He enjoys ___ in the lake. (swim)", "swimming"),
        mc("p3", "Choose the correct sentence.", ["She hates to cooking.", "She hates cooking.", "She hate cooking."], 1),
      ],
    },
    reading: {
      title: "Club profiles",
      text: "Hi, I'm Dev. I love playing football and I enjoy taking photos at matches. I don't like reading much.\nHi, I'm Lena. I enjoy reading and listening to jazz. I hate running, but I don't mind swimming.",
      questions: [
        mc("r1", "What does Dev enjoy?", ["reading", "taking photos", "swimming"], 1, undefined, "reading"),
        mc("r2", "How does Lena feel about swimming?", ["she loves it", "she hates it", "it's OK for her"], 2, undefined, "reading"),
      ],
    },
    listening: {
      title: "Weekend plans",
      script: [
        { speaker: "Kate", text: "What do you like doing at the weekend?" },
        { speaker: "Omar", text: "I love dancing! I go to a dance class on Saturday. And you?" },
        { speaker: "Kate", text: "I enjoy swimming and reading in the park." },
      ],
      questions: [
        mc("l1", "What does Omar love?", ["swimming", "dancing", "reading"], 1, undefined, "listening"),
        mc("l2", "Where does Kate read?", ["at home", "in a café", "in the park"], 2, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["I love reading.", "She enjoys swimming.", "Do you like dancing?", "I don't mind cooking."] },
    writing: {
      prompt: "Write about your hobbies: what you love, enjoy and hate doing.",
      minWords: 25,
      targetWords: ["love", "enjoy", "-ing"],
      model: "In my free time I love reading and listening to music. I enjoy swimming at the weekend. I don't mind cooking, but I hate cleaning the house.",
    },
    quizExtra: [mc("q1", "Which is correct?", ["I enjoy to dance.", "I enjoy dancing.", "I enjoy dance."], 1)],
  }),
  lesson({
    id: "A1-u3-l2",
    unitId: "A1-u3",
    title: "How Often?",
    goal: "Say how often you do things with frequency adverbs.",
    vocab: [
      v("always", "always", "adverb", "Every time (100%).", "I always drink coffee in the morning.", "💯"),
      v("usually", "usually", "adverb", "Most of the time (about 80%).", "We usually eat at home.", "📆"),
      v("often", "often", "adverb", "Many times (about 60%).", "She often goes to the cinema.", "🔁"),
      v("sometimes", "sometimes", "adverb", "Some of the time (about 40%).", "I sometimes take the bus.", "🎲"),
      v("never", "never", "adverb", "Not at any time (0%).", "He never eats meat.", "🚫"),
      v("once-a-week", "once a week", "phrase", "One time every week.", "I go to the gym once a week.", "1️⃣"),
    ],
    grammar: {
      id: "g-adverbs-frequency",
      title: "Adverbs of frequency",
      explanation: [
        "Put **always, usually, often, sometimes, never** before the main verb: I **often** play tennis.",
        "Put them after **be**: She **is always** late.",
        "Ask with **How often …?** Answer with expressions like **every day, twice a week, once a month** (at the end).",
      ],
      examples: [
        { en: "I usually walk to work." },
        { en: "They are never at home on Fridays." },
        { en: "How often do you swim? — Twice a week." },
      ],
      mistakes: [
        { wrong: "I go always to the gym.", right: "I always go to the gym.", why: "Frequency adverbs go before the main verb." },
        { wrong: "She always is happy.", right: "She is always happy.", why: "Put the adverb after be." },
        { wrong: "I don't never eat meat.", right: "I never eat meat.", why: "Never is already negative." },
      ],
      practice: [
        order("p1", "I usually walk to work"),
        mc("p2", "Choose the correct sentence.", ["He is often tired.", "He often is tired.", "Often he tired."], 0),
        cloze("p3", "How ___ do you go to the cinema?", "often"),
      ],
    },
    reading: {
      title: "A healthy life?",
      text: "Jamal always has breakfast, and he usually eats fruit with it. He often walks to work, but when it rains he takes the bus. He sometimes plays basketball with friends — about once a week. He never smokes, and he goes to bed early on weekdays.",
      questions: [
        mc("r1", "How often does Jamal play basketball?", ["every day", "about once a week", "never"], 1, undefined, "reading"),
        mc("r2", "When does he take the bus?", ["always", "when it rains", "on Fridays"], 1, undefined, "reading"),
      ],
    },
    listening: {
      title: "A survey",
      script: [
        { speaker: "Researcher", text: "How often do you eat fast food?" },
        { speaker: "Man", text: "Hmm, sometimes. Maybe once a month." },
        { speaker: "Researcher", text: "And how often do you cook?" },
        { speaker: "Man", text: "I usually cook dinner. I never cook breakfast!" },
      ],
      questions: [
        mc("l1", "How often does the man eat fast food?", ["once a week", "once a month", "never"], 1, undefined, "listening"),
        mc("l2", "Which meal does he never cook?", ["breakfast", "lunch", "dinner"], 0, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["I always drink water.", "She is never late.", "How often do you exercise?", "I go swimming twice a week."] },
    writing: {
      prompt: "Write about your habits with always, usually, sometimes and never.",
      minWords: 25,
      targetWords: ["always", "sometimes", "never"],
      model: "I always get up at seven. I usually have tea for breakfast. I sometimes go running in the park. I never watch TV in the morning.",
    },
    quizExtra: [mc("q1", "0% is…", ["sometimes", "never", "often"], 1)],
  }),
  lesson({
    id: "A1-u3-l3",
    unitId: "A1-u3",
    title: "Can You Swim?",
    goal: "Talk about abilities with can and can't.",
    vocab: [
      v("can", "can", "verb", "Used to say you are able to do something.", "I can speak two languages.", "💪"),
      v("cant", "can't", "verb", "Cannot; not able to.", "He can't drive.", "🙅"),
      v("ride-a-bike", "ride a bike", "phrase", "To travel on a bicycle.", "My son can ride a bike.", "🚲"),
      v("drive", "drive", "verb", "To control a car.", "Can you drive?", "🚗"),
      v("play-the-guitar", "play the guitar", "phrase", "To make music with a guitar.", "She can play the guitar very well.", "🎸"),
      v("speak", "speak", "verb", "To say words in a language.", "I can speak a little English.", "🗣️"),
    ],
    grammar: {
      id: "g-can-ability",
      title: "can / can't for ability",
      explanation: [
        "**can** + base verb for all people: I/you/he/she/we/they **can swim**. No -s!",
        "Negative: **can't** (cannot). Question: **Can** + subject + verb? Short answers: Yes, I can. / No, I can't.",
        "Add **well, very well, a little** to say how good you are.",
      ],
      examples: [
        { en: "She can speak three languages." },
        { en: "I can't play the piano." },
        { en: "Can you cook? — Yes, I can, but not very well." },
      ],
      mistakes: [
        { wrong: "He cans swim.", right: "He can swim.", why: "Can never takes -s." },
        { wrong: "I can to drive.", right: "I can drive.", why: "No to after can." },
        { wrong: "Do you can swim?", right: "Can you swim?", why: "Questions start with can, not do." },
      ],
      practice: [
        cloze("p1", "My grandmother ___ use a smartphone very well. (✓)", "can"),
        cloze("p2", "I ___ drive. I don't have a licence. (✗)", "can't", undefined, ["cannot", "can not"]),
        mc("p3", "___ your brother play the guitar?", ["Does", "Can", "Is"], 1),
      ],
    },
    reading: {
      title: "Talent show",
      text: "Our school has a talent show this Friday! Mei can sing and play the guitar. Tomás can dance very well, but he can't sing at all. Lucy can do magic tricks. Can you do something special? Talk to Mr Green before Wednesday.",
      questions: [
        mc("r1", "What can't Tomás do?", ["dance", "sing", "play the guitar"], 1, undefined, "reading"),
        mc("r2", "Who can do magic tricks?", ["Mei", "Lucy", "Mr Green"], 1, undefined, "reading"),
      ],
    },
    listening: {
      title: "A job interview",
      script: [
        { speaker: "Manager", text: "Can you drive?" },
        { speaker: "Ali", text: "Yes, I can. And I can speak English and Arabic." },
        { speaker: "Manager", text: "Can you use a computer?" },
        { speaker: "Ali", text: "Yes, very well. But I can't type very fast." },
      ],
      questions: [
        mc("l1", "Which languages can Ali speak?", ["English and French", "English and Arabic", "only English"], 1, undefined, "listening"),
        mc("l2", "What can't Ali do well?", ["drive", "use a computer", "type fast"], 2, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["I can swim.", "She can't drive.", "Can you play the guitar?", "Yes, I can, but not very well."] },
    writing: {
      prompt: "Write about three things you can do and two things you can't do.",
      minWords: 25,
      targetWords: ["can", "can't", "well"],
      model: "I can speak Spanish and a little English. I can cook very well. I can ride a bike. I can't drive and I can't play the piano.",
    },
    quizExtra: [mc("q1", "Choose the correct question.", ["Do you can dance?", "Can you dance?", "You can dance?"], 1)],
  }),
];
