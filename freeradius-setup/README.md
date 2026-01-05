# FreeRADIUS Setup for RADIUS SaaS Platform

هذا المجلد يحتوي على جميع الملفات اللازمة لتثبيت وتكوين خادم FreeRADIUS للعمل مع منصة RADIUS SaaS.

## محتويات المجلد

```
freeradius-setup/
├── README.md                    # هذا الملف
├── scripts/
│   ├── install-freeradius.sh   # سكربت تثبيت FreeRADIUS الشامل
│   └── install-vpn.sh          # سكربت تثبيت خادم VPN (PPTP)
├── configs/
│   ├── sql.conf                # تكوين اتصال قاعدة البيانات
│   ├── clients.conf            # تكوين أجهزة NAS (MikroTik)
│   └── default                 # تكوين الموقع الافتراضي
└── docs/
    └── INSTALLATION_GUIDE.md   # دليل التثبيت الشامل
```

## البدء السريع

### 1. نقل الملفات للخادم

```bash
scp -r freeradius-setup/ user@your-server:/home/user/
```

### 2. تعديل بيانات قاعدة البيانات

```bash
nano scripts/install-freeradius.sh
# عدّل: DB_HOST, DB_USER, DB_PASS, DB_NAME, RADIUS_SECRET
```

### 3. تشغيل التثبيت

```bash
chmod +x scripts/install-freeradius.sh
sudo bash scripts/install-freeradius.sh
```

### 4. (اختياري) تثبيت VPN

```bash
chmod +x scripts/install-vpn.sh
sudo bash scripts/install-vpn.sh
```

## الدليل الكامل

للحصول على تعليمات مفصلة، راجع:
- [دليل التثبيت الشامل](docs/INSTALLATION_GUIDE.md)

## المتطلبات

- Ubuntu 20.04/22.04 أو Debian 11/12
- صلاحيات root
- اتصال بالإنترنت
- بيانات قاعدة البيانات من Manus

## الدعم

إذا واجهت أي مشاكل، راجع قسم استكشاف الأخطاء في دليل التثبيت.
