
-- CLIENTES
CREATE TABLE public.remote_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  documento text,
  email text,
  telefone text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remote_clients TO authenticated;
GRANT ALL ON public.remote_clients TO service_role;
ALTER TABLE public.remote_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remote_clients_select" ON public.remote_clients FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_clients_insert" ON public.remote_clients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "remote_clients_update" ON public.remote_clients FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_clients_delete" ON public.remote_clients FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

-- COMPUTADORES
CREATE TABLE public.remote_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.remote_clients(id) ON DELETE SET NULL,
  agent_id text NOT NULL,
  hostname text NOT NULL,
  operating_system text,
  status text NOT NULL DEFAULT 'offline',
  last_seen timestamptz,
  public_ip text,
  local_ips text,
  cpu_model text,
  total_ram numeric,
  description text,
  mesh_node_id text,
  raw jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remote_devices_agent_unique UNIQUE (user_id, agent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remote_devices TO authenticated;
GRANT ALL ON public.remote_devices TO service_role;
ALTER TABLE public.remote_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remote_devices_select" ON public.remote_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_devices_insert" ON public.remote_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "remote_devices_update" ON public.remote_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_devices_delete" ON public.remote_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

-- SESSOES
CREATE TABLE public.remote_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.remote_devices(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.remote_clients(id) ON DELETE SET NULL,
  device_hostname text,
  operator_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'ativa',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remote_sessions TO authenticated;
GRANT ALL ON public.remote_sessions TO service_role;
ALTER TABLE public.remote_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remote_sessions_select" ON public.remote_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_sessions_insert" ON public.remote_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "remote_sessions_update" ON public.remote_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_sessions_delete" ON public.remote_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

-- PERMISSOES
CREATE TABLE public.remote_users_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.remote_clients(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.remote_devices(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_connect boolean NOT NULL DEFAULT false,
  can_manage boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remote_users_permissions TO authenticated;
GRANT ALL ON public.remote_users_permissions TO service_role;
ALTER TABLE public.remote_users_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remote_perms_select" ON public.remote_users_permissions FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_perms_insert" ON public.remote_users_permissions FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_perms_update" ON public.remote_users_permissions FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "remote_perms_delete" ON public.remote_users_permissions FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'));

-- CONFIGURACOES
CREATE TABLE public.remote_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rmm_url text,
  api_key_configured boolean NOT NULL DEFAULT false,
  mesh_url text,
  auto_sync boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_connection_status text,
  last_connection_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remote_settings TO authenticated;
GRANT ALL ON public.remote_settings TO service_role;
ALTER TABLE public.remote_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remote_settings_select" ON public.remote_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "remote_settings_insert" ON public.remote_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "remote_settings_update" ON public.remote_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "remote_settings_delete" ON public.remote_settings FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- TRIGGERS updated_at
CREATE TRIGGER trg_remote_clients_updated BEFORE UPDATE ON public.remote_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_remote_devices_updated BEFORE UPDATE ON public.remote_devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_remote_sessions_updated BEFORE UPDATE ON public.remote_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_remote_perms_updated BEFORE UPDATE ON public.remote_users_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_remote_settings_updated BEFORE UPDATE ON public.remote_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_remote_devices_client ON public.remote_devices(client_id);
CREATE INDEX idx_remote_sessions_device ON public.remote_sessions(device_id);
