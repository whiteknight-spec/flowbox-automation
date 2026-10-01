import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Film,
  Music,
  Volume2,
  VolumeX,
  Calendar,
  Edit3,
  Sliders,
  RotateCw,
  Info,
  Layers,
} from 'lucide-react';
import { api } from '../api.js';

// SVG Icons for Platforms to maintain sleek brand styling
function InstagramIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function YouTubeIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill={color} />
    </svg>
  );
}

const TOPIC_OPTIONS = [
  { id: 'motivation', label: 'Motivation', emoji: '🔥', desc: 'Inspiring thoughts, ambition & inner drive' },
  { id: 'love', label: 'Love', emoji: '❤️', desc: 'Deep emotional bonds, affection & warmth' },
  { id: 'humanity', label: 'Humanity', emoji: '🤝', desc: 'Kindness, mutual empathy & shared grace' },
  { id: 'thirukkural', label: 'Thirukkural + Explanation', emoji: '📜', desc: 'Ancient universal couplets with contemporary meaning' },
  { id: 'poetry', label: 'Poetry', emoji: '✍️', desc: 'Soulful lyrical reflections & expressive verses' },
  { id: 'meaningful', label: 'Beautiful / Meaningful Lines', emoji: '🌙', desc: 'Thought-provoking philosophy & contemplative lines' },
];

const DURATION_OPTIONS = [
  { id: 10, label: '10 seconds', desc: 'Punchy quick-bite quote for rapid consumption' },
  { id: 15, label: '15 seconds', desc: 'Recommended — optimal retention for Reels & Shorts', isDefault: true },
  { id: 20, label: '20 seconds', desc: 'Balanced rhythm for longer poetic thoughts' },
  { id: 30, label: '30 seconds', desc: 'Deep reflections with couplet and full context' },
];

const VISUAL_OPTIONS = [
  { id: 'auto', label: 'Auto-select', emoji: '🪄', desc: 'Flowbox dynamically chooses visuals matching the quote topic and mood', isDefault: true },
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬', desc: 'Atmospheric widescreen lighting with film-grade motion textures' },
  { id: 'dark_atmospheric', label: 'Dark & atmospheric', emoji: '🌌', desc: 'Deep obsidian backgrounds with subtle glowing ambient energy' },
  { id: 'minimal', label: 'Minimal', emoji: '✨', desc: 'Refined typography focused on subtle negative space' },
  { id: 'nature', label: 'Nature', emoji: '🌿', desc: 'Misty landscapes, serene morning light and organic textures' },
  { id: 'plain_black', label: 'Plain black fallback', emoji: '⚫', desc: 'Pure black backdrop for bold high-contrast typography' },
];

const AUDIO_OPTIONS = [
  { id: 'approved_library', label: 'Choose from my approved song library', emoji: '🎵', desc: 'Hand-picked licensed instrumental melodies curated for quotes' },
  { id: 'platform_audio', label: 'Platform-supported audio', emoji: '🎧', desc: 'Format video so you can attach trending sounds natively in Reels & Shorts' },
  { id: 'no_audio', label: 'No audio', emoji: '🔇', desc: 'Export silent video ready for custom soundtracking or external tools' },
];

