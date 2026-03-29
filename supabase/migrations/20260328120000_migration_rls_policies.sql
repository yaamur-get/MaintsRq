-- =====================================================
-- إضافة سياسات RLS لضمان وصول المستخدمين المُصادق عليهم
-- لجميع الجداول الرئيسية في النظام
-- =====================================================

-- =====================================================
-- جدول الطلبات (requests)
-- =====================================================
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'requests' AND policyname = 'authenticated_users_read_requests') THEN
    CREATE POLICY "authenticated_users_read_requests"
      ON requests FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'requests' AND policyname = 'authenticated_users_insert_requests') THEN
    CREATE POLICY "authenticated_users_insert_requests"
      ON requests FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'requests' AND policyname = 'authenticated_users_update_requests') THEN
    CREATE POLICY "authenticated_users_update_requests"
      ON requests FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- جدول سجل الحالات (request_status_history)
-- =====================================================
ALTER TABLE request_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'request_status_history' AND policyname = 'authenticated_users_read_history') THEN
    CREATE POLICY "authenticated_users_read_history"
      ON request_status_history FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'request_status_history' AND policyname = 'authenticated_users_insert_history') THEN
    CREATE POLICY "authenticated_users_insert_history"
      ON request_status_history FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- جدول الملفات الشخصية (profiles)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'authenticated_users_read_profiles') THEN
    CREATE POLICY "authenticated_users_read_profiles"
      ON profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'users_insert_own_profile') THEN
    CREATE POLICY "users_insert_own_profile"
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'users_update_own_profile') THEN
    CREATE POLICY "users_update_own_profile"
      ON profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- =====================================================
-- جدول أدوار المستخدمين (user_roles)
-- =====================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'authenticated_users_read_roles') THEN
    CREATE POLICY "authenticated_users_read_roles"
      ON user_roles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================
-- جدول المساجد (mosques)
-- =====================================================
ALTER TABLE mosques ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mosques' AND policyname = 'authenticated_users_read_mosques') THEN
    CREATE POLICY "authenticated_users_read_mosques"
      ON mosques FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mosques' AND policyname = 'authenticated_users_write_mosques') THEN
    CREATE POLICY "authenticated_users_write_mosques"
      ON mosques FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- جدول أنواع الطلبات (request_types)
-- =====================================================
ALTER TABLE request_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'request_types' AND policyname = 'authenticated_users_read_request_types') THEN
    CREATE POLICY "authenticated_users_read_request_types"
      ON request_types FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================
-- جدول المدن (cities)
-- =====================================================
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cities' AND policyname = 'authenticated_users_read_cities') THEN
    CREATE POLICY "authenticated_users_read_cities"
      ON cities FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================
-- جدول الأحياء (districts)
-- =====================================================
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'districts' AND policyname = 'authenticated_users_read_districts') THEN
    CREATE POLICY "authenticated_users_read_districts"
      ON districts FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================
-- جدول بنود المعاينة (inspection_items)
-- =====================================================
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inspection_items' AND policyname = 'authenticated_users_read_inspection_items') THEN
    CREATE POLICY "authenticated_users_read_inspection_items"
      ON inspection_items FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inspection_items' AND policyname = 'authenticated_users_write_inspection_items') THEN
    CREATE POLICY "authenticated_users_write_inspection_items"
      ON inspection_items FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- جدول تسعير الخبير (expert_pricing)
-- =====================================================
ALTER TABLE expert_pricing ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expert_pricing' AND policyname = 'authenticated_users_read_expert_pricing') THEN
    CREATE POLICY "authenticated_users_read_expert_pricing"
      ON expert_pricing FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expert_pricing' AND policyname = 'authenticated_users_write_expert_pricing') THEN
    CREATE POLICY "authenticated_users_write_expert_pricing"
      ON expert_pricing FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- جدول عروض المقاولين (contractor_bids)
-- =====================================================
ALTER TABLE contractor_bids ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contractor_bids' AND policyname = 'authenticated_users_read_contractor_bids') THEN
    CREATE POLICY "authenticated_users_read_contractor_bids"
      ON contractor_bids FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contractor_bids' AND policyname = 'authenticated_users_write_contractor_bids') THEN
    CREATE POLICY "authenticated_users_write_contractor_bids"
      ON contractor_bids FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- جدول الإشعارات (notifications)
-- =====================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'users_read_own_notifications') THEN
    CREATE POLICY "users_read_own_notifications"
      ON notifications FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'authenticated_users_insert_notifications') THEN
    CREATE POLICY "authenticated_users_insert_notifications"
      ON notifications FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'users_update_own_notifications') THEN
    CREATE POLICY "users_update_own_notifications"
      ON notifications FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- =====================================================
-- جدول ترجمات الحالات (status_translations)
-- =====================================================
ALTER TABLE status_translations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'status_translations' AND policyname = 'authenticated_users_read_status_translations') THEN
    CREATE POLICY "authenticated_users_read_status_translations"
      ON status_translations FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================
-- جدول المقاولين (contractors)
-- =====================================================
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contractors' AND policyname = 'authenticated_users_read_contractors') THEN
    CREATE POLICY "authenticated_users_read_contractors"
      ON contractors FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- =====================================================
-- جدول الصور (item_images)
-- =====================================================
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'item_images' AND policyname = 'authenticated_users_read_item_images') THEN
    CREATE POLICY "authenticated_users_read_item_images"
      ON item_images FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'item_images' AND policyname = 'authenticated_users_write_item_images') THEN
    CREATE POLICY "authenticated_users_write_item_images"
      ON item_images FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- جدول التقارير الختامية (final_reports)
-- =====================================================
ALTER TABLE final_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'final_reports' AND policyname = 'authenticated_users_read_final_reports') THEN
    CREATE POLICY "authenticated_users_read_final_reports"
      ON final_reports FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'final_reports' AND policyname = 'authenticated_users_write_final_reports') THEN
    CREATE POLICY "authenticated_users_write_final_reports"
      ON final_reports FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- جدول التقييمات (evaluations)
-- =====================================================
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evaluations' AND policyname = 'authenticated_users_read_evaluations') THEN
    CREATE POLICY "authenticated_users_read_evaluations"
      ON evaluations FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evaluations' AND policyname = 'authenticated_users_write_evaluations') THEN
    CREATE POLICY "authenticated_users_write_evaluations"
      ON evaluations FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- روابط الموافقة (approval_links)
-- =====================================================
ALTER TABLE approval_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approval_links' AND policyname = 'authenticated_users_read_approval_links') THEN
    CREATE POLICY "authenticated_users_read_approval_links"
      ON approval_links FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approval_links' AND policyname = 'authenticated_users_write_approval_links') THEN
    CREATE POLICY "authenticated_users_write_approval_links"
      ON approval_links FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- السماح للأنونيموس بقراءة رابط الموافقة عبر التوكن (للمستفيد غير المسجل)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approval_links' AND policyname = 'anon_read_approval_links') THEN
    CREATE POLICY "anon_read_approval_links"
      ON approval_links FOR SELECT
      TO anon
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approval_links' AND policyname = 'anon_update_approval_links') THEN
    CREATE POLICY "anon_update_approval_links"
      ON approval_links FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
