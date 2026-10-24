-- ==============================================================================
-- CampusFind Production Database Migration
-- PostgreSQL schema for Supabase: Auth, Tables, Constraints, Indexes, RLS Policies
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'staff', 'moderator', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automatic Profile Creation on User Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Items Table (Lost & Found Listings)
CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
  title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 100),
  category TEXT NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) >= 5 AND char_length(description) <= 2000),
  color TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL CHECK (char_length(location) >= 2 AND char_length(location) <= 150),
  date DATE NOT NULL,
  time TEXT,
  image_url TEXT,
  handover BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Possible Match', 'Claim Pending', 'Recovered', 'Closed')),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Fast Search, Filtering, and Matching
CREATE INDEX IF NOT EXISTS idx_items_type ON public.items(type);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status);
CREATE INDEX IF NOT EXISTS idx_items_date ON public.items(date DESC);
CREATE INDEX IF NOT EXISTS idx_items_owner ON public.items(owner_id);
CREATE INDEX IF NOT EXISTS idx_items_is_demo ON public.items(is_demo);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items(created_at DESC);

-- 3. Claims Table (Ownership Verification)
CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  claimant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimant_name TEXT NOT NULL,
  contact_phone TEXT,
  details TEXT NOT NULL CHECK (char_length(details) >= 12 AND char_length(details) <= 1500),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Under Review', 'Approved', 'Rejected', 'Completed')),
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claims_item ON public.claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON public.claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);

-- 4. Abuse Reports Table (Flagging Listings)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) >= 3 AND char_length(reason) <= 100),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_item ON public.reports(item_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 5. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is moderator or admin
CREATE OR REPLACE FUNCTION public.is_admin_or_mod()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Public profiles are readable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Items Policies
-- Anyone (authenticated or public visitor) can read approved, non-removed items
CREATE POLICY "Public items readable by everyone"
  ON public.items FOR SELECT
  USING (moderation_status = 'approved' OR auth.uid() = owner_id OR public.is_admin_or_mod());

-- Authenticated users can insert items owned by themselves
CREATE POLICY "Authenticated users can create items"
  ON public.items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Item owners can update their own items
CREATE POLICY "Owners can update their items"
  ON public.items FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin_or_mod());

-- Item owners can delete their own items (or admin)
CREATE POLICY "Owners can delete their items"
  ON public.items FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id OR public.is_admin_or_mod());

-- Claims Policies
-- Claimant and Item Owner can view claim details (keeps private verification details secure)
CREATE POLICY "Authorized users can read claims"
  ON public.claims FOR SELECT
  TO authenticated
  USING (
    auth.uid() = claimant_id OR
    auth.uid() IN (SELECT owner_id FROM public.items WHERE id = public.claims.item_id) OR
    public.is_admin_or_mod()
  );

-- Authenticated users can create claims for found items they do not own
CREATE POLICY "Authenticated users can create claims"
  ON public.claims FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = claimant_id AND
    auth.uid() NOT IN (SELECT owner_id FROM public.items WHERE id = item_id)
  );

-- Item owner, claimant, or admin can update claim status
CREATE POLICY "Item owner or claimant can update claim"
  ON public.claims FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = claimant_id OR
    auth.uid() IN (SELECT owner_id FROM public.items WHERE id = public.claims.item_id) OR
    public.is_admin_or_mod()
  );

-- Reports Policies
CREATE POLICY "Authenticated users can submit reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Only reporter or admin can read reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR public.is_admin_or_mod());

-- Notifications Policies
CREATE POLICY "Users can manage their own notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================================================
-- Supabase Storage Bucket Configuration
-- ==============================================================================
-- Run in Supabase SQL editor:
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read item images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'item-images');

CREATE POLICY "Authenticated users can upload item images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'item-images');
