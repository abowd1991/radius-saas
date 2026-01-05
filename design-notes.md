# Reference Design Notes - Card Creation Form

## Layout from Reference Image (RTL Arabic):

### Row 1 (Right to Left):
- **كمية** (Quantity) - Input field, value: 1
- **سعر الكرت** (Card Price) - Input field, value: 0
- **حرف او رقم يبدأ الكرت به** (Card Prefix) - Input field, empty

### Row 2 (Right to Left):
- **عدد الأجهزة التي يمكنها الاتصال** (Simultaneous Connections) - Input field, value: 1
- **طول رقم الكرت** (Username Length) - Dropdown, value: 6
- **طول كلمة السر** (Password Length) - Dropdown, value: 4

### Row 3 (Right to Left):
- **الخدمة المرتبطة بالكرت** (Service Plan) - Dropdown, value: "1M-24H"
- **مجموعة المشتركين** (Subscriber Group) - Dropdown, value: "Default group"

### Row 4:
- **تحديد منفذ هوتسبوت** (Hotspot Port) - Input with "?" icon
- Placeholder: "فارغ = السماح للجميع" (Empty = Allow all)
- Example text: "مثال: hs-LAN 5, hs-LAN 1, hs-LAN 2"

### Row 5 (Right to Left):
- **الوقت المتاح على الانترنت** (Internet Time) - Input: 0, Dropdown: ساعة (Hours)
- **الوقت المتاح من تفعيل الكرت** (Card Validity Time) - Input: 0, Dropdown: ساعة (Hours)

### Row 6 (Switches):
- **تحسب من تفعيل الكرت** (Count from activation) - Toggle ON (blue)
- **عدم ربط الماك** (No MAC binding) - Toggle OFF

### Buttons:
- **Submit** (إنشاء) - Primary blue button
- **Discard** (إلغاء) - Secondary/outline button

## Current Implementation Status:
The current implementation already matches the reference design closely. The form includes all required fields in the correct order.

## Key Observations:
1. Dark theme with blue accents
2. RTL layout for Arabic
3. Toggle switches for boolean options
4. Dropdowns for length selection (4, 6, etc.)
5. Input fields for numeric values
6. Help text below hotspot port field
