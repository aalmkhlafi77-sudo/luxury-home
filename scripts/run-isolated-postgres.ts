/**
 * Isolated PostgreSQL Test Runner
 * Sets up environment and validates isolated test DB URL before importing services.
 */

async function main() {
  const initialNodeEnv = process.env.NODE_ENV;
  if (initialNodeEnv === 'production') {
    console.error('حظر أمني قاطع: تم منع تشغيل اختبارات PostgreSQL لأن قيمة NODE_ENV الأصلية هي production.');
    process.exit(1);
  }

  const testUrl = process.env.TEST_DATABASE_URL?.trim();

  if (!testUrl) {
    console.log('========================================================================================');
    console.log('⚠️ [POSTGRES_TEST_STATUS: NOT_EXECUTED]');
    console.log('PostgreSQL غير منفذ: لم يتم تشغيل اختبارات PostgreSQL نظراً لعدم توفر بيئة اختبار صالحة.');
    console.log('السبب: متغير البيئة TEST_DATABASE_URL غير محدد. يلزم تحديد رابط قاعدة بيانات PostgreSQL اختبارية منفصلة.');
    console.log('\nمتطلبات تشغيل دورة PostgreSQL الحقيقية:');
    console.log('  1. TEST_DATABASE_URL="postgresql://user:pass@host:5432/luxuryhome_test"');
    console.log('  2. اسم قاعدة البيانات ينتهي بـ "_test"');
    console.log('  3. ALLOW_TEST_DATABASE_RESET="yes"');
    console.log('========================================================================================');
    process.exitCode = 2;
    process.exit(2);
  }

  let parsed: URL;
  try {
    parsed = new URL(testUrl);
  } catch (err: any) {
    console.error(`صيغة TEST_DATABASE_URL غير صالحة: ${err?.message}`);
    process.exitCode = 2;
    process.exit(2);
  }

  const databaseName = decodeURIComponent(parsed.pathname.slice(1));

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !databaseName.endsWith('_test') ||
    process.env.ALLOW_TEST_DATABASE_RESET !== 'yes'
  ) {
    console.error(
      'غير منفذ: يلزم اتصال PostgreSQL بقاعدة اختبارية مخصصة ينتهي اسمها بـ _test، وتصريح اختبار صريح (ALLOW_TEST_DATABASE_RESET=yes).',
    );
    process.exitCode = 2;
    process.exit(2);
  }

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = testUrl;

  // Dynamically import test suite after environment variables and guards pass
  const { runPostgresTestSuite } = await import('./test-isolated-postgres.js');

  const success = await runPostgresTestSuite();
  if (!success) {
    process.exitCode = 2;
    process.exit(2);
  }
}

main().catch((err) => {
  // Never print raw connection string or secrets
  console.error('فشل اختبار PostgreSQL؛ راجع سجل الاختبار المنقّح:', err instanceof Error ? err.message : 'خطأ غير متوقع');
  process.exitCode = 1;
  process.exit(1);
});
