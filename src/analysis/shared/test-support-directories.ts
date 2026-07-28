/**
 * Directory names conventionally holding test *data* rather than test
 * *code* (e.g. fixture inputs spawned or read by a test suite, or mocked
 * modules) — distinct from a language's own `isTestFile` convention, since
 * these files rarely look like tests themselves. Shared by each language's
 * source discovery (excluded at any depth, alongside dependency/build-output
 * directories) and `./derive-views` (defense-in-depth area labeling), so the
 * two can't drift apart.
 *
 * Validated against a real repository (`sindresorhus/globby`) in
 * implementation session 6, where `fixtures/` files (not under `test/` or
 * `tests/`) still crowded out real implementation areas in Start Here.
 */
export const TEST_SUPPORT_DIRECTORY_NAMES = new Set([
  "fixtures",
  "__fixtures__",
  "__mocks__",
]);
