import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  X,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Layers,
  ArrowLeft,
  Share2,
  Send,
  ExternalLink,
  UploadCloud,
  Info,
  Globe,
} from 'lucide-react';
import { api } from '../api';

/**
 * Consumer-Friendly Quote Video Review & Preview Modal
 *
 * Implements Phase 5 & Phase 6 Workflow:
 * - 9:16 vertical video player (muted by default)
 * - Clean human-friendly metadata (no IDs, UUIDs, or engine internals)
 * - Safe Approve action with success state ("✓ Approved")
 * - Controlled Publishing workflow to Instagram Reels & YouTube Shorts
 * - Deliberate Regenerate flow with explicit confirmation dialog
 */
export default function QuoteVideoReviewModal({
  job,
  workflowId,
  onClose,
  onJobUpdated,
}) {
  const [currentJob, setCurrentJob] = useState(job);
  const [isApproving, setIsApproving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publications, setPublications] = useState([]);
  const [publishingConfig, setPublishingConfig] = useState(null);
  const [publishNotice, setPublishNotice] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isMuted, setIsMuted] = useState(true);

  const videoRef = useRef(null);
  const confirmPanelRef = useRef(null);
  const bodyRef = useRef(null);

  // Auto-scroll confirmation panel into view when opened
  useEffect(() => {
    if (showRegenerateConfirm && confirmPanelRef.current) {
      confirmPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [showRegenerateConfirm]);

  // Sync internal job state if prop changes
  useEffect(() => {
    if (job) {
      setCurrentJob(job);
    }
  }, [job]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isRegenerating) return;
        if (showRegenerateConfirm) {
          setShowRegenerateConfirm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showRegenerateConfirm, isRegenerating]);

  if (!currentJob) return null;

  const isApproved =
    currentJob.reviewStatus === 'approved' ||
    currentJob.review_status === 'approved';

  const isRendered =
    currentJob.renderStatus === 'rendered' ||
    currentJob.render_status === 'rendered';

  const isRendering =
    currentJob.renderStatus === 'rendering' ||
    currentJob.render_status === 'rendering';

  const isRenderFailed =
    currentJob.renderStatus === 'render_failed' ||
    currentJob.render_status === 'render_failed';

  // Format consumer-friendly labels
  const topicLabel =
    currentJob.topic
      ? currentJob.topic.charAt(0).toUpperCase() + currentJob.topic.slice(1).replace(/_/g, ' ')
      : 'General';

  const languageLabel =
    currentJob.language === 'ta'
      ? 'Tamil'
      : currentJob.language === 'en'
      ? 'English'
      : currentJob.language || 'Tamil';

  const visualLabel =
    currentJob.visualStrategy?.visualTitle ||
    currentJob.visualStrategy?.style ||
    'Cinematic';

  const audioLabel =
    currentJob.audioStrategy?.preference === 'none'
      ? 'Silent'
      : 'Approved Ambient';

  // Handle Approve action
  const handleApprove = async () => {
    if (!isRendered) {
      setError('Cannot approve: Video is not rendered yet.');
      return;
    }
    setIsApproving(true);
    setError(null);
    try {
      const res = await api.approveQuoteJob(currentJob.id);
      const updated = res.data?.job || {
        ...currentJob,
        reviewStatus: 'approved',
        review_status: 'approved',
      };
      setCurrentJob(updated);
      setSuccessMsg('✓ Approved. Ready for the next publishing phase.');
      if (onJobUpdated) {
        onJobUpdated(updated);
      }
    } catch (err) {
      console.error('Approval failed:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Unable to approve this video. Please try again.';
      setError(msg);
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Regenerate action
  const handleConfirmRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);
    setShowRegenerateConfirm(false);
    try {
      const res = await api.regenerateQuoteJob(currentJob.id);
      const newJob = res.data?.job;
      if (newJob) {
        setCurrentJob(newJob);
        setSuccessMsg(`✓ Version ${newJob.version || 2} ready for review.`);
        if (onJobUpdated) {
          onJobUpdated(newJob);
        }
      }
    } catch (err) {
      console.error('Regeneration failed:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Unable to regenerate this video. Please try again.';
      setError(msg);
    } finally {
      setIsRegenerating(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const isPublished =
    currentJob.publishStatus === 'published' ||
    currentJob.publish_status === 'published';

  const isPublishingState =
    isPublishing ||
    currentJob.publishStatus === 'publishing' ||
    currentJob.publish_status === 'publishing';

  // Load publication records and configuration if approved
  useEffect(() => {
    if (isApproved && currentJob?.id) {
      api
        .getJobPublications(currentJob.id)
        .then((res) => {
          if (res.data?.publications) {
            setPublications(res.data.publications);
          }
        })
        .catch(() => {});
      api
        .getPublishingStatus()
        .then((res) => {
          if (res.data) setPublishingConfig(res.data);
        })
        .catch(() => {});
    }
  }, [isApproved, currentJob?.id]);

  // Handle Publish action
  const handlePublish = async (platformFilter = null) => {
    if (!isApproved) {
      setError('Cannot publish: Video must be approved first.');
      return;
    }
    setIsPublishing(true);
    setPublishNotice(null);
    setError(null);
    try {
      const payload = platformFilter ? { platforms: [platformFilter] } : {};
      const res = await api.publishQuoteJob(currentJob.id, payload);
      const updated = res.data?.job || {
        ...currentJob,
        publishStatus: res.data?.publishStatus || 'published',
        publish_status: res.data?.publishStatus || 'published',
      };
      setCurrentJob(updated);

      // Re-fetch complete publication history so single-platform retry never hides other platforms
      const pubsRes = await api.getJobPublications(currentJob.id).catch(() => null);
      if (pubsRes?.data?.publications && pubsRes.data.publications.length > 0) {
        setPublications(pubsRes.data.publications);
      } else if (res.data?.publications) {
        setPublications(res.data.publications);
      }

      if (onJobUpdated) {
        onJobUpdated(updated);
      }
      if (res.data?.success) {
        setSuccessMsg('✓ Video successfully published.');
      } else {
        const firstPubError =
          res.data?.publications?.find((p) => p.error || p.errorMessage)?.error ||
          res.data?.publications?.find((p) => p.error || p.errorMessage)?.errorMessage;
        if (firstPubError && firstPubError.includes('Publishing is not configured')) {
          setPublishNotice("Publishing isn't configured yet. Connect Instagram or YouTube to publish this video.");
        } else {
          setError(firstPubError || 'Publishing failed. Please check platform configuration.');
        }
      }
    } catch (err) {
      console.error('Publishing failed:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Publishing failed. Please try again.';
      if (msg.includes('Publishing is not configured')) {
        setPublishNotice("Publishing isn't configured yet. Connect Instagram or YouTube to publish this video.");
      } else {
        setError(msg);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="quote-video-modal-backdrop" onClick={isRegenerating ? undefined : onClose}>
      <div className="quote-video-modal" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        {/* FULL-MODAL REGENERATING OVERLAY */}
        {isRegenerating && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 20, 32, 0.94)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              zIndex: 50,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <RefreshCw size={36} className="spin" color="var(--neon-green)" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                Generating & Rendering New Version…
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, maxWidth: 320, lineHeight: 1.5 }}>
                Preparing next quote rotation, applying cinematic visuals, and rendering 1080×1920 MP4 video.
              </div>
            </div>
          </div>
        )}

        {/* MODAL HEADER */}
        <div className="quote-video-modal-header">
          <div className="quote-video-modal-title">
            <Film size={16} color="var(--neon-green)" />
            <span>Review Quote Video</span>
          </div>
          <button
            className="btn-icon"
            onClick={isRegenerating ? undefined : onClose}
            disabled={isRegenerating}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              opacity: isRegenerating ? 0.4 : 1,
              cursor: isRegenerating ? 'not-allowed' : 'pointer',
            }}
            title={isRegenerating ? 'Regenerating video…' : 'Close review'}
            aria-label="Close review"
          >
            <X size={16} />
          </button>
        </div>

        {/* SCROLLABLE MODAL CONTENT */}
        <div className="quote-video-modal-body" ref={bodyRef}>
          {/* METADATA SUMMARY BAR */}
          <div
            style={{
              padding: '10px 18px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0', fontWeight: 600 }}>
              <span>{topicLabel}</span>
              <span style={{ color: '#475569' }}>•</span>
              <span>{languageLabel}</span>
              <span style={{ color: '#475569' }}>•</span>
              <span style={{ color: '#94a3b8' }}>{currentJob.duration || 15}s</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
              <span>{visualLabel}</span>
              {currentJob.version > 1 && (
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    color: '#38bdf8',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  v{currentJob.version}
                </span>
              )}
            </div>
          </div>

          {/* ERROR / SUCCESS ALERTS */}
          {error && (
            <div
              style={{
                padding: '8px 18px',
                background: 'rgba(239, 68, 68, 0.12)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '8px 18px',
                background: 'rgba(0, 229, 117, 0.12)',
                borderBottom: '1px solid rgba(0, 229, 117, 0.25)',
                color: 'var(--neon-green)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={14} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 9:16 VERTICAL VIDEO PLAYER */}
          <div className="quote-video-player-wrap" style={{ position: 'relative' }}>
            {isRendered ? (
              <>
                <video
                  ref={videoRef}
                  className="quote-video-element"
                  controls
                  autoPlay
                  playsInline
                  muted={isMuted}
                  key={currentJob.id}
                  src={api.getVideoUrl(currentJob.id)}
                >
                  Your browser does not support HTML5 video preview.
                </video>

                {/* Quick Mute Toggle Overlay */}
                <button
                  type="button"
                  onClick={toggleMute}
                  style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    background: 'rgba(0, 0, 0, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                >
                  {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              </>
            ) : isRendering ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  color: '#94a3b8',
                  gap: 12,
                }}
              >
                <RefreshCw size={28} className="spin" color="var(--neon-green)" />
                <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>Video is currently rendering…</div>
                <div style={{ fontSize: 12 }}>Applying topic-aware visuals and cinematic typography.</div>
              </div>
            ) : isRenderFailed ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  color: '#f87171',
                  gap: 12,
                }}
              >
                <AlertCircle size={28} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Video rendering failed</div>
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                  {currentJob.errorMessage || 'An error occurred during video rendering.'}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  color: '#94a3b8',
                  gap: 12,
                }}
              >
                <Film size={28} color="#64748b" />
                <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>Video not rendered yet</div>
                <div style={{ fontSize: 12 }}>Render this quote video to view its cinematic preview.</div>
              </div>
            )}
          </div>

          {/* QUOTE SNIPPET BANNER */}
          {currentJob.quote && (
            <div
              style={{
                padding: '12px 18px',
                background: '#090c13',
                borderTop: '1px solid var(--border-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#e2e8f0',
                  fontStyle: 'italic',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}
              >
                "{currentJob.quote}"
              </div>
              {currentJob.explanation && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    marginTop: 4,
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}
                >
                  {currentJob.explanation}
                </div>
              )}
            </div>
          )}

          {/* REGENERATE CONFIRMATION PANEL (INSIDE SCROLLABLE CONTENT) */}
          {showRegenerateConfirm && (
            <div
              ref={confirmPanelRef}
              style={{
                padding: '14px 18px',
                background: '#131b2c',
                borderTop: '1px solid var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>
                Generate a new version of this quote video?
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
                This will prepare a fresh quote and render a new video. The current version will remain preserved in history.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => setShowRegenerateConfirm(false)}
                  disabled={isRegenerating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={handleConfirmRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? 'Generating…' : 'Regenerate'}
                </button>
              </div>
            </div>
          )}

          {/* PHASE 6: PUBLISHING NOTIFICATION (IF NOT CONFIGURED) */}
          {publishNotice && (
            <div
              style={{
                padding: '12px 18px',
                background: 'rgba(56, 189, 248, 0.08)',
                borderTop: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: 12,
                color: '#e2e8f0',
                lineHeight: 1.45,
                flexShrink: 0,
              }}
            >
              <Info size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#38bdf8' }}>Publishing Notice</div>
                <div style={{ marginTop: 2, color: '#94a3b8' }}>{publishNotice}</div>
              </div>
            </div>
          )}

          {/* PHASE 6: MULTI-PLATFORM PUBLISHING HISTORY */}
          {isApproved && publications && publications.length > 0 && (
            <div
              style={{
                padding: '12px 18px',
                background: '#090c13',
                borderTop: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#94a3b8',
                  marginBottom: 8,
                }}
              >
                Publishing History
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {publications.map((pub) => {
                  const isIg = pub.platform === 'instagram';
                  const isPub = pub.status === 'published';
                  const isSim = pub.status === 'simulated';
                  const isFail = pub.status === 'publish_failed';
                  const platformName = isIg ? 'Instagram Reels' : 'YouTube Shorts';

                  return (
                    <div
                      key={pub.id || pub.platform}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Share2
                          size={14}
                          color={isPub ? 'var(--neon-green)' : isSim ? '#38bdf8' : isFail ? '#f87171' : '#94a3b8'}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{platformName}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                            {isPub && (
                              <span style={{ color: 'var(--neon-green)' }}>
                                ✓ Published {pub.publishedAt ? `• ${new Date(pub.publishedAt).toLocaleDateString()}` : ''}
                                {pub.externalPostId ? ` (ID: ${pub.externalPostId})` : ''}
                              </span>
                            )}
                            {isSim && <span style={{ color: '#38bdf8' }}>⚡ Simulated (Dry-run)</span>}
                            {isFail && (
                              <span style={{ color: '#f87171' }}>
                                ✕ Failed: {pub.errorMessage || pub.error || 'Platform error'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {pub.externalUrl && (
                          <a
                            href={pub.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 11,
                              color: '#38bdf8',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <span>{isIg ? 'View Reel' : 'View Short'}</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                        {isFail && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: 10, padding: '2px 8px' }}
                            onClick={() => handlePublish(pub.platform)}
                            disabled={isPublishingState}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* STICKY ACTION FOOTER (ALWAYS ACCESSIBLE) */}
        <div className="quote-video-modal-footer">
          {/* APPROVED SUCCESS BANNER & PUBLISH CONTROLS */}
          {isApproved ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0, 229, 117, 0.08)',
                border: '1px solid rgba(0, 229, 117, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <CheckCircle2 size={16} color="var(--neon-green)" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neon-green)' }}>
                    {isPublished ? '✓ Published' : '✓ Approved'}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isPublished ? 'Live on connected platforms.' : 'Ready to publish.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {/* Publish Action Button */}
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    fontSize: 11,
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: isPublished ? 'rgba(0, 229, 117, 0.2)' : undefined,
                  }}
                  onClick={() => handlePublish()}
                  disabled={isPublishingState || isRegenerating || showRegenerateConfirm}
                  title={isPublished ? 'Publish again or retry platforms' : 'Publish approved video to Instagram and YouTube'}
                >
                  <UploadCloud size={13} className={isPublishingState ? 'spin' : ''} />
                  <span>{isPublishingState ? 'Publishing…' : isPublished ? 'Publish' : 'Publish'}</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '5px 10px' }}
                  onClick={() => setShowRegenerateConfirm(true)}
                  disabled={isRegenerating || isApproving || isPublishingState || showRegenerateConfirm}
                  title="Generate another version"
                >
                  <RefreshCw size={11} className={isRegenerating ? 'spin' : ''} />
                  <span>Regenerate</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '5px 12px' }}
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* READY FOR REVIEW / RENDERING ACTIONS */
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 11, color: '#64748b' }}>
                📱 Instagram Reels • YouTube Shorts
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => setShowRegenerateConfirm(true)}
                  disabled={isApproving || isRegenerating || isRendering || showRegenerateConfirm}
                  title="Prepare a different quote video"
                >
                  <RefreshCw size={12} className={isRegenerating ? 'spin' : ''} />
                  <span>{isRegenerating ? 'Regenerating…' : 'Regenerate'}</span>
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    fontSize: 12,
                    padding: '6px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={handleApprove}
                  disabled={!isRendered || isApproving || isRegenerating || isRendering || showRegenerateConfirm}
                  title={!isRendered ? 'Wait for rendering to complete' : 'Approve for publishing'}
                >
                  <CheckCircle2 size={13} />
                  <span>{isApproving ? 'Approving…' : 'Approve'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
