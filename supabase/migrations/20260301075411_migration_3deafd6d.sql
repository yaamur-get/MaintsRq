-- إضافة عمود mosque_number للمساجد (رقم تسلسلي)
ALTER TABLE mosques ADD COLUMN IF NOT EXISTS mosque_number SERIAL;

-- إنشاء فهرس فريد على mosque_number
CREATE UNIQUE INDEX IF NOT EXISTS mosques_mosque_number_key ON mosques(mosque_number);

-- تحديث أرقام المساجد الموجودة (إن لم تكن محدثة)
DO $$
DECLARE
  mosque_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR mosque_record IN 
    SELECT id FROM mosques WHERE mosque_number IS NULL OR mosque_number = 0 ORDER BY created_at
  LOOP
    UPDATE mosques SET mosque_number = counter WHERE id = mosque_record.id;
    counter := counter + 1;
  END LOOP;
END $$;