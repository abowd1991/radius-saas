# New Menu Structure - Global Standard

## Owner/Super Admin Menu

### 1. 📊 Dashboard (لوحة التحكم)
- Dashboard (الرئيسية)

### 2. 📡 Monitoring (المراقبة)
- Active Sessions (الجلسات النشطة) - `/sessions`
- RADIUS Logs (سجلات RADIUS) - `/radius-logs`
- NAS Health (مراقبة NAS) - `/nas-health`
- IP Pool Status (حالة IP Pool) - `/ip-pool`

### 3. 🌐 Infrastructure (البنية التحتية)
- NAS Devices (أجهزة NAS) - `/nas`
- MikroTik Setup (إعداد MikroTik) - `/mikrotik-setup`
- VPN Connections (اتصالات VPN) - `/vpn`
- VPN Logs (سجلات VPN) - `/vpn-logs`

### 4. 👥 Users & Clients (المستخدمين والعملاء)
- Subscribers (المشتركين) - `/subscribers`
- Customers (العملاء) - `/users-management`
- Resellers (الموزعين) - `/resellers`

### 5. 🛡️ Access Control (التحكم بالوصول)
- Plans (الخطط) - `/plans`
- RADIUS Control (لوحة تحكم RADIUS) - `/radius-control`

### 6. 🎫 Cards & Vouchers (البطاقات)
- Vouchers (الكروت) - `/vouchers`
- Print Cards (طباعة الكروت) - `/print-cards`

### 7. 💰 Billing (الفوترة)
- Billing Dashboard (لوحة الفوترة) - `/owner-billing`
- Invoices (الفواتير) - `/invoices`
- Wallet (المحفظة) - `/wallet`
- Wallet Ledger (سجل المحفظة) - `/wallet-ledger`
- Subscriptions (الاشتراكات) - `/tenant-subscriptions`
- SaaS Plans (خطط SaaS) - `/saas-plans`

### 8. 📈 Reports & Analytics (التقارير والتحليلات)
- Reports (التقارير) - `/reports`
- Bandwidth Reports (تقارير الباندويث) - `/bandwidth`

### 9. ⚙️ System (النظام)
- Settings (الإعدادات) - `/settings`
- Audit Log (سجل العمليات) - `/audit-log`
- System Admin (إدارة النظام) - `/system-admin`
- SMS Management (إدارة SMS) - `/sms`
- Support (الدعم الفني) - `/support`

---

## Client Menu (Simplified)

### 1. 📊 Dashboard (لوحة التحكم)
- Dashboard (الرئيسية)

### 2. 📡 Monitoring (المراقبة)
- Active Sessions (الجلسات النشطة)

### 3. 🌐 Network (الشبكة)
- My NAS (أجهزة NAS الخاصة بي)
- MikroTik Setup (إعداد MikroTik)

### 4. 👥 Subscribers (المشتركين)
- My Subscribers (مشتركيني)

### 5. 🎫 Cards (البطاقات)
- My Vouchers (كروتي)
- Print Cards (طباعة الكروت)

### 6. 💰 Billing (الفوترة)
- Invoices (فواتيري)
- Wallet (محفظتي)

### 7. 📈 Reports (التقارير)
- My Reports (تقاريري)

### 8. ⚙️ Settings (الإعدادات)
- Profile (الملف الشخصي)
- Support (الدعم الفني)

---

## Reseller Menu

### 1. 📊 Dashboard (لوحة التحكم)
- Dashboard (الرئيسية)

### 2. 👥 Customers (العملاء)
- My Customers (عملائي)

### 3. 🎫 Cards (البطاقات)
- Vouchers (الكروت)

### 4. 💰 Billing (الفوترة)
- Invoices (الفواتير)
- Wallet (المحفظة)

### 5. ⚙️ Support (الدعم)
- Support (الدعم الفني)

---

## Changes Summary:

### Removed/Merged:
- ❌ "النسخ الاحتياطي" (moved to System Admin page)
- ❌ Duplicate "Wallet" entries
- ❌ Redundant navigation items

### Renamed:
- ✅ "المستخدمين والعملاء" → "Users & Clients"
- ✅ "إدارة المستخدمين" → "Customers"
- ✅ "البنية التحتية" → "Infrastructure"
- ✅ "التحكم بالوصول" → "Access Control"
- ✅ "البطاقات والمدفوعات" → "Cards & Vouchers"
- ✅ "الفواتير والمالية" → "Billing"
- ✅ "النظام والإعدادات" → "System"

### Reorganized:
- ✅ Grouped related items logically
- ✅ Consistent naming (Arabic + English)
- ✅ Clear hierarchy
- ✅ Removed redundancy
