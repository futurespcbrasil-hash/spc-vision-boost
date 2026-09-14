-- Future Remote: vínculo seguro entre solicitação, convite MeshCentral e computador.
-- Compatível com instalações que já possuem as tabelas do módulo.

ALTER TABLE public.future_remote_requests
  ADD COLUMN IF NOT EXISTS mesh_group_id text,
  ADD COLUMN IF NOT EXISTS agent_download_url text,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;

ALTER TABLE public.future_remote_devices
  ADD COLUMN IF NOT EXISTS mesh_group_id text,
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_future_remote_requests_mesh_group_id
  ON public.future_remote_requests(mesh_group_id);

CREATE INDEX IF NOT EXISTS idx_future_remote_devices_mesh_group_id
  ON public.future_remote_devices(mesh_group_id);

CREATE INDEX IF NOT EXISTS idx_future_remote_devices_request_id
  ON public.future_remote_devices(request_id);

-- Uma solicitação representa um único computador conectado.
CREATE UNIQUE INDEX IF NOT EXISTS ux_future_remote_devices_request_id
  ON public.future_remote_devices(request_id)
  WHERE request_id IS NOT NULL;
