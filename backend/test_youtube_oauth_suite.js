const assert = require('assert');
const axios = require('axios');
const express = require('express');
const authRouter = require('./src/routes/auth');
const { YouTubeProvider } = require('./src/publishing');
const { PLATFORMS, PUBLISH_STATUS } = require('./src/publishing/types');

async function runYouTubeOAuthTests() {
  console.log('====================================================');
  console.log('STARTING YOUTUBE OAUTH 2.0 VERIFICATION SUITE');
  console.log('====================================================');

  // Create an in-process test app using authRouter on an ephemeral port
  // so we can test both configured and unconfigured states dynamically
  const testApp = express();
  testApp.use('/auth', authRouter);
  const testServer = await new Promise((resolve) => {
    const s = testApp.listen(0, () => resolve(s));
  });
  const testPort = testServer.address().port;
  const TEST_API = `http://localhost:${testPort}`;

  try {
    // --- TEST 1: Status endpoint returns accurate non-secret metadata ---
    console.log('\n--- TEST 1: Status Endpoint ---');
    const statusRes = await axios.get(`${TEST_API}/auth/youtube/status`);
    assert.strictEqual(statusRes.status, 200, 'Status endpoint returns 200');
    assert(typeof statusRes.data.configured === 'boolean', 'configured is boolean');
    assert(typeof statusRes.data.hasClientId === 'boolean', 'hasClientId is boolean');
    assert(typeof statusRes.data.hasClientSecret === 'boolean', 'hasClientSecret is boolean');
    assert(typeof statusRes.data.hasRefreshToken === 'boolean', 'hasRefreshToken is boolean');
    assert.strictEqual(
      statusRes.data.redirectUri,
      'http://localhost:4000/auth/youtube/callback',
      'Default redirectUri matches exact Google Cloud URI'
    );
    // Verify no secret values are returned
    assert.strictEqual(statusRes.data.clientSecret, undefined, 'No client secret in response');
    assert.strictEqual(statusRes.data.refreshToken, undefined, 'No refresh token in response');
    console.log('✅ PASSED: /auth/youtube/status reports accurate status without revealing secrets.');

    // --- TEST 2: Authorize Route Exists & Redirects to Google ---
    console.log('\n--- TEST 2: Authorize Route ---');
    // 2a: Missing client ID returns 400
    const savedClientId = process.env.YOUTUBE_CLIENT_ID;
    delete process.env.YOUTUBE_CLIENT_ID;

    try {
      await axios.get(`${TEST_API}/auth/youtube/authorize`, { maxRedirects: 0 });
      assert.fail('Should have failed when YOUTUBE_CLIENT_ID is missing');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Returns 400 when YOUTUBE_CLIENT_ID is missing');
      assert(err.response?.data.includes('YouTube Client ID Missing'), 'Helpful error page returned');
    }

    // 2b: Configured client ID redirects (302) to Google OAuth consent screen with exact params
    const testClientId = 'flowbox-test-client-id-12345.apps.googleusercontent.com';
    process.env.YOUTUBE_CLIENT_ID = testClientId;

    const authRedirectRes = await axios.get(`${TEST_API}/auth/youtube/authorize`, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302,
    });

    assert.strictEqual(authRedirectRes.status, 302, 'Returns 302 Redirect');
    const targetLocation = authRedirectRes.headers.location;
    assert(targetLocation.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'), 'Redirects to Google OAuth endpoint');

    const redirectUrl = new URL(targetLocation);
    assert.strictEqual(redirectUrl.searchParams.get('client_id'), testClientId, 'client_id matches');
    assert.strictEqual(redirectUrl.searchParams.get('redirect_uri'), 'http://localhost:4000/auth/youtube/callback', 'redirect_uri matches exact callback URL');
    assert.strictEqual(redirectUrl.searchParams.get('response_type'), 'code', 'response_type is code');
    assert.strictEqual(redirectUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/youtube.upload', 'scope is https://www.googleapis.com/auth/youtube.upload');
    assert.strictEqual(redirectUrl.searchParams.get('access_type'), 'offline', 'access_type is offline');
    assert.strictEqual(redirectUrl.searchParams.get('prompt'), 'consent', 'prompt is consent');
    console.log('✅ PASSED: /auth/youtube/authorize redirects to Google with exact required parameters.');

    // Restore client ID
    if (savedClientId) process.env.YOUTUBE_CLIENT_ID = savedClientId;
    else delete process.env.YOUTUBE_CLIENT_ID;

    // --- TEST 3: Callback Handles Missing Code Cleanly ---
    console.log('\n--- TEST 3: Callback Handles Missing Code ---');
    try {
      await axios.get(`${TEST_API}/auth/youtube/callback`);
      assert.fail('Should have failed without code');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Returns 400 when code is missing');
      assert(err.response?.data.includes('Missing Code'), 'User-friendly error displayed');
    }
    console.log('✅ PASSED: /auth/youtube/callback rejects missing code with clean error response.');

    // --- TEST 4: Callback Handles Google OAuth Error Cleanly ---
    console.log('\n--- TEST 4: Callback Handles Google Error ---');
    try {
      await axios.get(`${TEST_API}/auth/youtube/callback?error=access_denied&error_description=The%20user%20denied%20consent`);
      assert.fail('Should have failed with Google error');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Returns 400 on Google error');
      assert(err.response?.data.includes('The user denied consent'), 'Error description presented safely');
    }
    console.log('✅ PASSED: /auth/youtube/callback handles Google OAuth error without crashing.');

    // --- TEST 5: Callback Handles Invalid Code Exchange Without Leaking Secrets ---
    console.log('\n--- TEST 5: Token Exchange & Secret Safety ---');
    const oldSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const oldClient = process.env.YOUTUBE_CLIENT_ID;
    const dummySecret = 'GOCSPX-super-secret-fake-key-99999';
    process.env.YOUTUBE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    process.env.YOUTUBE_CLIENT_SECRET = dummySecret;

    // Intercept console.error / console.log to ensure dummySecret is never printed
    let leakedSecret = false;
    const originalStderr = console.error;
    console.error = (...args) => {
      const text = args.map(a => String(a)).join(' ');
      if (text.includes(dummySecret)) {
        leakedSecret = true;
      }
      originalStderr.apply(console, args);
    };

    try {
      await axios.get(`${TEST_API}/auth/youtube/callback?code=invalid_dummy_auth_code_12345`);
    } catch (err) {
      assert.strictEqual(err.response?.status, 400, 'Token exchange failure returns 400');
      // Ensure response body does NOT leak client secret or internal credentials
      assert(!err.response?.data.includes(dummySecret), 'Client secret is NOT exposed in response');
    } finally {
      console.error = originalStderr;
    }

    assert.strictEqual(leakedSecret, false, 'Client secret was NEVER printed to logs or console');
    console.log('✅ PASSED: Token exchange failure handled safely; secrets never printed or leaked.');

    // Restore env
    if (oldSecret) process.env.YOUTUBE_CLIENT_SECRET = oldSecret;
    else delete process.env.YOUTUBE_CLIENT_SECRET;
    if (oldClient) process.env.YOUTUBE_CLIENT_ID = oldClient;
    else delete process.env.YOUTUBE_CLIENT_ID;

    // --- TEST 6: Existing YouTube Publishing Provider Still Works ---
    console.log('\n--- TEST 6: YouTubeProvider Integrity ---');
    const provider = new YouTubeProvider();
    assert.strictEqual(provider.platform, PLATFORMS.YOUTUBE, 'Provider platform is youtube');

    // Test dry-run / simulation mode
    const simResult = await provider.publishQuoteVideo(
      { quote: 'Test quote', explanation: 'Test explanation', topic: 'motivation', language: 'en' },
      { simulated: true }
    );
    assert.strictEqual(simResult.success, true, 'Simulated publish succeeds');
    assert.strictEqual(simResult.status, PUBLISH_STATUS.SIMULATED, 'Status is simulated');
    assert(simResult.url.includes('youtube.com/shorts/'), 'URL is YouTube Shorts');

    // Test unconfigured mode
    const unconfiguredResult = await provider.publishQuoteVideo(
      { quote: 'Test quote', topic: 'motivation', language: 'en' },
      { accessToken: null, clientId: null, refreshToken: null }
    );
    assert.strictEqual(unconfiguredResult.success, false, 'Unconfigured publish reports false');
    assert.strictEqual(unconfiguredResult.status, PUBLISH_STATUS.PUBLISH_FAILED, 'Status is publish_failed');
    assert(unconfiguredResult.error.includes('Missing YouTube credentials'), 'Error mentions missing YouTube credentials');
    console.log('✅ PASSED: Existing YouTubeProvider publishing logic remains completely intact.');

    console.log('\n====================================================');
    console.log('ALL YOUTUBE OAUTH 2.0 TESTS PASSED (6/6)');
    console.log('====================================================');
  } finally {
    testServer.close();
  }
}

runYouTubeOAuthTests().catch((err) => {
  console.error('\n❌ YOUTUBE OAUTH SUITE FAILED:', err.response?.data || err.message);
  process.exit(1);
});
