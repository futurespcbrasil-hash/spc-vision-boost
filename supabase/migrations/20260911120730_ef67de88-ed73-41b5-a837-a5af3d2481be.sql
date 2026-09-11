
CREATE TABLE public.future_remote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  client_name text NOT NULL,
  client_company text,
  client_phone text,
  computer_name text,
  mesh_device_id text,
  status text NOT NULL DEFAULT 'aguardando',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attended_by_name text,
  expires_at timestamptz NOT NULL,
  validated_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_remote_requests TO authenticated;
GRANT ALL ON public.future_remote_requests TO service_role;
ALTER TABLE public.future_remote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_requests_select" ON public.future_remote_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "fr_requests_insert" ON public.future_remote_requests FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "fr_requests_update" ON public.future_remote_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fr_requests_delete" ON public.future_remote_requests FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

CREATE TABLE public.future_remote_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mesh_device_id text NOT NULL UNIQUE,
  device_name text NOT NULL,
  client_name text,
  client_company text,
  operating_system text,
  status text NOT NULL DEFAULT 'offline',
  last_seen timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_remote_devices TO authenticated;
GRANT ALL ON public.future_remote_devices TO service_role;
ALTER TABLE public.future_remote_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_devices_select" ON public.future_remote_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "fr_devices_insert" ON public.future_remote_devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fr_devices_update" ON public.future_remote_devices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fr_devices_delete" ON public.future_remote_devices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE TABLE public.future_remote_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.future_remote_requests(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.future_remote_devices(id) ON DELETE SET NULL,
  attended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attended_by_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'em_atendimento',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_remote_sessions TO authenticated;
GRANT ALL ON public.future_remote_sessions TO service_role;
ALTER TABLE public.future_remote_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_sessions_select" ON public.future_remote_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fr_sessions_insert" ON public.future_remote_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fr_sessions_update" ON public.future_remote_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fr_sessions_delete" ON public.future_remote_sessions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE TABLE public.future_remote_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  mesh_group text NOT NULL DEFAULT 'Future Remote',
  code_ttl_minutes integer NOT NULL DEFAULT 10,
  public_support_url text,
  mesh_server_configured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.future_remote_settings TO authenticated;
GRANT ALL ON public.future_remote_settings TO service_role;
ALTER TABLE public.future_remote_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_settings_select" ON public.future_remote_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "fr_settings_insert" ON public.future_remote_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "fr_settings_update" ON public.future_remote_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_fr_requests_updated BEFORE UPDATE ON public.future_remote_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fr_devices_updated BEFORE UPDATE ON public.future_remote_devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fr_sessions_updated BEFORE UPDATE ON public.future_remote_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fr_settings_updated BEFORE UPDATE ON public.future_remote_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fr_requests_status ON public.future_remote_requests(status);
CREATE INDEX idx_fr_sessions_request ON public.future_remote_sessions(request_id);
