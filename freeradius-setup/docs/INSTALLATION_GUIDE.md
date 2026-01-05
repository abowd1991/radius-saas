# دليل تثبيت FreeRADIUS الشامل
## RADIUS SaaS Platform - Complete Installation Guide

---

## نظرة عامة

هذا الدليل يشرح كيفية تثبيت وتكوين خادم FreeRADIUS للعمل مع منصة RADIUS SaaS. بعد اتباع هذه الخطوات، سيكون لديك نظام RADIUS كامل يدعم المصادقة (Authentication) والمحاسبة (Accounting) مع إمكانية الربط بأجهزة MikroTik.

---

## المتطلبات الأساسية

### متطلبات الخادم

| المتطلب | الحد الأدنى | الموصى به |
|---------|-------------|-----------|
| نظام التشغيل | Ubuntu 20.04 / Debian 11 | Ubuntu 22.04 / Debian 12 |
| المعالج | 1 Core | 2+ Cores |
| الذاكرة | 1 GB RAM | 2+ GB RAM |
| التخزين | 10 GB | 20+ GB |
| الشبكة | IP عام أو VPN | IP عام ثابت |

### المنافذ المطلوبة

| المنفذ | البروتوكول | الوظيفة |
|--------|-----------|---------|
| 1812 | UDP | RADIUS Authentication |
| 1813 | UDP | RADIUS Accounting |
| 3799 | UDP | RADIUS CoA/Disconnect |
| 1723 | TCP | PPTP VPN (اختياري) |
| 22 | TCP | SSH للإدارة |

---

## الخطوة 1: تحضير الخادم

### 1.1 تحديث النظام

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 تثبيت الأدوات الأساسية

```bash
sudo apt install -y wget curl git nano
```

### 1.3 نقل ملفات التثبيت للخادم

يمكنك نقل الملفات بإحدى الطرق التالية:

**الطريقة 1: باستخدام SCP**
```bash
scp -r freeradius-setup/ user@your-server:/home/user/
```

**الطريقة 2: باستخدام Git**
```bash
# على الخادم
git clone https://github.com/your-repo/radius-setup.git
```

**الطريقة 3: نسخ المحتوى يدوياً**
```bash
# إنشاء المجلدات
mkdir -p ~/freeradius-setup/{scripts,configs,docs}

# نسخ محتوى كل ملف
nano ~/freeradius-setup/scripts/install-freeradius.sh
# الصق محتوى السكربت
```

---

## الخطوة 2: تكوين السكربت

### 2.1 تعديل بيانات قاعدة البيانات

افتح ملف السكربت وعدّل القيم التالية:

```bash
nano ~/freeradius-setup/scripts/install-freeradius.sh
```

ابحث عن قسم التكوين وعدّل القيم:

```bash
# Database Configuration
DB_HOST="gateway01.us-east-1.prod.aws.tidbcloud.com"  # عنوان قاعدة البيانات
DB_PORT="4000"                                         # منفذ قاعدة البيانات
DB_NAME="radius_saas"                                  # اسم قاعدة البيانات
DB_USER="your_username"                                # اسم المستخدم
DB_PASS="your_password"                                # كلمة المرور
DB_SSL="true"                                          # تفعيل SSL

# RADIUS Configuration
RADIUS_SECRET="your_strong_secret"                     # السر المشترك مع MikroTik
```

> **ملاحظة هامة**: يمكنك الحصول على بيانات قاعدة البيانات من لوحة تحكم Manus في قسم Database Settings.

### 2.2 الحصول على بيانات قاعدة البيانات

1. افتح لوحة تحكم Manus
2. اذهب إلى **Database** في القائمة الجانبية
3. انقر على **Connection Info** في أسفل الصفحة
4. انسخ البيانات التالية:
   - Host
   - Port
   - Database Name
   - Username
   - Password

---

## الخطوة 3: تشغيل التثبيت

### 3.1 منح صلاحيات التنفيذ

```bash
chmod +x ~/freeradius-setup/scripts/install-freeradius.sh
```

### 3.2 تشغيل السكربت

```bash
sudo bash ~/freeradius-setup/scripts/install-freeradius.sh
```

### 3.3 متابعة التثبيت

