# أمثلة الاختبار والطلبات

## 🧪 اختبار API الخارجية

### 1. اختبر جلب تقرير المعاينة

```bash
# من Localhost
curl -X GET http://localhost:3000/api/inspection-report/RQ001234

# أو مباشرة من API الخارجية
curl -X GET https://inspection-six.vercel.app/api/reports/RQ001234
```

### الاستجابة المتوقعة:
```json
{
  "report": {
    "id": "...",
    "rq_number": "RQ001234",
    "status": "...",
    "mosques": {
      "name": "مسجد اسم"
    }
  },
  "issues": [
    {
      "id": "...",
      "main_item": { "name_ar": "بند رئيسي" },
      "items": [
        {
          "id": "...",
          "quantity": 5,
          "sub_items": { "name_ar": "بند فرعي", "unit_ar": "متر" }
        }
      ]
    }
  ]
}
```

---

## 💾 اختبار Supabase Queries

### 1. جلب التسعيرات المحفوظة

```sql
SELECT * 
FROM expert_pricing 
WHERE request_id = 'REQUEST_ID_HERE'
ORDER BY created_at ASC;
```

### 2. إضافة/تحديث تسعيرة

```sql
INSERT INTO expert_pricing (
  request_id,
  external_report_item_id,
  external_report_issue_id,
  item_main_name,
  item_sub_name,
  item_specifications,
  item_unit,
  quantity,
  unit_price,
  estimated_price,
  pricing_notes,
  approved
) VALUES (
  'REQUEST_UUID',
  'ITEM_ID',
  'ISSUE_ID',
  'بند رئيسي',
  'بند فرعي',
  'مواصفات',
  'متر',
  5,
  1000.00,
  5000.00,
  'ملاحظات',
  false
)
ON CONFLICT (request_id, external_report_item_id) 
DO UPDATE SET
  unit_price = 1000.00,
  estimated_price = 5000.00,
  pricing_notes = 'ملاحظات',
  updated_at = NOW();
```

### 3. التحقق من RLS

```javascript
// في الـ Browser Console
const { data, error } = await supabase
  .from('expert_pricing')
  .select('*')
  .eq('request_id', 'REQUEST_ID');

console.log(data); // يجب أن يظهر البيانات
console.log(error); // يجب أن يكون null
```

---

## 🔐 اختبار المصادقة والصلاحيات

### 1. اختبر جلب دور المستخدم

```javascript
const user = await authService.getCurrentUser();
const role = await authService.getUserRole(user.id);
console.log('User Role:', role); // يجب أن يكون pricing_expert
```

### 2. تحقق من الدور في قاعدة البيانات

```sql
SELECT ur.role, p.email
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.id
WHERE ur.user_id = 'USER_UUID';
```

### الأدوار المسموحة:
- `pricing_expert` ✅
- `project_manager` ✅
- `admin` ✅

---

## 📝 سيناريوهات الاختبار الشاملة

### السيناريو 1: اختبار كامل الجريان (Happy Path)

```javascript
// 1. تسجيل الدخول
const { user } = await authService.signIn(email, password);

// 2. الحصول على دور المستخدم
const role = await authService.getUserRole(user.id);
console.assert(role === 'pricing_expert', 'User should be pricing_expert');

// 3. جلب الطلب
const request = await requestService.getRequestById(requestId);
console.assert(request.rq_number, 'Request should have rq_number');

// 4. جلب تقرير المعاينة
const report = await fetchInspectionReport(request.rq_number);
console.assert(report.issues.length > 0, 'Report should have issues');

// 5. إضافة التسعيرات
for (const issue of report.issues) {
  for (const item of issue.items) {
    await pricingService.upsertExpertPricing({
      request_id: requestId,
      external_report_item_id: item.id,
      unit_price: 1000.00,
      // ... other fields
    });
  }
}

// 6. تحديث حالة الطلب
await requestService.updateRequestStatus(
  requestId,
  'pending_pricing_approval',
  'تم رفع التسعيرة'
);

console.log('✅ All steps completed successfully!');
```

### السيناريو 2: اختبار معالجة الأخطاء

```javascript
// ❌ اختبر: لا يوجد rq_number
const request = { /* بدون rq_number */ };
try {
  await loadPricingData(request); // يجب أن يرفع خطأ
} catch (e) {
  console.assert(
    e.message.includes('rq_number'),
    'Should mention rq_number'
  );
}

// ❌ اختبر: API معطلة
try {
  const report = await fetchInspectionReport('INVALID_RQ');
  console.assert(!report, 'Should return null');
} catch (e) {
  console.assert(e.status === 404, 'Should return 404');
}

// ❌ اختبر: بدون صلاحيات
const role = 'beneficiary'; // دور بدون صلاحيات
try {
  await checkAuthorization(role);
  console.assert(false, 'Should reject unauthorized user');
} catch (e) {
  console.assert(
    e.message.includes('صلاحية'),
    'Should mention permission'
  );
}
```

