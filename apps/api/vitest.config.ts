import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Tests share one seeded database; running files in parallel would
    // have them deleting each other's rows.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      // A throwaway key, so the encryption path is the one under test
      // rather than the plaintext fallback.
      APP_ENCRYPTION_KEY: 'ZGV2LW9ubHktdGVzdC1rZXktMzJieXRlcy1sb25nISE=',
      // The endpoints that read applications back are off unless a token
      // is configured; the tests configure one so they can check both.
      ADMIN_TOKEN: 'test-admin-token-long-enough-to-pass',
      // Above what the suite itself submits, so the limiter runs on every
      // request without turning the suite away. One test fills the window
      // deliberately to check that it does turn people away.
      SUBMIT_RATE_LIMIT: '50',
    },
  },
});