سيقوم السكربت بـ:
1. تحديث النظام
2. تثبيت FreeRADIUS مع دعم MySQL
3. تكوين اتصال قاعدة البيانات
4. إعداد المصادقة والمحاسبة
5. تكوين جدار الحماية
6. بدء الخدمة

عند الانتهاء، سترى رسالة نجاح مع معلومات الخادم.

---

## الخطوة 4: اختبار التثبيت

### 4.1 التحقق من حالة الخدمة

```bash
sudo systemctl status freeradius
```

يجب أن ترى:
```
● freeradius.service - FreeRADIUS multi-protocol policy server
     Loaded: loaded
     Active: active (running)
```

### 4.2 التحقق من المنافذ

```bash
sudo netstat -tulpn | grep -E "(1812|1813|3799)"
```

يجب أن ترى:
```
udp        0      0 0.0.0.0:1812            0.0.0.0:*           freeradius
udp        0      0 0.0.0.0:1813            0.0.0.0:*           freeradius
udp        0      0 0.0.0.0:3799            0.0.0.0:*           freeradius
```

### 4.3 اختبار المصادقة محلياً

```bash
# أولاً، أنشئ كرت اختبار من واجهة الويب
# ثم اختبر باستخدام:
radtest username password localhost 0 testing123
```

**نتيجة ناجحة:**
```
Received Access-Accept Id 123 from 127.0.0.1:1812 to 127.0.0.1:xxxxx length xx
```

**نتيجة فاشلة:**
```
Received Access-Reject Id 123 from 127.0.0.1:1812 to 127.0.0.1:xxxxx length xx
```

---

## الخطوة 5: تثبيت VPN (اختياري)

إذا كنت تريد ربط MikroTik عبر VPN بدلاً من IP عام:

### 5.1 تشغيل سكربت VPN

```bash
chmod +x ~/freeradius-setup/scripts/install-vpn.sh
sudo bash ~/freeradius-setup/scripts/install-vpn.sh
```

### 5.2 حفظ بيانات VPN

بعد التثبيت، سيظهر:
- عنوان الخادم
- اسم المستخدم
- كلمة المرور

**احفظ هذه البيانات!**

### 5.3 إدارة مستخدمي VPN

```bash
# إضافة مستخدم جديد
sudo vpn-add-user mikrotik2 password123

# حذف مستخدم
sudo vpn-del-user mikrotik2

# عرض المستخدمين
sudo vpn-list-users

# حالة الخادم
sudo vpn-status
```

---

## الخطوة 6: ربط MikroTik

### 6.1 الاتصال عبر IP عام

إذا كان لديك IP عام للخادم، استخدم الأوامر التالية على MikroTik:

```routeros
# إضافة خادم RADIUS
/radius add address=YOUR_SERVER_IP secret=YOUR_RADIUS_SECRET timeout=3s service=ppp,hotspot,login

# تفعيل RADIUS Incoming
/radius incoming set accept=yes port=3799

# تعطيل Message Auth (مطلوب للتوافق)
/radius set [find] require-message-auth=no

# تفعيل RADIUS لـ PPP
/ppp aaa set use-radius=yes accounting=yes interim-update=1m

# تفعيل RADIUS لـ Hotspot
/ip hotspot profile set [find] use-radius=yes
```

### 6.2 الاتصال عبر VPN

إذا كنت تستخدم VPN:

```routeros
# 1. إنشاء اتصال PPTP
/interface pptp-client add name=vpn-radius connect-to=YOUR_SERVER_IP user=mikrotik password=VPN_PASSWORD disabled=no

# 2. انتظر حتى يتصل VPN (حالة: connected)
/interface pptp-client print

# 3. إضافة خادم RADIUS (استخدم IP الخادم داخل VPN)
/radius add address=10.0.0.1 secret=YOUR_RADIUS_SECRET timeout=3s service=ppp,hotspot,login

# 4. باقي الإعدادات كما في الأعلى
/radius incoming set accept=yes port=3799
/radius set [find] require-message-auth=no
/ppp aaa set use-radius=yes accounting=yes interim-update=1m
```

---

## الخطوة 7: اختبار الربط الكامل

### 7.1 إنشاء كرت اختبار

1. افتح واجهة RADIUS SaaS
2. اذهب إلى **الكروت** > **إنشاء كروت**
3. أنشئ كرت واحد للاختبار
4. احفظ اسم المستخدم وكلمة المرور

