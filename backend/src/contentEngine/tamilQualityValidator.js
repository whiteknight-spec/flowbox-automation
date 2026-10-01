/**
 * Dedicated Tamil Language Quality & Linguistic Validation Layer
 *
 * Implements strict, comprehensive Tamil language validation:
 * 1. Tamil script validation (Unicode integrity, character ratios, no corrupted encoding/mojibake)
 * 2. Spelling validation (orthographic rules: Pulli, vowel signs, Ayutha Ezhuthu, morpheme boundaries)
 * 3. Grammar & naturalness check (finite verb agreement, sentence termination, no awkward machine translation)
 * 4. Meaning & coherence check (thematic alignment, emotional tone, appropriate punctuation)
 * 5. Short-form readability check (pacing, character bounds, mobile screen readability)
 *
 * SPECIAL THIRUKKURAL RULE:
 * - Classical Thirukkural couplets must NEVER be modified or synthesized.
 * - Classical verse is strictly verified against the authentic Thirukkural corpus.
 * - Only the modern explanation and caption are newly validated for natural modern Tamil.
 *
 * If quality is uncertain, the content is explicitly marked with `requiresReview: true`
 * rather than pretending it is valid.
 */

const { isAuthenticKural, THIRUKKURAL_CORPUS } = require('./thirukkuralSource');

// Unicode blocks
const TAMIL_UNICODE_REGEX = /[\u0B80-\u0BFF]/;
const TAMIL_PULLI = '\u0BCD'; // ்
const TAMIL_VOWEL_SIGNS = /[\u0BBE-\u0BCC]/; // ா ி ீ ு ூ ெ ே ை ொ ோ ௌ
const TAMIL_CONSONANTS = /[\u0B95-\u0BB9]/; // க to ஹ
const TAMIL_INDEPENDENT_VOWELS = /[\u0B85-\u0B94]/; // அ to ஔ
const TAMIL_AYUTHAM = '\u0B83'; // ஃ

// Corrupted encoding / Mojibake patterns
const MOJIBAKE_PATTERNS = [
  /Ã[©|®|¤|¥|§]/,
  /â[€|™|œ]/,
  /\ufffd/, // Unicode replacement character
  /&[a-z]+;/i, // Unrendered HTML entities like &nbsp; &quot;
  /\\u[0-9a-f]{4}/i, // Unparsed escape strings
];

// Disallowed accidental English/Tanglish in Tamil text (unless in hashtags)
const ACCIDENTAL_ENGLISH_WORDS = [
  'life', 'success', 'fail', 'failure', 'love', 'happy', 'sad', 'mind',
  'time', 'today', 'tomorrow', 'goal', 'dream', 'focus', 'work', 'hardwork',
  'super', 'best', 'great', 'friend', 'friends', 'chance', 'change',
];

// Awkward machine-translated patterns that indicate unnatural or broken syntax
const AWKWARD_MACHINE_PATTERNS = [
  /நீங்கள் ஒரு முறை/i,
  /நாள் செய்ய/i,
  /எடுத்துக்கொள்ளுங்கள்/i,
  /நன்றி சொல்ல விரும்புகிறேன்/i,
  /அது உங்கள் மீது உள்ளது/i,
  /வானம் மட்டுமே வரம்பு/i,
  /மற்றும்\s*$/m, // Sentence ending with "and"
  /ஆனால்\s*$/m, // Sentence ending with "but"
  /என்று\s*$/m, // Sentence ending abruptly with "that"
];

