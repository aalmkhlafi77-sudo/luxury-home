/**
 * Isolated PostgreSQL Test Runner
 * Sets up environment and validates isolated test DB URL before importing services.
 */

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!testUrl) {
    console.error('غير منفذ: TEST_DATABASE_URL غير متوفر.');
    process.exitCode = 2;
    return;
  }

  const parsed = new URL(testUrl);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !databaseName.endsWith('_test') ||
    process.env.ALLOW_TEST_DATABASE_RESET !== 'yes'
  ) {
    throw new Error(
      'يلزم اتصال PostgreSQL بقاعدة مخصصة ينتهي اسمها بـ _test، وتصريح اختبار صريح (ALLOW_TEST_DATABASE_RESET=yes).',
    );
  }

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = testUrl;

  // Dynamically import test suite after environment variables are set
  const { runPostgresTestSuite } = await import('./test-isolated-postgres.js');

  await runPostgresTestSuite();
}

main().catch((err) => {
  // Never print raw connection string or secrets
  console.error('فشل اختبار PostgreSQL؛ راجع سجل الاختبار المنقّح:', err instanceof Error ? err.message : 'خطأ غير متوقع');
  process.exitCode = 1;
});
