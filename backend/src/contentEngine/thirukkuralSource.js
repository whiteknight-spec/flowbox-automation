/**
 * Authentic Thirukkural Source Dataset
 *
 * CRITICAL RULE:
 * Thirukkural verses must NEVER be fabricated or AI-hallucinated.
 * This dataset provides authentic classical couplets (exact 7-word meter:
 * 4 words in the first line, 3 words in the second line), coupled with original,
 * fresh, modern explanations.
 */

const THIRUKKURAL_CORPUS = [
  {
    number: 391,
    chapter: 'கல்வி',
    chapterEnglish: 'Learning',
    section: 'பொருட்பால்',
    theme: 'education_growth',
    kuralTamil: 'கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தக.',
    transliteration: 'Karka kasadarak karpavai katrapin nirka adharkuth thaga.',
    englishTranslation: 'Learn thoroughly what is worthy of learning, and having learned, let your conduct strictly reflect that knowledge.',
    modernExplanationTamil: 'பிழையின்றித் தெளிவாகக் கற்க வேண்டியவற்றை ஆழமாகக் கற்றுக்கொள்ளுங்கள்; கற்ற பிறகு அந்த நற்குணங்களின் வழியிலேயே உங்கள் வாழ்க்கையை வாழுங்கள்.',
    modernExplanationEnglish: 'Master genuine wisdom with unwavering clarity, and ensure every choice you make in life embodies what you have learned.',
    contextTag: 'wisdom',
  },
  {
    number: 392,
    chapter: 'கல்வி',
    chapterEnglish: 'Learning',
    section: 'பொருட்பால்',
    theme: 'education_growth',
    kuralTamil: 'எண்ணென்ப ஏனை எழுத்தென்ப இவ்விரண்டும்\nகண்ணென்ப வாழும் உயிர்க்கு.',
    transliteration: 'Ennenba yenai ezhuththenba ivvirandum kannenba vaazhum uyirkku.',
    englishTranslation: 'Numbers and letters, the twin lights of learning, are truly the seeing eyes of every human soul.',
    modernExplanationTamil: 'எழுத்தும் எண்ணும் மனித வாழ்க்கைக்கு இரு கண்கள் போன்றவையாகும்; அவற்றைக் கற்றுத் தெளிவதே வாழ்வின் உயர்வு.',
    modernExplanationEnglish: 'The mastery of language and numbers are as essential to human life as two seeing eyes are to the body.',
    contextTag: 'wisdom',
  },
  {
    number: 393,
    chapter: 'கல்வி',
    chapterEnglish: 'Learning',
    section: 'பொருட்பால்',
    theme: 'education_growth',
    kuralTamil: 'கண்ணுடையர் என்பவர் கற்றோர் முகத்திரண்டு\nபுண்ணுடையர் கல்லா தவர்.',
    transliteration: 'Kannudaiyar enbavar katror mugaththirandu punnudaiyar kallaa thavar.',
    englishTranslation: 'Those who learn have eyes that truly see; those who refuse wisdom carry only wounds upon their face.',
    modernExplanationTamil: 'கல்வியறிவு உடையவர்களே கண்கள் உள்ளவர்கள் ஆவர்; கல்வி கற்காதவர்களின் முகத்தில் இருப்பது கண்களல்ல, அவை வெறும் புண்கள் மட்டுமே.',
    modernExplanationEnglish: 'Those who cultivate wisdom possess true vision, while those who refuse learning carry blindness through life.',
    contextTag: 'wisdom',
  },
  {
    number: 394,
    chapter: 'கல்வி',
    chapterEnglish: 'Learning',
    section: 'பொருட்பால்',
    theme: 'education_growth',
    kuralTamil: 'உவப்பத் தலைக்கூடி உள்ளப் பிரிதல்\nஅனைத்தே புலவர் தொழில்.',
    transliteration: 'Uvappath thalaikkoodi ullap piridhal anaiththe pulavar thozhil.',
    englishTranslation: 'To meet with joy and part with thoughtful inspiration is the hallmark of the truly wise.',
    modernExplanationTamil: 'கற்றறிந்த மேலோரைச் சந்திக்கும் போது மகிழ்வதும், பிரியும் போது நல்வழியில் தொடர்ந்து சிந்திக்க வைப்பதும் அறிஞர்களின் இயல்பாகும்.',
    modernExplanationEnglish: 'The meeting of noble minds brings pure joy, and their parting leaves behind an enduring inspiration to reflect and grow.',
    contextTag: 'wisdom',
  },
  {
    number: 595,
    chapter: 'ஊக்கமுடைமை',
    chapterEnglish: 'Enthusiasm & Resolve',
    section: 'பொருட்பால்',
    theme: 'motivation',
    kuralTamil: 'வெள்ளத் தனைய மலர்நீட்டம் மாந்தர்தம்\nஉள்ளத் தனைய துயர்வு.',
    transliteration: 'Vellath thanaiya malarneettam maandhardham ullath thanaiya dhuyarvu.',
    englishTranslation: 'As water-lilies rise to match the water’s depth, a person’s true stature rises to match the height of their inner aspiration.',
    modernExplanationTamil: 'நீரின் ஆழத்திற்கு ஏற்பவே நீர் மலர்கள் உயர்ந்து மலரும்; அதுபோல ஒருவரின் மன உறுதியின் உயரத்திற்கு ஏற்பவே அவரது வாழ்க்கையின் வெற்றிகள் உயரும்.',
    modernExplanationEnglish: 'Just as lotus blossoms reach upward to match the water’s depth, your accomplishments in this world will always reflect the scale of your inner courage.',
    contextTag: 'motivation',
  },
  {
    number: 619,
    chapter: 'ஆள்வினையுடைமை',
    chapterEnglish: 'Perseverance',
    section: 'பொருட்பால்',
    theme: 'motivation',
    kuralTamil: 'தெய்வத்தான் ஆகா தெனினும் முயற்சிதன்\nமெய்வருத்தக் கூலி தரும்.',
    transliteration: 'Dheivathaan aagaa dheninum muyarsithan meivaruthak kooli tharum.',
    englishTranslation: 'Even if destiny appears unyielding, relentless honest effort never fails to render its rightful reward.',
    modernExplanationTamil: 'விதியினாலோ சூழ்நிலையினாலோ ஒரு காரியம் கைகூடாது போனாலும், இடைவிடாத உடல் உழைப்பும் தன்னம்பிக்கையும் உரிய பலனைத் தவறாமல் தேடித்தரும்.',
    modernExplanationEnglish: 'Even when external circumstances resist your progress, tireless dedication and honest effort never walk away empty-handed.',
    contextTag: 'motivation',
  },
  {
    number: 102,
    chapter: 'செய்ந்நன்றி அறிதல்',
    chapterEnglish: 'Gratitude',
    section: 'அறத்துப்பால்',
    theme: 'humanity',
    kuralTamil: 'காலத்தி னாற்செய்த நன்றி சிறிதெனினும்\nஞாலத்தின் மாணப் பெரிது.',
    transliteration: 'Kaalaththinaar seydha nandri siridheninum gnaalaththin maanap peridhu.',
    englishTranslation: 'A timely kindness, however humble in scale, is grander than the vast expanse of the earth itself.',
    modernExplanationTamil: 'உரிய நேரத்தில் ஒருவர் செய்யும் சிறிய உதவியும் கூட, இப் பூவுலகத்தின் பரப்பளவை விடவும் மதிப்பால் மிக உயர்ந்ததாகும்.',
    modernExplanationEnglish: 'A small gesture of help offered at the exact moment of need carries greater weight than the entire world.',
    contextTag: 'humanity',
  },
  {
    number: 96,
    chapter: 'இனியவை கூறல்',
    chapterEnglish: 'Kind Words',
    section: 'அறத்துப்பால்',
    theme: 'humanity',
    kuralTamil: 'இனிய உளவாக இன்னாத கூறல்\nகனிஇருப்பக் காய்கவர்ந் தற்று.',
    transliteration: 'Iniya ulavaaga innaadha kooral kani-yiruppak kaai-kavarndhatru.',
    englishTranslation: 'Speaking harsh words when sweet words exist is like choosing bitter green fruit when sweet ripe fruit is within reach.',
    modernExplanationTamil: 'இதமளிக்கும் நல்ல சொற்கள் இருக்கும் போது கடுமையான சொற்களைப் பேசுவது, சுவைமிக்க கனியை விடுத்துக் கசப்பான காயைத் தேர்ந்தெடுப்பது போன்றதாகும்.',
    modernExplanationEnglish: 'To choose hurtful words when gentle understanding is available is like picking bitter raw fruit when sweet fruit hangs right before you.',
    contextTag: 'humanity',
  },
  {
    number: 1101,
    chapter: 'புணர்ச்சி மகிழ்தல்',
    chapterEnglish: 'The Joy of Beloved Love',
    section: 'காமத்துப்பால்',
    theme: 'love',
    kuralTamil: 'கண்டுகேட்டு உண்டுயிர்த்து உற்றறியும் ஐம்புலனும்\nஒண்டொடி கண்ணே யுள.',
    transliteration: 'Kandukettu unduyirthu uttrariyum aimbulanum ondodi kanney yula.',
    englishTranslation: 'All five senses—sight, sound, taste, fragrance, and tender touch—unite in radiant joy in the presence of the beloved.',
    modernExplanationTamil: 'கண்ணால் பார்த்தல், காதால் கேட்டல், சுவைத்தல், நுகர்தல், தொடுதல் ஆகிய ஐம்புலன்களின் முழுமையான ஆனந்தமும் அன்பானவளின் ஓர் அருகாமையிலேயே நிறைந்திருக்கிறது.',
    modernExplanationEnglish: 'Every quiet sensory joy of this world finds its complete and harmonious home in the presence of true love.',
    contextTag: 'love',
  },
  {
    number: 78,
    chapter: 'அன்புடைமை',
    chapterEnglish: 'Possession of Love',
    section: 'அறத்துப்பால்',
    theme: 'love',
    kuralTamil: 'அன்பகத் தில்லா உயிர்வாழ்க்கை வன்பாற்கண்\nவற்றல் மரந்தளிர்த் தற்று.',
    transliteration: 'Anbagath thillaa uyirvaazhkkai vanpaarkan vatral marandhalirth thatru.',
    englishTranslation: 'A life lived without warm love in the heart is like a withered barren tree trying to bloom in a scorched desert.',
    modernExplanationTamil: 'உள்ளத்தில் தூய அன்பு இல்லாமல் வாழும் வாழ்க்கை, பாறைகள் நிறைந்த பாலைவனத்தில் காய்ந்துபோன காய்ந்த மரம் தழைக்க முயல்வதைப் போன்றதாகும்.',
    modernExplanationEnglish: 'A human life deprived of genuine affection is like a dry, brittle trunk waiting in vain for springtime upon barren desert rock.',
    contextTag: 'love',
  },
  {
    number: 211,
    chapter: 'ஒப்புரவறிதல்',
    chapterEnglish: 'Benevolence & Fellowship',
    section: 'அறத்துப்பால்',
    theme: 'humanity',
    kuralTamil: 'தாளாற்றித் தந்த பொருளெல்லாம் தக்கார்க்கு\nவேளாண்மை செய்தற் பொருட்டு.',
    transliteration: 'Thaalaatrit thandha porulellaam thakkaarkku velaanmai seydhar poruttu.',
    englishTranslation: 'All honest wealth gathered through hard toil is truly meant to uplift, support, and serve those around us.',
    modernExplanationTamil: 'தன்னுடைய சொந்த உழைப்பால் சேர்த்த செல்வங்கள் அனைத்தும், தகுதியுள்ள மற்ற மனிதர்களுக்கு உதவி செய்து அவர்களையும் வாழவைப்பதற்கே ஆகும்.',
    modernExplanationEnglish: 'The true worth of wealth created through honest endeavor lies in the hands it lifts and the lives it touches.',
    contextTag: 'humanity',
  },
  {
    number: 66,
    chapter: 'மக்கட்பேறு',
    chapterEnglish: 'The Blessing of Kinship',
    section: 'அறத்துப்பால்',
    theme: 'meaningful',
    kuralTamil: 'குழலினிது யாழினிது என்பதம் மக்கள்\nமழலைச்சொல் கேளாதவர்.',
    transliteration: 'Kuzhalinidhu yaazhinidhu enbadham makkal mazhalaichchol kelaadhavar.',
    englishTranslation: 'Sweet is the flute and sweet is the harp, say only those who have not heard the tender laughter of their own young ones.',
    modernExplanationTamil: 'தன் குழந்தைகளின் மழலைச் சொற்களைக் கேட்டு மகிழாதவர்களே, புல்லாங்குழலும் யாழும் இசையில் மேன்மையானவை என்று பாராட்டுவர்.',
    modernExplanationEnglish: 'The finest melodies composed by human instruments pale beside the pure and innocent voice of loved ones in our home.',
    contextTag: 'meaningful',
  },
  {
    number: 423,
    chapter: 'அறிவுடைமை',
    chapterEnglish: 'The Possession of Wisdom',
    section: 'பொருட்பால்',
    theme: 'meaningful',
    kuralTamil: 'எப்பொருள் யார்யார்வாய்க் கேட்பினும் அப்பொருள்\nமெய்ப்பொருள் காண்ப தறிவு.',
    transliteration: 'Epporul yaaryaarvaaik ketpinum apporul meipporul kaanbadhu arivu.',
    englishTranslation: 'Whatever matter is heard from whomever’s lips, perceiving the underlying truth within it is the essence of true wisdom.',
    modernExplanationTamil: 'எந்த ஒரு கருத்தை யார் சொல்லக் கேட்டாலும், சொல்லப்பட்டதை அப்படியே நம்பாமல் அதன் உண்மைப் பொருளை ஆராய்ந்து அறிவதே உண்மையான அறிவாகும்.',
    modernExplanationEnglish: 'Wisdom is not merely absorbing words regardless of who speaks them, but seeing clearly through to the essential truth they hold.',
    contextTag: 'meaningful',
  },
];

