# إصلاح خطأ: column expert_pricing.request_id does not exist

## 🔴 المشكلة

```
فشل تحميل البيانات: column expert_pricing.request_id does not exist
```

هذا الخطأ يحدث لأن جدول `expert_pricing` لا يحتوي على العمود `request_id` الذي تحتاجه قاعدة البيانات.

---

## ✅ الحل الفوري (مطبق بالفعل)

تم تحديث `src/services/pricingService.ts` لمعالجة هذا الخطأ:

1. ✅ الدالة `getExpertPricing()` الآن ترجع قائمة فارغة إذا كان العمود غير موجود
2. ✅ الدالة `upsertExpertPricing()` الآن لديها fallback method
3. ✅ إضافة logging تفصيلي لتتبع المشكلة

---

## 🔧 الحل الدائم - تطبيق Migration

### الخطوة 1: تطبيق Migration الإصلاح

تم إنشاء ملف migration جديد:
```
supabase/migrations/20260331_fix_expert_pricing_request_id.sql
```

هذا الملف يضيف العمود `request_id` والأعمدة الأخرى المفقودة.

### الخطوة 2: تطبيق التغييرات على Supabase

#### الخيار أ: عبر Supabase Dashboard (يدوياً)

1. اذهب إلى [Supabase Console](https://app.supabase.com)
2. اختر مشروعك
3. اذهب إلى **SQL Editor**
4. انسخ المحتوى من `supabase/migrations/20260331_fix_expert_pricing_request_id.sql`
5. الصق في SQL Editor وشغّل

#### الخيار ب: عبر Supabase CLI

```bash
# تثبيت Supabase CLI إذا لم تكن مثبتة
npm install -g supabase

# تسجيل الدخول
supabase login

# تطبيق Migrations
supabase db push
```

#### الخيار جـ: عبر Vercel (في Production)

إذا كنت في Production، قد تحتاج إلى:
1. دخول Supabase dashboard لـ production database
2. تشغيل SQL manually

---

## 🔍 كود الإصلاح

### 1. ملف Migration: `20260331_fix_expert_pricing_request_id.sql`

```sql
-- إضافة العمود request_id إذا كان مفقوداً
ALTER TABLE expert_pricing
ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES requests(id) ON DELETE CASCADE;

-- ملء البيانات من جدول inspection_items
UPDATE expert_pricing ep
SET request_id = ii.request_id
FROM inspection_items ii
WHERE ep.inspection_item_id = ii.id 
  AND ep.request_id IS NULL;

-- إضافة الأعمدة الأخرى المفقودة
ALTER TABLE expert_pricing
ADD COLUMN IF NOT EXISTS external_report_item_id TEXT,
ADD COLUMN IF NOT EXISTS external_report_issue_id TEXT,
ADD COLUMN IF NOT EXISTS item_main_name TEXT,
ADD COLUMN IF NOT EXISTS item_sub_name TEXT,
ADD COLUMN IF NOT EXISTS item_specifications TEXT,
ADD COLUMN IF NOT EXISTS item_unit TEXT,
ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

-- إنشاء index فريد
CREATE UNIQUE INDEX IF NOT EXISTS expert_pricing_request_external_item_unique
ON expert_pricing (request_id, external_report_item_id)
WHERE external_report_item_id IS NOT NULL;
```

### 2. تحديثات Service: `src/services/pricingService.ts`

```typescript
// معالجة الخطأ عند جلب البيانات
if (error.message && error.message.includes("does not exist")) {
  console.warn("request_id column might not exist yet. Please run migrations.");
  return [];
}

// المحاولة الأخرى (fallback) عند الحفظ
if (error.message && error.message.includes("request_id")) {
  console.warn("request_id column issue detected. Attempting fallback insert...");
  // تنفيذ insert عادي بدلاً من upsert
}
```

---

## 📋 خطوات التحقق

بعد تطبيق الإصلاح، تحقق من:

### 1. تحقق من وجود العمود

```sql
-- في Supabase SQL Editor
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'expert_pricing'
ORDER BY column_name;
```

يجب أن ترى:
- ✅ `request_id`
- ✅ `external_report_item_id`
- ✅ `unit_price`
- ✅ `quantity`
- ✅ وغيرها...

### 2. اختبر جلب البيانات

```
1. اذهب إلى صفحة التسعير
2. تحقق من console لعدم وجود أخطاء
3. يجب أن تظهر البنود الآن
```

### 3. اختبر الحفظ

```
1. أدخل أسعار
2. احفظ
3. تحقق من عدم ظهور أخطاء
```

---

## 🐛 Debugging

### إذا استمرت المشكلة:

1. **افتح Browser Console** (F12)
2. **ابحث عن رسائل الخطأ**
3. **شاهد Network Tab** للطلبات الفاشلة
4. **تحقق من:**
   - هل تم تطبيق Migration؟
   - هل المستخدم مسجل دخول؟
   - هل الجلسة صالحة؟

### رسائل خطأ شائعة:

```
❌ "column expert_pricing.request_id does not exist"
✅ الحل: طبّق migration الإصلاح

❌ "Failed to save pricing"
✅ الحل: تحقق من الجلسة والصلاحيات

❌ لا تظهر البيانات
✅ الحل: شاهد console للأخطاء الدقيقة
```

---

## 📝 الخطوات الموصى بها

### للتطوير (Localhost):

```bash
# 1. شغّل التطبيق
npm run dev

# 2. افتح Browser Console
# 3. اذهب إلى صفحة التسعير
# 4. افحص الأخطاء في console

# 5. إذا رأيت خطأ migration، طبّقه:
supabase db push
```

### للإنتاج (Vercel):

```bash
# 1. تسجيل دخول Supabase Console
# 2. اختر production database
# 3. اذهب إلى SQL Editor
# 4. انسخ محتوى migration وشغّله
# 5. تحقق من النتائج
```

---

## ✨ النتيجة المتوقعة

بعد تطبيق الإصلاح:

✅ لا توجد أخطاء "request_id does not exist"  
✅ البيانات تُجلب بنجاح  
✅ الأسعار تُحفظ بنجاح  
✅ صفحة التسعير تعمل بشكل طبيعي  

---

## 🆘 إذا احتجت مساعدة إضافية

1. شاهد `COMPLETION_CHECKLIST.md`
2. شاهد `TESTING_EXAMPLES.md`
3. شاهد `PRICING_FIX_DOCUMENTATION.md`
