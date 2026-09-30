# 🚀 دليل التثبيت والتشغيل والنشر المستقل (Standalone Deployment Guide)
**نظام منصة إدارة العقارات والتأجير والمالية (Ivoire Platform)**

يقدم هذا الدليل خطوة بخطوة طريقة نشر وتشغيل المنصة على خادم مستقل (VPS / Dedicated Server / Cloud Instance) خارج بيئة تطوير Google AI Studio، باستخدام **Docker Compose** و **PostgreSQL 16** و **Nginx**.

---

## 📋 المتطلبات الأساسية للخادم (Prerequisites)

1. **نظام التشغيل:** Ubuntu 22.04 LTS أو Alpine Linux أو Debian 12.
2. **الحد الأدنى للمواصفات:**
   - 2 CPU Cores
   - 4 GB RAM
   - 40 GB SSD Storage (تزداد حسب حجم المرفقات والوسائط)
3. **البرامج المثبتة:**
   - Docker v24.0+
   - Docker Compose v2.20+
   - Git & Curl

---

## 🛠️ خطوات التشغيل من نسخة نظيفة (Clean Slate Installation)

### الخطوة 1: جلب المستودع (Clone Repository)
```bash
git clone https://github.com/your-org/ivoire-property-platform.git
cd ivoire-property-platform
```

### الخطوة 2: إعداد متغيرات البيئة (Environment Setup)
```bash
cp .env.example .env
nano .env
```
قم بتعديل قيم `.env` كالتالي:
- `JWT_SECRET`: مفتاح تشفير عشوائي آمن بطول 32 حرف على الأقل.
- `DATABASE_URL`: رابط الاتصال بالحاوية `postgresql://ivoire_user:IvoireSecurePass2026@postgres:5432/ivoire_db?schema=public`
- `APP_DOMAIN`: نطاق خادمك (مثال: `https://property.example.com`)

### الخطوة 3: بناء وتشغيل الحاويات (Build & Launch Stack)
```bash
docker-compose up -d --build
```

### الخطوة 4: التحقق من صحة تشغيل الخدمات (Health Check Verification)
```bash
# فحص حالة الحاويات
docker-compose ps

# فحص خادم API
curl http://localhost:3000/api/health
```
ستظهر الاستجابة:
```json
{
  "status": "healthy",
  "timestamp": "2026-09-30T10:00:00.000Z",
  "version": "1.0.0",
  "database": "persistent_file",
  "environment": "production"
}
```

---

## 🔌 المنافذ المستخدمة (Exposed Ports)

- **Port 80 (HTTP):** مدخل Nginx العام للتوجيه التلقائي وطلبات الشهادات.
- **Port 443 (HTTPS):** مدخل Nginx المشفر للواجهات العامة ولوحة التحكم والـ API.
- **Port 3000 (Internal API & App):** خادم Node.js الداخلي (محمي داخل شبكة Docker).
- **Port 5432 (Internal PostgreSQL):** قاعدة البيانات (محمية داخلياً).
- **Port 6379 (Internal Redis):** خادم الكاش والمهام الخلفية.

---

## 🔄 أمر إعادة التشغيل الآمن (Safe Restart)
```bash
docker-compose restart app
```
جميع البيانات المخزنة والملفات لن تضيع إطلاقاً نظراً لربطها بـ Persistent Docker Volumes (`postgres_data`, `app_uploads`, `app_data`).
