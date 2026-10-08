CREATE TABLE public.boleto_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  razao_social text,
  cpf_cnpj text,
  whatsapp text,
  email text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boleto_clientes TO authenticated;
GRANT ALL ON public.boleto_clientes TO service_role;
ALTER TABLE public.boleto_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bc_select" ON public.boleto_clientes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "bc_insert" ON public.boleto_clientes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bc_update" ON public.boleto_clientes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "bc_delete" ON public.boleto_clientes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_boleto_clientes_updated BEFORE UPDATE ON public.boleto_clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.boleto_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid REFERENCES public.boleto_clientes(id) ON DELETE SET NULL,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_hash text NOT NULL,
  nome_extraido text,
  cpf_cnpj_extraido text,
  valor numeric,
  vencimento date,
  nosso_numero text,
  linha_digitavel text,
  codigo_barras text,
  numero_documento text,
  data_emissao date,
  banco text,
  whatsapp text,
  mensagem text,
  match_info text,
  status text NOT NULL DEFAULT 'importado',
  api_message_id text,
  api_resposta text,
  enviado_em timestamptz,
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_boleto_envios_user_hash ON public.boleto_envios(user_id, arquivo_hash);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boleto_envios TO authenticated;
GRANT ALL ON public.boleto_envios TO service_role;
ALTER TABLE public.boleto_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "be_select" ON public.boleto_envios FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "be_insert" ON public.boleto_envios FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "be_update" ON public.boleto_envios FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "be_delete" ON public.boleto_envios FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_boleto_envios_updated BEFORE UPDATE ON public.boleto_envios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.boleto_envio_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  boleto_id uuid NOT NULL REFERENCES public.boleto_envios(id) ON DELETE CASCADE,
  status text NOT NULL,
  whatsapp text,
  resposta text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.boleto_envio_logs TO authenticated;
GRANT ALL ON public.boleto_envio_logs TO service_role;
ALTER TABLE public.boleto_envio_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bl_select" ON public.boleto_envio_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "bl_insert" ON public.boleto_envio_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.boleto_mensagem_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boleto_mensagem_templates TO authenticated;
GRANT ALL ON public.boleto_mensagem_templates TO service_role;
ALTER TABLE public.boleto_mensagem_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bt_all" ON public.boleto_mensagem_templates FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_boleto_templates_updated BEFORE UPDATE ON public.boleto_mensagem_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "boletos_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'boletos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'gestor')));
CREATE POLICY "boletos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'boletos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "boletos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'boletos' AND (storage.foldername(name))[1] = auth.uid()::text);