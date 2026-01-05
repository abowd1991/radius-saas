# دليل اختبار FreeRADIUS - Checklist

هذا الدليل يساعدك على التحقق من أن النظام جاهز للإنتاج.

---

## 📋 قائمة الاختبارات

### ✅ المرحلة 1: التثبيت الأساسي

| # | الاختبار | الأمر | الناتج الصحيح | ✓ |
|---|----------|-------|---------------|---|
| 1.1 | FreeRADIUS مثبت | `freeradius -v` | يظهر إصدار FreeRADIUS | ☐ |
| 1.2 | الخدمة تعمل | `systemctl status freeradius` | Active (running) | ☐ |
| 1.3 | المنافذ مفتوحة | `netstat -ulnp \| grep radius` | 1812, 1813, 3799 | ☐ |
| 1.4 | Firewall مُعد | `ufw status` | 1812, 1813, 3799 allowed | ☐ |

---

### ✅ المرحلة 2: اتصال قاعدة البيانات

| # | الاختبار | الأمر | الناتج الصحيح | ✓ |
|---|----------|-------|---------------|---|
| 2.1 | اتصال MySQL | `mysql -h HOST -u USER -p DB_NAME -e "SELECT 1"` | 1 | ☐ |
| 2.2 | جدول radcheck | `mysql ... -e "SELECT COUNT(*) FROM radcheck"` | رقم (عدد الكروت) | ☐ |
| 2.3 | جدول radreply | `mysql ... -e "SELECT COUNT(*) FROM radreply"` | رقم | ☐ |
| 2.4 | جدول radacct | `mysql ... -e "SELECT COUNT(*) FROM radacct"` | رقم (قد يكون 0) | ☐ |

**أمر الاختبار الكامل:**
```bash
# استبدل القيم ببيانات قاعدة البيانات الخاصة بك
mysql -h gateway01.us-east-1.prod.aws.tidbcloud.com -P 4000 -u YOUR_USER -p YOUR_DB --ssl-mode=REQUIRED -e "
SELECT 'radcheck' as table_name, COUNT(*) as count FROM radcheck
UNION ALL
SELECT 'radreply', COUNT(*) FROM radreply
UNION ALL
SELECT 'radacct', COUNT(*) FROM radacct;
"
```

---

### ✅ المرحلة 3: اختبار Authentication

| # | الاختبار | الأمر | الناتج الصحيح | ✓ |
|---|----------|-------|---------------|---|
| 3.1 | radtest محلي | `radtest testuser testpass localhost 0 testing123` | Access-Accept أو Access-Reject | ☐ |
| 3.2 | radtest بكرت حقيقي | `radtest CARD_USERNAME CARD_PASSWORD localhost 0 testing123` | **Access-Accept** | ☐ |
| 3.3 | radtest بكرت خاطئ | `radtest wronguser wrongpass localhost 0 testing123` | **Access-Reject** | ☐ |

**خطوات الاختبار:**

```bash
# 1. أولاً، احصل على بيانات كرت من قاعدة البيانات
mysql ... -e "SELECT username, value as password FROM radcheck WHERE attribute='Cleartext-Password' LIMIT 1"

# 2. اختبر بالبيانات الحقيقية
radtest CARD_USERNAME CARD_PASSWORD localhost 0 testing123

# الناتج الصحيح:
# Sent Access-Request Id 123 from 0.0.0.0:xxxxx to 127.0.0.1:1812 length xx
# Received Access-Accept Id 123 from 127.0.0.1:1812 to 0.0.0.0:xxxxx length xx
```

---

### ✅ المرحلة 4: اختبار من خارج الخادم

| # | الاختبار | الأمر (من جهاز آخر) | الناتج الصحيح | ✓ |
|---|----------|---------------------|---------------|---|
| 4.1 | الوصول للمنفذ | `nc -zvu SERVER_IP 1812` | Connection succeeded | ☐ |
| 4.2 | radtest خارجي | `radtest USER PASS SERVER_IP 0 RADIUS_SECRET` | Access-Accept | ☐ |

---

### ✅ المرحلة 5: اختبار VPN (إذا تم تثبيته)

| # | الاختبار | الأمر | الناتج الصحيح | ✓ |
|---|----------|-------|---------------|---|
| 5.1 | PPTP يعمل | `systemctl status pptpd` | Active (running) | ☐ |
| 5.2 | المنفذ مفتوح | `netstat -tlnp \| grep 1723` | 0.0.0.0:1723 | ☐ |
| 5.3 | IP Forwarding | `cat /proc/sys/net/ipv4/ip_forward` | 1 | ☐ |

**اختبار اتصال VPN من MikroTik:**
```
# على MikroTik
/interface pptp-client add name=vpn-radius connect-to=SERVER_PUBLIC_IP user=mikrotik password=VPN_PASSWORD disabled=no

# التحقق من الاتصال
/interface pptp-client print
# يجب أن يظهر: running=yes

# التحقق من IP
/ip address print where interface=vpn-radius
# يجب أن يظهر IP مثل: 10.0.0.100/32
```

---

### ✅ المرحلة 6: ربط MikroTik بـ RADIUS

| # | الاختبار | الأمر على MikroTik | الناتج الصحيح | ✓ |
|---|----------|-------------------|---------------|---|
| 6.1 | إضافة RADIUS | `/radius add address=RADIUS_IP secret=SECRET service=ppp,hotspot,login` | تمت الإضافة | ☐ |
| 6.2 | تفعيل Incoming | `/radius incoming set accept=yes` | تم التفعيل | ☐ |
| 6.3 | تفعيل PPP AAA | `/ppp aaa set use-radius=yes accounting=yes` | تم التفعيل | ☐ |

