import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODULE_KEYS = [
  "dashboard", "crm", "leads", "agenda", "relatorios", "metas", "notas", "chat",
  "consultas_spc", "consulta_cnpj", "consulta_sintegra", "consulta_cnpj_lote",
  "whatsapp", "future_remote", "comissoes", "parceiros", "financeiro",
  "produtos", "comparador", "gerar_link", "revendas", "perfil", "usuarios", "indicacoes_atendimento"
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Sessão não informada." }, 401);

    const token = authorization.slice(7);
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const isOwner = user.email?.toLowerCase() === "dalprapf1@gmail.com";
    const { data: callerRoles, error: callerRolesError } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (callerRolesError) throw callerRolesError;
    const isGestor = (callerRoles || []).some((item) => item.role === "gestor");
    const canManageUsers = isOwner || isGestor;
    if (!canManageUsers) return json({ error: "Somente o responsável principal ou um Gestor pode administrar usuários." }, 403);

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "list") {
      // Fetch every page: the Auth admin API returns at most 1,000 users per page.
      const pageSize = 1000;
      let page = 1;
      const listedUsers: Array<{
        id: string;
        email?: string;
        user_metadata?: { display_name?: string };
        created_at: string;
      }> = [];

      while (true) {
        const { data: listed, error: listError } = await admin.auth.admin.listUsers({
          page,
          perPage: pageSize,
        });
        if (listError) throw listError;

        const pageUsers = listed?.users ?? [];
        listedUsers.push(...pageUsers);
        if (pageUsers.length < pageSize) break;
        page += 1;
      }

      if (listedUsers.length === 0) return json({ users: [] });

      // Keep .in() requests bounded to avoid excessively large PostgREST URLs.
      const chunkSize = 500;
      const profiles: Array<{ user_id: string; display_name: string | null; email: string | null }> = [];
      const userRoles: Array<{ user_id: string; role: string }> = [];
      const perms: Array<{ user_id: string; module_key: string; can_access: boolean }> = [];

      for (let offset = 0; offset < listedUsers.length; offset += chunkSize) {
        const ids = listedUsers.slice(offset, offset + chunkSize).map((u) => u.id);
        const [profileResult, roleResult, permissionResult] = await Promise.all([
          admin.from("profiles").select("user_id,display_name,email").in("user_id", ids),
          admin.from("user_roles").select("user_id,role").in("user_id", ids),
          admin.from("user_module_permissions").select("user_id,module_key,can_access").in("user_id", ids),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (roleResult.error) throw roleResult.error;
        if (permissionResult.error) throw permissionResult.error;

        profiles.push(...(profileResult.data ?? []));
        userRoles.push(...(roleResult.data ?? []));
        perms.push(...(permissionResult.data ?? []));
      }

      // Build lookup maps once instead of repeatedly scanning every result for each user.
      const profileByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
      const roleByUser = new Map<string, string>();
      for (const item of userRoles) {
        if (!roleByUser.has(item.user_id)) roleByUser.set(item.user_id, item.role);
      }

      const permissionsByUser = new Map<string, Array<{ module_key: string; can_access: boolean }>>();
      for (const permission of perms) {
        const userPermissions = permissionsByUser.get(permission.user_id) ?? [];
        userPermissions.push({
          module_key: permission.module_key,
          can_access: permission.can_access,
        });
        permissionsByUser.set(permission.user_id, userPermissions);
      }

      return json({
        users: listedUsers.map((u) => ({
          id: u.id,
          email: u.email || "",
          name: profileByUser.get(u.id)?.display_name || u.user_metadata?.display_name || "",
          role: roleByUser.get(u.id) || "vendedor",
          permissions: permissionsByUser.get(u.id) ?? [],
          created_at: u.created_at,
        })),
      });
    }

    if (action === "create") {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = String(body.role || "");
      const requestedModules = Array.isArray(body.modules) ? body.modules.filter((m: unknown) => typeof m === "string" && MODULE_KEYS.includes(m)) : [];
      // Initial access is decided by the server, not by a client-supplied module list.
      // Gestors start with every registered module; other roles receive their standard defaults.
      const DEFAULT_MODULES_BY_ROLE: Record<string, string[]> = {
        vendedor: [
          "dashboard", "crm", "leads", "agenda", "relatorios", "metas", "notas", "chat",
          "consultas_spc", "consulta_cnpj", "consulta_sintegra", "comparador", "gerar_link", "perfil",
        ],
        gestor: [...MODULE_KEYS],
        atendimento: ["dashboard", "leads", "agenda", "chat", "whatsapp", "financeiro", "perfil", "indicacoes_atendimento"],
      };
      const modules = role in DEFAULT_MODULES_BY_ROLE ? DEFAULT_MODULES_BY_ROLE[role] : requestedModules;
      if (!name || !email || !password) return json({ error: "Informe nome, e-mail e senha." }, 400);
      if (password.length < 6) return json({ error: "A senha deve ter pelo menos 6 caracteres." }, 400);
      if (!["vendedor", "gestor", "atendimento"].includes(role)) return json({ error: "Tipo de usuário inválido." }, 400);
      if (!isOwner && role === "gestor") return json({ error: "Somente o responsável principal pode criar outro gestor." }, 403);

      // A protected one-time marker allows the database trigger to distinguish
      // this server-authorized provisioning request from public sign-up attempts.
      const { error: provisioningError } = await admin
        .from("admin_user_provisioning")
        .upsert({ email }, { onConflict: "email" });
      if (provisioningError) {
        console.error("Could not authorize user provisioning", provisioningError);
        return json({ error: "Não foi possível preparar a criação da conta. Verifique a configuração do banco." }, 500);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
        app_metadata: { provisioned_by_admin: true },
      });
      if (createError) {
        await admin.from("admin_user_provisioning").delete().eq("email", email);
        return json({ error: createError.message }, 400);
      }
      // The trigger consumes the marker atomically when the auth user is inserted.
      // Cleanup here also handles any marker left behind by unusual Auth failures.
      await admin.from("admin_user_provisioning").delete().eq("email", email);
      const newUserId = created.user.id;

      const { error: roleDeleteError } = await admin.from("user_roles").delete().eq("user_id", newUserId);
      if (roleDeleteError) throw roleDeleteError;
      const { error: roleInsertError } = await admin.from("user_roles").insert({ user_id: newUserId, role });
      if (roleInsertError) throw roleInsertError;

      const { error: profileError } = await admin.from("profiles").upsert(
        { user_id: newUserId, display_name: name, email },
        { onConflict: "user_id" },
      );
      if (profileError) throw profileError;

      if (role !== "vendedor") {
        await admin.from("vendedores_comissoes").delete().eq("user_id", newUserId);
      }

      const permissionRows = MODULE_KEYS.map((module_key) => ({
        user_id: newUserId,
        module_key,
        can_access: modules.includes(module_key),
        updated_by: user.id,
      }));
      const { error: permissionsError } = await admin.from("user_module_permissions").upsert(permissionRows, { onConflict: "user_id,module_key" });
      if (permissionsError) throw permissionsError;

      return json({ success: true, user: { id: newUserId, name, email, role } }, 201);
    }

    if (action === "permissions") {
      const targetUserId = String(body.user_id || "");
      const modules = Array.isArray(body.modules) ? body.modules.filter((m: unknown) => typeof m === "string" && MODULE_KEYS.includes(m)) : [];
      if (!targetUserId) return json({ error: "Usuário não informado." }, 400);
      const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", targetUserId);
      const targetIsGestor = (targetRoles || []).some((r) => r.role === "gestor");
      if (!isOwner && targetIsGestor) {
        return json({ error: "Somente o responsável principal pode alterar permissões de outro Gestor." }, 403);
      }
      // The owner can explicitly enable or disable modules for any target, including Gestores.
      // Non-owner Gestors are blocked above from changing another Gestor's permissions.
      const grantedModules = modules;
      const rows = MODULE_KEYS.map((module_key) => ({
        user_id: targetUserId,
        module_key,
        can_access: grantedModules.includes(module_key),
        updated_by: user.id,
      }));
      const { error } = await admin.from("user_module_permissions").upsert(rows, { onConflict: "user_id,module_key" });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "update") {
      const targetUserId = String(body.user_id || "");
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const role = String(body.role || "");
      const password = String(body.password || "");
      if (!targetUserId || !name || !email) return json({ error: "Informe nome e e-mail." }, 400);
      if (targetUserId === user.id) return json({ error: "Edite seus próprios dados pela página Perfil." }, 403);
      if (!["vendedor", "gestor", "atendimento"].includes(role)) return json({ error: "Tipo de usuário inválido." }, 400);
      if (password && password.length < 6) return json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, 400);

      const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(targetUserId);
      if (targetAuthError || !targetAuth.user) return json({ error: "Usuário não encontrado." }, 404);
      const targetEmail = (targetAuth.user.email || "").toLowerCase();
      if (targetEmail === "dalprapf1@gmail.com" && !isOwner) return json({ error: "Somente o responsável principal pode editar esta conta." }, 403);
      const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", targetUserId);
      const targetIsGestor = targetRoles?.some((r) => r.role === "gestor") ?? false;
      if (!isOwner && targetIsGestor) return json({ error: "Somente o responsável principal pode editar outro gestor." }, 403);
      if (!isOwner && role === "gestor") return json({ error: "Somente o responsável principal pode conceder o perfil Gestor." }, 403);

      const authUpdate: { email: string; email_confirm: boolean; user_metadata: { display_name: string }; password?: string } = {
        email,
        email_confirm: true,
        user_metadata: { ...(targetAuth.user.user_metadata || {}), display_name: name },
      };
      if (password) authUpdate.password = password;
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetUserId, authUpdate);
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);

      const { error: profileError } = await admin.from("profiles").upsert(
        { user_id: targetUserId, display_name: name, email },
        { onConflict: "user_id" },
      );
      if (profileError) throw profileError;

      if (!targetRoles?.some((r) => r.role === role)) {
        const { error: roleDeleteError } = await admin.from("user_roles").delete().eq("user_id", targetUserId);
        if (roleDeleteError) throw roleDeleteError;
        const { error: roleInsertError } = await admin.from("user_roles").insert({ user_id: targetUserId, role });
        if (roleInsertError) throw roleInsertError;
      }

      if (role === "vendedor") {
        const { data: salesperson } = await admin.from("vendedores_comissoes").select("user_id").eq("user_id", targetUserId).maybeSingle();
        if (!salesperson) {
          const { error: salespersonError } = await admin.from("vendedores_comissoes").insert({ nome: name, user_id: targetUserId, email });
          if (salespersonError) throw salespersonError;
        } else {
          await admin.from("vendedores_comissoes").update({ nome: name, email }).eq("user_id", targetUserId);
        }
      } else {
        await admin.from("vendedores_comissoes").delete().eq("user_id", targetUserId);
      }
      return json({ success: true });
    }

    if (action === "delete") {
      const targetUserId = String(body.user_id || "");
      if (!targetUserId) return json({ error: "Usuário não informado." }, 400);
      if (targetUserId === user.id) return json({ error: "Não é possível excluir a própria conta." }, 400);
      const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(targetUserId);
      if (targetAuthError || !targetAuth.user) return json({ error: "Usuário não encontrado." }, 404);
      if ((targetAuth.user.email || "").toLowerCase() === "dalprapf1@gmail.com") return json({ error: "A conta do responsável principal não pode ser excluída." }, 403);
      const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", targetUserId);
      if (!isOwner && targetRoles?.some((r) => r.role === "gestor")) {
        return json({ error: "Somente o responsável principal pode excluir outro gestor." }, 403);
      }
      await admin.from("vendedores_comissoes").delete().eq("user_id", targetUserId);
      await admin.from("user_module_permissions").delete().eq("user_id", targetUserId);
      await admin.from("user_roles").delete().eq("user_id", targetUserId);
      await admin.from("profiles").delete().eq("user_id", targetUserId);
      const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
      if (deleteError) throw deleteError;
      return json({ success: true });
    }

    if (action === "change_role") {
      const targetUserId = String(body.user_id || "");
      const role = String(body.role || "");
      if (!targetUserId || !["vendedor", "gestor", "atendimento"].includes(role)) return json({ error: "Dados inválidos." }, 400);
      if (!isOwner && role === "gestor") return json({ error: "Somente o responsável principal pode conceder o perfil Gestor." }, 403);
      const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", targetUserId);
      if (!isOwner && targetRoles?.some((r) => r.role === "gestor")) return json({ error: "Somente o responsável principal pode alterar outro gestor." }, 403);
      const { error: delError } = await admin.from("user_roles").delete().eq("user_id", targetUserId);
      if (delError) throw delError;
      const { error: insError } = await admin.from("user_roles").insert({ user_id: targetUserId, role });
      if (insError) throw insError;
      if (role !== "vendedor") await admin.from("vendedores_comissoes").delete().eq("user_id", targetUserId);
      return json({ success: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (error) {
    console.error("user-admin error", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno ao administrar usuário." }, 500);
  }
});