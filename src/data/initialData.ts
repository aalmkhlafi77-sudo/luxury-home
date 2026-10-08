import {
  CompanySettings,
  Property,
  Floor,
  Unit,
  Amenity,
  UnitAllocation,
  Booking,
  Lease,
  HousekeepingTask,
  MaintenanceTask,
  SecurityDepositRecord,
  PaymentRecord,
  ContentSection,
  AuditLog,
  OperationalExpense,
  TenantAdjustment,
  ParkingSpot,
  ExpenseCategoryConfig,
  RecurringExpenseSchedule,
  NavigationSettings,
  City,
  CustomizableTypographyConfig
} from '../types';

export const initialCustomTypography: CustomizableTypographyConfig = {
  hero: {
    badge: {
      id: 'hero_badge',
      label: 'شارة الهيدر الترحيبية',
      text: 'بوابة السكن المترف والضيافة الراقية بالمملكة',
      style: { color: '#FFFCF6', fontSizeRem: 0.875, fontWeight: 'medium', alignment: 'center' },
      defaultText: 'بوابة السكن المترف والضيافة الراقية بالمملكة',
      defaultStyle: { color: '#FFFCF6', fontSizeRem: 0.875, fontWeight: 'medium', alignment: 'center' }
    },
    title: {
      id: 'hero_title',
      label: 'العنوان الرئيسي الترحيبي',
      text: 'اكتشف أرقى مستويات المعيشة الفندقية الفاخرة في قلب مدن المملكة',
      style: { color: '#FFFFFF', fontSizeRem: 3.5, fontWeight: 'bold', alignment: 'center' },
      defaultText: 'اكتشف أرقى مستويات المعيشة الفندقية الفاخرة في قلب مدن المملكة',
      defaultStyle: { color: '#FFFFFF', fontSizeRem: 3.5, fontWeight: 'bold', alignment: 'center' }
    },
    subtitle: {
      id: 'hero_subtitle',
      label: 'الوصف والفقرة الترحيبية',
      text: 'شقق وأجنحة سكنية مفروشة بالكامل تدمج بسلاسة تامة بين دفء وخصوصية المنزل وخدمات الضيافة الفندقية المتكاملة الراقية، في أكثر الأحياء جاذبية في العاصمة وكبرى المدن.',
      style: { color: '#EFE9DF', fontSizeRem: 1.125, fontWeight: 'normal', alignment: 'center' },
      defaultText: 'شقق وأجنحة سكنية مفروشة بالكامل تدمج بسلاسة تامة بين دفء وخصوصية المنزل وخدمات الضيافة الفندقية المتكاملة الراقية، في أكثر الأحياء جاذبية في العاصمة وكبرى المدن.',
      defaultStyle: { color: '#EFE9DF', fontSizeRem: 1.125, fontWeight: 'normal', alignment: 'center' }
    },
    cta_primary: {
      id: 'hero_cta_primary',
      label: 'زر الإجراء الرئيسي (استعراض الشقق)',
      text: 'استعرض الشقق المتاحة',
      style: { color: '#282824', fontSizeRem: 1, fontWeight: 'semibold', alignment: 'center' },
      defaultText: 'استعرض الشقق المتاحة',
      defaultStyle: { color: '#282824', fontSizeRem: 1, fontWeight: 'semibold', alignment: 'center' }
    },
    cta_secondary: {
      id: 'hero_cta_secondary',
      label: 'زر الإجراء الثانوي (المشروعات)',
      text: 'مشروعاتنا وأبراجنا الفندقية',
      style: { color: '#FFFFFF', fontSizeRem: 1, fontWeight: 'medium', alignment: 'center' },
      defaultText: 'مشروعاتنا وأبراجنا الفندقية',
      defaultStyle: { color: '#FFFFFF', fontSizeRem: 1, fontWeight: 'medium', alignment: 'center' }
    },
    stat_1: {
      id: 'hero_stat_1',
      label: 'الإحصائية الأولى (المدن والوجهات)',
      text: '3 مدن ووجهات فاخرة بالمملكة',
      style: { color: '#FFFFFF', fontSizeRem: 0.875, fontWeight: 'medium', alignment: 'center' },
      defaultText: '3 مدن ووجهات فاخرة بالمملكة',
      defaultStyle: { color: '#FFFFFF', fontSizeRem: 0.875, fontWeight: 'medium', alignment: 'center' }
    },
    stat_2: {
      id: 'hero_stat_2',
      label: 'الإحصائية الثانية (الرضا والإشغال)',
      text: '100% نسبة رضا وضيافة استثنائية',
      style: { color: '#FFFFFF', fontSizeRem: 0.875, fontWeight: 'medium', alignment: 'center' },
      defaultText: '100% نسبة رضا وضيافة استثنائية',
      defaultStyle: { color: '#FFFFFF', fontSizeRem: 0.875, fontWeight: 'medium', alignment: 'center' }
    },
    stat_3: {
      id: 'hero_stat_3',
      label: 'الإحصائية الثالثة (الكونسيرج)',
      text: '24/7 كونسيرج وخدمة غرف خاصة',
      style: { color: '#FFFFFF', fontSizeRem: 0.875, fontWeight: 'medium', alignment: 'center' },
      defaultText: '24/7 كونسيرج وخدمة غرف خاصة',
      defaultStyle: { color: '#FFFFFF', fontSizeRem: 0.875, fontWeight: 'medium', alignment: 'center' }
    }
  },
  search_bar: {
    heading: {
      id: 'search_heading',
      label: 'عنوان محرك الحجز والبحث',
      text: 'ابحث عن إقامتك الفاخرة وحجزك القادم',
      style: { color: '#282824', fontSizeRem: 1, fontWeight: 'bold', alignment: 'right' },
      defaultText: 'ابحث عن إقامتك الفاخرة وحجزك القادم',
      defaultStyle: { color: '#282824', fontSizeRem: 1, fontWeight: 'bold', alignment: 'right' }
    },
    search_btn: {
      id: 'search_btn',
      label: 'نص زر البحث المباشر',
      text: 'بحث وتأكيد الإتاحة',
      style: { color: '#FFFFFF', fontSizeRem: 0.875, fontWeight: 'bold', alignment: 'center' },
      defaultText: 'بحث وتأكيد الإتاحة',
      defaultStyle: { color: '#FFFFFF', fontSizeRem: 0.875, fontWeight: 'bold', alignment: 'center' }
    }
  },
  buildings: {
    title: {
      id: 'buildings_title',
      label: 'عنوان قسم المجمعات والأبراج',
      text: 'مجمعاتنا وعقاراتنا السكنية المتميزة',
      style: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' },
      defaultText: 'مجمعاتنا وعقاراتنا السكنية المتميزة',
      defaultStyle: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' }
    },
    subtitle: {
      id: 'buildings_subtitle',
      label: 'وصف قسم المجمعات',
      text: 'مبانٍ فندقية مصممة بأعلى معايير المعمار الحديث ومجهزة بكافة وسائل الراحة والمرافق الحصرية.',
      style: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' },
      defaultText: 'مبانٍ فندقية مصممة بأعلى معايير المعمار الحديث ومجهزة بكافة وسائل الراحة والمرافق الحصرية.',
      defaultStyle: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' }
    }
  },
  units: {
    title: {
      id: 'units_title',
      label: 'عنوان قسم الوحدات الفاخرة',
      text: 'أحدث الشقق والأجنحة المتاحة للإقامة',
      style: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' },
      defaultText: 'أحدث الشقق والأجنحة المتاحة للإقامة',
      defaultStyle: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' }
    },
    subtitle: {
      id: 'units_subtitle',
      label: 'وصف قسم الوحدات الفاخرة',
      text: 'خيارات متعددة تناسب الإقامة اليومية الفندقية والإيجار الشهري والسنوي بعقود إلكترونية موثقة.',
      style: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' },
      defaultText: 'خيارات متعددة تناسب الإقامة اليومية الفندقية والإيجار الشهري والسنوي بعقود إلكترونية موثقة.',
      defaultStyle: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' }
    }
  },
  amenities: {
    title: {
      id: 'amenities_title',
      label: 'عنوان قسم الخدمات الفندقية',
      text: 'خدمات فندقية استثنائية متكاملة',
      style: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' },
      defaultText: 'خدمات فندقية استثنائية متكاملة',
      defaultStyle: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' }
    },
    subtitle: {
      id: 'amenities_subtitle',
      label: 'وصف قسم الخدمات الفندقية',
      text: 'نعتني بأدق التفاصيل لتنعم بتجربة ضيافة مترفة ترقى لتطلعاتك وتلبي كافة احتياجاتك اليومية.',
      style: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' },
      defaultText: 'نعتني بأدق التفاصيل لتنعم بتجربة ضيافة مترفة ترقى لتطلعاتك وتلبي كافة احتياجاتك اليومية.',
      defaultStyle: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' }
    }
  },
  faq: {
    title: {
      id: 'faq_title',
      label: 'عنوان الأسئلة الشائعة',
      text: 'الأسئلة الأكثر شيوعاً حول الإقامة والحجز',
      style: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' },
      defaultText: 'الأسئلة الأكثر شيوعاً حول الإقامة والحجز',
      defaultStyle: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' }
    },
    subtitle: {
      id: 'faq_subtitle',
      label: 'وصف الأسئلة الشائعة',
      text: 'كل ما تحتاج لمعرفته حول سياسات الحجز والإلغاء وتأمين الدخول الذكي وتوثيق العقود.',
      style: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' },
      defaultText: 'كل ما تحتاج لمعرفته حول سياسات الحجز والإلغاء وتأمين الدخول الذكي وتوثيق العقود.',
      defaultStyle: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' }
    }
  },
  contact: {
    title: {
      id: 'contact_title',
      label: 'عنوان قسم التواصل وخدمة العملاء',
      text: 'تواصل مع فريق الكونسيرج وخدمة الضيوف',
      style: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' },
      defaultText: 'تواصل مع فريق الكونسيرج وخدمة الضيوف',
      defaultStyle: { color: '#282824', fontSizeRem: 2, fontWeight: 'bold', alignment: 'right' }
    },
    subtitle: {
      id: 'contact_subtitle',
      label: 'وصف قسم التواصل',
      text: 'فريقنا متاح على مدار الساعة للإجابة على كافة استفساراتك وتقديم المساعدة في حجز وحدتك الفاخرة.',
      style: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' },
      defaultText: 'فريقنا متاح على مدار الساعة للإجابة على كافة استفساراتك وتقديم المساعدة في حجز وحدتك الفاخرة.',
      defaultStyle: { color: '#68675F', fontSizeRem: 1, fontWeight: 'normal', alignment: 'right' }
    },
    whatsapp_cta: {
      id: 'contact_whatsapp_cta',
      label: 'نص زر التواصل عبر الواتساب',
      text: 'محادثة مباشرة عبر الواتساب',
      style: { color: '#FFFFFF', fontSizeRem: 1, fontWeight: 'bold', alignment: 'center' },
      defaultText: 'محادثة مباشرة عبر الواتساب',
      defaultStyle: { color: '#FFFFFF', fontSizeRem: 1, fontWeight: 'bold', alignment: 'center' }
    }
  }
};

export const initialNavigationSettings: NavigationSettings = {
  enableBottomNav: true,
  headerHeightPx: 80,
  logoMaxHeightPx: 44,
  stickyHeader: true,
  navActiveColor: '#B69A68',
  navLinks: [
    { id: 'nav_home', label: 'الرئيسية', targetSectionId: 'hero', visible: true, order: 1, icon: 'Home' },
    { id: 'nav_buildings', label: 'المجمعات', targetSectionId: 'buildings', visible: true, order: 2, icon: 'Building2' },
    { id: 'nav_units', label: 'الوحدات الفاخرة', targetSectionId: 'units', visible: true, order: 3, icon: 'Sparkles' },
    { id: 'nav_amenities', label: 'الخدمات الفندقية', targetSectionId: 'amenities', visible: true, order: 4, icon: 'ConciergeBell' },
    { id: 'nav_faq', label: 'الأسئلة الشائعة', targetSectionId: 'faq', visible: true, order: 5, icon: 'HelpCircle' },
    { id: 'nav_contact', label: 'اتصل بنا', targetSectionId: 'contact', visible: true, order: 6, icon: 'Phone' },
  ],
  bottomNavItems: [
    { id: 'bnav_home', label: 'الرئيسية', type: 'section', targetSectionId: 'hero', icon: 'Home', visible: true, order: 1 },
    { id: 'bnav_units', label: 'الوحدات', type: 'section', targetSectionId: 'units', icon: 'Sparkles', visible: true, order: 2 },
    { id: 'bnav_bookings', label: 'حجوزاتي', type: 'my_bookings', icon: 'CalendarDays', visible: true, order: 3 },
    { id: 'bnav_account', label: 'حسابي', type: 'account', icon: 'User', visible: true, order: 4 },
    { id: 'bnav_more', label: 'المزيد', type: 'more', icon: 'Menu', visible: true, order: 5 },
  ]
};

