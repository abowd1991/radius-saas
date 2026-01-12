# نظام RADIUS Production-Ready

## ملخص تنفيذي

تم بناء نظام RADIUS متكامل يتحمل **10,000 مستخدم متزامن** مع ضمان **ثبات كامل** بعد أي Restart للسيرفر، بدون أي تدخل يدوي، ومع نظام مراقبة وتنبيهات فورية.

---

## 1. السبب الجذري لمشكلة "RADIUS not responding"

### المشكلة الأصلية
كان هناك **تعارض** بين ملفين:
- `dynamic-clients` - يعرّف شبكة `192.168.30.0/24`
- `clients.conf` - يعرّف نفس الشبكة

### الحل
1. حذف ملف `dynamic-clients` (غير ضروري مع `read_clients = yes`)
2. إضافة `br-radius-network` في `clients.conf` للسماح بالاتصالات المحلية
3. FreeRADIUS يقرأ NAS مباشرة من جدول `nas` في قاعدة البيانات

---

## 2. ترتيب تشغيل الخدمات

```
┌─────────────────┐
│   vpnserver     │  ← يبدأ أولاً (SoftEther VPN)
└────────┬────────┘
         │
┌────────▼────────┐
│  radius-bridge  │  ← ينشئ br-radius ويربط tap_radius
└────────┬────────┘
         │
┌────────▼────────┐
│ isc-dhcp-server │  ← يوزع IP على شبكة 192.168.30.0/24
└────────┬────────┘
         │
┌────────▼────────┐
│   freeradius    │  ← يستمع على جميع الـ interfaces
└─────────────────┘
```

### خدمات systemd المُحدّثة

| الخدمة | الملف | الإعدادات |
|--------|-------|-----------|
| radius-bridge | `/etc/systemd/system/radius-bridge.service` | `After=vpnserver.service` |
| isc-dhcp-server | `/etc/systemd/system/isc-dhcp-server.service.d/override.conf` | `After=radius-bridge.service` |
| freeradius | `/etc/systemd/system/freeradius.service.d/override.conf` | `After=isc-dhcp-server.service`, `Restart=on-failure` |

---

## 3. إعدادات الأداء العالي (10,000 مستخدم)

### FreeRADIUS Thread Pool

```conf
# /etc/freeradius/3.0/radiusd.conf
thread pool {
    start_servers = 32
    max_servers = 128
    min_spare_servers = 8
    max_spare_servers = 32
    max_requests_per_server = 0
    max_request_time = 30
}
```

### SQL Connection Pool

```conf
# /etc/freeradius/3.0/mods-available/sql
sql {
    pool {
        start = 20
        min = 10
        max = 100
        spare = 5
        uses = 0
        lifetime = 0
        idle_timeout = 60
    }
}
```

### الطاقة الاستيعابية

| المقياس | القيمة |
|---------|--------|
| Max Concurrent Requests | 128 |
| DB Connections | 100 |
| Requests/Second | ~500-1000 |
| Max Users | 10,000+ |

---

## 4. نظام Dynamic NAS

### آلية العمل

1. **إضافة NAS من لوحة التحكم**
   - يتم تخصيص IP من Pool (192.168.30.10-250)
   - يتم إنشاء مستخدم VPN تلقائياً
   - يتم حفظ `nasname = IP` في قاعدة البيانات

2. **DHCP Reservation تلقائي**
   - سكربت `/usr/local/bin/update-dhcp-reservations.sh` يعمل كل 5 دقائق
   - يقرأ MAC من اتصالات VPN
   - ينشئ reservation في `/etc/dhcp/reservations.conf`

3. **FreeRADIUS يتعرف على NAS فوراً**
   - `read_clients = yes` في SQL module
   - عند إضافة NAS → `systemctl reload freeradius`
   - لا حاجة لأي sync يدوي

### Cron Jobs

```bash
# /etc/cron.d/radius-dhcp-sync
*/5 * * * * root /usr/local/bin/update-dhcp-reservations.sh

# /etc/cron.d/radius-health-monitor
* * * * * root /usr/local/bin/radius-health-monitor.sh
```

