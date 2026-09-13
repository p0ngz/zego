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
    },
  },
});