export const initialCompanySettings: CompanySettings = {
  companyName: 'Luxury home منزل الفخامة',
  companyNameEn: 'Luxury Home',
  tagline: 'تجربة سكنية فاخرة تدمج بين خصوصية المنزل وخدمات الضيافة الراقية في Luxury home منزل الفخامة',
  logoUrl: '',
  iconUrl: '',
  phone: '+966 11 482 9900',
  whatsapp: '+966 50 123 4567',
  email: 'info@luxuryhome.com',
  taxNumber: '310984726100003',
  commercialReg: '1010784920',
  address: 'الرياض، المملكة العربية السعودية',
  currency: 'SAR',
  currencySymbol: 'ر.س',
  currencyDisplayMode: 'symbol',
  timezone: 'Asia/Riyadh',
  typography: initialCustomTypography,
  navigation: initialNavigationSettings,
  theme: {
    primaryColor: '#B69A68',
    ivoryBg: '#F7F3EB',
    ivorySurface: '#FFFCF6',
    textColor: '#282824',
    textMuted: '#68675F',
    borderColor: '#E3DCCD',
    glassBlurIntensity: 14,
    borderRadius: 'xl',
    enableAnimations: true,
  },
  defaultPrepBufferHours: 3,
  holdTimeoutMinutes: 15,
  minDailyNights: 1,
  maxDailyNights: 60,
  installmentDueReminderDaysBefore: 7,
  faqs: [
    {
      id: 'faq_1',
      question: 'ما هي مواعيد تسجيل الدخول والمغادرة في مباني منزل الفخامة؟',
      answer: 'موعد تسجيل الدخول المعياري في مجمعاتنا هو الساعة 15:00 عصراً، وتوقيت المغادرة وتسليم الشقة هو الساعة 12:00 ظهراً، وذلك لضمان منح طواقم التنظيف 3 ساعات كاملة لتطهير وتجهيز الشقة فندقيًا للنزيل التالي.',
      active: true,
      displayOrder: 1
    },
    {
      id: 'faq_2',
      question: 'كيف يمكنني الدخول إلى الشقة؟ وهل أحتاج لمقابلة المالك؟',
      answer: 'جميع شقق منزل الفخامة مجهزة بنظام قفل رقمي ذكي ومتصل بالشبكة الأمنية. لن تحتاج لمقابلة أي شخص؛ حيث سيصلك كود سري فريد وخاص بك فور إتمام التحقق من هويتك وسداد الحجز، ليمكنك فتح الباب الذكي بمجرد لمسه وإدخال الرمز متبوعاً بعلامة (#).',
      active: true,
      displayOrder: 2
    },
    {
      id: 'faq_3',
      question: 'كيف يتم التعامل مع مبلغ تأمين الإقامة وتأمين الأثاث؟',
      answer: 'مبلغ تأمين السكن هو وديعة يتم تعليقها كحجز تفويض مؤقت على بطاقة الفيزا الخاصة بك للرحلات الفندقية، أو تحصيلها نقدًا/تحويل في العقود الشهرية. يتم إرجاع وتصفية مبلغ التأمين بالكامل فور خروجك وفحص الشقة ومطابقتها بمحضر استلام الأثاث في غضون 24 ساعة.',
      active: true,
      displayOrder: 3
    },
    {
      id: 'faq_4',
      question: 'هل تتوفر خدمات التدبير المنزلي وتنظيف الشقق؟',
      answer: 'نعم بالكامل، خدمات منزل الفخامة تشمل تنظيف الشقق الدوري الأسبوعي الفندقي الشامل للإقامات الطويلة والتعاقدية، وتغيير بياضات الأسرّة والمناشف بأخرى معقمة، مع إمكانية طلب خدمات نظافة إضافية يومية برسوم رمزية عبر بهو الاستقبال.',
      active: true,
      displayOrder: 4
    },
    {
      id: 'faq_5',
      question: 'هل تتوفر مواقف خاصة وشواحن للسيارات الكهربائية؟',
      answer: 'نعم بالتأكيد، كل شقة في منزل الفخامة تمتلك موقف سيارات خاص بها ومظلل مسجل برقم الشقة في قبو أو فناء المبنى. كما نوفر مواقف مجهزة بالكامل بشواحن سيارات كهربائية EV بقوة 22 كيلو واط سريعة وآمنة.',
      active: true,
      displayOrder: 5
    },
    {
      id: 'faq_6',
      question: 'ما هي سياسة الإلغاء وتعديل مواعيد الحجز؟',
      answer: 'نحن نتبع سياسة إلغاء فندقية مرنة؛ حيث يمكنك إلغاء الحجز الفندقي القصير واسترداد المبلغ كاملًا بدون رسوم قبل موعد الدخول بـ 48 ساعة على الأقل. وفي عقود الإيجار الطويلة والشهرية يتم الرجوع لشروط الفسخ والإنهاء المبكر الموثقة بالعقد.',
      active: true,
      displayOrder: 6
    }
  ],
};

export const initialAmenities: Amenity[] = [
  { id: 'smart_lock', name: 'دخول ذكي بدون مفتاح', nameEn: 'Smart Keyless Access', icon: 'KeyRound', category: 'technology' },
  { id: 'wifi', name: 'إنترنت فايبر عالي السرعة', nameEn: 'High-speed Fiber WiFi', icon: 'Wifi', category: 'technology' },
  { id: 'cleaning', name: 'خدمة تدبير منزلي فندقية', nameEn: 'Hotel Housekeeping', icon: 'Sparkles', category: 'general' },
  { id: 'concierge', name: 'خدمات الكونسيرج 24/7', nameEn: '24/7 Concierge', icon: 'Clock', category: 'general' },
  { id: 'ev_parking', name: 'مواقف خاصة مع شاحن كهربائي', nameEn: 'EV Charger Parking', icon: 'Car', category: 'comfort' },
  { id: 'full_kitchen', name: 'مطبخ متكامل التجهيز', nameEn: 'Fully Equipped Kitchen', icon: 'Utensils', category: 'kitchen' },
  { id: 'coffee', name: 'ركن قهوة مختصة متكامل', nameEn: 'Specialty Coffee Bar', icon: 'Coffee', category: 'kitchen' },
  { id: 'washer_dryer', name: 'غسالة ومجففة ملابس ذكية', nameEn: 'Washer & Dryer', icon: 'Shirt', category: 'comfort' },
  { id: 'gym', name: 'نادي صحي ورياضي خاص بـ منزل الفخامة', nameEn: 'Private Wellness Gym', icon: 'Dumbbell', category: 'wellness' },
  { id: 'balcony_view', name: 'شرفة بإطلالة بانورامية', nameEn: 'Panoramic Balcony', icon: 'Eye', category: 'comfort' },
  { id: 'smart_tv', name: 'تلفزيون ذكي 65 بوصة 4K', nameEn: '65" 4K Smart TV', icon: 'Tv', category: 'technology' },
  { id: 'work_desk', name: 'مكتب عمل تنفيذي مريح', nameEn: 'Executive Workspace', icon: 'Briefcase', category: 'comfort' },
];

export const initialCities: City[] = [
  { id: 'city-riyadh', name: 'الرياض', nameEn: 'Riyadh', region: 'منطقة الرياض', country: 'المملكة العربية السعودية', status: 'active', displayOrder: 1 },
  { id: 'city-dammam', name: 'الدمام', nameEn: 'Dammam', region: 'المنطقة الشرقية', country: 'المملكة العربية السعودية', status: 'active', displayOrder: 2 },
  { id: 'city-jeddah', name: 'جدة', nameEn: 'Jeddah', region: 'منطقة مكة المكرمة', country: 'المملكة العربية السعودية', status: 'active', displayOrder: 3 },
];