### السيناريو 3: اختبار التعديل

```javascript
// 1. جلب التسعيرة الموجودة
const pricing = await pricingService.getExpertPricing(requestId);
console.log('Original price:', pricing[0].unit_price);

// 2. تعديل السعر
const newPrice = 2000.00;
await pricingService.upsertExpertPricing({
  ...pricing[0],
  unit_price: newPrice,
  estimated_price: newPrice * pricing[0].quantity,
});

// 3. التحقق من التحديث
const updated = await pricingService.getExpertPricing(requestId);
console.assert(
  updated[0].unit_price === newPrice,
  'Price should be updated'
);
```

---

## 🖥️ اختبار الواجهة (UI Testing)

### بواسطة Browser DevTools

```javascript
// اختبر جلب البيانات
localStorage.setItem('debug', 'app:*');
// ثم شاهد console لأي رسائل تصحيح

// اختبر الحفظ
await new Promise(resolve => setTimeout(resolve, 2000));
// شاهد Network tab للطلبات المرسلة
```

### بواسطة Playwright

```javascript
import { test, expect } from '@playwright/test';

test('Pricing page loads data correctly', async ({ page }) => {
  // تسجيل الدخول
  await page.goto('/dashboard/login');
  await page.fill('input[name="email"]', 'expert@test.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button:has-text("تسجيل الدخول")');
  
  // انتقل إلى صفحة التسعير
  await page.goto('/dashboard/pricing/request-id-123');
  
  // تحقق من ظهور البنود
  const items = await page.locator('[class*="Card"]');
  await expect(items).not.toHaveCount(0);
  
  // أدخل سعر
  await page.fill('input[type="number"]', '1000');
  
  // احفظ
  await page.click('button:has-text("حفظ")');
  
  // تحقق من النجاح
  await expect(page.locator('text=تم حفظ')).toBeVisible();
});
```

---

## 📊 اختبار الأداء

```javascript
// قياس وقت تحميل البيانات
const start = performance.now();
const data = await pricingService.getExpertPricing(requestId);
const duration = performance.now() - start;
console.log(`Data loaded in ${duration}ms`);

// قياس حجم الاستجابة
const size = JSON.stringify(data).length;
console.log(`Data size: ${(size / 1024).toFixed(2)}KB`);

// قياس استهلاك الذاكرة
console.memory?.() || console.log('Use DevTools for memory profiling');
```

---

## 🔍 Debugging Tips

### 1. تفعيل سجل التصحيح الكامل

```javascript
// في browser console
localStorage.setItem('debug', 'app:*');
location.reload();
```

### 2. فحص RLS Policies

```javascript
// بدون مصادقة - يجب أن يفشل
const { data: noAuth } = await supabase
  .from('expert_pricing')
  .select('*');
console.assert(!noAuth, 'Should fail without auth');

// مع مصادقة - يجب أن ينجح
const { data: withAuth } = await supabase
  .auth.session()
  .then(() => supabase
    .from('expert_pricing')
    .select('*')
  );
console.assert(withAuth, 'Should succeed with auth');
```

### 3. فحص الجلسة

```javascript
const session = await authService.getCurrentSession();
console.log('Session:', session);
console.log('Access Token:', session?.access_token?.substring(0, 20) + '...');
console.log('Expires at:', new Date(session?.expires_at * 1000));
```

---

## ✅ قائمة التحقق الختامية

- [ ] اختبر جلب البيانات من API
- [ ] اختبر عرض البنود
- [ ] اختبر إدخال الأسعار
- [ ] اختبر الحفظ الفوري
- [ ] اختبر الحفظ النهائي
- [ ] اختبر التعديل
- [ ] اختبر الصلاحيات
- [ ] اختبر معالجة الأخطاء
- [ ] اختبر الأداء
- [ ] اختبر في Production

---

## 🆘 قائمة المشاكل الشائعة

### المشكلة: البيانات لا تُحمّل
**الحل:**
1. تحقق من console.log للرسائل
2. تحقق من Network tab للطلبات
3. تحقق من أن rq_number صحيح
4. تحقق من API الخارجية

### المشكلة: الحفظ فاشل
**الحل:**
1. تحقق من رسالة الخطأ
2. تحقق من الجلسة الحالية
3. تحقق من RLS policies
4. تحقق من أن جميع الحقول مملوءة

### المشكلة: لا توجد صلاحيات
**الحل:**
1. تحقق من دور المستخدم في قاعدة البيانات
2. سجل الدخول بحساب صحيح
3. تحقق من RLS policies المرتبطة بالدور
