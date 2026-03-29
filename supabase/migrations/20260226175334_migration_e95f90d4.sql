-- إنشاء ENUM للحالات المختلفة
CREATE TYPE request_status AS ENUM (
  'pending_review',           -- بانتظار مراجعة خدمة العملاء
  'accepted_initial',         -- مقبول مبدئياً
  'rejected',                 -- مرفوض
  'approved',                 -- معتمد من مدير المشاريع
  'pending_inspection',       -- بانتظار المعاينة
  'pending_inspection_approval', -- بانتظار اعتماد المعاينة
  'pending_expert_pricing',   -- بانتظار تسعير الخبير
  'pending_pricing_approval', -- بانتظار اعتماد التسعير
  'pending_beneficiary_approval', -- بانتظار موافقة المستفيد
  'pending_funding',          -- بانتظار اكتمال المبلغ
  'pending_contractor_bids',  -- بانتظار عروض المقاولين
  'pending_final_approval',   -- بانتظار الموافقة النهائية
  'in_progress',              -- قيد التنفيذ
  'pending_final_report',     -- بانتظار التقرير الختامي
  'pending_closure',          -- بانتظار الإغلاق
  'closed',                   -- مغلق
  'cancelled'                 -- ملغي
);

CREATE TYPE user_role AS ENUM (
  'beneficiary',      -- مستفيد/مقدم طلب
  'customer_service', -- خدمة العملاء
  'project_manager',  -- مدير المشاريع
  'technician',       -- فني
  'pricing_expert',   -- خبير التسعير
  'mosque_management', -- إدارة المساجد
  'admin'             -- مدير النظام
);

CREATE TYPE funding_type AS ENUM (
  'ehsan',           -- إحسان
  'direct_donor',    -- متبرع مباشر
  'store_opportunity' -- فرصة متجر
);

-- جدول المدن
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الأحياء
CREATE TABLE districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(city_id, name)
);

-- جدول المساجد
CREATE TABLE mosques (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول أنواع الاحتياجات
CREATE TABLE request_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الطلبات الرئيسية
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rq_number TEXT UNIQUE, -- رقم الطلب الرسمي (يتم توليده بعد الاعتماد)
  
  -- بيانات مقدم الطلب
  beneficiary_name TEXT NOT NULL,
  beneficiary_phone TEXT NOT NULL,
  beneficiary_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- بيانات الطلب
  mosque_id UUID NOT NULL REFERENCES mosques(id) ON DELETE RESTRICT,
  request_type_id UUID NOT NULL REFERENCES request_types(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  
  -- الحالة والمراحل
  current_status request_status DEFAULT 'pending_review',
  
  -- الفريق المسؤول
  assigned_technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_pricing_expert_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- التمويل
  approved_amount DECIMAL(10,2),
  funding_completed BOOLEAN DEFAULT false,
  funding_type funding_type,
  funding_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- الأختام الزمنية
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE
);

-- جدول سجل الحالات (Timeline)
CREATE TABLE request_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  previous_status request_status,
  new_status request_status NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول بنود المعاينة
CREATE TABLE inspection_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  main_item TEXT NOT NULL,      -- البند الرئيسي
  sub_item TEXT NOT NULL,        -- البند الفرعي
  specifications TEXT,           -- المواصفات
  notes TEXT,                    -- ملاحظات فنية
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول صور البنود
CREATE TABLE item_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_item_id UUID NOT NULL REFERENCES inspection_items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول تسعير الخبير
CREATE TABLE expert_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_item_id UUID NOT NULL REFERENCES inspection_items(id) ON DELETE CASCADE,
  estimated_price DECIMAL(10,2) NOT NULL,
  pricing_notes TEXT,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول المقاولين
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  license_number TEXT,
  rating DECIMAL(3,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول عروض المقاولين
CREATE TABLE contractor_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_item_id UUID NOT NULL REFERENCES inspection_items(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE RESTRICT,
  bid_amount DECIMAL(10,2) NOT NULL,
  bid_document_url TEXT, -- رابط PDF العرض
  is_selected BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول التقارير الختامية
CREATE TABLE final_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  report_document_url TEXT NOT NULL,
  additional_notes TEXT,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- جدول التقييمات
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  service_quality_rating INTEGER CHECK (service_quality_rating >= 1 AND service_quality_rating <= 5),
  timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول أدوار المستخدمين
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- جدول الإشعارات
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء indexes لتحسين الأداء
CREATE INDEX idx_requests_status ON requests(current_status);
CREATE INDEX idx_requests_rq_number ON requests(rq_number);
CREATE INDEX idx_requests_mosque ON requests(mosque_id);
CREATE INDEX idx_requests_beneficiary_phone ON requests(beneficiary_phone);
CREATE INDEX idx_status_history_request ON request_status_history(request_id);
CREATE INDEX idx_inspection_items_request ON inspection_items(request_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);