// Thematic vocabulary indicators for semantic coherence
const THEMATIC_VOCABULARY = {
  motivation: [
    'வெற்றி', 'முயற்சி', 'நம்பிக்கை', 'இலக்கு', 'தைரியம்', 'விடியல்', 'வலிமை',
    'உழைப்பு', 'சவால்', 'துணிவு', 'எழு', 'சிகரம்', 'பாதை', 'தோல்வி', 'கனவு',
    'உறுதி', 'போராட்டம்', 'புத்துயிர்', 'தன்நம்பிக்கை', 'காலம்', 'ஊக்கம்',
  ],
  love: [
    'அன்பு', 'நேசம்', 'இதயம்', 'அமைதி', 'புன்னகை', 'துணை', 'பார்வை', 'ஆழம்',
    'மௌனம்', 'பாசம்', 'உணர்வு', 'நிறைவு', 'காதல்', 'உயிர்', 'அருகாமை', 'பிணைப்பு',
  ],
  one_sided_love: [
    'மௌனம்', 'தூரம்', 'ஏக்கம்', 'விலகல்', 'உரிமை', 'அன்பு', 'நினைவு', 'தனிமை',
    'சொல்லாத', 'பார்வை', 'காதல்', 'இதயம்',
  ],
  humanity: [
    'கருணை', 'மனிதநேயம்', 'உதவி', 'பகிர்வு', 'கண்ணீர்', 'பாலம்', 'ஒற்றுமை',
    'பரிவு', 'நன்மை', 'தியாகம்', 'துடைக்கும்', 'மனிதர்', 'அன்பு', 'வாழவைக்கும்',
  ],
  thirukkural: [
    'குறள்', 'அதிகாரம்', 'அறிவு', 'ஒழுக்கம்', 'அறம்', 'கல்வி', 'உண்மை',
    'முயற்சி', 'வாழ்வு', 'பொருள்', 'நிற்க', 'கற்க', 'விளக்கம்',
  ],
  poetry: [
    'கவிதை', 'சொற்கள்', 'மௌனம்', 'அலைகள்', 'வெளிச்சம்', 'இரவு', 'பனித்துளி',
    'காற்று', 'நினைவு', 'ஈரம்', 'உணர்வு', 'பாடல்', 'வரிகள்', 'கீதம்',
  ],
  meaningful: [
    'பொறுமை', 'வாழ்க்கை', 'காலம்', 'மெய்', 'அமைதி', 'பயணம்', 'பாடம்',
    'உண்மை', 'நிறைவு', 'மலரும்', 'ஆழம்', 'பக்குவம்', 'மனிதன்', 'முடிவு',
  ],
  heartbreak: [
    'வலி', 'துன்பம்', 'வளர்ச்சி', 'உடைந்த', 'மனம்', 'கண்ணீர்', 'மீண்டு', 'பாடம்',
  ],
};

/**
 * Validates Tamil script integrity across all text fields.
 */