export default function QuoteVideoWizard({
  isOpen,
  onClose,
  initialData = null,
  onSaved,
}) {
  if (!isOpen) return null;

  // Step 1 to 8
  const [step, setStep] = useState(1);
  const [editingFromReview, setEditingFromReview] = useState(false);

  // Configuration State
  const [language, setLanguage] = useState('alternate'); // 'tamil' | 'english' | 'alternate'
  const [topicMode, setTopicMode] = useState('rotate'); // 'rotate' | 'single'
  const [selectedTopic, setSelectedTopic] = useState('motivation');
  const [selectedTopics, setSelectedTopics] = useState([
    'motivation',
    'love',
    'humanity',
    'thirukkural',
    'poetry',
    'meaningful',
  ]);
  const [duration, setDuration] = useState(15);
  const [visualStyle, setVisualStyle] = useState('auto');
  const [audioPreference, setAudioPreference] = useState('approved_library');
  const [platforms, setPlatforms] = useState(['instagram', 'youtube_shorts']);

  // Schedule State
  const [frequency, setFrequency] = useState('daily'); // 'daily' | 'weekdays' | 'weekends' | 'custom'
  const [customDays, setCustomDays] = useState(['MON', 'WED', 'FRI']);
  const [scheduleHour, setScheduleHour] = useState('7');
  const [scheduleMinute, setScheduleMinute] = useState('00');
  const [scheduleAmPm, setScheduleAmPm] = useState('PM');

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Distinguish an existing saved workflow (to update) from a template configuration (to create)
  const isExistingWorkflow = Boolean(
    initialData?.id &&
    initialData.id !== 'daily-quote-video' &&
    !initialData.isQuoteVideo &&
    !initialData.isTemplate &&
    (initialData.isExistingWorkflow || initialData.jumpToReview || initialData.createdAt)
  );

  // Hydrate initial data if editing an existing quote video workflow
  useEffect(() => {
    if (initialData) {
      const cfgNode = initialData.definition?.nodes?.find(
        (n) => n.config?.templateType === 'dailyQuoteVideo'
      );
      if (cfgNode?.config) {
        const c = cfgNode.config;
        if (c.language) setLanguage(c.language);
        if (c.topicMode) setTopicMode(c.topicMode);
        if (c.selectedTopic) setSelectedTopic(c.selectedTopic);
        if (Array.isArray(c.selectedTopics) && c.selectedTopics.length > 0) {
          setSelectedTopics(c.selectedTopics);
        }
        if (c.duration) setDuration(c.duration);
        if (c.visualStyle) setVisualStyle(c.visualStyle);
        if (c.audioPreference) setAudioPreference(c.audioPreference);
        if (Array.isArray(c.platforms) && c.platforms.length > 0) {
          setPlatforms(c.platforms);
        }
        if (c.schedule) {
          if (c.schedule.frequency) setFrequency(c.schedule.frequency);
          if (c.schedule.customDays) setCustomDays(c.schedule.customDays);
          if (c.schedule.hour) setScheduleHour(c.schedule.hour);
          if (c.schedule.minute) setScheduleMinute(c.schedule.minute);
          if (c.schedule.ampm) setScheduleAmPm(c.schedule.ampm);
        }
      }
      // If editing an existing saved workflow, jump directly to review step; otherwise start at Step 1
      if (isExistingWorkflow) {
        setStep(8);
      } else {
        setStep(1);
      }
    } else {
      setStep(1);
    }
  }, [initialData, isExistingWorkflow]);

  // Cron expression builder for backend compatibility
  function computeCron() {
    let h = parseInt(scheduleHour, 10) || 7;
    if (scheduleAmPm === 'PM' && h < 12) h += 12;
    if (scheduleAmPm === 'AM' && h === 12) h = 0;
    const m = parseInt(scheduleMinute, 10) || 0;

    if (frequency === 'daily') {
      return `${m} ${h} * * *`;
    }
    if (frequency === 'weekdays') {
      return `${m} ${h} * * 1-5`;
    }
    if (frequency === 'weekends') {
      return `${m} ${h} * * 0,6`;
    }
    if (frequency === 'custom') {
      const dayMap = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 0 };
      const dayNums = customDays.map((d) => dayMap[d]).sort().join(',');
      return `${m} ${h} * * ${dayNums || '*'}`;
    }
    return `${m} ${h} * * *`;
  }

  // Friendly human schedule summary
  function getScheduleSummary() {
    const timeStr = `${scheduleHour}:${scheduleMinute} ${scheduleAmPm}`;
    if (frequency === 'daily') return `Every day at ${timeStr}`;
    if (frequency === 'weekdays') return `Every weekday at ${timeStr}`;
    if (frequency === 'weekends') return `Every weekend at ${timeStr}`;
    if (frequency === 'custom') {
      if (customDays.length === 0) return `No days selected (${timeStr})`;
      if (customDays.length === 7) return `Every day at ${timeStr}`;
      return `${customDays.join(', ')} at ${timeStr}`;
    }
    return `Every day at ${timeStr}`;
  }

  // Toggle topics when in rotation mode
  function toggleTopicInRotation(topicId) {
    if (selectedTopics.includes(topicId)) {
      if (selectedTopics.length === 1) return; // keep at least one
      setSelectedTopics(selectedTopics.filter((t) => t !== topicId));
    } else {
      setSelectedTopics([...selectedTopics, topicId]);
    }
  }

  // Toggle platform selection (at least one must stay selected)
  function togglePlatform(platId) {
    if (platforms.includes(platId)) {
      if (platforms.length === 1) return; // keep at least one
      setPlatforms(platforms.filter((p) => p !== platId));
    } else {
      setPlatforms([...platforms, platId]);
    }
  }

  // Toggle custom days
  function toggleCustomDay(day) {
    if (customDays.includes(day)) {
      if (customDays.length === 1) return;
      setCustomDays(customDays.filter((d) => d !== day));
    } else {
      setCustomDays([...customDays, day]);
    }
  }

  // Jump to specific step from review
  function handleEditStep(targetStep) {
    setEditingFromReview(true);
    setStep(targetStep);
  }

  // Next step navigation
  function handleNext() {
    if (editingFromReview) {
      setEditingFromReview(false);
      setStep(8);
    } else {
      setStep((prev) => Math.min(prev + 1, 8));
    }
  }

  // Back step navigation
  function handleBack() {
    if (editingFromReview) {
      setEditingFromReview(false);
      setStep(8);
    } else {
      setStep((prev) => Math.max(prev - 1, 1));
    }
  }

  // Save automation configuration
  async function handleSaveAutomation() {
    setSaving(true);
    setSaveError(null);

    const cronExpr = computeCron();
    const timeDisplay = `${scheduleHour}:${scheduleMinute} ${scheduleAmPm}`;

    const definition = {
      nodes: [
        {
          id: 'trigger-1',
          type: 'scheduleTrigger',
          config: {
            cron: cronExpr,
            summary: getScheduleSummary(),
          },
          position: { x: 80, y: 140 },
        },
        {
          id: 'quote-video-config',
          type: 'setData',
          config: {
            templateType: 'dailyQuoteVideo',
            templateTitle: 'Daily Quote Video',
            language,
            topicMode,
            selectedTopic,
            selectedTopics,
            duration,
            visualStyle,
            audioPreference,
            platforms,
            schedule: {
              frequency,
              customDays,
              hour: scheduleHour,
              minute: scheduleMinute,
              ampm: scheduleAmPm,
              timeString: timeDisplay,
              summary: getScheduleSummary(),
              cron: cronExpr,
            },
            fields: [
              { key: 'automationType', value: 'dailyQuoteVideo' },
              { key: 'language', value: language },
              { key: 'duration', value: String(duration) },
              { key: 'platforms', value: platforms.join(', ') },
              { key: 'schedule', value: getScheduleSummary() },
            ],
          },
          position: { x: 380, y: 140 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'quote-video-config' },
      ],
    };

    const payload = {
      name: 'Daily Quote Video',
      definition,
      active: true,
    };

    try {
      let res;
      if (isExistingWorkflow) {
        res = await api.updateWorkflow(initialData.id, payload);
      } else {
        res = await api.createWorkflow(payload);
      }
      if (onSaved) onSaved(res.data);
      onClose();
    } catch (err) {
      console.error('Failed to save quote video automation', err);
      setSaveError(
        err.response?.data?.error ||
        err.message ||
        'Unable to save automation configuration. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  // Friendly summary getters for Review step
  function getLanguageSummary() {
    if (language === 'tamil') return '🇮🇳 Tamil';
    if (language === 'english') return '🇬🇧 English';
    return '🇮🇳 Tamil → 🇬🇧 English → 🇮🇳 Tamil...';
  }

  function getTopicsSummary() {
    if (topicMode === 'single') {
      const t = TOPIC_OPTIONS.find((item) => item.id === selectedTopic);
      return `${t?.emoji || ''} ${t?.label || 'Motivation'}`;
    }
    const labels = selectedTopics
      .map((tid) => TOPIC_OPTIONS.find((t) => t.id === tid)?.label || tid)
      .slice(0, 4);
    return `${labels.join(' → ')}${selectedTopics.length > 4 ? '...' : ''}`;
  }

  function getVisualSummary() {
    const v = VISUAL_OPTIONS.find((opt) => opt.id === visualStyle);
    return `${v?.emoji || ''} ${v?.label || 'Auto-select'}`;
  }

  function getAudioSummary() {
    const a = AUDIO_OPTIONS.find((opt) => opt.id === audioPreference);
    return `${a?.emoji || ''} ${a?.label || 'Approved song library'}`;
  }

  function getPlatformsSummary() {
    const list = [];
    if (platforms.includes('instagram')) list.push('Instagram');
    if (platforms.includes('youtube_shorts')) list.push('YouTube Shorts');
    return list.join(' + ') || 'None selected';
  }

  const stepLabels = [
    'Language',
    'Topic',
    'Length',
    'Visual',
    'Audio',
    'Platforms',
    'Schedule',
    'Review',
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="wizard-modal"
        style={{ maxWidth: 760 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="wizard-header">
          <div className="wizard-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🎬</span>
              <span className="wizard-title">Daily Quote Video</span>
            </div>
            <span className="wizard-step-label">
              Step {step} of 8 · {stepLabels[step - 1]}
            </span>
          </div>
          <button className="btn-subtle" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="wizard-progress-bar">
          <div
            className="wizard-progress-fill"
            style={{ width: `${(step / 8) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="wizard-body">
          {/* STEP 1: LANGUAGE */}
          {step === 1 && (
            <div>
              <div className="wizard-step-header" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  What language should your posts use?
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Choose whether your daily quote videos appear in Tamil, English, or alternate smoothly between both.
                </p>
              </div>

              <div className="options-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                {/* Tamil */}
                <div
                  className={`option-card ${language === 'tamil' ? 'selected' : ''}`}
                  onClick={() => setLanguage('tamil')}
                >
                  <div className="option-icon-box" style={{ fontSize: 22 }}>
                    🇮🇳
                  </div>
                  <div className="option-text" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4>Tamil</h4>
                      {language === 'tamil' && <Check size={18} color="var(--neon-green)" />}
                    </div>
                    <p>All quote videos will be generated exclusively in Tamil (தமிழ்).</p>
                  </div>
                </div>

                {/* English */}
                <div
                  className={`option-card ${language === 'english' ? 'selected' : ''}`}
                  onClick={() => setLanguage('english')}
                >
                  <div className="option-icon-box" style={{ fontSize: 22 }}>
                    🇬🇧
                  </div>
                  <div className="option-text" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4>English</h4>
                      {language === 'english' && <Check size={18} color="var(--neon-green)" />}
                    </div>
                    <p>All quote videos will be generated exclusively in English.</p>
                  </div>
                </div>

                {/* Alternate */}
                <div
                  className={`option-card ${language === 'alternate' ? 'selected' : ''}`}
                  onClick={() => setLanguage('alternate')}
                >
                  <div className="option-icon-box" style={{ fontSize: 22 }}>
                    🔄
                  </div>
                  <div className="option-text" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4>Alternate Tamil & English</h4>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: 'rgba(0, 229, 117, 0.1)',
                            color: 'var(--neon-green)',
                            border: '1px solid var(--neon-green-border)',
                          }}
                        >
                          Recommended
                        </span>
                      </div>
                      {language === 'alternate' && <Check size={18} color="var(--neon-green)" />}
                    </div>
                    <p>Tamil → English → Tamil → English alternating every day automatically.</p>
                  </div>
                </div>
              </div>

              {/* Language Rotation Preview Box */}
              {language === 'alternate' && (
                <div
                  style={{
                    marginTop: 20,
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(0, 229, 117, 0.04)',
                    border: '1px solid var(--neon-green-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} color="var(--neon-green)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--neon-green)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Schedule Preview
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
                    <div
                      style={{
                        background: '#0d121a',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flex: '1 1 200px',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>🇮🇳</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-bright)', textTransform: 'uppercase' }}>
                          Tomorrow
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                          Tamil
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#0d121a',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flex: '1 1 200px',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>🇬🇧</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                          Next
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                          English
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: TOPIC */}
          {step === 2 && (
            <div>
              <div className="wizard-step-header" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  What should your posts be about?
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Pick a single category or enable a daily rotation to keep your social feed diverse and engaging.
                </p>
              </div>

              {/* Mode Toggle: Rotate vs Single */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 18,
                  padding: 4,
                  background: '#0d111a',
                  borderRadius: 'var(--radius-md)',
                  width: 'fit-content',
                  border: '1px solid var(--border-light)',
                }}
              >
                <button
                  type="button"
                  style={{
                    background: topicMode === 'rotate' ? 'var(--neon-green)' : 'transparent',
                    color: topicMode === 'rotate' ? '#000000' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setTopicMode('rotate')}
                >
                  🔄 Rotate topics
                </button>
                <button
                  type="button"
                  style={{
                    background: topicMode === 'single' ? 'var(--neon-green)' : 'transparent',
                    color: topicMode === 'single' ? '#000000' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setTopicMode('single')}
                >
                  🎯 One topic
                </button>
              </div>

              {/* Topics Selection Grid */}
              <div className="options-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {TOPIC_OPTIONS.map((topic) => {
                  const isSelected =
                    topicMode === 'rotate'
                      ? selectedTopics.includes(topic.id)
                      : selectedTopic === topic.id;

                  return (
                    <div
                      key={topic.id}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (topicMode === 'rotate') {
                          toggleTopicInRotation(topic.id);
                        } else {
                          setSelectedTopic(topic.id);
                        }
                      }}
                    >
                      <div className="option-icon-box" style={{ fontSize: 22 }}>
                        {topic.emoji}
                      </div>
                      <div className="option-text" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h4>{topic.label}</h4>
                          {isSelected && <Check size={18} color="var(--neon-green)" />}
                        </div>
                        <p>{topic.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visual Topic Rotation List (when rotate is active) */}
              {topicMode === 'rotate' && (
                <div
                  style={{
                    marginTop: 22,
                    padding: '18px 20px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(0, 229, 117, 0.03)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-bright)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Active Topic Rotation Sequence
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {selectedTopics.length} topics cycling daily
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {selectedTopics.map((tid, idx) => {
                      const t = TOPIC_OPTIONS.find((item) => item.id === tid);
                      return (
                        <React.Fragment key={tid}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-full)',
                              background: '#111622',
                              border: '1px solid var(--border-medium)',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#ffffff',
                            }}
                          >
                            <span>{t?.emoji}</span>
                            <span>{t?.label}</span>
                          </div>
                          {idx < selectedTopics.length - 1 && (
                            <ArrowRight size={13} color="var(--text-secondary)" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: VIDEO LENGTH */}
          {step === 3 && (
            <div>
              <div className="wizard-step-header" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  How long should the video be?
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Pacing is tuned precisely for optimal social engagement and viewer retention.
                </p>
              </div>

              <div className="options-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {DURATION_OPTIONS.map((opt) => (
                  <div
                    key={opt.id}
                    className={`option-card ${duration === opt.id ? 'selected' : ''}`}
                    onClick={() => setDuration(opt.id)}
                  >
                    <div
                      className="option-icon-box"
                      style={{
                        fontWeight: 800,
                        fontSize: 16,
                        color: duration === opt.id ? 'var(--neon-green)' : '#94a3b8',
                      }}
                    >
                      {opt.id}s
                    </div>
                    <div className="option-text" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <h4>{opt.label}</h4>
                          {opt.isDefault && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 10,
                                background: 'rgba(0, 229, 117, 0.1)',
                                color: 'var(--neon-green)',
                                border: '1px solid var(--neon-green-border)',
                              }}
                            >
                              Default
                            </span>
                          )}
                        </div>
                        {duration === opt.id && <Check size={18} color="var(--neon-green)" />}
                      </div>
                      <p>{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 24,
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: '#0d111a',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Info size={18} color="var(--gold-accent)" />
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  Video lengths are calculated to match speech cadence, reading speed, and social platform loops. No real video will be rendered until scheduled execution.
                </span>
              </div>
            </div>
          )}

          {/* STEP 4: VISUAL STYLE */}
          {step === 4 && (
            <div>
              <div className="wizard-step-header" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  What should the video look like?
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Select the visual tone for the background imagery and motion atmosphere.
                </p>
              </div>

              <div className="options-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {VISUAL_OPTIONS.map((opt) => (
                  <div
                    key={opt.id}
                    className={`option-card ${visualStyle === opt.id ? 'selected' : ''}`}
                    onClick={() => setVisualStyle(opt.id)}
                  >
                    <div className="option-icon-box" style={{ fontSize: 22 }}>
                      {opt.emoji}
                    </div>
                    <div className="option-text" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <h4>{opt.label}</h4>
                          {opt.isDefault && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 10,
                                background: 'rgba(0, 229, 117, 0.1)',
                                color: 'var(--neon-green)',
                                border: '1px solid var(--neon-green-border)',
                              }}
                            >
                              Default
                            </span>
                          )}
                        </div>
                        {visualStyle === opt.id && <Check size={18} color="var(--neon-green)" />}
                      </div>
                      <p>{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Explanatory callout */}
              <div
                style={{
                  marginTop: 20,
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 229, 117, 0.04)',
                  border: '1px solid var(--neon-green-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Sparkles size={18} color="var(--neon-green)" />
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                  The final system will dynamically choose a visual matching the quote theme and emotion. No external images are downloaded or scraped at this step.
                </span>
              </div>
            </div>
          )}

          {/* STEP 5: AUDIO PREFERENCE */}
          {step === 5 && (
            <div>
              <div className="wizard-step-header" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  What kind of audio should be used?
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Set your audio strategy for soundtracking the quote posts.
                </p>
              </div>

              <div className="options-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                {AUDIO_OPTIONS.map((opt) => (
                  <div
                    key={opt.id}
                    className={`option-card ${audioPreference === opt.id ? 'selected' : ''}`}
                    onClick={() => setAudioPreference(opt.id)}
                  >
                    <div className="option-icon-box" style={{ fontSize: 22 }}>
                      {opt.emoji}
                    </div>
                    <div className="option-text" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h4>{opt.label}</h4>
                        {audioPreference === opt.id && <Check size={18} color="var(--neon-green)" />}
                      </div>
                      <p>{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legal / Policy Note */}
              <div
                style={{
                  marginTop: 22,
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: '#0d111a',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <Info size={18} color="var(--gold-bright)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>
                  <strong style={{ color: '#ffffff' }}>Flowbox Audio Workflow:</strong> Flowbox will use audio through supported platform/licensed workflows. It will not download or extract copyrighted audio from Reels or Shorts.
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: PUBLISHING PLATFORMS */}
          {step === 6 && (
            <div>
              <div className="wizard-step-header" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  Where will you publish?
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Choose which platforms your quote videos are formatted for. You can choose one or both.
                </p>
              </div>

              <div className="options-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {/* Instagram */}
                <div
                  className={`option-card ${platforms.includes('instagram') ? 'selected' : ''}`}
                  onClick={() => togglePlatform('instagram')}
                >
                  <div
                    className="option-icon-box"
                    style={{
                      background: platforms.includes('instagram') ? 'rgba(0, 229, 117, 0.12)' : '#141923',
                      color: platforms.includes('instagram') ? 'var(--neon-green)' : '#94a3b8',
                    }}
                  >
                    <InstagramIcon size={22} />
                  </div>
                  <div className="option-text" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4>Instagram</h4>
                      {platforms.includes('instagram') && <Check size={18} color="var(--neon-green)" />}
                    </div>
                    <p>Formats 9:16 vertical video optimized for Instagram Reels and Stories.</p>
                  </div>
                </div>

                {/* YouTube Shorts */}
                <div
                  className={`option-card ${platforms.includes('youtube_shorts') ? 'selected' : ''}`}
                  onClick={() => togglePlatform('youtube_shorts')}
                >
                  <div
                    className="option-icon-box"
                    style={{
                      background: platforms.includes('youtube_shorts') ? 'rgba(0, 229, 117, 0.12)' : '#141923',
                      color: platforms.includes('youtube_shorts') ? 'var(--neon-green)' : '#94a3b8',
                    }}
                  >
                    <YouTubeIcon size={22} />
                  </div>
                  <div className="option-text" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4>YouTube Shorts</h4>
                      {platforms.includes('youtube_shorts') && <Check size={18} color="var(--neon-green)" />}
                    </div>
                    <p>Prepares high-bitrate vertical video tuned for YouTube Shorts feeds.</p>
                  </div>
                </div>
              </div>

              {/* Informational Callout (Publishing connection will be connected later) */}
              <div
                style={{
                  marginTop: 24,
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid var(--gold-border)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <Info size={18} color="var(--gold-bright)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-bright)', marginBottom: 2 }}>
                    Publishing integration will be connected later.
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                    Flowbox will store your publishing targets with this automation. Direct publishing credentials and account authorizations will be linked in an upcoming update.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: SCHEDULE */}
          {step === 7 && (
            <div>
              <div className="wizard-step-header" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                  When should Flowbox prepare this post?
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Set the daily or weekly cadence and the exact delivery time.
                </p>
              </div>

              {/* Cadence Presets */}
              <div style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>
                  Frequency
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {[
                    { id: 'daily', label: 'Every day' },
                    { id: 'weekdays', label: 'Weekdays' },
                    { id: 'weekends', label: 'Weekends' },
                    { id: 'custom', label: 'Custom days' },
                  ].map((freq) => (
                    <button
                      key={freq.id}
                      type="button"
                      className={`btn-secondary ${frequency === freq.id ? 'active' : ''}`}
                      style={{
                        padding: '12px 14px',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 600,
                        background: frequency === freq.id ? 'rgba(0, 229, 117, 0.08)' : '#0d111a',
                        borderColor: frequency === freq.id ? 'var(--neon-green)' : 'var(--border-light)',
                        color: frequency === freq.id ? 'var(--neon-green)' : '#94a3b8',
                      }}
                      onClick={() => setFrequency(freq.id)}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Days Selector */}
              {frequency === 'custom' && (
                <div style={{ marginBottom: 24 }}>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                    Select Days
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                      <button
                        key={day}
                        type="button"
                        style={{
                          width: 46,
                          height: 42,
                          borderRadius: 'var(--radius-md)',
                          background: customDays.includes(day) ? 'rgba(0, 229, 117, 0.15)' : '#0d111a',
                          border: `1px solid ${customDays.includes(day) ? 'var(--neon-green)' : 'var(--border-light)'}`,
                          color: customDays.includes(day) ? 'var(--neon-green)' : '#94a3b8',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleCustomDay(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Picker */}
              <div style={{ marginBottom: 24 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                  Preparation Time
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Hour */}
                  <select
                    className="form-select"
                    style={{ width: 85, fontSize: 16, fontWeight: 700 }}
                    value={scheduleHour}
                    onChange={(e) => setScheduleHour(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                      <option key={h} value={String(h)}>
                        {h}
                      </option>
                    ))}
                  </select>

                  <span style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>:</span>

                  {/* Minute */}
                  <select
                    className="form-select"
                    style={{ width: 85, fontSize: 16, fontWeight: 700 }}
                    value={scheduleMinute}
                    onChange={(e) => setScheduleMinute(e.target.value)}
                  >
                    {['00', '15', '30', '45'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  {/* AM/PM */}
                  <select
                    className="form-select"
                    style={{ width: 85, fontSize: 16, fontWeight: 700 }}
                    value={scheduleAmPm}
                    onChange={(e) => setScheduleAmPm(e.target.value)}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              {/* Human-Friendly Summary Banner */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 229, 117, 0.05)',
                  border: '1px solid var(--neon-green-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Clock size={20} color="var(--neon-green)" />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neon-green)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Scheduled Time
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff' }}>
                    {getScheduleSummary()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: REVIEW */}
          {step === 8 && (
            <div>
              <div className="wizard-step-header" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 24 }}>🎬</span>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Daily Quote Video
                  </h3>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Review your quote video configuration before activating the automation.
                </p>
              </div>

              {saveError && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {saveError}
                </div>
              )}

              {/* Review Boxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. Language */}
                <div className="review-box" style={{ margin: 0 }}>
                  <div className="review-left">
                    <div className="review-icon">
                      <span style={{ fontSize: 18 }}>🗣️</span>
                    </div>
                    <div>
                      <div className="review-label">Language</div>
                      <div className="review-val">{getLanguageSummary()}</div>
                    </div>
                  </div>
                  <button
                    className="review-edit-btn"
                    onClick={() => handleEditStep(1)}
                  >
                    Edit
                  </button>
                </div>

                {/* 2. Topics */}
                <div className="review-box" style={{ margin: 0 }}>
                  <div className="review-left">
                    <div className="review-icon">
                      <span style={{ fontSize: 18 }}>📜</span>
                    </div>
                    <div>
                      <div className="review-label">Topics</div>
                      <div className="review-val">{getTopicsSummary()}</div>
                    </div>
                  </div>
                  <button
                    className="review-edit-btn"
                    onClick={() => handleEditStep(2)}
                  >
                    Edit
                  </button>
                </div>

                {/* 3. Duration */}
                <div className="review-box" style={{ margin: 0 }}>
                  <div className="review-left">
                    <div className="review-icon">
                      <span style={{ fontSize: 18 }}>⏱️</span>
                    </div>
                    <div>
                      <div className="review-label">Duration</div>
                      <div className="review-val">{duration} seconds</div>
                    </div>
                  </div>
                  <button
                    className="review-edit-btn"
                    onClick={() => handleEditStep(3)}
                  >
                    Edit
                  </button>
                </div>

                {/* 4. Visual */}
                <div className="review-box" style={{ margin: 0 }}>
                  <div className="review-left">
                    <div className="review-icon">
                      <span style={{ fontSize: 18 }}>🎨</span>
                    </div>
                    <div>
                      <div className="review-label">Visual</div>
                      <div className="review-val">{getVisualSummary()}</div>
                    </div>
                  </div>
                  <button
                    className="review-edit-btn"
                    onClick={() => handleEditStep(4)}
                  >
                    Edit
                  </button>
                </div>

                {/* 5. Audio */}
                <div className="review-box" style={{ margin: 0 }}>
                  <div className="review-left">
                    <div className="review-icon">
                      <span style={{ fontSize: 18 }}>🎵</span>
                    </div>
                    <div>
                      <div className="review-label">Audio</div>
                      <div className="review-val">{getAudioSummary()}</div>
                    </div>
                  </div>
                  <button
                    className="review-edit-btn"
                    onClick={() => handleEditStep(5)}
                  >
                    Edit
                  </button>
                </div>

                {/* 6. Platforms */}
                <div className="review-box" style={{ margin: 0 }}>
                  <div className="review-left">
                    <div className="review-icon">
                      <span style={{ fontSize: 18 }}>📱</span>
                    </div>
                    <div>
                      <div className="review-label">Platforms</div>
                      <div className="review-val">{getPlatformsSummary()}</div>
                    </div>
                  </div>
                  <button
                    className="review-edit-btn"
                    onClick={() => handleEditStep(6)}
                  >
                    Edit
                  </button>
                </div>

                {/* 7. Schedule */}
                <div className="review-box" style={{ margin: 0 }}>
                  <div className="review-left">
                    <div className="review-icon">
                      <Clock size={18} color="var(--neon-green)" />
                    </div>
                    <div>
                      <div className="review-label">Schedule</div>
                      <div className="review-val">{getScheduleSummary()}</div>
                    </div>
                  </div>
                  <button
                    className="review-edit-btn"
                    onClick={() => handleEditStep(7)}
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Status Note */}
              <div
                style={{
                  marginTop: 18,
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 229, 117, 0.04)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--neon-green)',
                    boxShadow: '0 0 8px var(--neon-green)',
                  }}
                />
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                  Ready to activate. Saving will register this automation as <strong>Active</strong> in your Flowbox dashboard.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <div>
            {step > 1 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBack}
                disabled={saving}
              >
                <ArrowLeft size={16} />
                <span>{editingFromReview ? 'Back to Review' : 'Back'}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {step < 8 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleNext}
              >
                <span>{editingFromReview ? 'Done & Return to Review' : 'Next'}</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveAutomation}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RotateCw className="spin" size={16} />
                    <span>Saving automation…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Save automation</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