export const initialProperties: Property[] = [
  {
    id: 'prop-nakheel',
    name: 'Luxury home منزل الفخامة - النخيل',
    nameEn: 'Luxury Home Residence - Al Nakheel',
    slug: 'ivoire-residence-nakheel',
    tagline: 'الفخامة الهادئة في أكثر أحياء الرياض تميزاً',
    description: 'يقع Luxury home منزل الفخامة في حي النخيل الراقي، ويقدم شققاً سكنية فاخرة ومفروشة بالكامل للباحثين عن تجربة إقامة استثنائية وطويلة المدى، مع صالة رياضية مشتركة، بهو مخصص للكونسيرج، ومواقف سيارات مجهزة بشواحن كهربائية.',
    address: 'طريق الأمير تركي بن عبد العزيز الأول، حي النخيل، الرياض',
    city: 'الرياض',
    cityId: 'city-riyadh',
    district: 'حي النخيل',
    latitude: 24.7391,
    longitude: 46.6432,
    media: [
      {
        id: 'nakheel_cover',
        url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80',
        title: 'الواجهة الخارجية الفاخرة لبرج منزل الفخامة النخيل',
        type: 'image',
        category: 'facade',
        isCover: true,
      },
      {
        id: 'nakheel_lobby',
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        title: 'بهو الاستقبال الفاخر',
        type: 'image',
        category: 'living',
      },
      {
        id: 'nakheel_garden',
        url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
        title: 'الحديقة الفناء والمرافق المشتركة',
        type: 'image',
        category: 'amenity',
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'ev_parking', 'gym'],
    totalFloors: 5,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    featured: true,
    identifierCode: 'BLD-NKH-01',
    status: 'published',
    entrancesCount: 2,
    elevatorsCount: 3,
    stairsCount: 2,
    sharedFacilities: [
      { id: 'sf-n-1', name: 'الاستقبال والكونسيرج الرئيسي', type: 'reception', description: 'بهو استقبال مجهز لخدمة الضيوف والرد على الطلبات على مدار ٢٤ ساعة', openingHours: '٢٤/٧', floor: 'الدور الأرضي' },
      { id: 'sf-n-2', name: 'نادي منزل الفخامة الصحي المتكامل', type: 'gym', description: 'صالة رياضية خاصة بالنزلاء مجهزة بأحدث أجهزة اللياقة البدنية والتمارين', openingHours: '06:00 - 23:00', floor: 'الدور الأرضي' },
      { id: 'sf-n-3', name: 'غرفة الغسيل المركزية الذكية', type: 'laundry', description: 'غسالات ومجففات فندقية ذكية لتلبية احتياجات النزلاء للإقامات الطويلة', openingHours: '08:00 - 22:00', floor: 'الدور الأرضي' },
      { id: 'sf-n-4', name: 'صالة اللاونج المفتوحة للأعمال', type: 'lounge', description: 'مكان هادئ ومناسب للاجتماعات المصغرة أو العمل الفردي مع ركن للمشروبات والقهوة', openingHours: '07:00 - 24:00', floor: 'الدور الأرضي' },
    ],
  },
  {
    id: 'prop-olayya',
    name: 'منزل الفخامة بارك - العليا',
    nameEn: 'Luxury Home Park - Al Olayya',
    slug: 'ivoire-park-olayya',
    tagline: 'النبض الحيوي وعراقة المعيشة المترفة في قلب العليا',
    description: 'يقدم منزل الفخامة بارك العليا تجربة عصرية متفردة في قلب المركز المالي والتجاري للرياض، مجاوراً لأبرز المعالم الاقتصادية والترفيهية، بلمسات فندقية راقية ومساحات مخصصة لرجال الأعمال والمقيمين الباحثين عن سهولة التنقل والعمل الفاخر.',
    address: 'طريق الملك فهد، حي العليا، الرياض',
    city: 'الرياض',
    cityId: 'city-riyadh',
    district: 'حي العليا',
    latitude: 24.7082,
    longitude: 46.6789,
    media: [
      {
        id: 'olayya_cover',
        url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80',
        title: 'الواجهة الخارجية لمنزل الفخامة العليا',
        type: 'image',
        category: 'facade',
        isCover: true,
      },
      {
        id: 'olayya_interior',
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
        title: 'التجهيزات الداخلية الأنيقة للصالة',
        type: 'image',
        category: 'living',
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen', 'work_desk'],
    totalFloors: 4,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    featured: true,
    identifierCode: 'BLD-OLY-02',
    status: 'published',
    entrancesCount: 1,
    elevatorsCount: 2,
    stairsCount: 1,
    sharedFacilities: [
      { id: 'sf-o-1', name: 'الاستقبال والأمن', type: 'reception', description: 'منطقة كونسيرج وأمن متواجدة لتسهيل الدخول والخروج واستلام الشحنات', openingHours: '٢٤/٧', floor: 'الدور الأرضي' },
      { id: 'sf-o-2', name: 'مركز مخصص لرجال الأعمال', type: 'business_center', description: 'مساحات اجتماعات مجهزة بالكامل للاتصال بالإنترنت والطباعة والتواصل التنفيذي', openingHours: '08:00 - 20:00', floor: 'الدور الأرضي' },
      { id: 'sf-o-3', name: 'الحديقة المعلقة والسطح الاجتماعي', type: 'garden', description: 'منطقة استرخاء على السطح تطل على أبراج العليا بإنارة هادئة ليلاً ومقاعد مريحة', openingHours: '16:00 - 02:00', floor: 'الدور الرابع' },
    ],
  }
];

export const initialParkingSpots: ParkingSpot[] = [
  {
    id: 'prk-n-101',
    propertyId: 'prop-nakheel',
    spotNumber: 'P-B1-01',
    location: 'basement',
    locationLabel: 'القبو الأول',
    type: 'covered',
    status: 'assigned',
    usageType: 'dedicated_unit',
    assignedUnitId: 'unit-n-101',
    instructions: 'الدخول للقبو الأول باستخدام البطاقة الذكية، الموقف رقم 101 محدد بلوحة Luxury home منزل الفخامة لشقة 101.',
    createdAt: '2026-08-20T10:00:00',
  },
  {
    id: 'prk-n-102',
    propertyId: 'prop-nakheel',
    spotNumber: 'P-B1-02',
    location: 'basement',
    locationLabel: 'القبو الأول',
    type: 'covered',
    status: 'assigned',
    usageType: 'dedicated_unit',
    assignedUnitId: 'unit-n-102',
    instructions: 'الدخول للقبو الأول عبر بوابة النزلاء، الموقف رقم 102 مخصص بالكامل لشقة 102.',
    createdAt: '2026-08-20T10:00:00',
  },
  {
    id: 'prk-n-201',
    propertyId: 'prop-nakheel',
    spotNumber: 'P-B1-03',
    location: 'basement',
    locationLabel: 'القبو الأول',
    type: 'ev_charging',
    status: 'assigned',
    usageType: 'dedicated_unit',
    assignedUnitId: 'unit-n-201',
    instructions: 'موقف ذو تجهيز شحن سيارات كهربائية بقدرة 22 كيلو واط مخصص بالكامل لشقة 201.',
    createdAt: '2026-08-20T10:00:00',
  },
  {
    id: 'prk-n-202',
    propertyId: 'prop-nakheel',
    spotNumber: 'P-B1-04',
    location: 'basement',
    locationLabel: 'القبو الأول',
    type: 'accessible',
    status: 'available',
    usageType: 'shared_building',
    instructions: 'موقف ذوي الاحتياجات الخاصة المشترك بالقرب من مصعد البرج الرئيسي.',
    createdAt: '2026-08-20T10:00:00',
  },
  {
    id: 'prk-n-g01',
    propertyId: 'prop-nakheel',
    spotNumber: 'P-G-01',
    location: 'ground',
    locationLabel: 'الدور الأرضي الداخلي',
    type: 'open',
    status: 'available',
    usageType: 'shared_building',
    instructions: 'مواقف الاستقبال السطحية المتاحة للزوار وضيوف النزلاء لفترات قصيرة.',
    createdAt: '2026-08-20T10:00:00',
  },
  {
    id: 'prk-o-101',
    propertyId: 'prop-olayya',
    spotNumber: 'P-OLY-01',
    location: 'ground',
    locationLabel: 'مواقف الدور الأرضي المظللة',
    type: 'covered',
    status: 'assigned',
    usageType: 'dedicated_unit',
    assignedUnitId: 'unit-o-101',
    instructions: 'موقف بمدخل مباشر مضلل ومزود بكاميرا المراقبة، مخصص بالكامل لشقة 101.',
    createdAt: '2026-08-22T10:00:00',
  },
  {
    id: 'prk-o-201',
    propertyId: 'prop-olayya',
    spotNumber: 'P-OLY-02',
    location: 'ground',
    locationLabel: 'مواقف الدور الأرضي المظللة',
    type: 'covered',
    status: 'assigned',
    usageType: 'dedicated_unit',
    assignedUnitId: 'unit-o-201',
    instructions: 'الموقف المخصص الحصري لشقة 201 مع حواجز تمنع وقوف الغير وتعمل بالرمز اللاسلكي.',
    createdAt: '2026-08-22T10:00:00',
  },
  {
    id: 'prk-o-ev',
    propertyId: 'prop-olayya',
    spotNumber: 'P-OLY-EV',
    location: 'ground',
    locationLabel: 'مواقف المدخل الرئيسي',
    type: 'ev_charging',
    status: 'available',
    usageType: 'shared_building',
    instructions: 'شاحن سيارات كهربائية سريع للاستخدام المشترك عند الطلب في بهو العليا.',
    createdAt: '2026-08-22T10:00:00',
  }
];

export const initialFloors: Floor[] = [
  // Al Nakheel
  { id: 'floor-n-1', propertyId: 'prop-nakheel', floorNumber: 1, name: 'الدور الأول' },
  { id: 'floor-n-2', propertyId: 'prop-nakheel', floorNumber: 2, name: 'الدور الثاني' },
  { id: 'floor-n-3', propertyId: 'prop-nakheel', floorNumber: 3, name: 'الدور الثالث' },
  { id: 'floor-n-4', propertyId: 'prop-nakheel', floorNumber: 4, name: 'الدور الرابع' },
  { id: 'floor-n-5', propertyId: 'prop-nakheel', floorNumber: 5, name: 'الدور الخامس - البنتهاوس' },
  // Al Olayya
  { id: 'floor-o-1', propertyId: 'prop-olayya', floorNumber: 1, name: 'الدور الأول' },
  { id: 'floor-o-2', propertyId: 'prop-olayya', floorNumber: 2, name: 'الدور الثاني' },
  { id: 'floor-o-3', propertyId: 'prop-olayya', floorNumber: 3, name: 'الدور الثالث' },
  { id: 'floor-o-4', propertyId: 'prop-olayya', floorNumber: 4, name: 'الدور الرابع - الدوبلكس' },
];

export const initialUnits: Unit[] = [
  {
    id: 'unit-n-101',
    propertyId: 'prop-nakheel',
    floorId: 'floor-n-1',
    unitNumber: '101',
    title: 'جناح منزل الفخامة برستيج ذو الغرفتين الفاخرتين',
    titleEn: 'Luxury Home Prestige 2BR Suite',
    type: 'apartment',
    areaSqm: 125,
    floorNumber: 1,
    maxGuests: 4,
    bedroomsCount: 2,
    bathroomsCount: 2,
    bedsCount: 3,
    assignedParkingId: 'prk-n-101',
    publicationStatus: 'published',
    spaces: [
      {
        id: 'sp-1',
        name: 'منطقة المعيشة والجلوس الفسيحة',
        type: 'living_room',
        areaSqm: 42,
        details: 'تتميز الصالة بشاشة ٦٥ بوصة ذكية وطقم كنب إيطالي فاخر وسجاد حرير طبيعي وإضاءة خافتة مدروسة.',
        fittings: [
          { id: 'fit-1', name: 'طقم كنب إيطالي فاخر (3+2+1)', category: 'furniture', quantity: 1 },
          { id: 'fit-2', name: 'شاشة تلفزيون ذكي ٦٥ بوصة ٤كيه OLED', category: 'electronics', quantity: 1 },
          { id: 'fit-3', name: 'طاولة طعام خشبية فاخرة لأربعة أشخاص', category: 'furniture', quantity: 1 },
          { id: 'fit-4', name: 'نظام تكييف ذكي متكامل (Nest)', category: 'appliance', quantity: 1 }
        ]
      },
      {
        id: 'sp-2',
        name: 'غرفة النوم الرئيسية الماستر (بحمام خاص)',
        type: 'bedroom',
        areaSqm: 28,
        bedsCount: 1,
        bedType: 'سرير كينج ملكي ٢٠٠*٢٠٠',
        details: 'سرير ملكي مزود بمرتبة طبية أمريكية مع دولاب ملابس مدمج وإضاءة ليلية ناعمة.',
        fittings: [
          { id: 'fit-5', name: 'سرير كينج ملكي بحجم ٢٠٠*٢٠٠ سم', category: 'bed', quantity: 1, specifications: 'مفارش قطنية مصرية ٣٠٠ غرزة' },
          { id: 'fit-6', name: 'طاولة سرير جانبية ذكية مع شاحن لاسلكي', category: 'furniture', quantity: 2 },
          { id: 'fit-7', name: 'دولاب ملابس مدمج مع مرآة بالطول الكامل', category: 'furniture', quantity: 1 },
          { id: 'fit-8', name: 'تلفزيون ذكي مدمج ٥٥ بوصة شاشة ذكية', category: 'electronics', quantity: 1 }
        ]
      },
      {
        id: 'sp-3',
        name: 'غرفة النوم الثانية المشتركة',
        type: 'bedroom',
        areaSqm: 22,
        bedsCount: 2,
        bedType: 'سرير توين مزدوج ١٢٠*٢٠٠',
        fittings: [
          { id: 'fit-9', name: 'سرير توين مفرد بحجم ١٢٠*٢٠٠ سم لكل سرير', category: 'bed', quantity: 2 },
          { id: 'fit-10', name: 'طاولات نوم جانبية مجهزة بوصلات شحن', category: 'furniture', quantity: 1 },
          { id: 'fit-11', name: 'مكتب دراسة وعمل صغير مريح للعمل الفردي', category: 'furniture', quantity: 1 }
        ]
      },
      {
        id: 'sp-4',
        name: 'المطبخ المجهز بالكامل',
        type: 'kitchen',
        areaSqm: 16,
        details: 'يحتوي المطبخ على ثلاجة كبيرة وفرن ميكروويف وأواني طهي كاملة ومغسلة صحون متطورة.',
        fittings: [
          { id: 'fit-12', name: 'ثلاجة ومجمدة ماركة سيمنز الألمانية', category: 'appliance', quantity: 1 },
          { id: 'fit-13', name: 'موقد غاز مع فرن حراري متكامل بلت-إن', category: 'appliance', quantity: 1 },
          { id: 'fit-14', name: 'ماكينة تحضير قهوة نسبريسو مع كبسولات يومية', category: 'appliance', quantity: 1 },
          { id: 'fit-15', name: 'غسالة صحون مدمجة ذكية سهلة الاستعمال', category: 'appliance', quantity: 1 }
        ]
      },
      {
        id: 'sp-5',
        name: 'الحمام الرئيسي للماستر',
        type: 'bathroom',
        areaSqm: 9,
        details: 'يتميز حمام الماستر بدش مطري وجاكوزي مدمج وتجهيزات صحية ذهبية وإضاءة مرايا دافئة.',
        fittings: [
          { id: 'fit-16', name: 'جاكوزي مدمج وبورسلين إيطالي بالكامل', category: 'sanitary', quantity: 1 },
          { id: 'fit-17', name: 'دش مطري متدفق مع مصفاة تنقية مياه', category: 'sanitary', quantity: 1 },
          { id: 'fit-18', name: 'طقم مناشف وأرواب قطنية فندقية فاخرة', category: 'sanitary', quantity: 1 }
        ]
      },
      {
        id: 'sp-6',
        name: 'الحمام الثاني المشترك',
        type: 'bathroom',
        areaSqm: 4,
        fittings: [
          { id: 'fit-19', name: 'طقم دش زجاجي وتجهيزات صحية حديثة ومناشف', category: 'sanitary', quantity: 1 }
        ]
      },
      {
        id: 'sp-7',
        name: 'الشرفة الخارجية البانورامية',
        type: 'balcony',
        areaSqm: 8,
        fittings: [
          { id: 'fit-20', name: 'طقم كراسي ريزين خارجي ومقاوم للعوامل الجوية مع طاوله', category: 'furniture', quantity: 1 }
        ]
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen', 'coffee', 'washer_dryer', 'smart_tv', 'balcony_view'],
    media: [
      {
        id: 'u101_1',
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
        title: 'منطقة الصالة المفتوحة والمعيشة في شقة النخيل ١٠١',
        type: 'image',
        category: 'living',
        isCover: true,
      },
      {
        id: 'u101_2',
        url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80',
        title: 'غرفة النوم الماستر بإنارة وتصميم فاخر جداً',
        type: 'image',
        category: 'bedroom',
      },
      {
        id: 'u101_3',
        url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
        title: 'المطبخ المتكامل المجهز بأواني وتجهيزات فندقية راقية',
        type: 'image',
        category: 'kitchen',
      },
      {
        id: 'u101_4',
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
        title: 'الحمام الرئيسي المجهز بورق حائط بورسلين وجاكوزي',
        type: 'image',
        category: 'bathroom',
      }
    ],
    floorPlanUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1000&q=80',
    furnishingStatus: 'furnished',
    allowDaily: true,
    dailyRate: 950,
    dailySecurityDeposit: 1000,
    allowMonthly: true,
    monthlyRate: 19500,
    monthlySecurityDeposit: 5000,
    allowYearly: true,
    yearlyRate: 190000,
    yearlySecurityDeposit: 10000,
    yearlyPaymentOptions: ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 150,
    securityDeposit: 1000,
    taxPercentage: 15,
    operationalStatus: 'ready',
    occupancyStatus: 'vacant',
  },
  {
    id: 'unit-n-102',
    propertyId: 'prop-nakheel',
    floorId: 'floor-n-1',
    unitNumber: '102',
    title: 'جناح منزل الفخامة التنفيذي المتميز بغرفة نوم واحدة وصالة',
    titleEn: 'Luxury Home Executive 1BR Suite',
    type: 'apartment',
    areaSqm: 85,
    floorNumber: 1,
    maxGuests: 2,
    bedroomsCount: 1,
    bathroomsCount: 1.5,
    bedsCount: 1,
    assignedParkingId: 'prk-n-102',
    publicationStatus: 'published',
    spaces: [
      {
        id: 'sp-21',
        name: 'الصالة الفندقية الراقية',
        type: 'living_room',
        fittings: [
          { id: 'fit-21', name: 'كنبة مخملية زرقاء مريحة للغاية', category: 'furniture', quantity: 1 },
          { id: 'fit-22', name: 'طاولة قهوة دائرية من الرخام الأسود مع نحاس', category: 'furniture', quantity: 1 },
          { id: 'fit-23', name: 'شاشة تلفزيون سامسونج ذكية ٥٥ بوصة ٤كيه', category: 'electronics', quantity: 1 }
        ]
      },
      {
        id: 'sp-22',
        name: 'غرفة النوم الماستر المجهزة',
        type: 'bedroom',
        bedsCount: 1,
        bedType: 'سرير كوين مريح جداً ١٨٠*٢٠٠',
        fittings: [
          { id: 'fit-24', name: 'سرير كوين مريح مع مرتبة طبية ١٨٠*٢٠٠', category: 'bed', quantity: 1 },
          { id: 'fit-25', name: 'طاولات جانبية خشبية فاخرة', category: 'furniture', quantity: 2 },
          { id: 'fit-26', name: 'إضاءة أباجورة كلاسيكية من النحاس الخالص', category: 'furniture', quantity: 1 }
        ]
      },
      {
        id: 'sp-23',
        name: 'المطبخ والبار المفتوح',
        type: 'kitchen',
        fittings: [
          { id: 'fit-27', name: 'صانعة مشروبات وثلاجة وماكينة قهوة صغيرة', category: 'appliance', quantity: 1 }
        ]
      },
      {
        id: 'sp-24',
        name: 'الحمام الرئيسي والجاكوزي المبسط',
        type: 'bathroom',
        fittings: [
          { id: 'fit-28', name: 'طقم تجهيز استحمام وتجهيزات صحية إيطالية كاملة', category: 'sanitary', quantity: 1 }
        ]
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen', 'coffee', 'smart_tv', 'work_desk'],
    media: [
      {
        id: 'u102_1',
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
        title: 'الصالة الداخلية الرائعة للشقة ١٠٢',
        type: 'image',
        category: 'living',
        isCover: true,
      },
      {
        id: 'u102_2',
        url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80',
        title: 'غرفة النوم المجهزة بإضاءة ناعمة ودافئة',
        type: 'image',
        category: 'bedroom',
      }
    ],
    furnishingStatus: 'furnished',
    allowDaily: true,
    dailyRate: 720,
    dailySecurityDeposit: 800,
    allowMonthly: true,
    monthlyRate: 15000,
    monthlySecurityDeposit: 3000,
    allowYearly: true,
    yearlyRate: 145000,
    yearlySecurityDeposit: 7500,
    yearlyPaymentOptions: ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 120,
    securityDeposit: 800,
    taxPercentage: 15,
    operationalStatus: 'ready',
    occupancyStatus: 'daily_occupied',
    currentBookingId: 'bk-1001',
    todayDeparture: false,
  },
  {
    id: 'unit-n-201',
    propertyId: 'prop-nakheel',
    floorId: 'floor-n-2',
    unitNumber: '201',
    title: 'شقة منزل الفخامة سيجنتشر المترفة ذات ٣ غرف نوم وصالة',
    titleEn: 'Luxury Home Signature 3BR Residence',
    type: 'apartment',
    areaSqm: 180,
    floorNumber: 2,
    maxGuests: 6,
    bedroomsCount: 3,
    bathroomsCount: 3,
    bedsCount: 4,
    assignedParkingId: 'prk-n-201',
    publicationStatus: 'published',
    spaces: [
      {
        id: 'sp-31',
        name: 'الصالة التنفيذية الكبيرة والمفتوحة',
        type: 'living_room',
        fittings: [
          { id: 'fit-31', name: 'طقم كنب إيطالي دائري فاخر يسع لـ ٨ أشخاص', category: 'furniture', quantity: 1 },
          { id: 'fit-32', name: 'شاشة تلفزيون إل جي OLED ذكية بمقاس ٧٥ بوصة', category: 'electronics', quantity: 1 }
        ]
      },
      {
        id: 'sp-32',
        name: 'غرفة النوم الأولى الماستر الرائعة',
        type: 'bedroom',
        bedsCount: 1,
        bedType: 'سرير كينج ملكي مجهز بالكامل ٢٠٠*٢٠٠',
        fittings: [
          { id: 'fit-33', name: 'سرير كينج أمريكي فاخر ٢٠٠*٢٠٠ سم', category: 'bed', quantity: 1 }
        ]
      },
      {
        id: 'sp-33',
        name: 'غرفة النوم الثانية المزدوجة',
        type: 'bedroom',
        bedsCount: 1,
        bedType: 'سرير كوين مريح للغاية ١٦٠*٢٠٠',
        fittings: [
          { id: 'fit-34', name: 'سرير كوين مريح مجهز بجميع البياضات ١٦٠*٢٠٠', category: 'bed', quantity: 1 }
        ]
      },
      {
        id: 'sp-34',
        name: 'غرفة النوم الثالثة توين مزدوجة',
        type: 'bedroom',
        bedsCount: 2,
        bedType: 'سريرين مفردين ١٢٠*٢٠٠ لكل منهما',
        fittings: [
          { id: 'fit-35', name: 'طقم سرير مفرد ١٢٠*٢٠٠ سم قطن فندقي', category: 'bed', quantity: 2 }
        ]
      },
      {
        id: 'sp-35',
        name: 'الحمامات الصحية الثلاثة المجهزة',
        type: 'bathroom',
        fittings: [
          { id: 'fit-36', name: 'تجهيزات صحية جروهي الألمانية الفاخرة ومناشف وأرواب', category: 'sanitary', quantity: 1 }
        ]
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen', 'coffee', 'washer_dryer', 'ev_parking', 'balcony_view'],
    media: [
      {
        id: 'u201_1',
        url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
        title: 'الصالون الداخلي الفخم والفاخر في شقة ٢٠١',
        type: 'image',
        category: 'living',
        isCover: true,
      }
    ],
    furnishingStatus: 'furnished',
    allowDaily: true,
    dailyRate: 1450,
    dailySecurityDeposit: 2000,
    allowMonthly: true,
    monthlyRate: 28000,
    monthlySecurityDeposit: 10000,
    allowYearly: true,
    yearlyRate: 280000,
    yearlySecurityDeposit: 15000,
    yearlyPaymentOptions: ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 200,
    securityDeposit: 2000,
    taxPercentage: 15,
    operationalStatus: 'ready',
    occupancyStatus: 'monthly_occupied',
  },
  {
    id: 'unit-n-202',
    propertyId: 'prop-nakheel',
    floorId: 'floor-n-2',
    unitNumber: '202',
    title: 'شقة منزل الفخامة هورايزون بإطلالة واسعة وغرفتي نوم وصالة',
    titleEn: 'Luxury Home Horizon 2BR',
    type: 'apartment',
    areaSqm: 110,
    floorNumber: 2,
    maxGuests: 4,
    bedroomsCount: 2,
    bathroomsCount: 2,
    bedsCount: 2,
    publicationStatus: 'published',
    spaces: [
      {
        id: 'sp-41',
        name: 'منطقة المعيشة واللاونج الفاخر',
        type: 'living_room',
        fittings: [
          { id: 'fit-41', name: 'كنب مريح وطاولة طعام دائرية خشبية متميزة', category: 'furniture', quantity: 1 }
        ]
      },
      {
        id: 'sp-42',
        name: 'غرفة النوم الماستر المتميزة',
        type: 'bedroom',
        bedsCount: 1,
        bedType: 'سرير كينج طبي بالكامل ٢٠٠*٢٠٠',
        fittings: [
          { id: 'fit-42', name: 'سرير كينج طبي فاخر ٢٠٠*٢٠٠ سم مع كودينتين', category: 'bed', quantity: 1 }
        ]
      },
      {
        id: 'sp-43',
        name: 'غرفة النوم الثانية المريحة',
        type: 'bedroom',
        bedsCount: 1,
        bedType: 'سرير كوين مريح ومتميز ١٦٠*٢٠٠',
        fittings: [
          { id: 'fit-43', name: 'سرير كوين طبي فاخر ومناسب للإقامات الطويلة', category: 'bed', quantity: 1 }
        ]
      },
      {
        id: 'sp-44',
        name: 'الحمامات الأنيقة والبورسلين الفاخر',
        type: 'bathroom',
        fittings: [
          { id: 'fit-44', name: 'طقم دش جروهي ألماني ذو التصميم الذهبي البديع ومناشف صحية', category: 'sanitary', quantity: 2 }
        ]
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen', 'smart_tv'],
    media: [
      {
        id: 'u202_1',
        url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80',
        title: 'اللاونج الداخلي الرائع مع الصالة الدافئة الشقة ٢٠٢',
        type: 'image',
        category: 'living',
        isCover: true,
      }
    ],
    furnishingStatus: 'furnished',
    allowDaily: true,
    dailyRate: 880,
    dailySecurityDeposit: 1000,
    allowMonthly: true,
    monthlyRate: 18000,
    monthlySecurityDeposit: 5000,
    allowYearly: true,
    yearlyRate: 175000,
    yearlySecurityDeposit: 9000,
    yearlyPaymentOptions: ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 150,
    securityDeposit: 1000,
    taxPercentage: 15,
    operationalStatus: 'needs_cleaning',
    occupancyStatus: 'vacant',
    todayArrival: true,
  },
  {
    id: 'unit-n-501',
    propertyId: 'prop-nakheel',
    floorId: 'floor-n-5',
    unitNumber: '501',
    title: 'بنتهاوس رويال منزل الفخامة الفاخر مع تراس شاسع في الدور الخامس',
    titleEn: 'Royal Luxury Home Penthouse & Terrace',
    type: 'suite',
    areaSqm: 320,
    floorNumber: 5,
    maxGuests: 8,
    bedroomsCount: 4,
    bathroomsCount: 5,
    bedsCount: 5,
    publicationStatus: 'published',
    spaces: [
      {
        id: 'sp-51',
        name: 'مجلس المعيشة الملكي والفاخر',
        type: 'living_room',
        fittings: [
          { id: 'fit-51', name: 'كنب طقم كامل يسع لـ ١٠ أشخاص بتطريزات حرير يدوية', category: 'furniture', quantity: 1 }
        ]
      },
      {
        id: 'sp-52',
        name: 'الجناح الرئيسي الملكي (رويال منزل الفخامة)',
        type: 'bedroom',
        bedsCount: 1,
        bedType: 'سرير رويال كينج ضخم ٢٢٠*٢٠٠ سم',
        fittings: [
          { id: 'fit-52', name: 'سرير سوبر كينج منزل الفخامة رويال ٢٢٠*٢٠٠ سم مع كودينيات ذكية', category: 'bed', quantity: 1 }
        ]
      },
      {
        id: 'sp-53',
        name: 'الجناح الثاني المزدوج ذو السريرين المتميزين',
        type: 'bedroom',
        bedsCount: 2,
        fittings: [
          { id: 'fit-53', name: 'سرير كوين ١٦٠*٢٠٠ مزدوج بياضات حريرية فاخرة', category: 'bed', quantity: 2 }
        ]
      },
      {
        id: 'sp-54',
        name: 'الجناح الثالث والرابع للضيوف',
        type: 'bedroom',
        bedsCount: 2,
        fittings: [
          { id: 'fit-54', name: 'طقم سرير مفرد ١٢٠*٢٠٠ قطن مريح ومناسب للعوائل', category: 'bed', quantity: 2 }
        ]
      },
      {
        id: 'sp-55',
        name: 'التراس البانورامي الخارجي مع منقل نار مدمج',
        type: 'balcony',
        fittings: [
          { id: 'fit-55', name: 'جلسة كنب راقية مقاومة للأمطار والشمس مع طاولة تدفئة خارجية', category: 'furniture', quantity: 1 }
        ]
      },
      {
        id: 'sp-56',
        name: 'الحمامات الخمسة الفاخرة',
        type: 'bathroom',
        fittings: [
          { id: 'fit-56', name: 'تجهيزات صحية جروهي وحجر مايكا الإيطالي بالكامل وأرواب فندقية دافئة', category: 'sanitary', quantity: 5 }
        ]
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen', 'coffee', 'washer_dryer', 'ev_parking', 'balcony_view', 'gym'],
    media: [
      {
        id: 'u501_1',
        url: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
        title: 'الصالة البنتهاوس المطلة مع إطلالات الرياض البانورامية الرائعة',
        type: 'image',
        category: 'living',
        isCover: true,
      }
    ],
    furnishingStatus: 'furnished',
    allowDaily: true,
    dailyRate: 3200,
    dailySecurityDeposit: 5000,
    allowMonthly: true,
    monthlyRate: 65000,
    monthlySecurityDeposit: 20000,
    allowYearly: true,
    yearlyRate: 600000,
    yearlySecurityDeposit: 30000,
    yearlyPaymentOptions: ['single_annual'],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 400,
    securityDeposit: 5000,
    taxPercentage: 15,
    operationalStatus: 'ready',
    occupancyStatus: 'vacant',
  },
  // Luxury Home Park Olayya
  {
    id: 'unit-o-101',
    propertyId: 'prop-olayya',
    floorId: 'floor-o-1',
    unitNumber: '101',
    title: 'استديو منزل الفخامة للأعمال مجهز بالكامل للمدراء ورجال الأعمال',
    titleEn: 'Luxury Home Business Studio',
    type: 'studio',
    areaSqm: 55,
    floorNumber: 1,
    maxGuests: 2,
    bedroomsCount: 1,
    bathroomsCount: 1,
    bedsCount: 1,
    assignedParkingId: 'prk-o-101',
    publicationStatus: 'published',
    spaces: [
      {
        id: 'sp-o1',
        name: 'غرفة النوم والجلوس والعمل المفتوحة',
        type: 'bedroom',
        bedsCount: 1,
        bedType: 'سرير كوين أمريكي فاخر ١٨٠*٢٠٠ سم',
        fittings: [
          { id: 'fit-o1', name: 'سرير كوين مريح مع لوح رأس من الجلد الفاخر وركن مكتب ومقعد فخم', category: 'bed', quantity: 1 },
          { id: 'fit-o2', name: 'مكتب عمل تنفيذي مجهز بإضاءة مريحة وحقيبة قرطاسية متكاملة', category: 'furniture', quantity: 1 }
        ]
      },
      {
        id: 'sp-o12',
        name: 'الحمام الحديث والراقي المتميز',
        type: 'bathroom',
        fittings: [
          { id: 'fit-o3', name: 'دش مطري زجاجي وبلاط سيراميك فاخر ومستحضرات تجميل ومناشف فندقية', category: 'sanitary', quantity: 1 }
        ]
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'coffee', 'work_desk', 'smart_tv'],
    media: [
      {
        id: 'uo101_1',
        url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
        title: 'الاستديو الأنيق المجهز لرجال الأعمال العليا ١٠١',
        type: 'image',
        category: 'bedroom',
        isCover: true,
      }
    ],
    furnishingStatus: 'furnished',
    allowDaily: true,
    dailyRate: 520,
    dailySecurityDeposit: 600,
    allowMonthly: true,
    monthlyRate: 11000,
    monthlySecurityDeposit: 2500,
    allowYearly: true,
    yearlyRate: 98000,
    yearlySecurityDeposit: 5000,
    yearlyPaymentOptions: ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 90,
    securityDeposit: 600,
    taxPercentage: 15,
    operationalStatus: 'in_maintenance',
    occupancyStatus: 'vacant',
    notes: 'تحتاج صيانة وحدة التكييف ولقطة الحمام.',
  },
  {
    id: 'unit-o-201',
    propertyId: 'prop-olayya',
    floorId: 'floor-o-2',
    unitNumber: '201',
    title: 'جناح منزل الفخامة العليا غرفتين وصالة فخمة مع إطلالة حديقة',
    titleEn: 'Park View 1BR Suite',
    type: 'apartment',
    areaSqm: 75,
    floorNumber: 2,
    maxGuests: 3,
    bedroomsCount: 1,
    bathroomsCount: 1,
    bedsCount: 2,
    assignedParkingId: 'prk-o-201',
    publicationStatus: 'published',
    spaces: [
      {
        id: 'sp-o21',
        name: 'الصالة الفندقية واللاونج الداخلي',
        type: 'living_room',
        fittings: [
          { id: 'fit-o21', name: 'كنب طقم رائع بتدرجات البيج والرمادي دافئ ومريح وطاولات رخام', category: 'furniture', quantity: 1 }
        ]
      },
      {
        id: 'sp-o22',
        name: 'غرفة النوم الرئيسية ذي السرير المتميز كوين',
        type: 'bedroom',
        bedsCount: 1,
        bedType: 'سرير كوين مريح ومرتبة ميموري فوم طبية ١٦٠*٢٠٠ سم',
        fittings: [
          { id: 'fit-o22', name: 'سرير كوين مريح طبي بالكامل قطن مصري فاخر', category: 'bed', quantity: 1 }
        ]
      },
      {
        id: 'sp-o23',
        name: 'الحمام الأنيق دش وجاكوزي',
        type: 'bathroom',
        fittings: [
          { id: 'fit-o23', name: 'تجهيزات صحية حديثة ومناشف وأرواب قطنية دافئة', category: 'sanitary', quantity: 1 }
        ]
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen', 'coffee', 'smart_tv', 'balcony_view'],
    media: [
      {
        id: 'uo201_1',
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
        title: 'الصالة والجلوس الأنيق العليا ٢٠١',
        type: 'image',
        category: 'living',
        isCover: true,
      }
    ],
    furnishingStatus: 'furnished',
    allowDaily: false,
    dailyRate: 680,
    dailySecurityDeposit: 800,
    allowMonthly: true,
    monthlyRate: 7000,
    monthlySecurityDeposit: 3000,
    allowYearly: true,
    yearlyRate: 84000,
    yearlySecurityDeposit: 6000,
    yearlyPaymentOptions: ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 110,
    securityDeposit: 800,
    taxPercentage: 15,
    operationalStatus: 'ready',
    occupancyStatus: 'occupied_yearly',
    currentLeaseId: 'lease-3001',
    notes: 'العقد ساري حتى تاريخ 2027-05-31 (المستأجر ملتزم بالسداد الدوري).',
  },
  {
    id: 'unit-o-301',
    propertyId: 'prop-olayya',
    floorId: 'floor-o-3',
    unitNumber: '301',
    title: 'جناح منزل الفخامة سكاي دوبلكس الفاخر ذو الإطلالة الرائعة والغرفتين',
    titleEn: 'Luxury Home Sky Duplex 2BR',
    type: 'duplex',
    areaSqm: 145,
    floorNumber: 3,
    maxGuests: 4,
    bedroomsCount: 2,
    bathroomsCount: 2.5,
    bedsCount: 2,
    publicationStatus: 'published',
    spaces: [
      {
        id: 'sp-o31',
        name: 'الصالة الداخلية الفسيحة ومجلس الضيوف',
        type: 'living_room',
        fittings: [
          { id: 'fit-o31', name: 'طقم كنب مخمل وتلفزيون ذكي ذو الصوت السينمائي', category: 'furniture', quantity: 1 }
        ]
      },
      {
        id: 'sp-o32',
        name: 'الغرف المزدوجة في الطابق العلوي للدوبلكس',
        type: 'bedroom',
        bedsCount: 2,
        fittings: [
          { id: 'fit-o32', name: 'سرير كوين طبي فاخر وسرير توين مجهز ومريح لكل غرفة', category: 'bed', quantity: 2 }
        ]
      },
      {
        id: 'sp-o33',
        name: 'الحمامات والمغاسل الرخامية الفاخرة',
        type: 'bathroom',
        fittings: [
          { id: 'fit-o33', name: 'طقم تجهيز صحي مميز ذهبي ونظام تدفئة مياه ذكي ومرايا ليد', category: 'sanitary', quantity: 2 }
        ]
      }
    ],
    amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge', 'full_kitchen', 'washer_dryer', 'ev_parking', 'balcony_view'],
    media: [
      {
        id: 'uo301_1',
        url: 'https://images.unsplash.com/photo-160058515440-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        title: 'الدوبلكس الفاخر بتصميم معلق رائع العليا ٣٠١',
        type: 'image',
        category: 'living',
        isCover: true,
      }
    ],
    furnishingStatus: 'furnished',
    allowDaily: true,
    dailyRate: 1200,
    dailySecurityDeposit: 1500,
    allowMonthly: true,
    monthlyRate: 24000,
    monthlySecurityDeposit: 8000,
    allowYearly: true,
    yearlyRate: 230000,
    yearlySecurityDeposit: 12000,
    yearlyPaymentOptions: ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: 0,
    cleaningFee: 180,
    securityDeposit: 1500,
    taxPercentage: 15,
    operationalStatus: 'blocked',
    occupancyStatus: 'vacant',
    notes: 'محجوبة لأعمال التحديث الشاملة لفرش الشرفة وتطوير الديكور الداخلي.',
  }
];

export const initialAllocations: UnitAllocation[] = [
  {
    id: 'alloc-1',
    unitId: 'unit-n-102',
    type: 'booking',
    referenceId: 'bk-1001',
    startDate: '2026-09-28T15:00:00',
    endDate: '2026-10-02T12:00:00',
    prepBufferHours: 3,
    status: 'active',
    createdAt: '2026-09-27T10:00:00',
    notes: 'حجز مؤكد لشقة ١٠٢ عبر البوابة الإلكترونية للضيف عبد الرحمن الدوسري',
  },
  {
    id: 'alloc-2',
    unitId: 'unit-n-201',
    type: 'lease',
    referenceId: 'lease-2001',
    startDate: '2026-09-01T15:00:00',
    endDate: '2027-02-28T12:00:00',
    prepBufferHours: 4,
    status: 'active',
    createdAt: '2026-08-25T14:30:00',
    notes: 'عقد إيجار مخصص لشركة الأفق المتميزة شقة ٢٠١ حي النخيل',
  },
  {
    id: 'alloc-3',
    unitId: 'unit-n-202',
    type: 'booking',
    referenceId: 'bk-1002',
    startDate: '2026-09-30T15:00:00',
    endDate: '2026-10-05T12:00:00',
    prepBufferHours: 3,
    status: 'active',
    createdAt: '2026-09-29T11:20:00',
    notes: 'حجز مؤكد عبر البوابة الإلكترونية لشقة ٢٠٢ للضيف فهد منصور',
  },
  {
    id: 'alloc-4',
    unitId: 'unit-o-101',
    type: 'maintenance',
    referenceId: 'maint-3001',
    startDate: '2026-09-29T08:00:00',
    endDate: '2026-10-01T18:00:00',
    prepBufferHours: 2,
    status: 'active',
    createdAt: '2026-09-29T07:45:00',
    notes: 'حجب بسبب صيانة التكييف المركزي والمغسلة شقة العليا ١٠١',
  },
  {
    id: 'alloc-5',
    unitId: 'unit-o-301',
    type: 'block',
    referenceId: 'block-4001',
    startDate: '2026-09-29T00:00:00',
    endDate: '2026-10-04T23:59:59',
    prepBufferHours: 2,
    status: 'active',
    createdAt: '2026-09-28T09:00:00',
    notes: 'حجب إداري لشقة العليا ٣٠١ لتغيير فرش الشرفة والتصميم',
  },
  {
    id: 'alloc-yr-1',
    unitId: 'unit-o-201',
    type: 'lease',
    referenceId: 'lease-3001',
    startDate: '2026-06-01T15:00:00',
    endDate: '2027-05-31T12:00:00',
    prepBufferHours: 6,
    status: 'active',
    createdAt: '2026-05-20T10:00:00',
    notes: 'عقد سنوي مخصص للمستأجر سليمان القحطاني حي العليا شقة ٢٠١ لـ ١٢ شهراً',
  }
];

export const initialBookings: Booking[] = [
  {
    id: 'bk-1001',
    bookingNumber: 'IVR-26-9041',
    unitId: 'unit-n-102',
    propertyId: 'prop-nakheel',
    guest: {
      fullName: 'عبد الرحمن الدوسري',
      email: 'a.aldosari@example.com',
      phone: '+966 54 889 1234',
      nationalIdOrPassport: '1098234711',
      idVerified: true,
      notes: 'رائد أعمال محلي يفضل غسيل البياضات اليومي وتوفير كبسولات قهوة إضافية.',
    },
    checkIn: '2026-09-28',
    checkOut: '2026-10-02',
    totalNights: 4,
    guestsCount: 2,
    status: 'checked_in',
    rentalType: 'daily',
    nightlyRate: 720,
    subtotal: 2880,
    cleaningFee: 120,
    taxes: 450,
    securityDeposit: 800,
    totalAmount: 4250,
    smartLockPin: '829410#',
    smartLockPinValidFrom: '2026-09-28T15:00:00',
    smartLockPinValidTo: '2026-10-02T12:00:00',
    pinAccessedAt: '2026-09-28T15:10:00',
    pinAccessedBy: 'guest_app',
    createdAt: '2026-09-27T10:00:00',
    allocationId: 'alloc-1',
  },
  {
    id: 'bk-1002',
    bookingNumber: 'IVR-26-9042',
    unitId: 'unit-n-202',
    propertyId: 'prop-nakheel',
    guest: {
      fullName: 'فهد منصور',
      email: 'fahad.mansour@example.com',
      phone: '+966 50 671 9922',
      nationalIdOrPassport: '1084729104',
      idVerified: true,
    },
    checkIn: '2026-09-30',
    checkOut: '2026-10-05',
    totalNights: 5,
    guestsCount: 3,
    status: 'confirmed',
    rentalType: 'daily',
    nightlyRate: 880,
    subtotal: 4400,
    cleaningFee: 150,
    taxes: 682.5,
    securityDeposit: 1000,
    totalAmount: 6232.5,
    smartLockPin: '419752#',
    smartLockPinValidFrom: '2026-09-30T15:00:00',
    smartLockPinValidTo: '2026-10-05T12:00:00',
    createdAt: '2026-09-29T11:20:00',
    allocationId: 'alloc-3',
  }
];

export const initialLeases: Lease[] = [
  {
    id: 'lease-2001',
    contractNumber: 'IVR-LSE-2026-08',
    unitId: 'unit-n-201',
    propertyId: 'prop-nakheel',
    tenant: {
      fullName: 'شركة الأفق المتميزة (ممثلة بـ رائد التركي)',
      email: 'r.turki@alofooq.sa',
      phone: '+966 55 412 8877',
      nationalIdOrPassport: '7009823412',
      idVerified: true,
    },
    startDate: '2026-09-01',
    endDate: '2027-02-28',
    monthsCount: 6,
    rentalType: 'monthly',
    status: 'active',
    monthlyRent: 28000,
    securityDeposit: 10000,
    totalContractValue: 168000,
    allocationId: 'alloc-2',
    inclusionType: 'all_inclusive',
    services: [
      {
        id: 's-2001-1',
        serviceKey: 'electricity',
        name: 'فاتورة الكهرباء والعداد المخصص',
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: 'company',
        billingMethod: 'capped_included',
        billingCycle: 'monthly',
        capAmount: 500,
        providerPayer: 'company',
        descriptionRule: 'الشركة تتحمل تكلفة الفاتورة بحد أقصى ٥٠٠ ريال شهرياً والزيادة على المستأجر.',
      },
      {
        id: 's-2001-2',
        serviceKey: 'water',
        name: 'فاتورة شبكة المياه والصرف',
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: 'company',
        billingMethod: 'included_no_fee',
        billingCycle: 'monthly',
        providerPayer: 'company',
        descriptionRule: 'استهلاك المياه مغطى بالكامل وبدون تكلفة إضافية طوال فترة العقد.',
      },
      {
        id: 's-2001-3',
        serviceKey: 'internet',
        name: 'إنترنت فايبر عالي السرعة مخصص',
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: 'company',
        billingMethod: 'included_no_fee',
        billingCycle: 'monthly',
        providerPayer: 'company',
        descriptionRule: 'خط إنترنت ألياف بصرية بسرعة ٥٠٠ ميجابت مغطى بالكامل ومشمول في قيمة الإيجار.',
      }
    ],
    termsSnapshot: {
      frozenAt: '2026-08-25T14:30:00',
      approvedBy: 'أحمد المفلح (مدير العمليات التشغيلية)',
      latePolicy: 'تطبق غرامة تأخير قدرها ١٠٪ من قيمة الدفعة بعد فوات ٧ أيام من الاستحقاق.',
      renewalPolicy: 'يجب إبلاغ إدارة منزل الفخامة بالرغبة في التجديد قبل ٣٠ يوماً على الأقل من تاريخ انتهاء العقد.',
      earlyTerminationPolicy: 'في حال الإنهاء المبكر، يتم مصادرة تأمين العقد مع دفع غرامة تعادل شهر إيجار إضافي كشرط جزائي.',
      agreedRent: 28000,
      agreedDeposit: 10000
    },
    amendments: [],
    createdAt: '2026-08-25T14:30:00',
    installments: [
      {
        id: 'inst-1',
        leaseId: 'lease-2001',
        installmentNumber: 1,
        label: 'دفعة شهر سبتمبر 2026',
        dueDate: '2026-09-01',
        amount: 28000,
        paidAmount: 28000,
        remainingAmount: 0,
        status: 'paid',
        paidAt: '2026-08-28T11:00:00',
        receiptNumber: 'RCP-26-0901',
        transactionRef: 'TX-98401',
        payments: [{ paymentId: 'pay-2001-1', amount: 28000, date: '2026-08-28T11:00:00', method: 'bank_transfer', receiptNo: 'RCP-26-0901' }]
      },
      {
        id: 'inst-2',
        leaseId: 'lease-2001',
        installmentNumber: 2,
        label: 'دفعة شهر أكتوبر 2026',
        dueDate: '2026-10-01',
        amount: 28000,
        paidAmount: 0,
        remainingAmount: 28000,
        status: 'due',
        payments: []
      },
      {
        id: 'inst-3',
        leaseId: 'lease-2001',
        installmentNumber: 3,
        label: 'دفعة شهر نوفمبر 2026',
        dueDate: '2026-11-01',
        amount: 28000,
        paidAmount: 0,
        remainingAmount: 28000,
        status: 'not_due_yet',
        payments: []
      },
      {
        id: 'inst-4',
        leaseId: 'lease-2001',
        installmentNumber: 4,
        label: 'دفعة شهر ديسمبر 2026',
        dueDate: '2026-12-01',
        amount: 28000,
        paidAmount: 0,
        remainingAmount: 28000,
        status: 'not_due_yet',
        payments: []
      },
      {
        id: 'inst-5',
        leaseId: 'lease-2001',
        installmentNumber: 5,
        label: 'دفعة شهر يناير 2027',
        dueDate: '2027-01-01',
        amount: 28000,
        paidAmount: 0,
        remainingAmount: 28000,
        status: 'not_due_yet',
        payments: []
      },
      {
        id: 'inst-6',
        leaseId: 'lease-2001',
        installmentNumber: 6,
        label: 'دفعة شهر فبراير 2027',
        dueDate: '2027-02-01',
        amount: 28000,
        paidAmount: 0,
        remainingAmount: 28000,
        status: 'not_due_yet',
        payments: []
      }
    ]
  },
  {
    id: 'lease-3001',
    contractNumber: 'IVR-LSE-2026-YR01',
    unitId: 'unit-o-201',
    propertyId: 'prop-olayya',
    tenant: {
      fullName: 'سليمان القحطاني',
      email: 's.qahtani@saudicorp.sa',
      phone: '+966 50 918 2233',
      nationalIdOrPassport: '1076294810',
      idVerified: true,
      notes: 'مستشار إداري لدى الهيئات الحكومية يطلب فاتورة ضريبية رسمية باسم مؤسسته.',
    },
    startDate: '2026-06-01',
    endDate: '2027-05-31',
    monthsCount: 12,
    rentalType: 'yearly',
    yearlyPaymentOption: 'semi_annual',
    status: 'active',
    yearlyRent: 84000,
    monthlyRent: 7000,
    securityDeposit: 6000,
    totalContractValue: 84000,
    allocationId: 'alloc-yr-1',
    inclusionType: 'partially_inclusive',
    services: [
      {
        id: 'srv-yr-1',
        serviceKey: 'electricity',
        name: 'فاتورة العداد الكهربائي المستقل',
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: 'company',
        billingMethod: 'capped_included',
        billingCycle: 'monthly',
        capAmount: 400,
        providerPayer: 'company',
        descriptionRule: 'مشمول بحد أقصى ٤٠٠ ريال شهرياً وتتم المحاسبة على الفرق مع الفاتورة شهرياً.',
        meterInfo: {
          hasDedicatedMeter: true,
          meterNumber: 'SEC-992104',
          startReading: 15200,
          readingDate: '2026-06-01'
        }
      },
      {
        id: 'srv-yr-2',
        serviceKey: 'water',
        name: 'استهلاك شبكة المياه والصرف',
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: 'company',
        billingMethod: 'included_no_fee',
        billingCycle: 'monthly',
        providerPayer: 'company',
        descriptionRule: 'مياه الصنبور والصرف مشمولة بالكامل وبدون قيود طوال مدة الإقامة.',
      },
      {
        id: 'srv-yr-3',
        serviceKey: 'internet',
        name: 'إنترنت ألياف بصرية فايبر مستقل',
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: 'company',
        billingMethod: 'included_no_fee',
        billingCycle: 'monthly',
        providerPayer: 'company',
        descriptionRule: 'خط ألياف بصرية سريع للغاية مخصص للوحدة ومغطى بالكامل.',
        internetInfo: {
          packageSpeed: '500 Mbps Fiber',
          providerName: 'STC Fiber',
          isDedicatedLine: true,
          wifiName: 'Luxury Home_Olayya_201',
          wifiPasswordSafe: 'Iv#Olayya2026'
        }
      },
      {
        id: 'srv-yr-4',
        serviceKey: 'maintenance',
        name: 'الصيانة الدورية والطارئة الشاملة',
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: 'company',
        billingMethod: 'included_no_fee',
        billingCycle: 'once',
        providerPayer: 'company',
        descriptionRule: 'الشركة توفر صيانة ميكانيكية وكهربائية وقفل ذكي بشكل فوري ومجاني.',
        maintenanceScope: {
          routineCoveredBy: 'company',
          normalWearCoveredBy: 'company',
          misuseCoveredBy: 'tenant',
          emergencyCoveredBy: 'company'
        }
      },
      {
        id: 'srv-yr-5',
        serviceKey: 'parking',
        name: 'الموقف الخاص المظلل المخصص',
        isAvailable: true,
        isIncludedInRent: true,
        responsibleParty: 'company',
        billingMethod: 'included_no_fee',
        billingCycle: 'once',
        providerPayer: 'company',
        descriptionRule: 'موقف مظلل خاص رقم P-OLY-02 متاح طوال مدة العقد.',
      }
    ],
    termsSnapshot: {
      frozenAt: '2026-05-25T11:00:00',
      approvedBy: 'سعد القحطاني (مدير الإدارة المالية والتحصيل)',
      latePolicy: 'تطبق سياسة التحصيل الفوري ورسوم تأخير ٢٠٠ ريال لليوم بعد أسبوع من الاستحقاق.',
      renewalPolicy: 'إرسال خطاب طلب تجديد أو رغبة في الإخلاء قبل ٦٠ يوماً، على أن يتم تحديث السعر قبل ٣٠ يوماً.',
      earlyTerminationPolicy: 'في حال الفسخ قبل الموعد، يتحمل المستأجر إيجار شهرين كغرامة إنهاء مبكر.',
      agreedRent: 84000,
      agreedDeposit: 6000
    },
    amendments: [],
    createdAt: '2026-05-25T11:00:00',
    installments: [
      {
        id: 'inst-yr-1',
        leaseId: 'lease-3001',
        installmentNumber: 1,
        label: 'الدفعة الأولى - النصف الأول من الإيجار',
        dueDate: '2026-06-01',
        amount: 42000,
        paidAmount: 42000,
        remainingAmount: 0,
        status: 'paid',
        paidAt: '2026-05-28T16:00:00',
        receiptNumber: 'RCP-YR-2601',
        transactionRef: 'MADA-98217',
        payments: [
          { paymentId: 'pay-yr-1', amount: 42000, date: '2026-05-28T16:00:00', method: 'mada', receiptNo: 'RCP-YR-2601' }
        ],
        notes: 'تم سداد الدفعة الأولى بنجاح من بطاقة مادية للعميل.'
      },
      {
        id: 'inst-yr-2',
        leaseId: 'lease-3001',
        installmentNumber: 2,
        label: 'الدفعة الثانية - النصف الثاني من الإيجار',
        dueDate: '2026-12-01',
        amount: 42000,
        paidAmount: 0,
        remainingAmount: 42000,
        status: 'not_due_yet',
        payments: [],
        notes: 'الدفعة مستحقة بتاريخ 2026-12-01 بقيمة 42,000 ريال.'
      }
    ]
  }
];

export const initialHousekeepingTasks: HousekeepingTask[] = [
  {
    id: 'hk-101',
    taskNumber: 'HK-26-302',
    unitId: 'unit-n-202',
    propertyId: 'prop-nakheel',
    type: 'turnover',
    priority: 'urgent',
    status: 'in_progress',
    assignedToStaffId: 'staff-clean-1',
    assignedToStaffName: 'مريم الفيلكاوي',
    startedAt: '2026-09-30T10:15:00',
    checklist: [
      { id: 'chk-1', text: 'تغيير بياضات ومفارش غرف النوم بالكامل بأخرى مغسولة ومطهرة', done: true },
      { id: 'chk-2', text: 'تنظيف وتطهير الحمام بالكامل وتلميع البورسلين والمرايا', done: true },
      { id: 'chk-3', text: 'تنظيف المطبخ والثلاجة وركن القهوة والتأكد من توفير الكبسولات الأساسية', done: false },
      { id: 'chk-4', text: 'غسيل وتلميع الأرضيات الخشبية بمواد مخصصة للباركيه لعدم التلف', done: false },
      { id: 'chk-5', text: 'التأكد من تشغيل التكييف ونظافة فلاتر الهواء وسرعة الإنترنت', done: false },
      { id: 'chk-6', text: 'فحص القفل الذكي والتأكد من سلامة كود الدخول والبطاريات', done: false },
    ],
    notes: 'وصول الضيف القادم اليوم الساعة ١٥:٠٠ يرجى تجهيز الجناح بأعلى مستويات الجودة الفندقية.',
    completionPhotos: [],
    createdAt: '2026-09-30T09:00:00',
  }
];

export const initialMaintenanceTasks: MaintenanceTask[] = [
  {
    id: 'maint-3001',
    taskNumber: 'MNT-26-089',
    unitId: 'unit-o-101',
    propertyId: 'prop-olayya',
    category: 'hvac',
    severity: 'moderate',
    title: 'ضعف أداء التكييف المركزي بالصالة والبار',
    description: 'المستأجر السابق أبلغ عن ضعف برودة المكيف، يحتاج لفحص الغاز وفلتر الهواء وتنظيف مجاري الهواء.',
    status: 'in_progress',
    assignedToStaffName: 'المهندس سليم الباكستاني',
    photos: [],
    createdAt: '2026-09-29T07:45:00',
  }
];

export const initialSecurityDeposits: SecurityDepositRecord[] = [
  {
    id: 'dep-101',
    bookingOrLeaseId: 'bk-1001',
    unitId: 'unit-n-102',
    guestName: 'عبد الرحمن الدوسري',
    amount: 800,
    collectedAmount: 0,
    collectionReference: undefined,
    collectionVerifiedAt: undefined,
    heldType: 'authorized_hold',
    status: 'held',
    deductions: [],
    refundAmount: 0,
    refundedAmount: 0,
    deductedAmount: 0,
    rentAppliedAmount: 0,
    createdAt: '2026-09-27T10:05:00',
  },
  {
    id: 'dep-102',
    bookingOrLeaseId: 'lease-2001',
    unitId: 'unit-n-201',
    guestName: 'شركة الأفق المتميزة',
    amount: 10000,
    collectedAmount: 0,
    collectionReference: undefined,
    collectionVerifiedAt: undefined,
    heldType: 'collected_cash_card',
    status: 'held',
    deductions: [],
    refundAmount: 0,
    refundedAmount: 0,
    deductedAmount: 0,
    rentAppliedAmount: 0,
    createdAt: '2026-08-25T14:40:00',
  }
];

export const initialPayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    referenceType: 'booking',
    referenceId: 'bk-1001',
    amount: 3450,
    method: 'mada',
    status: 'success',
    transactionId: 'MADA_AUTH_948102',
    installmentId: undefined,
    sourceType: 'direct_payment',
    affectsCash: true,
    createdAt: '2026-09-27T10:04:30',
    notes: 'سداد حجز الضيف عبد الرحمن الدوسري عبر مدي بوابة الدفع كينت',
  },
  {
    id: 'pay-2',
    referenceType: 'deposit',
    referenceId: 'dep-101',
    amount: 800,
    method: 'visa_mastercard',
    status: 'pending',
    transactionId: 'AUTH_HOLD_771892',
    installmentId: undefined,
    sourceType: 'direct_payment',
    affectsCash: false,
    createdAt: '2026-09-27T10:05:00',
    notes: 'تفويض بطاقة ائتمان كوديعة تأمين محتجزة (غير محصلة نقدياً)',
  },
  {
    id: 'pay-3',
    referenceType: 'lease_installment',
    referenceId: 'lease-2001',
    amount: 28000,
    method: 'bank_transfer',
    status: 'success',
    transactionId: 'SARIE_TRANS_198274',
    installmentId: undefined,
    sourceType: 'direct_payment',
    affectsCash: true,
    createdAt: '2026-08-28T11:00:00',
    notes: 'حوالة مصرفية واردة لحساب منزل الفخامة عبر سريع - دفعة سبتمبر لشركة الأفق',
  }
];

export const initialContentSections: ContentSection[] = [
  {
    id: 'sec-hero',
    sectionKey: 'hero',
    name: 'القسم الترحيبي الرئيسي',
    title: 'اكتشف أرقى مستويات المعيشة الفندقية الفاخرة في قلب الرياض',
    subtitle: 'شقق وأجنحة سكنية مفروشة بالكامل تدمج بسلاسة تامة بين دفء وخصوصية المنزل وخدمات الضيافة الفندقية المتكاملة الراقية، في أكثر الأحياء جاذبية في العاصمة.',
    visible: true,
    order: 1,
    mediaUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=85',
    ctaText: 'استكشف الوحدات السكنية',
    ctaLink: '#units',
    customData: {
      overlayOpacity: 45,
      showVideo: false,
      videoUrl: '',
    }
  },
  {
    id: 'sec-search',
    sectionKey: 'search_bar',
    name: 'شريط البحث المطور الفوري والذكي',
    title: 'البحث عن جناح متاح',
    subtitle: 'اختر التواريخ ونوع الإقامة المناسبة لك لتكتشف الشقق الجاهزة للحجز الفوري',
    visible: true,
    order: 2,
  },
  {
    id: 'sec-buildings',
    sectionKey: 'buildings',
    name: 'أبراج ومباني Luxury home منزل الفخامة الفخمة',
    title: 'وجهاتنا المتميزة والسكن الفاخر المختار',
    subtitle: 'نقدم مجمعاتنا السكنية في أرقى المواقع في مدينة الرياض، مصممة بهندسة معمارية عصرية لضمان أعلى مستويات الرفاهية والهدوء لضيوفنا ومستأجرينا.',
    visible: true,
    order: 3,
  },
  {
    id: 'sec-units',
    sectionKey: 'featured_units',
    name: 'شقق وأجنحة منزل الفخامة الفاخرة المتاحة',
    title: 'شقق سكنية مصممة خصيصاً لذوقك الرفيع',
    subtitle: 'استعرض تشكيلتنا المختارة من الشقق والوحدات المتاحة للإقامة الفندقية اليومية، الشهرية، والسنوية الفاخرة، مع تفاصيل المساحات، الأثاث، والخدمات الشاملة.',
    visible: true,
    order: 4,
  },
  {
    id: 'sec-offers',
    sectionKey: 'offers',
    name: 'العروض والمزايا الحصرية والترقيات',
    title: 'احصل على خصم يصل حتى ٢٠٪ على إقامات الأعمال الطويلة',
    subtitle: 'استمتع بمزايا التسجيل المبكر وعروض رجال الأعمال والشركات، مع تغطية شاملة لكافة الفواتير وخدمات التدبير المنزلي الفندقي الأسبوعي بخصم حصري ومميز.',
    visible: true,
    order: 5,
    mediaUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
    ctaText: 'تواصل مع الكونسيرج الآن',
    ctaLink: '#contact'
  },
  {
    id: 'sec-amenities',
    sectionKey: 'amenities',
    name: 'المرافق والخدمات الفندقية المتكاملة',
    title: 'خدمات استثنائية تفوق التوقعات لضمان راحتك',
    subtitle: 'صممت خدمات منزل الفخامة بعناية فائقة لتغطي كل تفاصيل حياتك اليومية، لتركز فقط على أعمالك واسترخائك بينما نتولى نحن التفاصيل اللوجستية والضيافة بدقة تامة.',
    visible: true,
    order: 6,
  },
  {
    id: 'sec-steps',
    sectionKey: 'steps',
    name: 'رحلة الحجز الميسرة ذات الخطوات الثلاث',
    title: 'خطوات حجز وتأجير فورية ميسرة وآمنة',
    subtitle: 'نفخر بتقديم أول تجربة تعاقد وحجز رقمية بالكامل بدون أوراق في المملكة، لتبدأ إقامتك الفاخرة بدقائق معدودة.',
    visible: true,
    order: 7,
  },
  {
    id: 'sec-faq',
    sectionKey: 'faq',
    name: 'الأسئلة الشائعة والمكررة للضيوف',
    title: 'كل ما تود معرفته عن خدمات منزل الفخامة الفاخرة',
    subtitle: 'إجابات وافية ومفصلة عن أكثر الأسئلة طرحاً من قبل ضيوفنا ومستأجرينا لتجربة إقامة خالية من القلق والارتباك.',
    visible: true,
    order: 8,
  },
  {
    id: 'sec-contact',
    sectionKey: 'contact',
    name: 'قسم التواصل والطلبات وخدمة العملاء',
    title: 'تواصل مباشرة مع فريق الكونسيرج وخدمة الضيوف',
    subtitle: 'هل لديك استفسار مخصص أو رغبة في زيارة خاصة للمباني؟ فريق الكونسيرج متاح على مدار الساعة لتلبية متطلباتك وضمان إجابة وافية لكل رغباتك وتسهيل زيارتك.',
    visible: true,
    order: 9,
  }
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    action: 'إنشاء حجز فوري فندقي',
    entity: 'Booking',
    entityId: 'bk-1001',
    performedBy: 'بوابة الدفع (الضيف عبر الموقع الإلكتروني)',
    role: 'Guest / System',
    details: 'تم حجز شقة ١٠٢ بنجاح وتأكيد المعاملة بعد استلام مبلغ الحجز كاملاً ٣٤٥٠ ريال سعودي من ٢٠٢٦-٠٩-٢٨ إلى ٢٠٢٦-١٠-٠٢.',
    timestamp: '2026-09-27T10:05:00',
  },
  {
    id: 'log-2',
    action: 'توليد الرمز السري للقفل الذكي للضيف',
    entity: 'Booking',
    entityId: 'bk-1001',
    performedBy: 'نظام إدارة المفاتيح الذكية',
    role: 'Guest',
    details: 'تم توليد الرمز السري 829410# بنجاح وصالح للدخول من الساعة ١٥:٠٠ يوم الوصول حتى ١٢:٠٠ يوم المغادرة.',
    timestamp: '2026-09-28T15:10:00',
  },
  {
    id: 'log-3',
    action: 'تكليف مهمة تنظيف دورية (Turnover)',
    entity: 'HousekeepingTask',
    entityId: 'hk-101',
    performedBy: 'الجدولة التلقائية للعمليات التشغيلية',
    role: 'System',
    details: 'تم تعيين مهمة تنظيف وتطهير شقة ٢٠٢ تلقائياً لتوافق موعد خروج النزيل مع وصول الضيف الجديد الساعة ١٥:٠٠ اليوم.',
    timestamp: '2026-09-30T09:00:00',
  }
];

export const initialExpenseCategories: ExpenseCategoryConfig[] = [
  {
    id: 'cat-rent',
    code: 'building_rent',
    nameAr: 'إيجار المباني',
    nameEn: 'Building Rent',
    defaultCostCenterLevel: 'property',
    defaultTemporalDistribution: 'equal_monthly',
    defaultAllocationMethod: 'by_area',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-rent-1', nameAr: 'عقد إيجار العمارة الرئيسي', nameEn: 'Master Building Lease' },
      { id: 'sub-rent-2', nameAr: 'مواقف إضافية مستأجرة', nameEn: 'Leased Extra Parking' },
    ]
  },
  {
    id: 'cat-salaries-admin',
    code: 'admin_salaries',
    nameAr: 'الرواتب الإدارية',
    nameEn: 'Admin Salaries',
    defaultCostCenterLevel: 'company',
    defaultTemporalDistribution: 'equal_monthly',
    defaultAllocationMethod: 'equal_units',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-adm-1', nameAr: 'رواتب الإدارة العامة والتشغيل', nameEn: 'HQ Operations' },
      { id: 'sub-adm-2', nameAr: 'مكافآت وإكراميات أداء', nameEn: 'Bonuses' },
    ]
  },
  {
    id: 'cat-salaries-staff',
    code: 'building_staff_salaries',
    nameAr: 'رواتب موظفي المباني والحراس',
    nameEn: 'Building Staff & Security',
    defaultCostCenterLevel: 'property',
    defaultTemporalDistribution: 'equal_monthly',
    defaultAllocationMethod: 'equal_units',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-stf-1', nameAr: 'حراس الأمن والسلامة', nameEn: 'Security Guards' },
      { id: 'sub-stf-2', nameAr: 'موظفي الاستقبال والكونسيرج', nameEn: 'Reception Staff' },
      { id: 'sub-stf-3', nameAr: 'عمال النظافة المقيمين', nameEn: 'Resident Cleaners' },
    ]
  },
  {
    id: 'cat-marketing',
    code: 'marketing_advertising',
    nameAr: 'الدعاية والتسويق',
    nameEn: 'Marketing & Advertising',
    defaultCostCenterLevel: 'company',
    defaultTemporalDistribution: 'instant',
    defaultAllocationMethod: 'by_revenue',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-mkt-1', nameAr: 'إعلانات جوجل ومواقع التواصل', nameEn: 'Digital Ads' },
      { id: 'sub-mkt-2', nameAr: 'تصوير فوتوغرافي وفيديو 3D', nameEn: 'Media Production' },
      { id: 'sub-mkt-3', nameAr: 'مطبوعات وهدايا ترحيبية', nameEn: 'Welcome Kits' },
    ]
  },
  {
    id: 'cat-electricity',
    code: 'electricity',
    nameAr: 'الكهرباء',
    nameEn: 'Electricity',
    defaultCostCenterLevel: 'property',
    defaultTemporalDistribution: 'actual_days',
    defaultAllocationMethod: 'by_area',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-elec-1', nameAr: 'عداد الخدمات المشتركة والمصاعد', nameEn: 'Common Area Meter' },
      { id: 'sub-elec-2', nameAr: 'عدادات الشقق المجمعة', nameEn: 'Apartment Meters' },
    ]
  },
  {
    id: 'cat-water',
    code: 'water',
    nameAr: 'المياه والصرف',
    nameEn: 'Water & Sewage',
    defaultCostCenterLevel: 'property',
    defaultTemporalDistribution: 'actual_days',
    defaultAllocationMethod: 'by_area',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-wtr-1', nameAr: 'فاتورة شركة المياه الوطنية', nameEn: 'NWC Bill' },
      { id: 'sub-wtr-2', nameAr: 'صهاريج مياه طارئة', nameEn: 'Water Tankers' },
    ]
  },
  {
    id: 'cat-internet',
    code: 'internet',
    nameAr: 'الإنترنت والاتصالات',
    nameEn: 'Internet & Telecom',
    defaultCostCenterLevel: 'property',
    defaultTemporalDistribution: 'equal_monthly',
    defaultAllocationMethod: 'equal_units',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-net-1', nameAr: 'اشتراك فايبر ألياف بصرية', nameEn: 'Fiber Subscription' },
      { id: 'sub-net-2', nameAr: 'راوترات ومقويات إشارة', nameEn: 'Routers & Extenders' },
    ]
  },
  {
    id: 'cat-cleaning',
    code: 'cleaning_supplies',
    nameAr: 'النظافة والمستلزمات',
    nameEn: 'Cleaning & Consumables',
    defaultCostCenterLevel: 'property',
    defaultTemporalDistribution: 'instant',
    defaultAllocationMethod: 'equal_units',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-cln-1', nameAr: 'منظفات ومطهرات فندقية', nameEn: 'Cleaning Agents' },
      { id: 'sub-cln-2', nameAr: 'مستلزمات الضيافة (شاي، قهوة، ماء)', nameEn: 'Hospitality Amenities' },
      { id: 'sub-cln-3', nameAr: 'غسيل وكوي الشراشف والبياضات', nameEn: 'Linen Laundry' },
    ]
  },
  {
    id: 'cat-building-maint',
    code: 'building_common_maintenance',
    nameAr: 'صيانة المباني والمرافق المشتركة',
    nameEn: 'Building & Common Maintenance',
    defaultCostCenterLevel: 'property',
    defaultTemporalDistribution: 'instant',
    defaultAllocationMethod: 'by_area',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-bmnt-1', nameAr: 'صيانة وقائية للمصاعد', nameEn: 'Elevator Maintenance' },
      { id: 'sub-bmnt-2', nameAr: 'صيانة خزان المياه والمضخات', nameEn: 'Water Tank & Pumps' },
      { id: 'sub-bmnt-3', nameAr: 'كاميرات المراقبة والأبواب الإلكترونية', nameEn: 'CCTV & Access Gates' },
    ]
  },
  {
    id: 'cat-unit-appliances',
    code: 'unit_appliances_maintenance',
    nameAr: 'صيانة أجهزة الوحدات',
    nameEn: 'Unit Appliances Maintenance',
    defaultCostCenterLevel: 'unit',
    defaultTemporalDistribution: 'instant',
    defaultAllocationMethod: 'direct_unit',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-umnt-1', nameAr: 'صيانة وغسيل المكيفات', nameEn: 'HVAC Servicing' },
      { id: 'sub-umnt-2', nameAr: 'صيانة الثلاجات والغسالات', nameEn: 'Kitchen Appliances' },
      { id: 'sub-umnt-3', nameAr: 'صيانة القفل الذكي والإنتركوم', nameEn: 'Smart Locks' },
    ]
  },
  {
    id: 'cat-gov-fees',
    code: 'government_fees_licenses',
    nameAr: 'الرسوم الحكومية والرخص',
    nameEn: 'Gov Fees & Licenses',
    defaultCostCenterLevel: 'company',
    defaultTemporalDistribution: 'equal_monthly',
    defaultAllocationMethod: 'by_area',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-gov-1', nameAr: 'رخصة البلدية والدفاع المدني', nameEn: 'Civil Defense & Municipality' },
      { id: 'sub-gov-2', nameAr: 'اشتراك الغرفة التجارية والسجل', nameEn: 'Commercial Register & Chamber' },
    ]
  },
  {
    id: 'cat-payment-fees',
    code: 'payment_fees_commissions',
    nameAr: 'رسوم الدفع والعمولات',
    nameEn: 'Payment Gateway & Bank Fees',
    defaultCostCenterLevel: 'company',
    defaultTemporalDistribution: 'instant',
    defaultAllocationMethod: 'by_revenue',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-pay-1', nameAr: 'عمولات بوابات الدفع الإلكترونية', nameEn: 'Payment Gateway Fees' },
      { id: 'sub-pay-2', nameAr: 'رسوم أجهزة نقاط البيع POS', nameEn: 'POS Terminal Fees' },
    ]
  },
  {
    id: 'cat-furniture-ffe',
    code: 'furniture_appliances',
    nameAr: 'شراء الأثاث والأجهزة (رأسمالي FF&E)',
    nameEn: 'Furniture & Appliances (Capital FF&E)',
    defaultCostCenterLevel: 'unit',
    defaultTemporalDistribution: 'instant',
    defaultAllocationMethod: 'direct_unit',
    isCapitalFfe: true,
    isArchived: false,
    subcategories: [
      { id: 'sub-ffe-1', nameAr: 'أجهزة ذكية وتلفزيونات', nameEn: 'Smart TVs & Electronics' },
      { id: 'sub-ffe-2', nameAr: 'أثاث غرف نوم وغرف جلوس', nameEn: 'Living & Bedroom Furniture' },
      { id: 'sub-ffe-3', nameAr: 'أطقم أواني ومستلزمات مطبخ', nameEn: 'Kitchenware' },
    ]
  },
  {
    id: 'cat-other',
    code: 'operations_other',
    nameAr: 'مصاريف أخرى ونثريات',
    nameEn: 'Other Operational Expenses',
    defaultCostCenterLevel: 'property',
    defaultTemporalDistribution: 'instant',
    defaultAllocationMethod: 'equal_units',
    isCapitalFfe: false,
    isArchived: false,
    subcategories: [
      { id: 'sub-oth-1', nameAr: 'نثريات تشغيلية وطارئة', nameEn: 'Petty Cash Sundries' }
    ]
  }
];

export const initialRecurringExpenses: RecurringExpenseSchedule[] = [
  {
    id: 'rec-01',
    name: 'إيجار مبنى مجمع النخيل السنوي',
    category: 'building_rent',
    subcategoryId: 'sub-rent-1',
    description: 'عقد استئجار عمارة النخيل السنوي بقيمة ١٢٠,٠٠٠ ريال يغطي سنة كاملة مقسمة شهرياً بالتساوي وموزعة بمساحة الشقق',
    amount: 120000,
    isFfeOrEquipment: false,
    costCenterLevel: 'property',
    propertyId: 'prop-nakheel',
    vendorOrBeneficiary: 'مجموعة المالك العقارية',
    frequency: 'yearly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    temporalDistribution: 'equal_monthly',
    costAllocationMethod: 'by_area',
    isActive: true,
    lastGeneratedPeriod: '2026-09',
    createdAt: '2026-01-01T09:00:00'
  },
  {
    id: 'rec-02',
    name: 'راتب حارس ومسؤول أمن برج النخيل',
    category: 'building_staff_salaries',
    subcategoryId: 'sub-stf-1',
    description: 'مستحقات راتب الحراسة والأمن الميداني لبرج النخيل',
    amount: 4000,
    isFfeOrEquipment: false,
    costCenterLevel: 'property',
    propertyId: 'prop-nakheel',
    vendorOrBeneficiary: 'شركة الحراسات الأمنية الأولى',
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    temporalDistribution: 'equal_monthly',
    costAllocationMethod: 'equal_units',
    isActive: true,
    lastGeneratedPeriod: '2026-09',
    createdAt: '2026-01-01T09:00:00'
  },
  {
    id: 'rec-03',
    name: 'إنترنت وألياف بصرية مشتركة لبرج العليا',
    category: 'internet',
    subcategoryId: 'sub-net-1',
    description: 'اشتراك إنترنت فايبر مخصص لخدمة الضيوف وأنظمة الأقفال الذكية بالعليا',
    amount: 650,
    isFfeOrEquipment: false,
    costCenterLevel: 'property',
    propertyId: 'prop-olayya',
    vendorOrBeneficiary: 'شركة الاتصالات السعودية (STC أعمال)',
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    temporalDistribution: 'equal_monthly',
    costAllocationMethod: 'equal_units',
    isActive: true,
    lastGeneratedPeriod: '2026-09',
    createdAt: '2026-01-01T09:00:00'
  },
  {
    id: 'rec-04',
    name: 'رواتب الإدارة العامة والتسويق المركزي',
    category: 'admin_salaries',
    subcategoryId: 'sub-adm-1',
    description: 'رواتب الفريق الإداري والمالي المركزي لLuxury home منزل الفخامة',
    amount: 15000,
    isFfeOrEquipment: false,
    costCenterLevel: 'company',
    vendorOrBeneficiary: 'طاقم الإدارة والمالية',
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    temporalDistribution: 'equal_monthly',
    costAllocationMethod: 'equal_units',
    isActive: true,
    lastGeneratedPeriod: '2026-09',
    createdAt: '2026-01-01T09:00:00'
  }
];

export const initialExpenses: OperationalExpense[] = [
  // 1. Annual Building Rent: 120,000 SAR paid upfront covering whole year 2026!
  // Demonstrates decoupling: 120,000 in payment register, but 10,000/mo in NOI accrual!
  {
    id: 'exp-100',
    expenseNumber: 'EXP-2026-000',
    date: '2026-01-02',
    servicePeriodStart: '2026-01-01',
    servicePeriodEnd: '2026-12-31',
    category: 'building_rent',
    subcategoryId: 'sub-rent-1',
    subcategoryName: 'عقد إيجار العمارة الرئيسي',
    description: 'إيجار عمارة برج النخيل السنوي بالكامل لعام ٢٠٢٦ (سُدد مقدماً دفعة واحدة ويوزع شهرياً بحسب مساحة الوحدات)',
    amount: 120000,
    paidAmount: 120000,
    isFfeOrEquipment: false,
    level: 'property',
    propertyId: 'prop-nakheel',
    vendorOrBeneficiary: 'مجموعة المالك العقارية للاستثمار',
    invoiceDocNumber: 'LEASE-NKH-2026',
    invoiceDocUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    paymentStatus: 'paid',
    paymentMethod: 'bank_transfer',
    distributionType: 'by_area',
    temporalDistribution: 'equal_monthly',
    costAllocationMethod: 'by_area',
    recordStatus: 'approved',
    paymentsList: [
      {
        id: 'pay-exp-100',
        paymentDate: '2026-01-02',
        amount: 120000,
        paymentMethod: 'bank_transfer',
        receiptReference: 'BANK-TRF-00192',
        recordedBy: 'سعد القحطاني (مدير الإدارة المالية)',
        createdAt: '2026-01-02T10:00:00'
      }
    ],
    distributionShares: [
      { unitId: 'unit-n-101', unitNumber: '101', amount: 30000, percentage: 25 },
      { unitId: 'unit-n-102', unitNumber: '102', amount: 22500, percentage: 18.75 },
      { unitId: 'unit-n-201', unitNumber: '201', amount: 37500, percentage: 31.25 },
      { unitId: 'unit-n-202', unitNumber: '202', amount: 30000, percentage: 25 },
    ],
    notes: 'تم سداد كامل الإيجار بموجب حوالة بنكية من حساب الشركة بالبنك الأهلي. التكلفة الشهرية المحملة ١٠,٠٠٠ ريال.',
    createdAt: '2026-01-02T10:00:00',
    createdBy: 'سعد القحطاني (مدير الإدارة المالية)',
  },
  {
    id: 'exp-101',
    expenseNumber: 'EXP-2026-001',
    date: '2026-09-05',
    servicePeriodStart: '2026-09-01',
    servicePeriodEnd: '2026-09-30',
    category: 'electricity',
    subcategoryId: 'sub-elec-1',
    subcategoryName: 'عداد الخدمات المشتركة والمصاعد',
    description: 'فواتير استهلاك الكهرباء والماء ومزود الإنترنت للبرج والبهو لشهر سبتمبر',
    amount: 3200,
    paidAmount: 3200,
    isFfeOrEquipment: false,
    level: 'property',
    propertyId: 'prop-nakheel',
    vendorOrBeneficiary: 'الشركة السعودية للكهرباء + STC أعمال',
    invoiceDocNumber: 'INV-SEC-89210',
    invoiceDocUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    paymentStatus: 'paid',
    paymentMethod: 'bank_transfer',
    distributionType: 'by_area',
    temporalDistribution: 'actual_days',
    costAllocationMethod: 'by_area',
    recordStatus: 'approved',
    paymentsList: [
      {
        id: 'pay-exp-101',
        paymentDate: '2026-09-05',
        amount: 3200,
        paymentMethod: 'bank_transfer',
        receiptReference: 'SADAD-99120',
        recordedBy: 'عبد المحسن السهلي (المحاسب المالي)',
        createdAt: '2026-09-05T10:00:00'
      }
    ],
    distributionShares: [
      { unitId: 'unit-n-101', unitNumber: '101', amount: 800, percentage: 25 },
      { unitId: 'unit-n-102', unitNumber: '102', amount: 600, percentage: 18.75 },
      { unitId: 'unit-n-201', unitNumber: '201', amount: 1000, percentage: 31.25 },
      { unitId: 'unit-n-202', unitNumber: '202', amount: 800, percentage: 25 },
    ],
    createdAt: '2026-09-05T10:00:00',
    createdBy: 'عبد المحسن السهلي (المحاسب المالي)',
  },
  {
    id: 'exp-102',
    expenseNumber: 'EXP-2026-002',
    date: '2026-09-12',
    servicePeriodStart: '2026-09-01',
    servicePeriodEnd: '2026-09-30',
    category: 'building_common_maintenance',
    subcategoryId: 'sub-bmnt-1',
    subcategoryName: 'صيانة وقائية للمصاعد',
    description: 'أعمال الصيانة الوقائية السنوية للمصاعد والمولد الاحتياطي',
    amount: 4500,
    paidAmount: 4500,
    isFfeOrEquipment: false,
    level: 'property',
    propertyId: 'prop-nakheel',
    vendorOrBeneficiary: 'مؤسسة أوتيس للمصاعد المحدودة',
    invoiceDocNumber: 'OTIS-MNT-9912',
    paymentStatus: 'paid',
    paymentMethod: 'bank_transfer',
    distributionType: 'equal',
    temporalDistribution: 'instant',
    costAllocationMethod: 'equal_units',
    recordStatus: 'approved',
    paymentsList: [
      {
        id: 'pay-exp-102',
        paymentDate: '2026-09-12',
        amount: 4500,
        paymentMethod: 'bank_transfer',
        receiptReference: 'BANK-CHQ-4401',
        recordedBy: 'عبد المحسن السهلي (المحاسب المالي)',
        createdAt: '2026-09-12T14:30:00'
      }
    ],
    distributionShares: [
      { unitId: 'unit-n-101', unitNumber: '101', amount: 1125 },
      { unitId: 'unit-n-102', unitNumber: '102', amount: 1125 },
      { unitId: 'unit-n-201', unitNumber: '201', amount: 1125 },
      { unitId: 'unit-n-202', unitNumber: '202', amount: 1125 },
    ],
    createdAt: '2026-09-12T14:30:00',
    createdBy: 'عبد المحسن السهلي (المحاسب المالي)',
  },
  {
    id: 'exp-103',
    expenseNumber: 'EXP-2026-003',
    date: '2026-09-20',
    servicePeriodStart: '2026-09-20',
    servicePeriodEnd: '2026-09-20',
    category: 'cleaning_supplies',
    subcategoryId: 'sub-cln-1',
    subcategoryName: 'منظفات ومطهرات فندقية',
    description: 'شراء مواد ومطهرات وعطور غسيل فندقية مستدامة ومعتمدة لخدمة الكونسيرج النظافة',
    amount: 850,
    paidAmount: 850,
    isFfeOrEquipment: false,
    level: 'property',
    propertyId: 'prop-olayya',
    vendorOrBeneficiary: 'مؤسسة ضيافتنا للتجهيز',
    invoiceDocNumber: 'HOSP-SUP-221',
    paymentStatus: 'paid',
    paymentMethod: 'company_card',
    distributionType: 'equal',
    temporalDistribution: 'instant',
    costAllocationMethod: 'equal_units',
    recordStatus: 'approved',
    paymentsList: [
      {
        id: 'pay-exp-103',
        paymentDate: '2026-09-20',
        amount: 850,
        paymentMethod: 'company_card',
        receiptReference: 'CARD-VISA-9921',
        recordedBy: 'سعد جابر (المنسق التشغيلي للعليا)',
        createdAt: '2026-09-20T09:15:00'
      }
    ],
    createdAt: '2026-09-20T09:15:00',
    createdBy: 'سعد جابر (المنسق التشغيلي للعليا)',
  },
  {
    id: 'exp-104',
    expenseNumber: 'EXP-2026-004',
    date: '2026-09-22',
    category: 'furniture_appliances',
    subcategoryId: 'sub-ffe-1',
    subcategoryName: 'أجهزة ذكية وتلفزيونات',
    description: 'تجهيز الشقة العليا ١٠١ بتلفزيون ذكي مقاس ٦٥ بوصة أموليد بديل للمكسور (مشتريات رأس مالية FF&E)',
    amount: 4200,
    paidAmount: 4200,
    isFfeOrEquipment: true, // رأس مالي FF&E - مستثنى من OPEX والتشغيلي المباشر
    level: 'unit',
    propertyId: 'prop-olayya',
    unitId: 'unit-o-101',
    vendorOrBeneficiary: 'شركة المنيع للأجهزة الكهربائية والمنزلية',
    invoiceDocNumber: 'MAN-INV-7719',
    paymentStatus: 'paid',
    paymentMethod: 'company_card',
    distributionType: 'none',
    temporalDistribution: 'instant',
    costAllocationMethod: 'direct_unit',
    recordStatus: 'approved',
    paymentsList: [
      {
        id: 'pay-exp-104',
        paymentDate: '2026-09-22',
        amount: 4200,
        paymentMethod: 'company_card',
        receiptReference: 'CARD-MAN-8821',
        recordedBy: 'أحمد المفلح (مدير العمليات)',
        createdAt: '2026-09-22T11:45:00'
      }
    ],
    createdAt: '2026-09-22T11:45:00',
    createdBy: 'أحمد المفلح (مدير العمليات)',
  },
  {
    id: 'exp-105',
    expenseNumber: 'EXP-2026-005',
    date: '2026-09-25',
    servicePeriodStart: '2026-09-01',
    servicePeriodEnd: '2026-09-30',
    category: 'payment_fees_commissions',
    subcategoryId: 'sub-pay-1',
    subcategoryName: 'عمولات بوابات الدفع الإلكترونية',
    description: 'عمولات بوابة الدفع وسداد للعمليات الرقمية والمالية لشهر سبتمبر',
    amount: 620,
    paidAmount: 620,
    isFfeOrEquipment: false,
    level: 'company',
    vendorOrBeneficiary: 'بوابة الدفع الإلكتروني ميسر بيمنت',
    invoiceDocNumber: 'PG-FEE-SEP26',
    paymentStatus: 'paid',
    paymentMethod: 'bank_transfer',
    distributionType: 'equal',
    temporalDistribution: 'instant',
    costAllocationMethod: 'by_revenue',
    recordStatus: 'approved',
    paymentsList: [
      {
        id: 'pay-exp-105',
        paymentDate: '2026-09-25',
        amount: 620,
        paymentMethod: 'bank_transfer',
        receiptReference: 'GATEWAY-FEE-991',
        recordedBy: 'عبد المحسن السهلي (المحاسب المالي)',
        createdAt: '2026-09-25T16:00:00'
      }
    ],
    createdAt: '2026-09-25T16:00:00',
    createdBy: 'عبد المحسن السهلي (المحاسب المالي)',
  },
  {
    id: 'exp-106',
    expenseNumber: 'EXP-2026-006',
    date: '2026-09-28',
    servicePeriodStart: '2026-09-28',
    servicePeriodEnd: '2026-09-28',
    category: 'unit_appliances_maintenance',
    subcategoryId: 'sub-umnt-1',
    subcategoryName: 'صيانة وغسيل المكيفات',
    description: 'صيانة وتنظيف مكيف كونسيلد وتغيير الثيرموستات للشقة ٢٠١ ببرج النخيل',
    amount: 450,
    paidAmount: 450,
    isFfeOrEquipment: false,
    level: 'unit',
    propertyId: 'prop-nakheel',
    unitId: 'unit-n-201',
    vendorOrBeneficiary: 'شركة تبريد الرواد للتكييف',
    invoiceDocNumber: 'AC-SRV-201-9',
    paymentStatus: 'paid',
    paymentMethod: 'company_card',
    distributionType: 'none',
    temporalDistribution: 'instant',
    costAllocationMethod: 'direct_unit',
    recordStatus: 'approved',
    paymentsList: [
      {
        id: 'pay-exp-106',
        paymentDate: '2026-09-28',
        amount: 450,
        paymentMethod: 'company_card',
        receiptReference: 'CARD-POS-3312',
        recordedBy: 'أحمد المفلح (مدير العمليات)',
        createdAt: '2026-09-28T14:00:00'
      }
    ],
    createdAt: '2026-09-28T14:00:00',
    createdBy: 'أحمد المفلح (مدير العمليات)',
  }
];

export const initialAdjustments: TenantAdjustment[] = [
  {
    id: 'adj-1',
    tenantNationalId: '7009823412',
    leaseId: 'lease-2001',
    type: 'discount',
    amount: 1000,
    reason: 'خصم ترحيبي خاص ببداية تعاقد شركة الأفق لإيجار الوحدة ٢٠١ وتأخر التسليم يوم واحد',
    authorizedBy: 'سعد القحطاني (مدير الإدارة المالية والتحصيل)',
    appliedToInstallmentId: 'inst-1',
    createdAt: '2026-08-28T10:00:00',
  }
];