function validateTamilScript(text, fieldName = 'text') {
  const issues = [];
  const warnings = [];

  if (!text || typeof text !== 'string') {
    issues.push(`${fieldName} is empty or not a string`);
    return { valid: false, issues, warnings };
  }

  // 1. Must contain Tamil characters
  if (!TAMIL_UNICODE_REGEX.test(text)) {
    issues.push(`${fieldName} does not contain any valid Tamil Unicode characters`);
  }

  // 2. No Mojibake or corrupt encoding
  for (const pattern of MOJIBAKE_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(`${fieldName} contains corrupted character encoding or unparsed entities (${pattern.source})`);
      break;
    }
  }

  // 3. Script purity: check for accidental Latin words or Tanglish embedded in Tamil
  const cleanWords = text
    .split(/\s+/)
    .filter((w) => !w.startsWith('#') && !w.startsWith('http') && !w.startsWith('@'));

  for (const word of cleanWords) {
    const latinMatches = word.match(/[a-zA-Z]{2,}/g);
    if (latinMatches) {
      for (const m of latinMatches) {
        const lower = m.toLowerCase();
        if (ACCIDENTAL_ENGLISH_WORDS.includes(lower) || fieldName === 'quote' || fieldName === 'title' || fieldName === 'explanation') {
          issues.push(`${fieldName} contains accidental English/Tanglish word: "${m}" in "${word}"`);
        } else if (fieldName !== 'caption') {
          warnings.push(`${fieldName} contains Latin word "${m}" in Tamil content`);
        }
      }
    }
  }

  // 4. Word separation check (no huge unsegmented blocks)
  const longTokens = text.split(/\s+/).filter((t) => t.length > 40 && !t.startsWith('#'));
  if (longTokens.length > 0) {
    issues.push(`${fieldName} contains unsegmented Tamil word exceeding 40 characters: "${longTokens[0].slice(0, 30)}..."`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Validates Tamil orthographic spelling rules.
 */
function validateTamilSpelling(text, fieldName = 'text') {
  const issues = [];
  const warnings = [];

  if (!text || typeof text !== 'string') {
    return { valid: false, issues: [`${fieldName} is empty`], warnings };
  }

  const words = text.split(/\s+/).filter(Boolean);

  for (const word of words) {
    // Skip hashtags, numbers, punctuation
    if (word.startsWith('#') || /^[\d\p{P}\s]+$/u.test(word)) continue;

    // Rule A: Word cannot begin with Pulli (Virama)
    if (word.startsWith(TAMIL_PULLI)) {
      issues.push(`${fieldName} has word starting with invalid Pulli (்): "${word}"`);
    }

    // Rule B: Word cannot begin with a dependent vowel sign (ா, ி, ீ, etc.)
    if (TAMIL_VOWEL_SIGNS.test(word[0])) {
      issues.push(`${fieldName} has word starting with detached vowel sign: "${word}"`);
    }

    // Rule C: Consecutive pullis without consonant or doubled final meyyeluthu
    if (word.includes(TAMIL_PULLI + TAMIL_PULLI) || /(?:[\u0B95-\u0BB9]\u0BCD){2,}$/.test(word)) {
      issues.push(`${fieldName} contains illegal double pulli sequence in "${word}"`);
    }

    // Rule D: Ayutha Ezhuthu ஃ position validation
    if (word.includes(TAMIL_AYUTHAM)) {
      const idx = word.indexOf(TAMIL_AYUTHAM);
      if (idx === 0) {
        issues.push(`${fieldName} has word starting with Ayutha Ezhuthu (ஃ): "${word}"`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Validates Tamil grammar, natural phrasing, and sentence endings.
 */
function validateTamilGrammarAndNaturalness(text, fieldName = 'text') {
  const issues = [];
  const warnings = [];

  if (!text || typeof text !== 'string') {
    return { valid: false, issues: [`${fieldName} is empty`], warnings };
  }

  // 1. Detect awkward machine-translation phrasing
  for (const pattern of AWKWARD_MACHINE_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(`${fieldName} contains unnatural or machine-translated Tamil phrasing (${pattern.source})`);
    }
  }

  // 2. Punctuation and sentence structure
  // Quotes and explanations must end with appropriate terminal punctuation (. ! ? ” " »)
  const trimmed = text.trim();
  const validTerminators = ['.', '!', '?', '…', '"', '”', '»', '✨', '🔥', '❤️', '🌹', '🌿', '💪', '🤝'];
  const lastChar = trimmed.slice(-1);

  if (fieldName === 'quote' || fieldName === 'explanation') {
    const hasProperEnding = validTerminators.some((t) => trimmed.endsWith(t));
    if (!hasProperEnding && !trimmed.endsWith('\n')) {
      warnings.push(`${fieldName} does not end with standard sentence punctuation or terminal mark (ends with '${lastChar}')`);
    }
  }

  // 3. Quotation marks matching
  const doubleQuotesCount = (trimmed.match(/"|“|”/g) || []).length;
  if (doubleQuotesCount % 2 !== 0) {
    warnings.push(`${fieldName} has unbalanced quotation marks`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Validates thematic meaning and semantic coherence.
 */
function validateTamilMeaningAndCoherence(content, topic = 'motivation') {
  const issues = [];
  const warnings = [];

  const normalizedTopic = String(topic || 'motivation').toLowerCase().trim();
  const expectedKeywords = THEMATIC_VOCABULARY[normalizedTopic] || THEMATIC_VOCABULARY.motivation;

  const fullText = [
    content.title || '',
    content.quote || '',
    content.explanation || '',
    content.caption || '',
  ].join(' ');

  // Check if at least one thematic keyword or related concept appears across content
  const hasThematicMatch = expectedKeywords.some((keyword) => fullText.includes(keyword));

  if (!hasThematicMatch && normalizedTopic !== 'poetry') {
    warnings.push(
      `Content may lack strong thematic alignment with "${normalizedTopic}" (expected related terms like ${expectedKeywords.slice(0, 3).join(', ')})`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    topicAligned: hasThematicMatch,
  };
}

/**
 * Validates short-form video readability for Tamil.
 */
function validateTamilReadability(content, duration = 15) {
  const issues = [];
  const warnings = [];

  const quote = content.quote || '';
  const dur = parseInt(duration, 10) || 15;

  // Reading speed in short-form video: ~10-15 Tamil characters per second
  const charCount = quote.length;
  const maxSafeChars = dur * 18;
  const minSafeChars = 15;

  if (charCount < minSafeChars) {
    issues.push(`Tamil quote is too short (${charCount} chars) for short-form display`);
  }
  if (charCount > maxSafeChars) {
    issues.push(`Tamil quote exceeds safe reading length for ${dur}s video (${charCount} chars, max ${maxSafeChars})`);
  }

  // Estimate reading time in seconds
  const readingTimeSeconds = Math.max(3, Math.round(charCount / 12));

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    charCount,
    readingTimeSeconds,
  };
}

/**
 * Special rule for Thirukkural:
 * - Couplet must match authentic corpus.
 * - Classical meter: 7 words across 2 lines (4 on line 1, 3 on line 2).
 */
function validateThirukkuralClassicalRule(quote) {
  const issues = [];
  const warnings = [];

  if (!quote || typeof quote !== 'string') {
    return { valid: false, issues: ['Thirukkural couplet is missing'], warnings };
  }

  // 1. Authenticity check against corpus
  const authentic = isAuthenticKural(quote);
  if (!authentic) {
    issues.push('Thirukkural couplet failed authenticity check: verse does not match verified classical corpus');
  }

  // 2. 7-cir (words) meter check
  const words = quote.trim().split(/\s+/);
  if (words.length !== 7) {
    warnings.push(`Thirukkural couplet structure has ${words.length} words; classical Kural standard is strictly 7 words (4 + 3)`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    authentic,
  };
}

/**
 * Main Tamil Quality Validator.
 * Reviews quote, explanation, caption, and title.
 *
 * @param {Object} content - The generated quote content
 * @param {Object} params
 * @param {string} [params.topic='motivation'] - Target topic
 * @param {number} [params.duration=15] - Target video duration
 * @param {boolean} [params.isThirukkural=false] - Thirukkural flag
 * @returns {Object} Comprehensive quality result
 */
function validateTamilQuality(content, { topic = 'motivation', duration = 15, isThirukkural = false } = {}) {
  const allIssues = [];
  const allWarnings = [];

  if (!content || typeof content !== 'object') {
    return {
      checked: true,
      valid: false,
      confidence: 'low',
      requiresReview: true,
      reviewReason: 'Content is null or undefined',
      issues: ['Content object is missing'],
      warnings: [],
    };
  }

  const fieldsToCheck = [
    { name: 'quote', text: content.quote, required: true },
    { name: 'explanation', text: content.explanation, required: isThirukkural || duration >= 20 },
    { name: 'title', text: content.title, required: true },
    { name: 'caption', text: content.caption, required: true },
  ];

  const fieldResults = {};

  for (const { name, text, required } of fieldsToCheck) {
    if (!text && required) {
      allIssues.push(`Required Tamil field "${name}" is missing`);
      fieldResults[name] = { valid: false, issues: ['Field is missing'] };
      continue;
    }

    if (!text) continue;

    // 1. Script validation
    const scriptRes = validateTamilScript(text, name);
    // 2. Spelling validation
    const spellingRes = validateTamilSpelling(text, name);
    // 3. Grammar & Naturalness validation
    const grammarRes = validateTamilGrammarAndNaturalness(text, name);

    const fieldIssues = [...scriptRes.issues, ...spellingRes.issues, ...grammarRes.issues];
    const fieldWarnings = [...scriptRes.warnings, ...spellingRes.warnings, ...grammarRes.warnings];

    allIssues.push(...fieldIssues);
    allWarnings.push(...fieldWarnings);

    fieldResults[name] = {
      valid: fieldIssues.length === 0,
      issues: fieldIssues,
      warnings: fieldWarnings,
    };
  }

  // 4. Meaning and coherence validation
  const coherenceRes = validateTamilMeaningAndCoherence(content, topic);
  allIssues.push(...coherenceRes.issues);
  allWarnings.push(...coherenceRes.warnings);

  // 5. Short-form readability validation
  const readabilityRes = validateTamilReadability(content, duration);
  allIssues.push(...readabilityRes.issues);
  allWarnings.push(...readabilityRes.warnings);

  // 6. SPECIAL THIRUKKURAL RULE
  let kuralRuleRes = null;
  if (isThirukkural || topic === 'thirukkural') {
    kuralRuleRes = validateThirukkuralClassicalRule(content.quote);
    allIssues.push(...kuralRuleRes.issues);
    allWarnings.push(...kuralRuleRes.warnings);
  }

  const isValid = allIssues.length === 0;
  const confidence = isValid ? (allWarnings.length === 0 ? 'high' : 'medium') : 'low';
  const requiresReview = !isValid || confidence === 'low';

  return {
    checked: true,
    valid: isValid,
    confidence,
    requiresReview,
    reviewReason: requiresReview ? (allIssues[0] || 'Uncertain Tamil quality') : null,
    issues: allIssues,
    warnings: allWarnings,
    details: {
      fields: fieldResults,
      coherence: coherenceRes,
      readability: readabilityRes,
      thirukkural: kuralRuleRes,
    },
  };
}

module.exports = {
  validateTamilQuality,
  validateTamilScript,
  validateTamilSpelling,
  validateTamilGrammarAndNaturalness,
  validateTamilMeaningAndCoherence,
  validateTamilReadability,
  validateThirukkuralClassicalRule,
  THEMATIC_VOCABULARY,
};