**أوامر MikroTik الكاملة:**
```
# إذا كان الاتصال مباشر (Public IP)
/radius add address=SERVER_PUBLIC_IP secret=YOUR_SECRET timeout=3s service=ppp,hotspot,login

# إذا كان الاتصال عبر VPN
/radius add address=10.0.0.1 secret=YOUR_SECRET timeout=3s service=ppp,hotspot,login

# إعدادات إضافية
/radius incoming set accept=yes port=3799
/radius set [find] require-message-auth=no
/ppp aaa set use-radius=yes accounting=yes interim-update=1m
```

---

### ✅ المرحلة 7: اختبار تسجيل دخول حقيقي

| # | الاختبار | الطريقة | الناتج الصحيح | ✓ |
|---|----------|---------|---------------|---|
| 7.1 | PPPoE Login | اتصال PPPoE ببيانات كرت | اتصال ناجح + IP | ☐ |
| 7.2 | Hotspot Login | تسجيل دخول من صفحة Hotspot | دخول ناجح | ☐ |
| 7.3 | Session في radacct | `SELECT * FROM radacct ORDER BY radacctid DESC LIMIT 1` | سجل جديد | ☐ |

**التحقق من Accounting:**
```bash
# على خادم RADIUS
mysql ... -e "SELECT username, nasipaddress, acctstarttime, acctstoptime FROM radacct ORDER BY radacctid DESC LIMIT 5"

# يجب أن ترى:
# - username: اسم المستخدم/الكرت
# - nasipaddress: IP الراوتر
# - acctstarttime: وقت بدء الجلسة
# - acctstoptime: NULL (إذا الجلسة نشطة) أو وقت الانتهاء
```

---

### ✅ المرحلة 8: اختبار التزامن مع لوحة التحكم

| # | الاختبار | الخطوات | الناتج الصحيح | ✓ |
|---|----------|---------|---------------|---|
| 8.1 | تعطيل كرت | عطّل كرت من لوحة التحكم → حاول تسجيل الدخول | **Access-Reject** | ☐ |
| 8.2 | تمكين كرت | فعّل الكرت → حاول تسجيل الدخول | **Access-Accept** | ☐ |
| 8.3 | تغيير السرعة | غيّر الخطة → تحقق من radreply | القيم الجديدة موجودة | ☐ |

**اختبار التزامن:**
```bash
# 1. من لوحة التحكم: عطّل كرت معين

# 2. تحقق من قاعدة البيانات
mysql ... -e "SELECT * FROM radcheck WHERE username='CARD_USERNAME'"
# يجب أن ترى: Auth-Type := Reject

# 3. اختبر تسجيل الدخول
radtest CARD_USERNAME CARD_PASSWORD localhost 0 testing123
# يجب أن يكون: Access-Reject

# 4. من لوحة التحكم: فعّل الكرت

# 5. اختبر مرة أخرى
radtest CARD_USERNAME CARD_PASSWORD localhost 0 testing123
# يجب أن يكون: Access-Accept
```

---

## 🎯 ملخص الجاهزية للإنتاج

### النظام جاهز للإنتاج إذا:

| المتطلب | الحالة |
|---------|--------|
| FreeRADIUS يعمل بدون أخطاء | ☐ |
| Authentication يعمل (radtest) | ☐ |
| Accounting يُسجَّل في radacct | ☐ |
| MikroTik متصل بـ RADIUS | ☐ |
| تسجيل دخول حقيقي يعمل (PPP/Hotspot) | ☐ |
| التعديلات من لوحة التحكم تنعكس فوراً | ☐ |
| VPN يعمل (إذا مطلوب) | ☐ |

---

## 🔧 استكشاف الأخطاء السريع

### مشكلة: Access-Reject دائماً
```bash
# تحقق من وجود المستخدم
mysql ... -e "SELECT * FROM radcheck WHERE username='USERNAME'"

# تحقق من عدم وجود Auth-Type := Reject
mysql ... -e "SELECT * FROM radcheck WHERE username='USERNAME' AND attribute='Auth-Type'"

# شغّل FreeRADIUS في وضع Debug
systemctl stop freeradius
freeradius -X
# ثم اختبر وراقب الرسائل
```

### مشكلة: لا يوجد اتصال بالمنفذ
```bash
# تحقق من Firewall
ufw status
ufw allow 1812/udp
ufw allow 1813/udp

# تحقق من أن الخدمة تستمع
netstat -ulnp | grep radius
```

### مشكلة: VPN لا يتصل
```bash
# تحقق من الخدمة
systemctl status pptpd
journalctl -u pptpd -f

# تحقق من IP Forwarding
sysctl net.ipv4.ip_forward
# إذا كان 0:
echo 1 > /proc/sys/net/ipv4/ip_forward
```

### مشكلة: Accounting لا يُسجَّل
```bash
# تحقق من إعدادات MikroTik
/ppp aaa print
# يجب أن يكون: use-radius=yes accounting=yes

# تحقق من جدول radacct
mysql ... -e "DESCRIBE radacct"
```

---

## 📞 الدعم

إذا واجهت أي مشاكل بعد اتباع هذا الدليل، يرجى:
1. تشغيل FreeRADIUS في وضع Debug: `freeradius -X`
2. نسخ رسائل الخطأ
3. التواصل مع الدعم الفني

---

**تاريخ الإنشاء:** يناير 2026
**الإصدار:** 1.0
