const types = require('./types');
const publishingManager = require('./publishingManager');
const InstagramProvider = require('./providers/instagramProvider');
const YouTubeProvider = require('./providers/youtubeProvider');

module.exports = {
  ...types,
  ...publishingManager,
  InstagramProvider,
  YouTubeProvider,
};
