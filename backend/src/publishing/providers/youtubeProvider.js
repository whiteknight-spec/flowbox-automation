const fs = require('fs');
const axios = require('axios');
const BasePublishingProvider = require('./baseProvider');
const { PLATFORMS, PUBLISH_STATUS } = require('../types');

/**
 * Official YouTube Shorts Publishing Provider
 *
 * Implements official YouTube Data API v3 Video Upload workflow:
 * 1. Resolves OAuth2 tokens (refresh token flow if needed)
 * 2. POST /upload/youtube/v3/videos (resumable or multipart) with title, snippet, and #Shorts tags
 * 3. Streams local rendered MP4 file directly to YouTube API
 * 4. Returns canonical YouTube Shorts URL and video ID
 *
 * Strict Security: Never logs or stores raw client secrets or refresh tokens.
 */
class YouTubeProvider extends BasePublishingProvider {
  constructor() {
    super(PLATFORMS.YOUTUBE, 'YouTube Shorts');
  }

  /**
   * Resolves credentials from passed config or environment variables.
   */
  resolveCredentials(credentials = {}) {
    const accessToken = credentials.accessToken || credentials.youtubeAccessToken || process.env.YOUTUBE_ACCESS_TOKEN;
    const clientId = credentials.clientId || credentials.youtubeClientId || process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = credentials.clientSecret || credentials.youtubeClientSecret || process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = credentials.refreshToken || credentials.youtubeRefreshToken || process.env.YOUTUBE_REFRESH_TOKEN;
    return { accessToken, clientId, clientSecret, refreshToken };
  }

  isConfigured(credentials = {}) {
    const { accessToken, clientId, refreshToken } = this.resolveCredentials(credentials);
    return Boolean(accessToken || (clientId && refreshToken));
  }

  /**
   * Exchanges refresh token for an active access token if needed.
   */
  async getEffectiveAccessToken(creds) {
    if (creds.accessToken) return creds.accessToken;
    if (creds.clientId && creds.clientSecret && creds.refreshToken) {
      try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          refresh_token: creds.refreshToken,
          grant_type: 'refresh_token',
        });
        return tokenRes.data?.access_token;
      } catch (err) {
        throw new Error(`YouTube OAuth token refresh failed: ${err.response?.data?.error_description || err.message}`);
      }
    }
    return null;
  }

  /**
   * Builds the YouTube Shorts title and description.
   */
  buildMetadata(job) {
    const topicTitle = job.topic ? job.topic.charAt(0).toUpperCase() + job.topic.slice(1) : 'Daily Inspiration';
    const langLabel = job.language === 'ta' ? 'Tamil' : 'English';
    const title = `${topicTitle} Quote (${langLabel}) #Shorts`.slice(0, 100);

    const descParts = [];
    if (job.quote) descParts.push(`"${job.quote}"`);
    if (job.explanation) descParts.push(`\n${job.explanation}`);
    descParts.push('\n\n#Shorts #Quotes #DailyInspiration #Flowbox');

    return {
      title,
      description: descParts.join('\n').trim(),
      tags: ['Shorts', 'Quotes', 'DailyInspiration', topicTitle, langLabel],
    };
  }

  async publishQuoteVideo(job, credentials = {}) {
    const creds = this.resolveCredentials(credentials);

    // Check development dry-run / simulation mode
    const isSimulated = process.env.PUBLISHING_SIMULATED === 'true' || credentials.simulated === true;
    if (isSimulated) {
      const simId = `sim_yt_${Date.now()}`;
      return {
        success: true,
        platform: PLATFORMS.YOUTUBE,
        status: PUBLISH_STATUS.SIMULATED,
        externalPostId: simId,
        url: `https://youtube.com/shorts/${simId}`,
        publishedAt: new Date().toISOString(),
        note: 'Simulated dry-run publish (development mode).',
      };
    }

    if (!this.isConfigured(credentials)) {
      return {
        success: false,
        platform: PLATFORMS.YOUTUBE,
        status: PUBLISH_STATUS.PUBLISH_FAILED,
        error: 'Publishing is not configured. Missing YouTube credentials (YOUTUBE_CLIENT_ID / YOUTUBE_REFRESH_TOKEN).',
      };
    }

    // Verify local MP4 file exists for upload
    if (!job.outputPath || !fs.existsSync(job.outputPath)) {
      return {
        success: false,
        platform: PLATFORMS.YOUTUBE,
        status: PUBLISH_STATUS.PUBLISH_FAILED,
        error: 'YouTube Shorts publishing requires a rendered MP4 file on disk.',
      };
    }

    try {
      const token = await this.getEffectiveAccessToken(creds);
      if (!token) {
        throw new Error('Unable to obtain active YouTube OAuth access token');
      }

      const { title, description, tags } = this.buildMetadata(job);
      const metadata = {
        snippet: {
          title,
          description,
          tags,
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus: credentials.privacyStatus || 'public',
          selfDeclaredMadeForKids: false,
        },
      };

      const fileStats = fs.statSync(job.outputPath);

      // Initiate Resumable Upload Session
      const initRes = await axios.post(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        metadata,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Length': fileStats.size,
            'X-Upload-Content-Type': 'video/mp4',
          },
          timeout: 20000,
        }
      );

      const uploadUrl = initRes.headers.location;
      if (!uploadUrl) {
        throw new Error('YouTube API did not return resumable upload location header');
      }

      // Stream MP4 file to upload location
      const fileStream = fs.createReadStream(job.outputPath);
      const uploadRes = await axios.put(uploadUrl, fileStream, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': fileStats.size,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000,
      });

      const videoId = uploadRes.data?.id;
      if (!videoId) {
        throw new Error('YouTube API upload succeeded but video ID was not returned');
      }

      return {
        success: true,
        platform: PLATFORMS.YOUTUBE,
        status: PUBLISH_STATUS.PUBLISHED,
        externalPostId: videoId,
        url: `https://youtube.com/shorts/${videoId}`,
        publishedAt: new Date().toISOString(),
      };
    } catch (err) {
      const apiMsg = err.response?.data?.error?.message || err.message;
      return {
        success: false,
        platform: PLATFORMS.YOUTUBE,
        status: PUBLISH_STATUS.PUBLISH_FAILED,
        error: `YouTube publishing failed: ${apiMsg}`,
      };
    }
  }
}

module.exports = YouTubeProvider;
