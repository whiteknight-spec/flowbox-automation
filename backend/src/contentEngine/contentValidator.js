/**
 * Content Quality Check & Validation Layer
 *
 * Runs comprehensive pre-acceptance checks on generated content:
 * - Language verification (Tamil script for 'ta', Latin for 'en')
 * - Topic alignment
 * - Quote non-empty & reasonable short-form bounds
 * - Explanation presence when required
 * - No unrendered markdown artifacts
 * - No oversized paragraphs (readability on mobile screens)
 * - Duration suitability checks
 * - Safety checks (no hateful, unsafe or sexually explicit terms)
 * - Thirukkural authenticity verification (never allow fabricated couplets)
 */

const { isAuthenticKural } = require('./thirukkuralSource');
const { validateTamilQuality } = require('./tamilQualityValidator');

// Prohibited / Unsafe terms
const UNSAFE_WORDS = [
  'kill',
  'hate',
  'murder',
  'suicide',
  'porn',
  'nsfw',
  'slur',
  'terrorist',
  'வெறுப்பு',
  'கொலை',
  'தற்கொலை',
];

// Character limit thresholds by target duration for mobile screen readability
const DURATION_LIMITS = {
  10: { maxQuoteChars: 160, minChars: 15, maxWords: 25 },
  15: { maxQuoteChars: 240, minChars: 20, maxWords: 35 },
  20: { maxQuoteChars: 320, minChars: 25, maxWords: 50 },
  30: { maxQuoteChars: 480, minChars: 30, maxWords: 75 },
};

/**
 * Validates a generated quote content object.
 *
 * @param {Object} content - The content object from generateQuoteContent
 * @param {Object} expectations - Expected parameters { expectedLanguage, expectedTopic, expectedDuration }
 * @returns {Object} Validation result { valid: boolean, issues: string[], warnings: string[] }
 */
function validateContent(content, expectations = {}) {
  const issues = [];
  const warnings = [];

  if (!content || typeof content !== 'object') {
    return {
      valid: false,
      issues: ['Content object is null or undefined'],
      warnings: [],
    };
  }

  const { language, topic, quote, explanation, estimatedDuration, isThirukkural } = content;
  const { expectedLanguage, expectedTopic, expectedDuration } = expectations;

  // 1. Language validation
  if (!language) {
    issues.push('Missing language field in generated content');
  } else if (expectedLanguage && language !== expectedLanguage) {
    issues.push(`Language mismatch: expected "${expectedLanguage}" but got "${language}"`);
  }

  // Script checks
  if (language === 'ta') {
    const tamilRegex = /[\u0B80-\u0BFF]/;
    if (!tamilRegex.test(quote)) {
      issues.push('Tamil content does not contain valid Tamil Unicode characters');
    }
  }

  // 2. Topic validation
  if (!topic) {
    issues.push('Missing topic field in generated content');
  } else if (expectedTopic && topic !== expectedTopic) {
    issues.push(`Topic mismatch: expected "${expectedTopic}" but got "${topic}"`);
  }

  // 3. Quote presence and basic structure
  if (!quote || typeof quote !== 'string' || quote.trim().length === 0) {
    issues.push('Quote is empty or non-string');
  } else {
    const trimmed = quote.trim();
    const dur = parseInt(estimatedDuration || expectedDuration || 15, 10);
    const limits = DURATION_LIMITS[dur] || DURATION_LIMITS[15];

    if (trimmed.length < limits.minChars) {
      issues.push(`Quote is too short (${trimmed.length} chars, minimum is ${limits.minChars})`);
    }

    if (trimmed.length > limits.maxQuoteChars) {
      issues.push(`Quote exceeds maximum readable length for ${dur}s video (${trimmed.length} chars, max is ${limits.maxQuoteChars})`);
    }

    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > limits.maxWords) {
      warnings.push(`Word count (${wordCount} words) is slightly high for ${dur}s duration (recommended max is ${limits.maxWords})`);
    }

    // Huge paragraph check (no single run without breaks over 350 chars)
    if (trimmed.length > 350 && !trimmed.includes('\n') && !trimmed.includes('.')) {
      issues.push('Quote is a single continuous unpunctuated block; unsuitable for short-form video reading');
    }

    // Markdown artifacts check (e.g. ```, ###, etc.)
    if (/```|###|\*\*\*|<script/i.test(trimmed)) {
      issues.push('Quote contains unrendered markdown code blocks or HTML elements');
    }

    // Safety checks
    const lowerQuote = trimmed.toLowerCase();
    for (const badWord of UNSAFE_WORDS) {
      if (lowerQuote.includes(badWord)) {
        issues.push(`Content contains disallowed or unsafe term: "${badWord}"`);
        break;
      }
    }
  }

  // 4. Explanation check
  // For Thirukkural or longer formats (20s, 30s), explanation is mandatory
  if (topic === 'thirukkural' || (expectedDuration && expectedDuration >= 20)) {
    if (!explanation || typeof explanation !== 'string' || explanation.trim().length < 10) {
      issues.push(`Explanation is required for topic "${topic}" but is missing or too brief`);
    }
  }

  // 5. Dedicated Tamil Quality & Linguistic Validation
  let tamilQualityResult = null;
  if (language === 'ta' || expectedLanguage === 'ta') {
    tamilQualityResult = validateTamilQuality(content, {
      topic: topic || expectedTopic,
      duration: parseInt(estimatedDuration || expectedDuration || 15, 10),
      isThirukkural: !!isThirukkural || topic === 'thirukkural',
    });

    if (!tamilQualityResult.valid) {
      for (const iss of tamilQualityResult.issues) {
        if (!issues.includes(iss)) issues.push(iss);
      }
    }
    for (const w of tamilQualityResult.warnings) {
      if (!warnings.includes(w)) warnings.push(w);
    }
  }

  const result = {
    valid: issues.length === 0,
    issues,
    warnings,
  };

  if (tamilQualityResult) {
    result.tamilQuality = tamilQualityResult;
  }

  return result;
}

module.exports = {
  validateContent,
  validateTamilQuality,
  DURATION_LIMITS,
};
