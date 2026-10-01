/**
 * Topic Rotation Module
 * Deterministically rotates topics sequentially across workflow executions.
 *
 * Designed with an extensible topics registry so topics like:
 * - One-Sided Love (one_sided_love)
 * - Heartbreak / Lost Love (heartbreak)
 * can be added in the future without rewriting the engine.
 */

const DEFAULT_TOPICS = [
  'motivation',
  'love',
  'humanity',
  'thirukkural',
  'poetry',
  'meaningful',
];

const TOPIC_REGISTRY = {
  motivation: {
    id: 'motivation',
    label: 'Motivation',
    emoji: '🔥',
    category: 'inspirational',
    mood: 'dramatic',
    description: 'Inspiring thoughts, ambition, perseverance and inner drive',
    defaultTags: ['#Motivation', '#DailyDrive', '#Inspiration', '#SelfGrowth'],
  },
  love: {
    id: 'love',
    label: 'Love',
    emoji: '❤️',
    category: 'relationships',
    mood: 'intimate',
    description: 'Deep emotional bonds, affection, warmth and cherished presence',
    defaultTags: ['#Love', '#LoveQuotes', '#Heartfelt', '#Soulmate'],
  },
  humanity: {
    id: 'humanity',
    label: 'Humanity',
    emoji: '🤝',
    category: 'compassion',
    mood: 'empathetic',
    description: 'Kindness, mutual empathy, selfless giving and shared grace',
    defaultTags: ['#Humanity', '#Kindness', '#Empathy', '#GoodVibes'],
  },
  thirukkural: {
    id: 'thirukkural',
    label: 'Thirukkural + Explanation',
    emoji: '📜',
    category: 'wisdom',
    mood: 'philosophical',
    description: 'Ancient universal couplets with contemporary practical explanation',
    defaultTags: ['#Thirukkural', '#TamilWisdom', '#Kural', '#AncientWisdom'],
  },
  poetry: {
    id: 'poetry',
    label: 'Poetry',
    emoji: '✍️',
    category: 'literary',
    mood: 'artistic',
    description: 'Soulful lyrical reflections, cadence, expressive verse and imagery',
    defaultTags: ['#Poetry', '#PoeticLines', '#WordsOfSoul', '#Verse'],
  },
  meaningful: {
    id: 'meaningful',
    label: 'Beautiful / Meaningful Lines',
    emoji: '🌙',
    category: 'reflection',
    mood: 'contemplative',
    description: 'Thought-provoking philosophy, quiet observations and deep lines',
    defaultTags: ['#Meaningful', '#DeepThoughts', '#LifeQuotes', '#Reflections'],
  },

  // Future Extensibility Topics (Supported by engine without rewriting)
  one_sided_love: {
    id: 'one_sided_love',
    label: 'One-Sided Love',
    emoji: '🥀',
    category: 'unrequited',
    mood: 'melancholic',
    description: 'Quiet unspoken devotion, tender distant longing and silent grace',
    defaultTags: ['#OneSidedLove', '#SilentLove', '#UnspokenFeelings', '#Melancholy'],
  },
  heartbreak: {
    id: 'heartbreak',
    label: 'Heartbreak / Lost Love',
    emoji: '💔',
    category: 'healing',
    mood: 'poignant',
    description: 'Poignant nostalgia, painful growth, letting go and inner healing',
    defaultTags: ['#Heartbreak', '#HealingWords', '#LostLove', '#MovingForward'],
  },
};

/**
 * Resolves the next topic for the automation execution.
 *
 * @param {Object} params
 * @param {string} [params.topicMode='rotate'] - 'rotate' | 'single'
 * @param {string} [params.selectedTopic='motivation'] - Used if topicMode is 'single'
 * @param {string[]} [params.selectedTopics] - Array of topic IDs to rotate through
 * @param {string|null} [params.lastTopic] - Topic used in the most recent job
 * @param {number} [params.runCount=0] - Total count of prior runs
 * @returns {string} The resolved topic ID (e.g. 'motivation')
 */
function resolveTopic({
  topicMode = 'rotate',
  selectedTopic = 'motivation',
  selectedTopics = null,
  lastTopic = null,
  runCount = 0,
} = {}) {
  // If single topic mode, return selected topic
  if (topicMode === 'single') {
    const topicId = String(selectedTopic || 'motivation').toLowerCase().trim();
    return TOPIC_REGISTRY[topicId] ? topicId : 'motivation';
  }

  // Rotation mode: normalize selectedTopics
  let list = Array.isArray(selectedTopics) && selectedTopics.length > 0
    ? selectedTopics.map((t) => String(t).toLowerCase().trim())
    : [...DEFAULT_TOPICS];

  // Filter list to recognized topics or fallback to default
  list = list.filter((t) => TOPIC_REGISTRY[t] !== undefined);
  if (list.length === 0) {
    list = [...DEFAULT_TOPICS];
  }

  // If there's a recorded previous topic in the list, advance to the next index
  if (lastTopic) {
    const prev = String(lastTopic).toLowerCase().trim();
    const prevIndex = list.indexOf(prev);
    if (prevIndex !== -1) {
      const nextIndex = (prevIndex + 1) % list.length;
      return list[nextIndex];
    }
  }

  // If no previous topic, pick by run count or start at index 0
  if (runCount && typeof runCount === 'number') {
    return list[runCount % list.length];
  }

  return list[0];
}

/**
 * Retrieves metadata for a topic ID.
 *
 * @param {string} topicId
 * @returns {Object} Topic metadata
 */
function getTopicMeta(topicId) {
  const id = String(topicId || '').toLowerCase().trim();
  return (
    TOPIC_REGISTRY[id] || {
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      emoji: '✨',
      category: 'general',
      mood: 'contemplative',
      description: 'General thoughtful quote',
      defaultTags: ['#Quotes', '#DailyThought'],
    }
  );
}

module.exports = {
  resolveTopic,
  getTopicMeta,
  TOPIC_REGISTRY,
  DEFAULT_TOPICS,
};
