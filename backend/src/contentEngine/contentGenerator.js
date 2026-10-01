/**
 * Content Generation Engine
 *
 * Generates natural, modern, evocative original content for short-form quote videos.
 * - Tamil: Natural, flowing, modern Tamil with poetic elegance.
 * - English: Expressive, concise, punchy modern English.
 * - Thirukkural: Strictly uses authentic verified couplets from thirukkuralSource with fresh modern explanations.
 * - Tailored for video durations (10s, 15s, 20s, 30s).
 */

const { getAuthenticThirukkural } = require('./thirukkuralSource');
const { getTopicMeta } = require('./topicRotation');

// Original Curated Quotes Library by Topic, Language, and Duration
const ORIGINAL_QUOTES = {
  // MOTIVATION
  motivation: {
    ta: [
      {
        title: 'நம்பிக்கையின் வேகம்',
        quote: 'உன் பாதைகள் கடினமாக இருக்கலாம், ஆனால் நீ அடையும் சிகரம் அதைவிட கம்பீரமானது.',
        explanation: 'சவால்கள் வரும்போது தயங்காதே. ஒவ்வொரு தடையையும் அடுத்த உயரத்திற்கான படியாக மாற்று.',
        caption: 'எந்தத் தடையும் உன் இலக்கை விடப் பெரிதல்ல. தொடர்ந்து முன்னேறு! 🔥',
        hashtags: ['#TamilMotivation', '#SelfBelief', '#Focus', '#NeverGiveUp', '#Flowbox'],
        optimalDurations: [10, 15],
      },
      {
        title: 'விடியலின் சாட்சி',
        quote: 'இருளின் ஆழம் கண்டு அஞ்சாதே; அதிகாலையின் முதல் வெளிச்சம் உனக்காகத்தான் காத்திருக்கிறது.',
        explanation: 'கடினமான தருணங்கள் நிரந்தரமல்ல. மன உறுதியோடு போராடும் வரை வெற்றி நம் பக்கமே.',
        caption: 'நம்பிக்கையை இழக்காதே, உன் நேரம் நெருங்கிக்கொண்டிருக்கிறது. ✨',
        hashtags: ['#TamilQuotes', '#DailyMotivation', '#Hope', '#Determination'],
        optimalDurations: [15, 20],
      },
      {
        title: 'விடாமுயற்சியின் வலிமை',
        quote: 'விழும் ஒவ்வொரு முறையும் நீ கற்பது தோல்வியை அல்ல; மீண்டும் எப்படிப் புத்துயிர்ப்போடு எழுவது என்ற ரகசியத்தைத்தான்.',
        explanation: 'தோல்வி என்பது முடிவு அல்ல, அது சிறந்த அனுபவத்தின் புதிய தொடக்கம்.',
        caption: 'மீண்டும் எழுந்து நில், உலகை வெல்! 💪',
        hashtags: ['#InspirationTamil', '#RiseAgain', '#Persistence', '#TamilReels'],
        optimalDurations: [15, 20, 30],
      },
      {
        title: 'உன் கனவை நம்பு',
        quote: 'மற்றவர்கள் உன்னை நம்பும் முன், நீ உன்னை முழுமையாக நம்பத் தொடங்கு.',
        explanation: 'உன் மீது நீ வைக்கும் தன்னம்பிக்கையே உலகின் மிகப்பெரிய மாற்றத்தைத் தொடங்கும்.',
        caption: 'தன்னம்பிக்கைதான் வெற்றியின் முதல் படி. 🔥',
        hashtags: ['#SelfConfidence', '#TamilThought', '#DreamBig', '#Shorts'],
        optimalDurations: [10, 15],
      },
    ],
    en: [
      {
        title: 'The Unseen Climb',
        quote: 'The mountain seems steepest right before the summit opens to the morning sky.',
        explanation: 'When the path tests your patience the most, remember your breakthrough is closer than you think.',
        caption: 'Stay the course. The view from the top is worth every step. 🏔️🔥',
        hashtags: ['#Motivation', '#KeepGoing', '#Breakthrough', '#DailyQuote', '#Flowbox'],
        optimalDurations: [10, 15],
      },
      {
        title: 'Quiet Resilience',
        quote: 'Strength is not about never feeling weary; it is choosing to take one more honest step.',
        explanation: 'Consistent small efforts outlast sudden bursts of motivation every single time.',
        caption: 'One step at a time builds mountains. Keep moving forward. ✨',
        hashtags: ['#Resilience', '#InnerStrength', '#Focus', '#Discipline'],
        optimalDurations: [15, 20],
      },
      {
        title: 'Building Tomorrow',
        quote: 'Do not measure your worth by where you started; measure it by the courage you carry today.',
        explanation: 'Your origin is history, but your dedication today defines your entire tomorrow.',
        caption: 'Your courage today builds your future. Believe in yourself. 💫',
        hashtags: ['#Courage', '#SelfGrowth', '#InspirationDaily', '#Mindset'],
        optimalDurations: [15, 20, 30],
      },
      {
        title: 'The Silent Spark',
        quote: 'A quiet dedication today whispers louder than all the doubts of yesterday.',
        explanation: 'Let your silent daily work speak for your ambition.',
        caption: 'Focus on the work. Results will follow. ⚡',
        hashtags: ['#WorkEthic', '#Ambition', '#DailyDrive'],
        optimalDurations: [10, 15],
      },
    ],
  },

  // LOVE
  love: {
    ta: [
      {
        title: 'மௌனத்தின் மொழி',
        quote: 'சொற்கள் தேவையில்லாத ஒரு மௌனத்தில், இரு இதயங்கள் தமக்கான முழு அமைதியைக் கண்டுகொள்கின்றன.',
        explanation: 'தூய அன்பு என்பது எப்போதும் பேசுவதில் இல்லை; அமைதியாக ஒருவருக்கொருவர் புரிந்துகொள்வதில்தான் இருக்கிறது.',
        caption: 'மௌனத்திலும் பேசும் உண்மையான அன்பு. ❤️✨',
        hashtags: ['#TamilLoveQuotes', '#LoveLines', '#Heartfelt', '#TamilKavithai'],
        optimalDurations: [10, 15],
      },
      {
        title: 'இருப்பின் இதம்',
        quote: 'ஆயிரம் மனிதர்கள் கடந்து செல்லும் உலகில், ஒருவரின் ஒற்றைப் புன்னகை மட்டுமே மனதின் அமைதியாக மாறுகிறது.',
        explanation: 'நாம் நேசிக்கும் மனிதரின் சிறு அன்பும் கூட நம் வாழ்வின் மிகப்பெரிய நிறைவை அளித்துவிடுகிறது.',
        caption: 'உண்மையான அன்பு தரும் அமைதி அளவிட முடியாதது. 🌹',
        hashtags: ['#PureLove', '#TamilAffection', '#Soulmate', '#LoveReels'],
        optimalDurations: [15, 20],
      },
      {
        title: 'காலம் கடந்த பிணைப்பு',
        quote: 'நேரம் நழுவிக்கொண்டே இருக்கலாம், ஆனால் உண்மையான அன்பு ஒவ்வொரு நாளும் புதுப்பிக்கப்படும் ஒரு அழகிய கலை.',
        explanation: 'அன்பு என்பது ஒருமுறை தோன்றி மறைவதல்ல, அது வாழ்நாள் முழுவதும் வளரும் உணர்வு.',
        caption: 'என்றும் வாடாத அன்பின் பயணம். 💞',
        hashtags: ['#TimelessLove', '#TamilRomance', '#LoveWords', '#Feelings'],
        optimalDurations: [15, 20, 30],
      },
    ],
    en: [
      {
        title: 'Sanctuary of Peace',
        quote: 'In a noisy world, true love is the quiet space where your soul simply breathes easy.',
        explanation: 'Love is not about chaos or grand gestures; it is finding calm certainty in another soul.',
        caption: 'Home is not a place, it is a person you love. ❤️',
        hashtags: ['#LoveQuotes', '#Soulmate', '#PeaceOfMind', '#Heartstrings'],
        optimalDurations: [10, 15],
      },
      {
        title: 'Gentle Certainty',
        quote: 'The right presence does not ask you to hide your flaws; it helps you carry them with grace.',
        explanation: 'Genuine affection embraces who you are without demanding performance.',
        caption: 'To be loved as you are is life’s greatest gift. 🌸',
        hashtags: ['#UnconditionalLove', '#DeepLove', '#Relationships', '#LoveLife'],
        optimalDurations: [15, 20],
      },
      {
        title: 'Unspoken Harmony',
        quote: 'True companionship is when silence between two people feels warmer than a thousand empty promises.',
        explanation: 'When trust is complete, words become secondary to understanding.',
        caption: 'Quiet warmth, deep bond. 💖',
        hashtags: ['#TrueLove', '#Connection', '#Devotion', '#LoveNotes'],
        optimalDurations: [15, 20, 30],
      },
    ],
  },

  // HUMANITY
  humanity: {
    ta: [
      {
        title: 'சிறு கருணையின் வெளிச்சம்',
        quote: 'எதிர்பார்ப்பின்றி நீ காட்டும் ஒரு சிறு கருணை, பிறரின் இருண்ட நாளுக்குப் பேரொளியாக அமையலாம்.',
        explanation: 'மனிதநேயம் என்பது பெரிய தியாகங்களில் மட்டுமல்ல; அன்றாடம் நாம் காட்டும் அன்பான பரிவிலேயே வாழ்கிறது.',
        caption: 'அன்பும் கருணையுமே மனிதத்தின் அடையாளம். 🤝🌱',
        hashtags: ['#HumanityFirst', '#TamilHumanity', '#Kindness', '#Care'],
        optimalDurations: [10, 15],
      },
      {
        title: 'பகிர்வின் இனிமை',
        quote: 'பிறர் கண்ணீரைத் துடைக்கும் விரல்களே, இவ்வுலகின் மிகவும் புனிதமான தீபங்களாக ஒளிர்கின்றன.',
        explanation: 'நாம் வாழும் வாழ்க்கையின் மதிப்பு பிறருக்கு நாம் செய்யும் நன்மைகளில்தான் இருக்கிறது.',
        caption: 'மனிதநேயம் நம்மை வாழவைக்கிறது. ✨🕊️',
        hashtags: ['#Selfless', '#Empathy', '#TamilWisdom', '#Goodness'],
        optimalDurations: [15, 20],
      },
      {
        title: 'இணைக்கும் இதயம்',
        quote: 'மனிதர்கள் கட்டிய சுவர்களை விட, அவர்கள் கட்டும் பாலங்களே தலைமுறைகளுக்கு அமைதியைத் தருகின்றன.',
        explanation: 'வேற்றுமைகளைக் கடந்து ஒற்றுமையோடு வாழ்வதே நாகரிகத்தின் உச்சம்.',
        caption: 'மனிதர்களை இணைப்போம், அன்பைப் பகிர்வோம். 🤝❤️',
        hashtags: ['#Unity', '#Compassion', '#HumanityMatters'],
        optimalDurations: [15, 20, 30],
      },
    ],
    en: [
      {
        title: 'The Ripple of Kindness',
        quote: 'No act of kindness, however modest, ever dissipates into the air; it always finds someone who needed it.',
        explanation: 'A compassionate word or simple help can completely change someone’s day.',
        caption: 'Be kind whenever you can. It always matters. 🤝🌍',
        hashtags: ['#Humanity', '#KindnessMatters', '#Empathy', '#Compassion'],
        optimalDurations: [10, 15],
      },
      {
        title: 'Shared Grace',
        quote: 'We rise not by stepping above others, but by reaching down to lift someone beside us.',
        explanation: 'True nobility is measured by how much compassion we show to those around us.',
        caption: 'Lifting others is the highest human purpose. ✨',
        hashtags: ['#LiftOthers', '#GoodVibes', '#Integrity', '#Selfless'],
        optimalDurations: [15, 20],
      },
    ],
  },

  // POETRY
  poetry: {
    ta: [
      {
        title: 'காற்றின் கவிதை',
        quote: 'இரவின் நிழலில் நனைந்த சொற்கள், விடியலின் பனித்துளியில் கவிதையாக மலர்கின்றன.',
        explanation: 'மனதின் ஆழமான உணர்வுகளை மிக எளிய அழகுடன் வெளிப்படுத்துவதே உண்மையான கவிதை.',
        caption: 'சொற்களில் உறைந்திருக்கும் உணர்வுகளின் பயணம். ✍️🌙',
        hashtags: ['#TamilKavithai', '#PoeticLines', '#TamilLiterature', '#PoetryVibes'],
        optimalDurations: [10, 15],
      },
      {
        title: 'மௌனத்தின் கீதம்',
        quote: 'பேசித் தீர்க்க முடியாத உணர்வுகளுக்கு, காலம் வைத்த ஒற்றைப் புள்ளிதான் மௌனம்.',
        explanation: 'சில நேரங்களில் பேசும் சொற்களை விட, பேசாத அமைதியே அதிக ஆழத்தைக் கொண்டிருக்கும்.',
        caption: 'கவிதையாய் வாழும் மௌனம். 🍃',
        hashtags: ['#Kavithai', '#TamilLyrics', '#DeepFeelings', '#SoulPoetry'],
        optimalDurations: [15, 20],
      },
      {
        title: 'நினைவின் அலைகள்',
        quote: 'நினைவுகள் என்பவை கடலின் அலைகளைப் போல; கரை தொட்டுத் திரும்பினாலும் ஈரத்தை எப்போதும் விட்டுச் செல்கின்றன.',
        explanation: 'கடந்துபோன நாட்கள் மீண்டும் திரும்பாவிட்டாலும், அவை விட்டுச் சென்ற பாடங்கள் நம்மோடு வாழ்கின்றன.',
        caption: 'நினைவுகளின் தீராத ஈரப்பதம். 🌊✍️',
        hashtags: ['#Nostalgia', '#TamilPoem', '#Echoes', '#ArtisticWords'],
        optimalDurations: [15, 20, 30],
      },
    ],
    en: [
      {
        title: 'Whispers in Amber',
        quote: 'The dusk does not end the day; it merely tucks the golden light into the seams of the quiet sky.',
        explanation: 'Every ending carries its own subtle, breathtaking beauty if we pause to watch.',
        caption: 'Finding poetry in the ordinary moments. ✍️🌅',
        hashtags: ['#Poetry', '#WordArt', '#GoldenHour', '#SoulfulVerse'],
        optimalDurations: [10, 15],
      },
      {
        title: 'Echoes of Rain',
        quote: 'Words are like rain upon dry soil; spoken with tenderness, they coax tomorrow’s wild blooms to life.',
        explanation: 'Gentle creative expression can heal and awaken tired hearts.',
        caption: 'Words that nourish the soul. 🌧️🌱',
        hashtags: ['#PoeticThoughts', '#LiteraryVibes', '#QuietReflections'],
        optimalDurations: [15, 20],
      },
    ],
  },

  // MEANINGFUL LINES
  meaningful: {
    ta: [
      {
        title: 'காலத்தின் பாடம்',
        quote: 'எதையும் அவசரப்படுத்தாதே; பூக்க வேண்டிய காலம் வரும்போது மொட்டும் மலராகும், காயும் கனியாகும்.',
        explanation: 'பொறுமையும் தொடர்ச்சியான நம்பிக்கையுமே வாழ்வின் மிகச்சிறந்த முடிவுகளைத் தரும்.',
        caption: 'பொறுமைதான் வாழ்க்கையின் மிகப்பெரிய பலம். ⏳🌿',
        hashtags: ['#MeaningfulTamil', '#LifeLessons', '#Patience', '#TamilQuotes'],
        optimalDurations: [10, 15],
      },
      {
        title: 'உள் அமைதி',
        quote: 'வெளி உலகத்தின் சத்தங்களை அடக்க முடியாது; ஆனால் உள் மனதின் அமைதியை நீயே உருவாக்க முடியும்.',
        explanation: 'சுற்றியுள்ள குழப்பங்களுக்கு நடுவிலும் நம் மன அமைதி நம்முடைய சொந்தக் கட்டுப்பாட்டில்தான் உள்ளது.',
        caption: 'உன் அமைதியை நீயே பாதுகாத்துக்கொள். 🧘‍♂️✨',
        hashtags: ['#InnerPeace', '#PeacefulMind', '#SelfAwareness', '#WisdomTamil'],
        optimalDurations: [15, 20],
      },
      {
        title: 'பயணத்தின் உண்மை',
        quote: 'நாம் தேடும் மகிழ்ச்சி சேருமிடத்தில் இல்லை; நாம் கடந்து செல்லும் பாதையை நேசிப்பதில்தான் இருக்கிறது.',
        explanation: 'வாழ்க்கையின் ஒவ்வொரு நொடியையும் ரசித்து வாழுங்கள், இலக்கு தன்னால் வசப்படும்.',
        caption: 'பயணத்தை நேசி, வாழ்க்கை அழகாகும். 🚶‍♂️🌈',
        hashtags: ['#LifeJourney', '#TrueHappiness', '#LivingInTheMoment'],
        optimalDurations: [15, 20, 30],
      },
    ],
    en: [
      {
        title: 'The Art of Timing',
        quote: 'Do not rush the unfoldment of your life; fruit ripens only when the sun has completed its quiet rounds.',
        explanation: 'Patience is not passive waiting; it is trusting the rhythm of honest growth.',
        caption: 'Trust the timing of your life. ⏳✨',
        hashtags: ['#DeepThoughts', '#LifeLessons', '#Patience', '#Wisdom'],
        optimalDurations: [10, 15],
      },
      {
        title: 'Anchored Within',
        quote: 'You cannot quiet the ocean around you, but you can always anchor your vessel in steady peace.',
        explanation: 'Peace is not the absence of external storms, but the presence of inner composure.',
        caption: 'Guard your inner calm above all else. ⚓🌊',
        hashtags: ['#InnerPeace', '#Mindfulness', '#Perspective', '#DailyReflection'],
        optimalDurations: [15, 20],
      },
    ],
  },

  // EXTENSIBILITY: ONE-SIDED LOVE (Supported for future extension)
  one_sided_love: {
    ta: [
      {
        title: 'மௌன ஆராதனை',
        quote: 'உன் பதில்களை எதிர்பார்க்காமல் உன்னை நேசிப்பதில்தான், என் அன்பின் முழு சுதந்திரமும் வாழ்கிறது.',
        explanation: 'எதிர்பார்ப்புகள் இல்லாத அன்பு காயங்களை உருவாக்காது; அது தூய நினைவுகளாகவே நிலைத்திருக்கும்.',
        caption: 'எதிர்பார்ப்பற்ற தூய மௌன அன்பு. 🥀❤️',
        hashtags: ['#OneSidedLove', '#TamilSilentLove', '#TrueFeelings'],
        optimalDurations: [15, 20],
      },
    ],
    en: [
      {
        title: 'Silent Devotion',
        quote: 'Loving you from a distance requires no permission; it lives as a quiet star that asks for no night in return.',
        explanation: 'True silent devotion holds its own dignity without demanding possession.',
        caption: 'Quiet love, gentle distance. 🥀✨',
        hashtags: ['#OneSidedLove', '#SilentDevotion', '#PoignantWords'],
        optimalDurations: [15, 20],
      },
    ],
  },

  // EXTENSIBILITY: HEARTBREAK (Supported for future extension)
  heartbreak: {
    ta: [
      {
        title: 'வலியின் வழியே வளர்ச்சி',
        quote: 'உடைந்த கண்ணாடி வெளிச்சத்தைப் பிரதிபலிக்காது என்பது உண்மை அல்ல; அது இன்னும் பல கோணங்களில் ஒளிரும்.',
        explanation: 'துன்பங்கள் நம்மை அழிக்க வருவதில்லை; நம்மை இன்னும் வலிமையான மனிதனாகச் செதுக்கவே வருகின்றன.',
        caption: 'வலியும் ஒருநாள் வலிமையாக மாறும். 💔🌱',
        hashtags: ['#HealingTamil', '#HeartbreakQuotes', '#InnerStrength'],
        optimalDurations: [15, 20],
      },
    ],
    en: [
      {
        title: 'Mending Grace',
        quote: 'A broken vessel does not lose its value; the cracks are where tomorrow’s golden compassion enters.',
        explanation: 'Healing takes time, but every wound carries the seeds of deeper empathy.',
        caption: 'Brokenness becomes your greatest strength. 💔🕊️',
        hashtags: ['#Heartbreak', '#HealingWords', '#GrowthAfterPain'],
        optimalDurations: [15, 20],
      },
    ],
  },
};

