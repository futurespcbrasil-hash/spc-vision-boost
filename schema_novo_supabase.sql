-- Execute este script no SQL Editor do seu novo projeto Supabase (supabase.com)
-- IMPORTANTE: Antes de executar, substitua 'sua_senha_segura' por uma senha real ou use a interface para criar.

-- Este script consolida toda a estrutura de tabelas, roles e enums necessários para o CRM rodar perfeitamente.

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
  allowed_sectors text[] DEFAULT '{}'::text[],
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
  color text NOT NULL DEFAULT '#8B5CF6',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#8B5CF6',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==========================================
-- POLÍTICAS DE RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_labels ENABLE ROW LEVEL SECURITY;

-- Políticas super permissivas para facilitar o início (recomenda-se ajustar depois)
CREATE POLICY "Permitir leitura para autenticados" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir inserção para autenticados" ON public.profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permitir atualização do próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Leitura total leads" ON public.leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Inserção total leads" ON public.leads FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Atualização total leads" ON public.leads FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Leitura total whatsapp" ON public.whatsapp_instances FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Leitura total chats" ON public.whatsapp_chats FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Leitura total msgs" ON public.whatsapp_messages FOR ALL USING (auth.role() = 'authenticated');
