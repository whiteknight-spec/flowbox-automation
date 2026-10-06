/**
 * Base Publishing Provider Interface
 *
 * Each platform provider must implement:
 * - isConfigured(credentials): boolean
 * - publishQuoteVideo(job, credentials): Promise<NormalizedPublishResult>
 */
class BasePublishingProvider {
  constructor(platform, name) {
    this.platform = platform;
    this.name = name || platform;
  }

  /**
   * Checks whether required platform credentials exist in the environment or passed config.
   * @param {Object} [credentials]
   * @returns {boolean}
   */
  isConfigured(credentials = {}) {
    return false;
  }

  /**
   * Publishes an approved quote video job to the target platform.
   *
   * @param {Object} job - Parsed quote video job
   * @param {Object} [credentials] - Platform credentials / overrides
   * @returns {Promise<{
   *   success: boolean,
   *   platform: string,
   *   status: string,
   *   externalPostId?: string,
   *   url?: string,
   *   publishedAt?: string,
   *   error?: string
   * }>}
   */
  async publishQuoteVideo(job, credentials = {}) {
    throw new Error(`publishQuoteVideo must be implemented by ${this.constructor.name}`);
  }
}

module.exports = BasePublishingProvider;
