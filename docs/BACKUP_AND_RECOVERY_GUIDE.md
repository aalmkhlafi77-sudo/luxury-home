# 📦 دليل النسخ الاحتياطي والاستعادة والتحديث والرجوع الآمن (Backup & Recovery Guide)

يشرح هذا الدليل كيفية أخذ نسخ احتياطية تلقائية ودورية لقاعدة البيانات والمستندات، وكيفية استعادتها في حالات الطوارئ، وخطة التحديثات والرجوع الآمن (Rollback).

---

## 💾 أولاً: أخذ نسخة احتياطية (Automated Backup)

### 1. النسخ الاحتياطي لقاعدة البيانات PostgreSQL
```bash
# إنشاء المجلد
mkdir -p /backups/postgres

# أمر أخذ النسخة الاحتياطية المباشرة
docker exec ivoire_platform_postgres pg_dump -U ivoire_user ivoire_db | gzip > /backups/postgres/ivoire_db_$(date +%Y%m%m_%H%M%S).sql.gz
```

### 2. النسخ الاحتياطي لملفات الوسائط والمستندات
```bash
mkdir -p /backups/uploads
tar -czvf /backups/uploads/uploads_$(date +%Y%m%d_%H%M%S).tar.gz /var/lib/docker/volumes/ivoire_platform_app_uploads/_data
```

### 3. جدولة النسخ الاحتياطي التلقائي (CronJob)
قم بإضافة السطر التالي في `crontab -e` لأخذ نسخة احتياطية يومية الساعة 2:00 صباحاً:
```cron
0 2 * * * /bin/bash -c "docker exec ivoire_platform_postgres pg_dump -U ivoire_user ivoire_db | gzip > /backups/postgres/db_\$(date +\%Y\%m\%d).sql.gz"
```

---

## ♻️ ثانياً: استعادة البيانات (Disaster Recovery & Restore)

في حال حدوث خلل طارئ أو الرغبة في النقل لخادم جديد:

1. **فك ضغط واستعادة قاعدة البيانات:**
```bash
gunzip -c /backups/postgres/ivoire_db_20260930_100000.sql.gz | docker exec -i ivoire_platform_postgres psql -U ivoire_user -d ivoire_db
```

2. **استعادة ملفات الوسائط:**
```bash
tar -xzvf /backups/uploads/uploads_20260930_100000.tar.gz -C /var/lib/docker/volumes/ivoire_platform_app_uploads/_data
```

---

## 🔄 ثالثاً: خطة التحديث والرجوع الآمن (Update & Rollback Plan)

عند الرغبة في نشر إغدار جديد من التطبيق:

1. **خطوات التحديث الآمن:**
   - أخذ نسخة احتياطية فورية لقاعدة البيانات والوسائط.
   - جلب النسخة الجديدة من الكود (`git pull`).
   - إعادة بناء الحاوية دون إيقاف قاعدة البيانات: `docker-compose up -d --build app`
   - إجراء ترحيلات قاعدة البيانات إن وجدت: `docker exec -it ivoire_platform_app npx prisma db push`

2. **خطة الرجوع الآمن عند الفشل (Rollback):**
   - في حال حدوث خطأ غير متوقع، استرجع النسخة السابقة من صورت الحاوية أو التاج السلس:
   ```bash
   git checkout tags/v1.0.0
   docker-compose up -d --build app
   ```
   - استعد النسخة الاحتياطية لقاعدة البيانات التي تم أخذها قبل بدء التحديث مباشرة.
