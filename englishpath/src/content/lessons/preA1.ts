import { cloze, lesson, mc, order, v } from "../helpers";

/** Fully written Pre-A1 content: units 1–3 (original material). */
export const PRE_A1_LESSONS = [
  // ───────────────────────── Unit 1 · First Words ─────────────────────────
  lesson({
    id: "PreA1-u1-l1",
    unitId: "PreA1-u1",
    title: "Hello and Goodbye",
    goal: "Say hello, say goodbye and use polite words.",
    vocab: [
      v("hello", "hello", "interjection", "A word you say when you meet someone.", "Hello! Nice to meet you.", "👋"),
      v("goodbye", "goodbye", "interjection", "A word you say when you leave.", "Goodbye! See you tomorrow.", "🚶"),
      v("please", "please", "interjection", "A polite word when you ask for something.", "Water, please.", "🙏"),
      v("thank-you", "thank you", "phrase", "Words you say when someone helps you.", "Thank you for the coffee.", "💐"),
      v("yes", "yes", "interjection", "The answer when something is true.", "Yes, I am a student.", "✅"),
      v("no", "no", "interjection", "The answer when something is not true.", "No, I am not a teacher.", "❌"),
    ],
    grammar: {
      id: "g-i-am-you-are",
      title: "I am / You are",
      explanation: [
        "Use **am** with **I**. Use **are** with **you**.",
        "In speaking we often make it short: I am → **I'm**, you are → **you're**.",
      ],
      examples: [
        { en: "I am Sara.", note: "I + am" },
        { en: "You are my friend.", note: "you + are" },
        { en: "I'm fine, thank you.", note: "I'm = I am" },
      ],
      mistakes: [
        { wrong: "I is Tom.", right: "I am Tom.", why: "With I we always use am." },
        { wrong: "You is nice.", right: "You are nice.", why: "With you we always use are." },
      ],
      practice: [
        cloze("p1", "I ___ Anna.", "am", "I + am.", ["'m"]),
        cloze("p2", "You ___ my teacher.", "are", "You + are.", ["'re"]),
        mc("p3", "Choose the correct sentence.", ["I are happy.", "I am happy.", "I is happy."], 1, "I + am."),
      ],
    },
    reading: {
      title: "At the door",
      text: "Mia: Hello! I'm Mia.\nLeo: Hi, Mia. I'm Leo.\nMia: Come in, please.\nLeo: Thank you!\n…\nLeo: Goodbye, Mia!\nMia: Goodbye, Leo!",
      questions: [
        mc("r1", "Who says \"Come in, please\"?", ["Leo", "Mia"], 1, undefined, "reading"),
        mc("r2", "What does Leo say at the end?", ["Hello", "Thank you", "Goodbye"], 2, undefined, "reading"),
      ],
    },
    listening: {
      title: "Two friends meet",
      script: [
        { speaker: "Ben", text: "Hello, Kim!" },
        { speaker: "Kim", text: "Hi, Ben! A tea, please?" },
        { speaker: "Ben", text: "Yes. Here you are." },
        { speaker: "Kim", text: "Thank you!" },
      ],
      questions: [
        mc("l1", "What does Kim want?", ["Coffee", "Tea", "Water"], 1, undefined, "listening"),
        mc("l2", "What does Kim say last?", ["Thank you", "Goodbye", "Hello"], 0, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["Hello!", "Thank you.", "I am happy.", "Goodbye, see you tomorrow."] },
    writing: {
      prompt: "Write two short sentences: say hello and say your name. Example: Hello! I am …",
      minWords: 4,
      targetWords: ["hello", "I am"],
      model: "Hello! I am Carlos. Thank you.",
    },
    quizExtra: [mc("q1", "You leave your friend's house. You say:", ["Hello", "Goodbye", "Please"], 1)],
  }),
  lesson({
    id: "PreA1-u1-l2",
    unitId: "PreA1-u1",
    title: "Numbers 1 to 10",
    goal: "Count from one to ten and say how many.",
    vocab: [
      v("one", "one", "number", "The number 1.", "I have one sister.", "1️⃣"),
      v("two", "two", "number", "The number 2.", "Two coffees, please.", "2️⃣"),
      v("three", "three", "number", "The number 3.", "I see three birds.", "3️⃣"),
      v("five", "five", "number", "The number 5.", "I have five fingers on one hand.", "🖐️"),
      v("eight", "eight", "number", "The number 8.", "The class starts at eight.", "8️⃣"),
      v("ten", "ten", "number", "The number 10.", "I have ten fingers.", "🔟"),
    ],
    grammar: {
      id: "g-a-an",
      title: "a / an",
      explanation: [
        "Use **a** or **an** before one thing (a singular noun).",
        "Use **a** before a consonant sound: a book, a cat.",
        "Use **an** before a vowel sound (a, e, i, o, u): an apple, an egg.",
      ],
      examples: [
        { en: "a pen", note: "p = consonant sound" },
        { en: "an orange", note: "o = vowel sound" },
        { en: "an umbrella", note: "u = vowel sound" },
      ],
      mistakes: [
        { wrong: "a apple", right: "an apple", why: "Apple starts with a vowel sound, so we use an." },
        { wrong: "an book", right: "a book", why: "Book starts with a consonant sound, so we use a." },
      ],
      practice: [
        cloze("p1", "I have ___ egg.", "an", "Egg starts with a vowel sound."),
        cloze("p2", "She has ___ cat.", "a", "Cat starts with a consonant sound."),
        mc("p3", "Choose the correct words.", ["a orange", "an orange"], 1),
      ],
    },
    reading: {
      title: "My numbers",
      text: "I have one phone. I have two bags. My house is number eight. My class has ten students.",
      questions: [
        mc("r1", "How many bags?", ["one", "two", "ten"], 1, undefined, "reading"),
        mc("r2", "What is the house number?", ["three", "five", "eight"], 2, undefined, "reading"),
      ],
    },
    listening: {
      title: "Phone number",
      script: [
        { speaker: "Ana", text: "My number is five, three, eight, one." },
        { speaker: "Tom", text: "Five, three, eight, one. Thank you!" },
      ],
      questions: [
        mc("l1", "What is Ana's number?", ["5381", "5318", "3581"], 0, undefined, "listening"),
        mc("l2", "What is the first number?", ["three", "five", "one"], 1, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["One, two, three.", "I have an apple.", "Ten students.", "My number is five."] },
    writing: {
      prompt: "Write about things you have. Use numbers. Example: I have two bags.",
      minWords: 6,
      targetWords: ["I have", "two"],
      model: "I have one phone. I have two pens. I have ten fingers.",
    },
    quizExtra: [mc("q1", "Three + two =", ["five", "eight", "ten"], 0)],
  }),
  lesson({
    id: "PreA1-u1-l3",
    unitId: "PreA1-u1",
    title: "What's Your Name?",
    goal: "Ask and answer questions about names.",
    vocab: [
      v("name", "name", "noun", "The word people call you.", "My name is Lina.", "🏷️"),
      v("nice", "nice", "adjective", "Good and pleasant.", "Nice to meet you!", "😊"),
      v("meet", "meet", "verb", "To see and talk to someone for the first time.", "Nice to meet you, Paul.", "🤝"),
      v("friend", "friend", "noun", "A person you like and know well.", "Omar is my friend.", "🧑‍🤝‍🧑"),
      v("student", "student", "noun", "A person who studies at a school.", "I am a student.", "🎒"),
      v("teacher", "teacher", "noun", "A person who teaches at a school.", "She is my teacher.", "🧑‍🏫"),
    ],
    grammar: {
      id: "g-what-is-your-name",
      title: "What is your name? / My name is …",
      explanation: [
        "Ask: **What is your name?** (short: What's your name?)",
        "Answer: **My name is** + name. Or: **I'm** + name.",
        "Use **my** for you and **your** for the other person.",
      ],
      examples: [
        { en: "What's your name?" },
        { en: "My name is Daniel." },
        { en: "I'm Daniel. Nice to meet you." },
      ],
      mistakes: [
        { wrong: "What your name?", right: "What is your name?", why: "The question needs is." },
        { wrong: "Me name is Ali.", right: "My name is Ali.", why: "Use my before a noun." },
      ],
      practice: [
        cloze("p1", "What is ___ name?", "your", "Ask about the other person: your."),
        cloze("p2", "___ name is Eva.", "My", "Talk about you: my.", ["my"]),
        order("p3", "What is your name?"),
      ],
    },
    reading: {
      title: "First day at school",
      text: "Teacher: Hello! What's your name?\nStudent: My name is Rosa.\nTeacher: Nice to meet you, Rosa. I'm Mr Brown. I'm your teacher.\nRosa: Nice to meet you too!",
      questions: [
        mc("r1", "What is the student's name?", ["Mr Brown", "Rosa", "Rita"], 1, undefined, "reading"),
        mc("r2", "Who is Mr Brown?", ["a student", "a friend", "the teacher"], 2, undefined, "reading"),
      ],
    },
    listening: {
      title: "New friends",
      script: [
        { speaker: "Sam", text: "Hi! I'm Sam. What's your name?" },
        { speaker: "Yuki", text: "My name is Yuki. I'm a student." },
        { speaker: "Sam", text: "Nice to meet you, Yuki!" },
      ],
      questions: [
        mc("l1", "What is the girl's name?", ["Sam", "Yuki", "Yoko"], 1, undefined, "listening"),
        mc("l2", "Yuki is a…", ["teacher", "doctor", "student"], 2, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["What's your name?", "My name is Alex.", "Nice to meet you.", "I am a student."] },
    writing: {
      prompt: "Introduce yourself in two or three sentences: your name and student or teacher.",
      minWords: 6,
      targetWords: ["My name is", "I am"],
      model: "Hello! My name is Nadia. I am a student. Nice to meet you!",
    },
    quizExtra: [mc("q1", "Someone says \"Nice to meet you.\" You answer:", ["Nice to meet you too.", "Goodbye.", "Yes, please."], 0)],
  }),

  // ───────────────────────── Unit 2 · People and Family ─────────────────────────
  lesson({
    id: "PreA1-u2-l1",
    unitId: "PreA1-u2",
    title: "My Family",
    goal: "Name family members and introduce them.",
    vocab: [
      v("mother", "mother", "noun", "Your female parent. Also: mum, mom.", "My mother is a nurse.", "👩"),
      v("father", "father", "noun", "Your male parent. Also: dad.", "My father likes football.", "👨"),
      v("sister", "sister", "noun", "A girl with the same parents as you.", "My sister is ten.", "👧"),
      v("brother", "brother", "noun", "A boy with the same parents as you.", "This is my brother, Max.", "👦"),
      v("baby", "baby", "noun", "A very young child.", "The baby is sleeping.", "👶"),
      v("family", "family", "noun", "Parents, children, brothers and sisters.", "I love my family.", "👨‍👩‍👧"),
    ],
    grammar: {
      id: "g-this-is-my",
      title: "This is my …",
      explanation: [
        "Use **This is my** + person to introduce someone near you.",
        "Use **This is** for one person. For two or more people use **These are**.",
      ],
      examples: [
        { en: "This is my mother." },
        { en: "This is my brother, Tom." },
        { en: "These are my sisters." },
      ],
      mistakes: [
        { wrong: "This my father.", right: "This is my father.", why: "Don't forget is." },
        { wrong: "This is my sisters.", right: "These are my sisters.", why: "For more than one person: These are." },
      ],
      practice: [
        cloze("p1", "This ___ my father.", "is", "This + is."),
        cloze("p2", "These ___ my brothers.", "are", "These + are."),
        mc("p3", "Choose the correct sentence.", ["This is my sister.", "This my sister.", "This are my sister."], 0),
      ],
    },
    reading: {
      title: "A family photo",
      text: "Look at my photo! This is my family. This is my mother, Rosa, and this is my father, Luis. These are my brothers, Pablo and Leo. The baby is my sister, Inés.",
      questions: [
        mc("r1", "What is the father's name?", ["Pablo", "Luis", "Leo"], 1, undefined, "reading"),
        mc("r2", "Who is the baby?", ["Inés", "Rosa", "Leo"], 0, undefined, "reading"),
      ],
    },
    listening: {
      title: "Who is this?",
      script: [
        { speaker: "Eva", text: "Who is this?" },
        { speaker: "Jon", text: "This is my sister, Lily. And this is my father." },
        { speaker: "Eva", text: "Nice family!" },
      ],
      questions: [
        mc("l1", "Lily is Jon's…", ["mother", "sister", "brother"], 1, undefined, "listening"),
        mc("l2", "Who else is in the photo?", ["his father", "his baby", "his teacher"], 0, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["This is my mother.", "This is my brother.", "These are my sisters.", "I love my family."] },
    writing: {
      prompt: "Write about your family. Use This is my … and These are my …",
      minWords: 10,
      targetWords: ["This is my", "family"],
      model: "This is my family. This is my mother, Hana. This is my father, Kenji. These are my sisters.",
    },
    quizExtra: [mc("q1", "Your mother's son is your…", ["sister", "brother", "father"], 1)],
  }),
  lesson({
    id: "PreA1-u2-l2",
    unitId: "PreA1-u2",
    title: "He and She",
    goal: "Talk about other people with he and she.",
    vocab: [
      v("man", "man", "noun", "An adult male person.", "The man is tall.", "🧔"),
      v("woman", "woman", "noun", "An adult female person.", "The woman is a doctor.", "👩‍🦱"),
      v("boy", "boy", "noun", "A male child.", "The boy is my son.", "🧒"),
      v("girl", "girl", "noun", "A female child.", "The girl is happy.", "👧"),
      v("doctor", "doctor", "noun", "A person who helps sick people.", "He is a doctor.", "🧑‍⚕️"),
      v("happy", "happy", "adjective", "Feeling good.", "She is happy today.", "😄"),
    ],
    grammar: {
      id: "g-he-she-is",
      title: "He is / She is",
      explanation: [
        "Use **he** for a man or boy. Use **she** for a woman or girl. Use **it** for a thing.",
        "With he, she and it we use **is**. Short forms: he's, she's, it's.",
      ],
      examples: [
        { en: "He is a doctor." },
        { en: "She's my friend." },
        { en: "It is a book." },
      ],
      mistakes: [
        { wrong: "She are happy.", right: "She is happy.", why: "He/She/It + is." },
        { wrong: "He is a girl.", right: "She is a girl.", why: "Use she for a girl or woman." },
      ],
      practice: [
        cloze("p1", "Maria is my friend. ___ is a teacher.", "She", "Maria is a woman: she.", ["she"]),
        cloze("p2", "My father ___ a doctor.", "is", "One person: is."),
        mc("p3", "Tom is a boy. ___ is ten.", ["She", "He", "It"], 1),
      ],
    },
    reading: {
      title: "People in my street",
      text: "This is Mr Lee. He is a doctor. He is very nice. This is Ms Park. She is a teacher. She is happy. Her son is Jun. He is a boy. He is eight.",
      questions: [
        mc("r1", "What is Mr Lee's job?", ["teacher", "doctor", "student"], 1, undefined, "reading"),
        mc("r2", "How old is Jun?", ["six", "eight", "ten"], 1, undefined, "reading"),
      ],
    },
    listening: {
      title: "At the park",
      script: [
        { speaker: "Lucy", text: "Who is the girl?" },
        { speaker: "Mark", text: "She is my daughter, Emma. She is five." },
        { speaker: "Lucy", text: "She is very happy!" },
      ],
      questions: [
        mc("l1", "Who is Emma?", ["Mark's sister", "Mark's daughter", "Lucy's friend"], 1, undefined, "listening"),
        mc("l2", "How old is Emma?", ["five", "nine", "two"], 0, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["He is a doctor.", "She is my friend.", "The boy is happy.", "She is a teacher."] },
    writing: {
      prompt: "Write about two people you know. Use He is … and She is …",
      minWords: 10,
      targetWords: ["He is", "She is"],
      model: "This is my friend Omar. He is a doctor. This is my sister. She is a student. She is happy.",
    },
    quizExtra: [mc("q1", "My mother is a woman. ___ is nice.", ["He", "She", "It"], 1)],
  }),
  lesson({
    id: "PreA1-u2-l3",
    unitId: "PreA1-u2",
    title: "How Old Are You?",
    goal: "Ask and say ages, using numbers 11 to 20.",
    vocab: [
      v("eleven", "eleven", "number", "The number 11.", "My brother is eleven.", "⚽"),
      v("twelve", "twelve", "number", "The number 12.", "There are twelve months in a year.", "🗓️"),
      v("fifteen", "fifteen", "number", "The number 15.", "She is fifteen years old.", "🎂"),
      v("twenty", "twenty", "number", "The number 20.", "I am twenty.", "🎉"),
      v("old", "old", "adjective", "Having lived many years; also used to ask age.", "How old are you?", "👴"),
      v("young", "young", "adjective", "Not old; having lived few years.", "My sister is young.", "🐣"),
    ],
    grammar: {
      id: "g-years-old",
      title: "I am … years old",
      explanation: [
        "Ask: **How old are you?** / **How old is he/she?**",
        "Answer with **be** + number + (years old): **I am 20 (years old).**",
        "In English we use **be** for age, not have.",
      ],
      examples: [
        { en: "How old are you? — I'm nineteen." },
        { en: "She is twelve years old." },
        { en: "How old is your father? — He's fifty." },
      ],
      mistakes: [
        { wrong: "I have 20 years.", right: "I am 20 years old.", why: "Use be for age in English." },
        { wrong: "How old you are?", right: "How old are you?", why: "In questions, are comes before you." },
      ],
      practice: [
        cloze("p1", "I ___ fifteen years old.", "am", "Use be for age.", ["'m"]),
        cloze("p2", "How old ___ your sister?", "is", "Your sister = she: is."),
        order("p3", "How old are you?"),
      ],
    },
    reading: {
      title: "Birthday party",
      text: "Today is Sofia's birthday. She is twelve years old. Her brother Nick is fifteen. Her grandmother is very old: she is ninety! The baby, Lou, is very young. He is one.",
      questions: [
        mc("r1", "How old is Sofia?", ["eleven", "twelve", "fifteen"], 1, undefined, "reading"),
        mc("r2", "Who is fifteen?", ["Nick", "Lou", "Sofia"], 0, undefined, "reading"),
      ],
    },
    listening: {
      title: "How old?",
      script: [
        { speaker: "Paul", text: "How old are you, Hana?" },
        { speaker: "Hana", text: "I'm twenty. And you?" },
        { speaker: "Paul", text: "I'm eighteen." },
      ],
      questions: [
        mc("l1", "How old is Hana?", ["eighteen", "twelve", "twenty"], 2, undefined, "listening"),
        mc("l2", "How old is Paul?", ["eighteen", "eleven", "twenty"], 0, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["How old are you?", "I am twenty years old.", "She is twelve.", "My brother is young."] },
    writing: {
      prompt: "Write the ages of three people in your family.",
      minWords: 10,
      targetWords: ["years old", "is"],
      model: "I am nineteen years old. My mother is forty-five. My brother is twelve.",
    },
    quizExtra: [mc("q1", "Ten + five =", ["twelve", "fifteen", "twenty"], 1)],
  }),

  // ───────────────────────── Unit 3 · Things Around Me ─────────────────────────
  lesson({
    id: "PreA1-u3-l1",
    unitId: "PreA1-u3",
    title: "Colours",
    goal: "Name colours and describe things with colours.",
    vocab: [
      v("red", "red", "adjective", "The colour of blood or a tomato.", "The apple is red.", "🔴"),
      v("blue", "blue", "adjective", "The colour of the sky on a sunny day.", "The sky is blue.", "🔵"),
      v("green", "green", "adjective", "The colour of grass and leaves.", "The tree is green.", "🟢"),
      v("yellow", "yellow", "adjective", "The colour of a lemon or the sun.", "The banana is yellow.", "🟡"),
      v("black", "black", "adjective", "The colour of the night sky.", "My cat is black.", "⚫"),
      v("white", "white", "adjective", "The colour of snow and milk.", "The milk is white.", "⚪"),
    ],
    grammar: {
      id: "g-it-is-colour",
      title: "It is + colour / colour + noun",
      explanation: [
        "Say the colour after **is**: **The car is red.**",
        "Or put the colour before the noun: **a red car**.",
        "Colours do not change for plurals: two red cars (not reds).",
      ],
      examples: [
        { en: "It is blue." },
        { en: "I have a green bag." },
        { en: "The flowers are yellow." },
      ],
      mistakes: [
        { wrong: "a car red", right: "a red car", why: "The colour comes before the noun." },
        { wrong: "two blues bags", right: "two blue bags", why: "Adjectives don't take -s." },
      ],
      practice: [
        mc("p1", "Choose the correct phrase.", ["a bag black", "a black bag", "a blacks bag"], 1),
        cloze("p2", "The sky ___ blue.", "is"),
        mc("p3", "Choose the correct phrase.", ["three red apples", "three reds apples"], 0),
      ],
    },
    reading: {
      title: "My room",
      text: "My room is small. The walls are white. My bed is blue and my chair is green. I have a red lamp and a yellow clock. My cat, Pepper, is black.",
      questions: [
        mc("r1", "What colour is the bed?", ["green", "blue", "red"], 1, undefined, "reading"),
        mc("r2", "What colour is Pepper?", ["white", "yellow", "black"], 2, undefined, "reading"),
      ],
    },
    listening: {
      title: "In the shop",
      script: [
        { speaker: "Shop assistant", text: "Hello! Can I help you?" },
        { speaker: "Customer", text: "Yes, please. A green T-shirt." },
        { speaker: "Shop assistant", text: "Sorry, we have red, blue and black." },
        { speaker: "Customer", text: "OK, a blue T-shirt, please." },
      ],
      questions: [
        mc("l1", "What colour does the customer want first?", ["green", "blue", "red"], 0, undefined, "listening"),
        mc("l2", "What colour does the customer buy?", ["black", "blue", "red"], 1, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["The sky is blue.", "I have a red bag.", "My cat is black.", "The banana is yellow."] },
    writing: {
      prompt: "Describe three things in your room and their colours.",
      minWords: 10,
      targetWords: ["is", "red", "blue"],
      model: "My desk is white. I have a blue chair. My phone is black.",
    },
    quizExtra: [mc("q1", "Grass is…", ["red", "green", "white"], 1)],
  }),
  lesson({
    id: "PreA1-u3-l2",
    unitId: "PreA1-u3",
    title: "In My Bag",
    goal: "Name everyday objects using a and an.",
    vocab: [
      v("book", "book", "noun", "Pages with words that you read.", "I have a book in my bag.", "📕"),
      v("pen", "pen", "noun", "A thing you write with.", "Can I have a pen, please?", "🖊️"),
      v("phone", "phone", "noun", "A thing you use to call people.", "My phone is new.", "📱"),
      v("key", "key", "noun", "A small metal thing that opens a door.", "Where is my key?", "🔑"),
      v("bag", "bag", "noun", "A thing you carry your things in.", "My bag is red.", "👜"),
      v("umbrella", "umbrella", "noun", "A thing you hold over your head when it rains.", "I have an umbrella.", "☂️"),
    ],
    grammar: {
      id: "g-what-is-this",
      title: "What is this? It's a / an …",
      explanation: [
        "Ask about a thing: **What is this?** (short: What's this?)",
        "Answer: **It's a** + consonant-sound noun, or **It's an** + vowel-sound noun.",
      ],
      examples: [
        { en: "What's this? — It's a key." },
        { en: "What's this? — It's an umbrella." },
        { en: "It's a black phone." },
      ],
      mistakes: [
        { wrong: "It's umbrella.", right: "It's an umbrella.", why: "Use a/an with one thing." },
        { wrong: "What is it this?", right: "What is this?", why: "Don't use it and this together." },
      ],
      practice: [
        cloze("p1", "It's ___ umbrella.", "an"),
        cloze("p2", "It's ___ pen.", "a"),
        order("p3", "What is this?"),
      ],
    },
    reading: {
      title: "What's in the bag?",
      text: "This is my bag. In my bag I have a book, a pen and a phone. I have a key for my house. It's raining today, so I have an umbrella too!",
      questions: [
        mc("r1", "Why is there an umbrella?", ["It's sunny.", "It's raining.", "It's new."], 1, undefined, "reading"),
        mc("r2", "What is the key for?", ["the car", "the house", "the bag"], 1, undefined, "reading"),
      ],
    },
    listening: {
      title: "Lost and found",
      script: [
        { speaker: "Woman", text: "Excuse me, is this your phone?" },
        { speaker: "Man", text: "No, my phone is black. But that is my key!" },
        { speaker: "Woman", text: "Here you are." },
        { speaker: "Man", text: "Thank you very much!" },
      ],
      questions: [
        mc("l1", "What colour is the man's phone?", ["black", "white", "red"], 0, undefined, "listening"),
        mc("l2", "What does the man get back?", ["his phone", "his bag", "his key"], 2, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["What's this?", "It's a pen.", "It's an umbrella.", "My bag is red."] },
    writing: {
      prompt: "What is in your bag? Write three things with a or an.",
      minWords: 8,
      targetWords: ["a", "an", "bag"],
      model: "In my bag I have a phone, a book and an apple.",
    },
    quizExtra: [mc("q1", "You open a door with a…", ["pen", "key", "book"], 1)],
  }),
  lesson({
    id: "PreA1-u3-l3",
    unitId: "PreA1-u3",
    title: "Food I Like",
    goal: "Say what food you like and don't like.",
    vocab: [
      v("apple", "apple", "noun", "A round fruit, red or green.", "I eat an apple every day.", "🍎"),
      v("bread", "bread", "noun", "Food made from flour and baked.", "I like bread with cheese.", "🍞"),
      v("water", "water", "noun", "The clear drink from rain and rivers.", "Can I have some water?", "💧"),
      v("milk", "milk", "noun", "A white drink from cows.", "The baby drinks milk.", "🥛"),
      v("rice", "rice", "noun", "Small white grains you cook and eat.", "We eat rice for dinner.", "🍚"),
      v("egg", "egg", "noun", "Food from a chicken, with a shell.", "I have an egg for breakfast.", "🥚"),
    ],
    grammar: {
      id: "g-like-dont-like",
      title: "I like / I don't like",
      explanation: [
        "Use **like** for things you think are good: **I like apples.**",
        "Use **don't like** (do not like) for the opposite: **I don't like milk.**",
        "Ask: **Do you like …?** Answer: **Yes, I do. / No, I don't.**",
      ],
      examples: [
        { en: "I like rice." },
        { en: "I don't like eggs." },
        { en: "Do you like bread? — Yes, I do." },
      ],
      mistakes: [
        { wrong: "I no like milk.", right: "I don't like milk.", why: "Use don't before like." },
        { wrong: "Do you like apples? — Yes, I like.", right: "Yes, I do.", why: "Short answers use do / don't." },
      ],
      practice: [
        cloze("p1", "I ___ like milk. It's not nice.", "don't", "Negative: don't.", ["do not"]),
        cloze("p2", "___ you like rice?", "Do", "Questions start with Do.", ["do"]),
        mc("p3", "Do you like apples? — Yes, I…", ["like", "do", "am"], 1),
      ],
    },
    reading: {
      title: "Breakfast",
      text: "For breakfast I like bread and eggs. I don't like milk, so I drink water. My brother likes rice for breakfast! He doesn't like eggs.",
      questions: [
        mc("r1", "What does the writer drink?", ["milk", "water", "tea"], 1, undefined, "reading"),
        mc("r2", "What does the brother eat for breakfast?", ["eggs", "bread", "rice"], 2, undefined, "reading"),
      ],
    },
    listening: {
      title: "Do you like…?",
      script: [
        { speaker: "Nina", text: "Do you like apples, Tim?" },
        { speaker: "Tim", text: "Yes, I do. I love apples!" },
        { speaker: "Nina", text: "Do you like milk?" },
        { speaker: "Tim", text: "No, I don't." },
      ],
      questions: [
        mc("l1", "Does Tim like apples?", ["Yes", "No"], 0, undefined, "listening"),
        mc("l2", "What doesn't Tim like?", ["apples", "milk", "water"], 1, undefined, "listening"),
      ],
    },
    speaking: { prompts: ["I like apples.", "I don't like milk.", "Do you like rice?", "Yes, I do."] },
    writing: {
      prompt: "Write about food you like and food you don't like.",
      minWords: 10,
      targetWords: ["I like", "I don't like"],
      model: "I like rice and eggs. I like water. I don't like milk.",
    },
    quizExtra: [mc("q1", "Which is a drink?", ["bread", "water", "rice"], 1)],
  }),
];
