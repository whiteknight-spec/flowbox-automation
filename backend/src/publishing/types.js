/**
 * Flowbox Publishing Domain Constants
 */
const PUBLISH_STATUS = {
  NOT_SCHEDULED: 'not_scheduled',
  SCHEDULED: 'scheduled',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  PUBLISH_FAILED: 'publish_failed',
  SIMULATED: 'simulated',
};

const PLATFORMS = {
  INSTAGRAM: 'instagram',
  YOUTUBE: 'youtube',
};

function normalizePlatform(platform) {
  if (!platform) return null;
  const p = String(platform).trim().toLowerCase();
  if (p === 'instagram' || p === 'instagram_reels' || p === 'ig' || p === 'reels') {
    return PLATFORMS.INSTAGRAM;
  }
  if (p === 'youtube' || p === 'youtube_shorts' || p === 'yt' || p === 'shorts') {
    return PLATFORMS.YOUTUBE;
  }
  return p;
}

module.exports = {
  PUBLISH_STATUS,
  PLATFORMS,
  normalizePlatform,
};
