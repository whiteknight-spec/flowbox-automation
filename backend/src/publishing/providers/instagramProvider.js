const axios = require('axios');
const BasePublishingProvider = require('./baseProvider');
const { PLATFORMS, PUBLISH_STATUS } = require('../types');

/**
 * Official Meta / Instagram Reels Publishing Provider
 *
 * Implements official Instagram Graph API Content Publishing workflow for Reels:
 * 1. POST /{ig-user-id}/media (media_type=REELS, video_url, caption) -> creation_id
 * 2. GET /{creation-id}?fields=status_code -> wait for FINISHED
 * 3. POST /{ig-user-id}/media_publish?creation_id={creation_id} -> publish_id
 *
 * Strict Security: Never logs or stores raw access tokens.
 */
class InstagramProvider extends BasePublishingProvider {
  constructor() {
    super(PLATFORMS.INSTAGRAM, 'Instagram Reels');
  }

  /**
   * Resolves credentials from passed object or environment variables.
   */
  resolveCredentials(credentials = {}) {
    const accessToken = credentials.accessToken || credentials.metaAccessToken || process.env.META_ACCESS_TOKEN;
    const igUserId = credentials.igUserId || credentials.metaIgUserId || process.env.META_IG_USER_ID;
    return { accessToken, igUserId };
  }

  isConfigured(credentials = {}) {
    const { accessToken, igUserId } = this.resolveCredentials(credentials);
    return Boolean(accessToken && igUserId);
  }

  /**
   * Builds the Instagram Reels caption including hashtags and source attribution.
   */
  buildCaption(job) {
    const parts = [];
    if (job.quote) parts.push(`"${job.quote}"`);
    if (job.explanation) parts.push(`\n${job.explanation}`);
    const hashtags = Array.isArray(job.hashtags) ? job.hashtags : [];
    if (hashtags.length > 0) {
      parts.push(`\n\n${hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}`);
    }
    return parts.join('\n').trim();
  }

  async publishQuoteVideo(job, credentials = {}) {
    const { accessToken, igUserId } = this.resolveCredentials(credentials);

    // Check development dry-run / simulation mode
    const isSimulated = process.env.PUBLISHING_SIMULATED === 'true' || credentials.simulated === true;
    if (isSimulated) {
      const simId = `sim_ig_${Date.now()}`;
      return {
        success: true,
        platform: PLATFORMS.INSTAGRAM,
        status: PUBLISH_STATUS.SIMULATED,
        externalPostId: simId,
        url: `https://www.instagram.com/reel/${simId}`,
        publishedAt: new Date().toISOString(),
        note: 'Simulated dry-run publish (development mode).',
      };
    }

    if (!accessToken || !igUserId) {
      return {
        success: false,
        platform: PLATFORMS.INSTAGRAM,
        status: PUBLISH_STATUS.PUBLISH_FAILED,
        error: 'Publishing is not configured. Missing Instagram credentials (META_ACCESS_TOKEN and META_IG_USER_ID).',
      };
    }

    // Determine public or downloadable video URL
    const videoUrl = credentials.videoUrl || job.outputUrl;
    if (!videoUrl || !videoUrl.startsWith('http')) {
      return {
        success: false,
        platform: PLATFORMS.INSTAGRAM,
        status: PUBLISH_STATUS.PUBLISH_FAILED,
        error: 'Instagram Reels publishing requires a publicly reachable video URL (video_url).',
      };
    }

    const caption = this.buildCaption(job);

    try {
      // Step 1: Create IG Reels Media Container
      const containerRes = await axios.post(
        `https://graph.facebook.com/v19.0/${igUserId}/media`,
        null,
        {
          params: {
            media_type: 'REELS',
            video_url: videoUrl,
            caption,
            access_token: accessToken,
          },
          timeout: 30000,
        }
      );

      const creationId = containerRes.data?.id;
      if (!creationId) {
        throw new Error('Meta Graph API did not return a valid container creation_id');
      }

      // Step 2: Poll container status until FINISHED (up to 60s)
      let isReady = false;
      const startTime = Date.now();
      while (!isReady && Date.now() - startTime < 60000) {
        await new Promise((res) => setTimeout(res, 3000));
        const statusRes = await axios.get(
          `https://graph.facebook.com/v19.0/${creationId}`,
          {
            params: {
              fields: 'status_code,status',
              access_token: accessToken,
            },
            timeout: 15000,
          }
        );
        const statusCode = statusRes.data?.status_code;
        if (statusCode === 'FINISHED') {
          isReady = true;
        } else if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
          throw new Error(`Media container processing failed with status: ${statusCode}`);
        }
      }

      if (!isReady) {
        throw new Error('Media container processing timed out before finishing');
      }

      // Step 3: Publish Media Container
      const publishRes = await axios.post(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: creationId,
            access_token: accessToken,
          },
          timeout: 30000,
        }
      );

      const postId = publishRes.data?.id;
      return {
        success: true,
        platform: PLATFORMS.INSTAGRAM,
        status: PUBLISH_STATUS.PUBLISHED,
        externalPostId: postId || creationId,
        url: `https://www.instagram.com/reel/${postId || creationId}`,
        publishedAt: new Date().toISOString(),
      };
    } catch (err) {
      const apiMsg = err.response?.data?.error?.message || err.message;
      return {
        success: false,
        platform: PLATFORMS.INSTAGRAM,
        status: PUBLISH_STATUS.PUBLISH_FAILED,
        error: `Instagram publishing failed: ${apiMsg}`,
      };
    }
  }
}

module.exports = InstagramProvider;
