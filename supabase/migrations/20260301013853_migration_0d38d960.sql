-- إنشاء جدول طلبات إضافة المساجد (منفصل عن طلبات الصيانة)
CREATE TABLE IF NOT EXISTS mosque_addition_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_name TEXT NOT NULL,
  requester_phone TEXT NOT NULL,
  city_name TEXT NOT NULL,
  district_name TEXT,
  mosque_name TEXT NOT NULL,
  google_maps_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- تمكين RLS
ALTER TABLE mosque_addition_requests ENABLE ROW LEVEL SECURITY;

-- السياسات: أي شخص يمكنه إنشاء طلب، فقط الموظفين يمكنهم القراءة/التحديث
CREATE POLICY "Anyone can create mosque addition requests"
  ON mosque_addition_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff can view mosque addition requests"
  ON mosque_addition_requests FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update mosque addition requests"
  ON mosque_addition_requests FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- إضافة فهرس للأداء
CREATE INDEX IF NOT EXISTS idx_mosque_addition_status ON mosque_addition_requests(status);
CREATE INDEX IF NOT EXISTS idx_mosque_addition_created ON mosque_addition_requests(created_at DESC);