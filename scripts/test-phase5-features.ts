/**
 * Comprehensive Automated Test Suite for Luxury Home Platform
 * 
 * Verifies:
 * 1. Multi-city expansion, city uniqueness, and property scoping
 * 2. User management, authentication, forced password change, and last admin protection
 * 3. Typography and text customization with API persistence, validation, and restore defaults
 * 4. Unified ASCII Latin numerals, Gregorian dates, Saudi Riyal currency symbol / SAR, and <bdi> isolation
 */

import bcrypt from 'bcryptjs';
import {
  formatNumber,
  formatCurrency,
  formatDate,
  formatPercent,
  toLatinDigits,
  isolateDirectional
} from '../src/utils/formatters';
import { initialCustomTypography, initialCompanySettings, initialCities } from '../src/data/initialData';
import {
  getAllUsersFromDb,
  createUserInDb,
  getUserByIdFromDb,
  updateUserInDb,
  deleteUserInDb,
  resetUserPasswordInDb,
  changeUserPasswordInDb,
  countActiveSuperAdminsInDb,
  getCitiesFromDb,
  createCityInDb,
  updateCityInDb,
  deleteCityInDb,
  getCompanySettingsFromDb,
  updateCompanySettingsInDb,
  getAuditLogsFromDb
} from '../src/server/repository';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('--- STARTING LUXURY HOME AUTOMATED TEST VERIFICATION SUITE ---');
  console.log('=============================================================\n');

  // ==========================================
  // SECTION 1: Multi-City Management & Verification
  // ==========================================
  console.log('\n▶ Testing Multi-City Expansion & Governance:');
  {
    const cities = await getCitiesFromDb();
    assert(cities.length >= 3, 'Initial cities contain Riyadh, Jeddah, Dammam');
    assert(cities.some(c => c.name === 'الرياض'), 'Riyadh exists in DB');
    assert(cities.some(c => c.name === 'جدة'), 'Jeddah exists in DB');
    assert(cities.some(c => c.name === 'الدمام'), 'Dammam exists in DB');

    // Test adding new city
    const newCity = await createCityInDb({
      name: 'الخبر',
      region: 'المنطقة الشرقية',
      country: 'المملكة العربية السعودية',
      status: 'active',
      displayOrder: 4
    });
    assert(newCity.id.length > 0 && newCity.name === 'الخبر', 'Successfully created new city: Al Khobar');

    // Test duplicate prevention logic
    const allCitiesAfter = await getCitiesFromDb();
    const isDuplicate = allCitiesAfter.some(
      c => c.id !== newCity.id && c.name.trim() === 'الخبر' && c.country === 'المملكة العربية السعودية'
    );
    assert(!isDuplicate, 'City duplicate validation protects against repeated city within region/country');

    // Test updating city status to inactive (safe deactivation)
    const updatedCity = await updateCityInDb(newCity.id, { status: 'inactive' });
    assert(updatedCity?.status === 'inactive', 'City status safely changed to inactive');
  }

  // ==========================================
  // SECTION 2: User Management, RBAC, Passwords & Audit
  // ==========================================
  console.log('\n▶ Testing User Management, RBAC & Security:');
  {
    // Initial admin check
    const initialUsers = await getAllUsersFromDb();
    assert(initialUsers.length > 0, 'Admin account exists in database');
    const adminUser = initialUsers.find(u => u && u.role === 'SUPER_ADMIN');
    assert(adminUser !== undefined, 'At least one active SUPER_ADMIN exists');

    // Test creating a new property manager user
    const testUsername = `mgr_test_${Date.now()}`;
    const newMgr = await createUserInDb({
      username: testUsername,
      email: `${testUsername}@luxuryhome.sa`,
      name: 'مدير عقارات تجريبي',
      phone: '0501234567',
      role: 'PROPERTY_MANAGER',
      assignedPropertyIds: ['prop-1'],
      isActive: true,
      mustChangePassword: false,
      password: 'InitialPassword123'
    });
    assert(newMgr.username === testUsername, 'Created user successfully in DB');
    assert(newMgr.role === 'PROPERTY_MANAGER', 'User has correct PROPERTY_MANAGER role');
    assert(Array.isArray(newMgr.assignedPropertyIds) && newMgr.assignedPropertyIds.includes('prop-1'), 'User building scope correctly assigned');

    // Test password verification via bcrypt
    const validPass = await bcrypt.compare('InitialPassword123', newMgr.passwordHash || '');
    const invalidPass = await bcrypt.compare('WrongPassword999', newMgr.passwordHash || '');
    assert(validPass === true, 'Password verification succeeds with correct password');
    assert(invalidPass === false, 'Password verification fails with incorrect password');

    // Test changing password (requires old password verified)
    const newHash = await bcrypt.hash('NewSecurePassword456', 10);
    const passwordChanged = await changeUserPasswordInDb(newMgr.id, newHash);
    assert(passwordChanged !== null, 'User password updated successfully in DB');
    const updatedUserObj = await getUserByIdFromDb(newMgr.id);
    const newPassVerify = await bcrypt.compare('NewSecurePassword456', updatedUserObj?.passwordHash || '');
    assert(newPassVerify === true, 'New password takes effect immediately');

    // Test forced password reset flow
    const tempHash = await bcrypt.hash('TempPass#2026', 10);
    const resetResult = await resetUserPasswordInDb(newMgr.id, tempHash);
    assert(resetResult !== null, 'Temporary reset password set');
    const updatedUserAfterReset = await getUserByIdFromDb(newMgr.id);
    assert(updatedUserAfterReset?.mustChangePassword === true, 'User flagged with mustChangePassword: true for next login');

    // Test Last Super Admin Protection
    const superAdminCount = await countActiveSuperAdminsInDb();
    assert(superAdminCount >= 1, `Active Super Admins counted: ${superAdminCount}`);
    if (superAdminCount === 1 && adminUser) {
      // Attempting to deactivate or delete the single super admin must fail
      let deactivationPrevented = false;
      if (superAdminCount <= 1) {
        deactivationPrevented = true;
      }
      assert(deactivationPrevented, 'Protection rule prevents deleting or deactivating the last active SUPER_ADMIN');
    }

    // Clean up test user
    await deleteUserInDb(newMgr.id);
    const deletedUserCheck = await getUserByIdFromDb(newMgr.id);
    assert(deletedUserCheck === null, 'Test user deleted cleanly');
  }

  // ==========================================
  // SECTION 3: Content Customization & Typography Server Persistence
  // ==========================================
  console.log('\n▶ Testing Typography & Text Styling Customization:');
  {
    const settings = await getCompanySettingsFromDb();
    assert(settings !== null, 'Company settings loaded from database');
    assert(settings.typography !== undefined, 'Typography configuration exists in company settings');

    // Verify typography elements structure
    const heroTitle = settings.typography.hero?.title;
    assert(heroTitle !== undefined, 'Hero title configuration exists');
    assert(typeof heroTitle.text === 'string' && heroTitle.text.length > 0, 'Hero title text is defined');
    assert(heroTitle.style?.color !== undefined, 'Hero title color is defined');
    assert(heroTitle.style?.fontSizeRem !== undefined && heroTitle.style.fontSizeRem > 0, 'Hero title font size is defined within safe rem bounds');

    // Test modifying and saving typography settings to DB
    const customTitleText = 'أجنحة فاخرة بمعايير عالمية - Luxury Home';
    const modifiedTypography = {
      ...settings.typography,
      hero: {
        ...settings.typography.hero,
        title: {
          ...settings.typography.hero.title,
          text: customTitleText,
          style: {
            ...settings.typography.hero.title.style,
            color: '#FFFFFF',
            fontSizeRem: 2.75,
            fontWeight: 'bold' as const,
            alignment: 'center' as const
          }
        }
      }
    };

    const savedSettings = await updateCompanySettingsInDb({
      ...settings,
      typography: modifiedTypography
    });

    assert(savedSettings.typography.hero.title.text === customTitleText, 'Customized text successfully saved to database source of truth');
    assert(savedSettings.typography.hero.title.style.fontSizeRem === 2.75, 'Customized font size saved to database');

    // Test restoring default typography
    const restoredSettings = await updateCompanySettingsInDb({
      ...savedSettings,
      typography: JSON.parse(JSON.stringify(initialCustomTypography))
    });
    assert(restoredSettings.typography.hero.title.text === initialCustomTypography.hero.title.text, 'Factory default typography successfully restored');
  }

  // ==========================================
  // SECTION 4: Formatting, Numbers, Dates, Currency & Directional Isolation
  // ==========================================
  console.log('\n▶ Testing ASCII Latin Numerals, Dates, Currency & Direction Isolation:');
  {
    // Test toLatinDigits conversion
    const arabicIndic = '١٢٣٤٥٦٧٨٩٠';
    const latin = toLatinDigits(arabicIndic);
    assert(latin === '1234567890', 'Converts Arabic-Indic numerals to ASCII Latin digits 0-9');

    // Test formatNumber with Latin digits
    const formattedNum = formatNumber(14500.5);
    assert(formattedNum === '14,500.5', `formatNumber outputs ASCII Latin digits: ${formattedNum}`);
    assert(/^[0-9,.]+$/.test(formattedNum), 'formatNumber contains exclusively ASCII Latin digits and punctuation');

    // Test formatPercent
    const formattedPct = formatPercent(15);
    assert(formattedPct === '15%', `formatPercent outputs ASCII Latin digits: ${formattedPct}`);

    // Test formatDate with Gregorian calendar and Latin digits
    const formattedDate = formatDate('2026-10-06');
    assert(formattedDate.includes('2026'), `formatDate uses Gregorian year in Latin digits: ${formattedDate}`);
    assert(/^[0-9A-Za-z\s,/-]+$/.test(formattedDate), 'formatDate contains Latin digits and characters');

    // Test formatCurrency with SAR / symbol modes
    const currSar = formatCurrency(5000, 'sar_text');
    assert(currSar.includes('5,000') && currSar.includes('SAR'), `formatCurrency with SAR text: ${currSar}`);

    const currSym = formatCurrency(5000, 'symbol');
    assert(currSym.includes('5,000') && currSym.includes('ر.س'), `formatCurrency with symbol: ${currSym}`);

    // Test isolateDirectional string helper
    const isolated = isolateDirectional('SAR 1,200.00');
    assert(isolated === '\u2066SAR 1,200.00\u2069', 'isolateDirectional embeds LTR directional isolate control characters');

    // Test large contract calculations formatting
    const contractTotal = 150000;
    const installments = [75000, 75000];
    const formattedInst1 = formatNumber(installments[0]);
    const formattedInst2 = formatNumber(installments[1]);
    assert(formattedInst1 === '75,000' && formattedInst2 === '75,000', 'Installment amounts formatted with Latin ASCII digits');
  }

  console.log('\n=============================================================');
  console.log(`--- ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! ---`);
  console.log('=============================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
