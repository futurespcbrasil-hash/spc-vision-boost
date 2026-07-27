-- ========================================================
-- SCRIPT COMPLETO DE MIGRAÇÃO SQL PARA O NOVO SUPABASE
-- Execute este script no SQL Editor do seu novo projeto Supabase (supabase.com)
-- ========================================================

-- 1. TIPOS ENUM
CREATE TYPE public.app_role AS ENUM ('vendedor', 'gestor');
CREATE TYPE public.tipo_parceiro_spc AS ENUM ('contabilidade', 'software', 'certificadora', 'consultoria', 'outro');

-- 2. FUNÇÃO HAS_ROLE
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 3. TABELAS DE USUÁRIOS E PERFIS
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'vendedor',
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- 4. TABELAS DE CRM, LEADS E KANBAN
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  company text,
  cpf_cnpj text,
  email text,
  phone text,
  whatsapp text,
  origin text,
  product text,
  status text NOT NULL DEFAULT 'novo',
  type text NOT NULL DEFAULT 'comercial',
  funnel text NOT NULL DEFAULT 'comercial',
  observations text,
  interactions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kanban_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  color text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  funnel text NOT NULL DEFAULT 'comercial',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  conteudo text,
  cor text NOT NULL DEFAULT '#FEF08A',
  concluido boolean NOT NULL DEFAULT false,
  data_lembrete timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.metas_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referencia text NOT NULL,
  ordem integer NOT NULL,
  faturamento numeric,
  salario numeric NOT NULL DEFAULT 0,
  ponto_zero numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  client_email text,
  status text NOT NULL DEFAULT 'scheduled',
  meet_link text,
  google_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.imported_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. TABELAS DE PARCEIROS E CONSULTAS SPC
CREATE TABLE IF NOT EXISTS public.parceiros_spc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  tipo_parceiro public.tipo_parceiro_spc NOT NULL DEFAULT 'outro',
  responsavel text,
  email text,
  whatsapp text,
  cidade text,
  endereco text,
  percentual_comissao numeric NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'ativo',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clientes_indicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros_spc(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  responsavel text,
  email text,
  whatsapp text,
  telefone text,
  cidade text,
  data_indicacao date NOT NULL DEFAULT CURRENT_DATE,
  produto_vendido text,
  valor_venda numeric NOT NULL DEFAULT 0,
  comissao_gerada numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendas_indicadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_indicado_id uuid NOT NULL REFERENCES public.clientes_indicados(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor numeric NOT NULL DEFAULT 0,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. TABELAS DO WHATSAPP & RYZE API
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL UNIQUE,
  phone text,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  ryze_instance_id text,
  token_instance text,
  last_status_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  wa_chat_id text NOT NULL,
  contact_number text NOT NULL,
  contact_name text,
  avatar_url text,
  is_group boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  unread_count integer NOT NULL DEFAULT 0,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  funnel_stage text,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_chats_instance_wa_chat_key UNIQUE (instance_id, wa_chat_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  wa_message_id text,
  from_me boolean NOT NULL DEFAULT false,
  sender text,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type text NOT NULL DEFAULT 'text',
  text text,
  media_url text,
  media_mime text,
  media_filename text,
  status text DEFAULT 'sent',
  error text,
  raw jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_instance_wa_msg_key UNIQUE (instance_id, wa_message_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  wa_number text NOT NULL,
  name text,
  push_name text,
  avatar_url text,
  is_group boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_contacts_instance_number_key UNIQUE (instance_id, wa_number)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#8B5CF6',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_chat_labels (
  chat_id uuid NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.whatsapp_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, label_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. HABILITAR ROW LEVEL SECURITY (RLS) E REGRAS DE PERMISSÃO
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso completo a perfis" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Permitir acesso a roles" ON public.user_roles FOR ALL USING (true);
CREATE POLICY "Permitir acesso completo a leads" ON public.leads FOR ALL USING (true);
CREATE POLICY "Permitir acesso a instancias whatsapp" ON public.whatsapp_instances FOR ALL USING (true);
CREATE POLICY "Permitir acesso a chats whatsapp" ON public.whatsapp_chats FOR ALL USING (true);
CREATE POLICY "Permitir acesso a mensagens whatsapp" ON public.whatsapp_messages FOR ALL USING (true);
CREATE POLICY "Permitir acesso a contatos whatsapp" ON public.whatsapp_contacts FOR ALL USING (true);

-- 8. HABILITAR SUPABASE REALTIME NAS TABELAS DO WHATSAPP
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
