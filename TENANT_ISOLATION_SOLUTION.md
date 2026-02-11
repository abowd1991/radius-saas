# حل مشكلة تعارض الكروت بين العملاء (Tenant Isolation)

## المشكلة
حالياً، يتم توليد username للكروت بشكل عشوائي من أرقام فقط (0-9) بدون أي ربط بـ userId أو tenantId.

**مثال على التعارض:**
- عميل 1 (userId=17) ينشئ كارت: username = "123456"
- عميل 2 (userId=25) ينشئ كارت: username = "123456" (نفس الأرقام بالصدفة)
- **النتيجة:** تعارض في RADIUS لأن username يجب أن يكون unique في جدول `radcheck`

## الحل المقترح

### 1. إضافة User ID Prefix
كل username سيبدأ بـ prefix يحتوي على userId:

```
Format: U{userId}-{randomNumbers}
```

**أمثلة:**
- عميل 1 (userId=17): `U17-123456`, `U17-789012`
- عميل 2 (userId=25): `U25-123456`, `U25-789012`
- عميل 3 (userId=100): `U100-123456`, `U100-789012`

### 2. دعم Custom Prefix (اختياري)
العميل يمكنه إضافة prefix إضافي خاص به:

```
Format: U{userId}-{customPrefix}{randomNumbers}
```

**أمثلة:**
- عميل 1 مع prefix "VIP": `U17-VIP123456`
- عميل 2 مع prefix "GOLD": `U25-GOLD789012`

### 3. التوافق مع الكروت القديمة (Backward Compatibility)
- الكروت الموجودة حالياً (بدون prefix) ستبقى تعمل
- الكروت الجديدة فقط ستحصل على prefix
- لا حاجة لتعديل الكروت القديمة

## التنفيذ

### ملفات تحتاج تعديل:
1. **server/db/radiusCards.ts**
   - تعديل `generateUsername()` لإضافة userId prefix
   - تمرير `createdBy` (userId) إلى الدالة

2. **server/routers.ts** (إن وجد)
   - التأكد من تمرير userId عند إنشاء الكروت

3. **client/src/pages/CardCreation.tsx** (إن وجد)
   - عرض معلومة للمستخدم عن format الـ username الجديد

## الفوائد
✅ **عزل تام بين العملاء** - لا يمكن حدوث تعارض في usernames
✅ **سهولة التتبع** - يمكن معرفة صاحب الكارت من username مباشرة
✅ **توافق مع RADIUS** - username يبقى unique في جدول radcheck
✅ **مرونة** - دعم custom prefix للعملاء

## الاختبار المطلوب
1. إنشاء كروت من عميل 1
2. إنشاء كروت من عميل 2 بنفس الإعدادات
3. التأكد من عدم وجود تعارض في usernames
4. اختبار RADIUS authentication لكلا العميلين
5. التأكد من عدم تسرب بيانات بين العملاء