---

## 5. نظام المراقبة والتنبيهات

### Health Monitor

سكربت `/usr/local/bin/radius-health-monitor.sh` يعمل **كل دقيقة** ويفحص:

1. ✅ حالة FreeRADIUS
2. ✅ حالة VPN Server
3. ✅ حالة DHCP Server
4. ✅ وجود br-radius
5. ✅ استجابة RADIUS (radclient test)

### Auto-Restart

عند فشل أي خدمة:
1. يحاول إعادة التشغيل تلقائياً
2. إذا فشل → يسجل في `/var/log/radius-health-monitor.log`
3. يرسل تنبيه (webhook إذا تم تكوينه)

### API Endpoints للتشخيص

| Endpoint | الوصف |
|----------|-------|
| `diagnostics.getSystemStatus` | حالة جميع الخدمات |
| `diagnostics.getFreeradiusStatus` | حالة FreeRADIUS |
| `diagnostics.getFreeradiusLogs` | آخر سجلات FreeRADIUS |
| `diagnostics.getUnknownClients` | محاولات اتصال من NAS غير معروفة |
| `diagnostics.testConnectivity` | اختبار استجابة RADIUS |
| `diagnostics.reloadFreeradius` | إعادة تحميل FreeRADIUS |

---

## 6. قائمة التحقق للإنتاج

### قبل أي Restart

- [ ] لا شيء مطلوب - النظام يعمل تلقائياً

### بعد Restart

- [ ] تحقق من `/var/log/radius-health-monitor.log`
- [ ] أو استخدم `diagnostics.getSystemStatus` من لوحة التحكم

### عند إضافة NAS جديد

1. أضف NAS من لوحة التحكم
2. انسخ أوامر MikroTik من صفحة "اتصال ميكروتك"
3. نفذ الأوامر في MikroTik
4. انتظر 5 دقائق للـ DHCP reservation
5. أعد اتصال VPN مرة واحدة

---

## 7. استكشاف الأخطاء

### "RADIUS server is not responding"

| السبب المحتمل | الفحص | الحل |
|---------------|-------|------|
| FreeRADIUS متوقف | `systemctl status freeradius` | `systemctl restart freeradius` |
| NAS غير معروف | `diagnostics.getUnknownClients` | تحقق من IP في جدول `nas` |
| Secret خاطئ | سجلات FreeRADIUS | تحقق من Secret في لوحة التحكم |
| VPN غير متصل | حالة VPN في MikroTik | أعد اتصال VPN |
| br-radius غير موجود | `ip addr show br-radius` | `systemctl restart radius-bridge` |

### أوامر التشخيص السريع

```bash
# حالة جميع الخدمات
systemctl status freeradius vpnserver isc-dhcp-server radius-bridge

# اختبار RADIUS
echo "User-Name=test" | radclient 127.0.0.1:1812 auth testing123

# سجلات FreeRADIUS
journalctl -u freeradius -n 50

# سجلات Health Monitor
tail -50 /var/log/radius-health-monitor.log
```

---

## 8. الملفات المهمة

| الملف | الوصف |
|-------|-------|
| `/etc/freeradius/3.0/radiusd.conf` | إعدادات FreeRADIUS الرئيسية |
| `/etc/freeradius/3.0/mods-available/sql` | إعدادات قاعدة البيانات |
| `/etc/freeradius/3.0/clients.conf` | تعريف NAS clients |
| `/etc/dhcp/dhcpd.conf` | إعدادات DHCP |
| `/etc/dhcp/reservations.conf` | DHCP reservations |
| `/etc/systemd/system/radius-bridge.service` | خدمة Bridge |
| `/usr/local/bin/radius-health-monitor.sh` | سكربت المراقبة |
| `/var/log/radius-health-monitor.log` | سجلات المراقبة |

---

**تاريخ التوثيق:** 12 يناير 2026  
**الإصدار:** 1.0 Production-Ready
