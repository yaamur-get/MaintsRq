-- إضافة سياسات RLS لجدول mosque_addition_requests

-- السماح لأي شخص بإضافة طلب (للمستفيدين من الموقع الرئيسي)
CREATE POLICY "Anyone can submit mosque addition request"
ON mosque_addition_requests
FOR INSERT
TO public
WITH CHECK (true);

-- السماح لجميع المستخدمين المصادق عليهم بقراءة الطلبات
CREATE POLICY "Authenticated users can view mosque addition requests"
ON mosque_addition_requests
FOR SELECT
TO authenticated
USING (true);

-- السماح للمستخدمين المصادق عليهم بتحديث الطلبات (للموافقة/الرفض)
CREATE POLICY "Authenticated users can update mosque addition requests"
ON mosque_addition_requests
FOR UPDATE
TO authenticated
USING (true);