/**
 * Returns an authentic Thirukkural couplet.
 * Selects based on theme affinity, deterministic index, and deduplication exclusions.
 *
 * @param {string} [theme='wisdom'] - Preferred theme tag
 * @param {number} [index=0] - Deterministic sequence index
 * @param {Object} [options={}] - Options including excludeNumbers
 * @returns {Object} Authentic Kural couplet object
 */
function getAuthenticThirukkural(theme = 'wisdom', index = 0, options = {}) {
  const rawExcludes = options.excludeNumbers || options.excludedKuralNumbers || [];
  const excludeNumbers = Array.isArray(rawExcludes)
    ? rawExcludes.map(Number)
    : [Number(rawExcludes)];

  // 1. Filter out recently used Kurals
  const available = THIRUKKURAL_CORPUS.filter((k) => !excludeNumbers.includes(k.number));
  const pool = available.length > 0 ? available : THIRUKKURAL_CORPUS;

  // 2. Prioritize matching theme if available in filtered pool
  const themeMatching = pool.filter((k) => k.theme === theme || k.contextTag === theme);
  const finalPool = themeMatching.length > 0 ? themeMatching : pool;

  // Pick next unused Kural in order
  return finalPool[0];
}

/**
 * Checks if a given text matches any known authentic Thirukkural verse.
 */
function isAuthenticKural(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.replace(/[\n\r\s]+/g, ' ').trim();
  return THIRUKKURAL_CORPUS.some((k) => {
    const kuralClean = k.kuralTamil.replace(/[\n\r\s]+/g, ' ').trim();
    return clean.includes(kuralClean) || kuralClean.includes(clean);
  });
}

module.exports = {
  THIRUKKURAL_CORPUS,
  getAuthenticThirukkural,
  isAuthenticKural,
};