/**
 * Generates structured quote content for a Daily Quote Video.
 *
 * @param {Object} params
 * @param {string} params.language - 'ta' | 'en'
 * @param {string} params.topic - Topic ID ('motivation', 'love', 'humanity', 'thirukkural', 'poetry', 'meaningful')
 * @param {number} [params.duration=15] - Target video length (10, 15, 20, 30)
 * @param {Object} [params.context] - Additional context / index
 * @returns {Promise<Object>} Structured content
 */
async function generateQuoteContent({
  language = 'ta',
  topic = 'motivation',
  duration = 15,
  context = {},
} = {}) {
  const lang = (language === 'en' ? 'en' : 'ta');
  const normalizedTopic = String(topic || 'motivation').toLowerCase().trim();
  const dur = parseInt(duration, 10) || 15;
  const index = context.runIndex !== undefined ? Math.abs(context.runIndex) : Date.now();

  const topicMeta = getTopicMeta(normalizedTopic);

  // SPECIAL CASE: THIRUKKURAL
  // Thirukkural couplets are ALWAYS sourced from the verified authentic corpus.
  if (normalizedTopic === 'thirukkural') {
    const kural = getAuthenticThirukkural(context.theme || 'wisdom', index);

    if (lang === 'ta') {
      return {
        language: 'ta',
        topic: 'thirukkural',
        title: `திருக்குறள் — அதிகாரம் ${kural.chapter} (${kural.number})`,
        kuralNumber: kural.number,
        chapter: kural.chapter,
        quote: kural.kuralTamil,
        explanation: kural.modernExplanationTamil,
        caption: `திருக்குறள் அதிகாரம் ${kural.chapter} (குறள் ${kural.number}):\n"${kural.kuralTamil}"\n\nவிளக்கம்: ${kural.modernExplanationTamil}\n\n#Thirukkural #TamilWisdom #Flowbox`,
        hashtags: ['#Thirukkural', '#TamilWisdom', '#Kural', '#AncientWisdom', '#DailyTamil'],
        estimatedDuration: dur,
        isThirukkural: true,
      };
    } else {
      return {
        language: 'en',
        topic: 'thirukkural',
        title: `Thirukkural — Chapter: ${kural.chapterEnglish} (#${kural.number})`,
        kuralNumber: kural.number,
        chapter: kural.chapterEnglish,
        quote: `"${kural.englishTranslation}"\n— Thirukkural (${kural.number})`,
        explanation: kural.modernExplanationEnglish,
        caption: `Thirukkural (${kural.number}) — ${kural.chapterEnglish}:\n"${kural.englishTranslation}"\n\nReflection: ${kural.modernExplanationEnglish}\n\n#Thirukkural #Wisdom #DailyShorts`,
        hashtags: ['#ThirukkuralInEnglish', '#AncientWisdom', '#DailyQuote', '#LifePhilosophy'],
        estimatedDuration: dur,
        isThirukkural: true,
      };
    }
  }

  // ALL OTHER TOPICS: Use original curated content matching topic, language, and duration
  const topicPool = ORIGINAL_QUOTES[normalizedTopic] || ORIGINAL_QUOTES.motivation;
  const langPool = topicPool[lang] || topicPool.ta || ORIGINAL_QUOTES.motivation.ta;

  // Filter by duration affinity if available, or use entire pool
  const durationMatches = langPool.filter((item) =>
    Array.isArray(item.optimalDurations) && item.optimalDurations.includes(dur)
  );
  const candidatePool = durationMatches.length > 0 ? durationMatches : langPool;

  const selected = candidatePool[index % candidatePool.length];

  return {
    language: lang,
    topic: normalizedTopic,
    title: selected.title,
    quote: selected.quote,
    explanation: selected.explanation,
    caption: selected.caption,
    hashtags: selected.hashtags || topicMeta.defaultTags || ['#Quotes'],
    estimatedDuration: dur,
    isThirukkural: false,
  };
}

module.exports = {
  generateQuoteContent,
  ORIGINAL_QUOTES,
};
