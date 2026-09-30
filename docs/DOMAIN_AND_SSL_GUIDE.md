# 🌐 دليل ربط النطاق الخاص وتفعيل الاتصال الآمن (Domain & SSL Guide)

يشرح هذا الدليل كيفية ربط النطاق الخاص بك (Domain) بالمنصة، وإصدار شهادة أمان مجانية ومعتمدة **Let's Encrypt SSL (HTTPS)**، وتضبط إعدادات التوجيه والجلسات.

---

## 📍 أولاً: ضبط سجلات النطاق (DNS Records)

قم بالتسجيل في لوحة تحكم مزود النطاق الخاص بك (مثل GoDaddy, Cloudflare, Namecheap) وأضف السجلات التالية مشيرة لعنوان IP الخادم الخاص بك:

| نوع السجل (Type) | الاسم (Host) | القيمة (Value / Target) | ملاحظات |
| :--- | :--- | :--- | :--- |
| **A Record** | `@` | `192.0.2.1` *(عنوان IP خادامك)* | النطاق الرئيسي |
| **A Record** | `www` | `192.0.2.1` *(عنوان IP خادمك)* | الفرعي |
| **CNAME** | `api` | `your-domain.com` | خيار توجيه API بديل |

---

## 🔒 ثانياً: إصدار شهادة الأمان HTTPS SSL via Certbot

1. قم بتثبيت Certbot على الخادم:
```bash
sudo apt-get update
sudo apt-get install -y certbot
```

2. إصدار الشهادة والنطاق يعمل على الخادم:
```bash
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com
```

3. ربط ملفات الشهادات بمسار Nginx المشفر:
سيتم حفظ الشهادات في المسار:
`/etc/letsencrypt/live/your-domain.com/fullchain.pem`
`/etc/letsencrypt/live/your-domain.com/privkey.pem`

4. تفعيل التجديد التلقائي للشهادة (Auto Renewal):
```bash
sudo certbot renew --dry-run
```

---

## ⚙️ ثالثاً: إعداد الكوكيز والجلسات والـ CORS للإنتاج

عند التشغيل على النطاق المشفر HTTPS:
- يتم تلقائياً تفعيل خاصية `SameSite=Strict` و `Secure=true` للكوكيز والجلسات.
- يتم حصر طلبات الـ API والمقبولة عبر `CORS` بالنطاق المعين في `.env`:
  `APP_DOMAIN=https://your-domain.com`

---

## 📲 رابعاً: تحديث الروابط في الخدمات الخارجية

بعد ربط النطاق وتفعيل HTTPS، قم بتحديث الروابط التالية لدى مزودي الخدمات:
1. **بوابة الدفع (Moyasar / Mada):** تحديث رابط العودة والتأكيد (Webhook URL): `https://your-domain.com/api/payments/webhook`
2. **بوابة الرسائل (Taqnyat / Twilio):** تحديث عنوان المرسل المعتمد المكتوب في الرسائل النصية.
3. **روابط استعادة كلمة المرور وإشعارات البريد:** التأكد من اعتماد `APP_DOMAIN` المقترن بالشهادة المشفرة.
