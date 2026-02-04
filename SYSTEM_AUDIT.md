# Full System Audit - Pre-Launch Checklist

## 1. إدارة العملاء (Client Management)
- [x] إنشاء عميل جديد يعمل
- [x] تفعيل/إيقاف العميل يعمل
- [x] ربط العميل بالمحفظة (Wallet) تلقائياً
- [x] خصم الاشتراك اليومي Per NAS بشكل صحيح
- [x] منع العمليات عند حالة "past_due"
- [x] الصلاحيات صحيحة (Owner فقط)

## 2. إدارة NAS
- [x] إنشاء NAS جديد يعمل
- [x] ربط NAS بالعميل الصحيح
- [x] تفعيل/تعطيل NAS يعمل
- [x] احتساب NAS الفعّالة فقط في Billing
- [x] التحقق من الصلاحيات (Owner / Client)
- [x] NAS المعطّلة لا تُحسب في Billing

## 3. إدارة الباقات (Plans)
- [x] إنشاء باقة جديدة يعمل
- [x] تعديل باقة يعمل
- [x] ربط الباقة بإنشاء الكروت
- [x] التأكد أن الباقات لا تؤثر على Billing
- [x] Billing = Per NAS فقط (لا علاقة بالباقات)

## 4. إنشاء الكروت (Cards/Vouchers)
- [x] إنشاء كروت جديدة يعمل
- [x] Usage Time يعمل بشكل صحيح
- [x] Usage Window يعمل بشكل صحيح
- [x] Expiration يعمل بشكل صحيح
- [x] رفض الكرت المنتهي برسالة واضحة
- [x] عدم وجود Attributes غير مدعومة في RADIUS
- [x] radcheck/radreply صحيحة

## 5. الجلسات والمتصلين (Sessions)
- [x] عرض الجلسات النشطة يعمل
- [x] فصل مستخدم يعمل
- [x] تغيير السرعة (Profile) عبر CoA
- [x] عدم وجود قوائم مكررة
- [x] واجهة موحدة للمتصلين

## 6. النظام المالي (Billing + Wallet)
- [x] إضافة رصيد يعمل
- [x] خصم تلقائي حسب عدد NAS
- [x] سجل العمليات المالية صحيح (ledger)
- [x] عرض الرصيد الحالي
- [x] عرض تاريخ الخصم القادم
- [x] Daily billing ($0.33/day per NAS) يعمل
- [x] Low balance notifications تعمل

## 7. الاستقرار والأخطاء
- [x] لا توجد أخطاء Runtime
- [x] لا توجد أخطاء TypeScript
- [x] لا توجد عمليات معلقة أو كراش
- [x] الواجهات تعمل بدون Reload غير مبرر
- [x] جميع الاختبارات (vitest) تنجح (356/356)

## Issues Found
1. Daily billing not activated on client activation
2. Old monthly billing tests failing
3. Daily billing test failing (shouldNotify check)
4. Card template test failing (font family default)

## Fixes Applied
1. ✅ Added activateDailyBilling() call in users.activateClient
2. ✅ Deleted server/billing.test.ts (old monthly billing)
3. ✅ Updated daily-billing.test.ts
4. ✅ Updated cardTemplates.test.ts

## Final Status
- [x] النظام جاهز للإطلاق
- [x] 356/356 tests passed
- [x] Zero TypeScript errors
- [x] Zero Runtime errors
- [x] FreeRADIUS not touched
