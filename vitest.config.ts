import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run tests from source. Without this, the compiled copies under dist/
    // are collected too and every test is reported twice.
    include: ['server/**/*.test.ts'],
  },
});