### 7.2 اختبار من MikroTik

```routeros
# اختبار المصادقة
/tool user-manager user print

# أو جرب تسجيل الدخول من Hotspot/PPPoE
```

### 7.3 التحقق من الجلسات

1. افتح واجهة RADIUS SaaS
2. اذهب إلى **الجلسات**
3. يجب أن ترى الجلسة النشطة

---

## استكشاف الأخطاء وإصلاحها

### مشكلة: Access-Reject دائماً

**الأسباب المحتملة:**
1. اسم المستخدم أو كلمة المرور خاطئة
2. الكرت معطل أو منتهي الصلاحية
3. مشكلة في اتصال قاعدة البيانات

**الحل:**
```bash
# تحقق من سجلات RADIUS
sudo tail -f /var/log/freeradius/radius.log

# تحقق من قاعدة البيانات
mysql -h DB_HOST -u DB_USER -p DB_NAME -e "SELECT * FROM radcheck WHERE username='test_user';"
```

### مشكلة: لا يوجد اتصال بـ RADIUS

**الأسباب المحتملة:**
1. جدار الحماية يحجب المنافذ
2. الخدمة لا تعمل
3. IP خاطئ

**الحل:**
```bash
# تحقق من جدار الحماية
sudo ufw status

# تحقق من الخدمة
sudo systemctl status freeradius

# تحقق من المنافذ
sudo netstat -tulpn | grep radius
```

### مشكلة: VPN لا يتصل

**الأسباب المحتملة:**
1. بيانات الاعتماد خاطئة
2. المنفذ 1723 محجوب
3. GRE محجوب

**الحل:**
```bash
# تحقق من خدمة VPN
sudo systemctl status pptpd

# تحقق من السجلات
sudo tail -f /var/log/syslog | grep pptpd
```

### مشكلة: Accounting لا يعمل

**الأسباب المحتملة:**
1. جدول radacct غير موجود
2. إعدادات SQL خاطئة

**الحل:**
```bash
# تحقق من جدول radacct
mysql -h DB_HOST -u DB_USER -p DB_NAME -e "DESCRIBE radacct;"

# تحقق من سجلات RADIUS
sudo freeradius -X
```

---

## الأوامر المفيدة

### إدارة FreeRADIUS

```bash
# بدء الخدمة
sudo systemctl start freeradius

# إيقاف الخدمة
sudo systemctl stop freeradius

# إعادة تشغيل الخدمة
sudo systemctl restart freeradius

# تشغيل في وضع Debug
sudo systemctl stop freeradius
sudo freeradius -X

# اختبار التكوين
sudo freeradius -CX

# عرض السجلات
sudo tail -f /var/log/freeradius/radius.log
```

### اختبار RADIUS

```bash
# اختبار مصادقة
radtest username password localhost 0 testing123

# اختبار مع NAS-IP
radtest username password localhost 0 testing123 nas-ip-address=192.168.1.1

# حالة الخادم
radius-status
```

### إدارة VPN

```bash
# إضافة مستخدم
sudo vpn-add-user username password

# حذف مستخدم
sudo vpn-del-user username

# عرض المستخدمين
sudo vpn-list-users

# حالة VPN
sudo vpn-status
```

---

## الأمان والتوصيات

### توصيات الأمان

1. **استخدم كلمات مرور قوية** للـ RADIUS Secret و VPN
2. **قيّد الوصول** بتحديد IPs المسموح بها في clients.conf
3. **فعّل SSL** لاتصال قاعدة البيانات
4. **راقب السجلات** بانتظام للكشف عن محاولات الاختراق
5. **حدّث النظام** بانتظام

### النسخ الاحتياطي

```bash
# نسخ احتياطي للتكوين
sudo tar -czvf /backup/freeradius-config-$(date +%Y%m%d).tar.gz /etc/freeradius/

# نسخ احتياطي لمستخدمي VPN
sudo cp /etc/ppp/chap-secrets /backup/chap-secrets-$(date +%Y%m%d)
```

---

## الدعم والمساعدة

إذا واجهت أي مشاكل:

1. راجع قسم **استكشاف الأخطاء** أعلاه
2. تحقق من **سجلات النظام**
3. تواصل مع الدعم الفني

---

**تم إعداد هذا الدليل بواسطة Manus AI**
**آخر تحديث: يناير 2026**
