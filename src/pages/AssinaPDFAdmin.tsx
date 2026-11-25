import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import {
  Copy, KeyRound, RefreshCw, ShieldCheck, PackagePlus,
  History, Laptop, Power, Save, X, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ASSINAPDF_URL = "https://zcquhikpsqohrclflnjo.supabase.co";
const ASSINAPDF_PUBLISHABLE_KEY = "sb_publishable_QGohhsJ9qwrmjzzT_QKqrw_dPQ_lRY7";

type Plan = { id: string; code: string; name: string; price_cents: number | null; is_active: boolean };
type Release = {
  id: string;
  platform: string;
  channel: string;
  version: string;
  build_number: number;
  minimum_supported_version: string | null;
  download_url: string;
  sha256: string;
  signature: string | null;
  release_notes: string | null;
  is_mandatory: boolean;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};
type Device = {
  id: string;
  device_label: string | null;
  platform: string | null;
  app_version: string | null;
  activated_at: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  assinapdf_licenses?: { user_id?: string; status?: string; assinapdf_plans?: { name?: string; code?: string } | null } | null;
};
type AuditEntry = {
  id: string;
  actor_email: string;
  action: string;
  target_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
type AdminResponse = {
  plans?: Plan[];
  releases?: Release[];
  devices?: Device[];
  audit?: AuditEntry[];
  plaintext_key?: string;
  activation_key?: {
    id: string;
    key_prefix: string;
    status: string;
    payment_status: string;
    valid_until: string;
    customer_name?: string | null;
    customer_email?: string | null;
  };
  error?: string;
};

type Tab = "releases" | "devices" | "audit" | "keys";
type ReleaseForm = {
  platform: string;
  channel: string;
  version: string;
  build_number: string;
  minimum_supported_version: string;
  download_url: string;
  sha256: string;
  signature: string;
  release_notes: string;
  is_mandatory: boolean;
  is_published: boolean;
};
const EMPTY_RELEASE: ReleaseForm = {
  platform: "windows-x64", channel: "stable", version: "", build_number: "1",
  minimum_supported_version: "", download_url: "", sha256: "", signature: "",
  release_notes: "", is_mandatory: false, is_published: false,
};
const PLATFORMS = [
  { value: "windows-x64", label: "Windows 64 bits" },
  { value: "macos-universal", label: "macOS Universal (Intel + Apple Silicon)" },
  { value: "macos-x64", label: "macOS Intel (x64)" },
  { value: "macos-arm64", label: "macOS Apple Silicon (ARM64)" },
];
const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const labelClass = "grid gap-1.5 text-sm";
const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
const platformName = (value: string) => PLATFORMS.find((p) => p.value === value)?.label || value;

function defaultValidity() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

const AssinaPDFAdmin = () => {
  const { user, canManageUsers, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("releases");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [planId, setPlanId] = useState("");
  const [customerName, setCustomerName] = useState("Teste AssinaPDF");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidity);
  const [generatedKey, setGeneratedKey] = useState("");
  const [releaseForm, setReleaseForm] = useState<ReleaseForm>(EMPTY_RELEASE);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const callAdmin = useCallback(async (body: Record<string, unknown>): Promise<AdminResponse> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sua sessão do CRM expirou. Entre novamente.");
    const response = await fetch(`${ASSINAPDF_URL}/functions/v1/assinapdf-admin`, {
      method: "POST",
      headers: {
        apikey: ASSINAPDF_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({})) as AdminResponse;
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação administrativa.");
    return result;
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    setMessage("");
    const tasks = await Promise.allSettled([
      callAdmin({ action: "list_releases" }),
      callAdmin({ action: "list_devices" }),
      callAdmin({ action: "list_audit" }),
      callAdmin({ action: "list_plans" }),
    ]);
    const errors: string[] = [];
    if (tasks[0].status === "fulfilled") setReleases(tasks[0].value.releases || []);
    else errors.push(tasks[0].reason instanceof Error ? tasks[0].reason.message : "Falha ao carregar versões.");
    if (tasks[1].status === "fulfilled") setDevices(tasks[1].value.devices || []);
    else errors.push(tasks[1].reason instanceof Error ? tasks[1].reason.message : "Falha ao carregar dispositivos.");
    if (tasks[2].status === "fulfilled") setAudit(tasks[2].value.audit || []);
    else errors.push(tasks[2].reason instanceof Error ? tasks[2].reason.message : "Falha ao carregar auditoria.");
    if (tasks[3].status === "fulfilled") {
      const activePlans = (tasks[3].value.plans || []).filter((plan) => plan.is_active);
      setPlans(activePlans);
      setPlanId((current) => current || activePlans.find((plan) => plan.code === "premium")?.id || activePlans[0]?.id || "");
    } else errors.push(tasks[3].reason instanceof Error ? tasks[3].reason.message : "Falha ao carregar planos.");
    if (errors.length) setMessage(errors.join(" "));
    setLoadingData(false);
  }, [callAdmin]);

  useEffect(() => {
    if (user && canManageUsers) void loadAll();
  }, [user, canManageUsers, loadAll]);

  const publishedCount = useMemo(() => releases.filter((release) => release.is_published).length, [releases]);
  const activeDevices = useMemo(() => devices.filter((device) => !device.revoked_at), [devices]);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando permissões...</div>;
  if (!user || !canManageUsers) return <Navigate to="/" replace />;

  const updateReleaseForm = (patch: Partial<ReleaseForm>) => setReleaseForm((current) => ({ ...current, ...patch }));
  const resetReleaseForm = () => {
    setReleaseForm(EMPTY_RELEASE);
    setEditingReleaseId(null);
    setShowReleaseForm(false);
  };
  const editRelease = (release: Release) => {
    setEditingReleaseId(release.id);
    setReleaseForm({
      platform: release.platform, channel: release.channel, version: release.version,
      build_number: String(release.build_number || 1),
      minimum_supported_version: release.minimum_supported_version || "",
      download_url: release.download_url, sha256: release.sha256,
      signature: release.signature || "", release_notes: release.release_notes || "",
      is_mandatory: release.is_mandatory, is_published: release.is_published,
    });
    setShowReleaseForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveRelease = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(releaseForm.version.trim())) {
        throw new Error("Informe a versão no formato semântico, por exemplo 1.2.0.");
      }
      if (!/^https:\/\//i.test(releaseForm.download_url.trim())) throw new Error("O instalador precisa estar hospedado em um endereço HTTPS.");
      if (!/^[a-fA-F0-9]{64}$/.test(releaseForm.sha256.trim())) throw new Error("O SHA-256 deve conter exatamente 64 caracteres hexadecimais.");
      const result = await callAdmin({
        action: "save_release",
        release: {
          platform: releaseForm.platform, channel: releaseForm.channel,
          version: releaseForm.version.trim(), build_number: Number(releaseForm.build_number) || 1,
          minimum_supported_version: releaseForm.minimum_supported_version.trim() || null,
          download_url: releaseForm.download_url.trim(), sha256: releaseForm.sha256.trim().toLowerCase(),
          signature: releaseForm.signature.trim() || null, release_notes: releaseForm.release_notes.trim() || null,
          is_mandatory: releaseForm.is_mandatory, is_published: releaseForm.is_published,
        },
      });
      if (!result.releases && !result.error) {
        setMessage(releaseForm.is_published ? "Versão publicada e registrada na auditoria." : "Versão salva como rascunho.");
      }
      resetReleaseForm();
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a versão.");
    } finally {
      setBusy(false);
    }
  };

  const toggleReleasePublished = async (release: Release) => {
    const actionLabel = release.is_published ? "desativar" : "publicar";
    if (!window.confirm(`Deseja ${actionLabel} a versão ${release.version} para ${platformName(release.platform)}?`)) return;
    setBusy(true);
    setMessage("");
    try {
      await callAdmin({
        action: "save_release",
        release: {
          platform: release.platform, channel: release.channel, version: release.version,
          build_number: release.build_number, minimum_supported_version: release.minimum_supported_version,
          download_url: release.download_url, sha256: release.sha256, signature: release.signature,
          release_notes: release.release_notes, is_mandatory: release.is_mandatory,
          is_published: !release.is_published,
        },
      });
      setMessage(release.is_published ? "Versão desativada. Ela permanece no histórico." : "Versão publicada.");
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Não foi possível ${actionLabel} a versão.`);
    } finally {
      setBusy(false);
    }
  };

  const createTestKey = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setGeneratedKey("");
    try {
      if (!planId) throw new Error("Selecione um plano ativo.");
      if (!validUntil || new Date(validUntil).getTime() <= Date.now()) throw new Error("Informe uma validade futura.");
      const result = await callAdmin({
        action: "create_activation_key",
        activation_key: {
          plan_id: planId, customer_name: customerName, customer_email: customerEmail,
          customer_phone: customerPhone, valid_until: new Date(validUntil).toISOString(),
          payment_confirmed: true, payment_reference: "TESTE INTERNO CRM — sem cobrança",
        },
      });
      setGeneratedKey(result.plaintext_key || "");
      setMessage(result.activation_key
        ? `Chave criada e liberada para ativação. Validade: ${new Date(result.activation_key.valid_until).toLocaleString("pt-BR")}.`
        : "A chave foi criada, mas não recebemos o código para exibição.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar a chave.");
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(generatedKey);
      setMessage("Chave copiada. Guarde-a: o código completo é exibido somente nesta criação.");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione e copie o código exibido.");
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof PackagePlus }[] = [
    { id: "releases", label: "Versões e atualizações", icon: PackagePlus },
    { id: "devices", label: "Dispositivos", icon: Laptop },
    { id: "audit", label: "Auditoria", icon: History },
    { id: "keys", label: "Chaves de acesso", icon: KeyRound },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><KeyRound className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão do AssinaPDF</h1>
            <p className="mt-1 text-sm text-muted-foreground">Clientes, versões do aplicativo, dispositivos e controle administrativo.</p>
          </div>
        </div>
        <button type="button" onClick={() => void loadAll()} disabled={loadingData || busy} className={`${buttonClass} border`}>
          <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} /> Atualizar dados
        </button>
        <a href="/assinar" target="_blank" rel="noreferrer" className={`${buttonClass} bg-primary text-primary-foreground`}>
          <span aria-hidden="true">↗</span> Abrir página pública de vendas
        </a>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Versões publicadas</p><p className="mt-1 text-2xl font-bold">{publishedCount}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Dispositivos ativos</p><p className="mt-1 text-2xl font-bold">{activeDevices.length}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Registros de auditoria</p><p className="mt-1 text-2xl font-bold">{audit.length}</p></div>
      </section>

      <nav className="flex flex-wrap gap-2 border-b pb-3" aria-label="Seções de administração do AssinaPDF">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`${buttonClass} h-9 px-3 ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "border bg-background text-foreground"}`}>
            <Icon className="h-4 w-4" /> {tab.label}
          </button>;
        })}
      </nav>

      {message && <div role="status" className="rounded-lg border bg-muted/50 p-3 text-sm">{message}</div>}

      {activeTab === "releases" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-semibold">Publicação de atualizações</h2><p className="text-sm text-muted-foreground">Cadastre instaladores separados por plataforma, com hash para conferência de integridade.</p></div>
            <button type="button" onClick={() => { resetReleaseForm(); setShowReleaseForm(true); }} className={`${buttonClass} bg-primary text-primary-foreground`}>
              <PackagePlus className="h-4 w-4" /> Nova versão
            </button>
          </div>

          {showReleaseForm && (
            <form onSubmit={saveRelease} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{editingReleaseId ? "Editar versão" : "Cadastrar nova versão"}</h3><button type="button" onClick={resetReleaseForm} className="rounded-md p-2 hover:bg-muted" aria-label="Fechar formulário"><X className="h-4 w-4" /></button></div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className={labelClass}><span className="font-medium">Plataforma</span><select className={inputClass} value={releaseForm.platform} onChange={(e) => updateReleaseForm({ platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
                <label className={labelClass}><span className="font-medium">Canal</span><select className={inputClass} value={releaseForm.channel} onChange={(e) => updateReleaseForm({ channel: e.target.value })}><option value="stable">Estável</option><option value="beta">Beta</option></select></label>
                <label className={labelClass}><span className="font-medium">Versão</span><input className={inputClass} value={releaseForm.version} onChange={(e) => updateReleaseForm({ version: e.target.value })} placeholder="1.0.0" required /></label>
                <label className={labelClass}><span className="font-medium">Número do build</span><input className={inputClass} type="number" min="1" value={releaseForm.build_number} onChange={(e) => updateReleaseForm({ build_number: e.target.value })} required /></label>
                <label className={labelClass}><span className="font-medium">Versão mínima suportada (opcional)</span><input className={inputClass} value={releaseForm.minimum_supported_version} onChange={(e) => updateReleaseForm({ minimum_supported_version: e.target.value })} placeholder="1.0.0" /></label>
                <label className={labelClass}><span className="font-medium">URL HTTPS do instalador</span><input className={inputClass} type="url" value={releaseForm.download_url} onChange={(e) => updateReleaseForm({ download_url: e.target.value })} placeholder="https://..." required /></label>
                <label className={`${labelClass} md:col-span-2`}><span className="font-medium">SHA-256 do arquivo (64 caracteres)</span><input className={inputClass} value={releaseForm.sha256} onChange={(e) => updateReleaseForm({ sha256: e.target.value.replace(/\s/g, "") })} placeholder="Hash SHA-256 do instalador" required /></label>
                <label className={labelClass}><span className="font-medium">Assinatura digital (opcional)</span><input className={inputClass} value={releaseForm.signature} onChange={(e) => updateReleaseForm({ signature: e.target.value })} placeholder="Assinatura ou referência" /></label>
                <label className={`${labelClass} md:col-span-3`}><span className="font-medium">Novidades desta versão</span><textarea className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm" value={releaseForm.release_notes} onChange={(e) => updateReleaseForm({ release_notes: e.target.value })} placeholder="Descreva correções, melhorias e novos recursos..." /></label>
              </div>
              <div className="flex flex-wrap gap-5 rounded-lg bg-muted/40 p-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={releaseForm.is_mandatory} onChange={(e) => updateReleaseForm({ is_mandatory: e.target.checked })} /> Atualização obrigatória</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={releaseForm.is_published} onChange={(e) => updateReleaseForm({ is_published: e.target.checked })} /> Publicar imediatamente</label>
              </div>
              <p className="text-xs text-muted-foreground">A publicação registra a versão no serviço administrativo. A entrega automática ao aplicativo será ativada na etapa de integração do cliente de atualização.</p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy} className={`${buttonClass} bg-primary text-primary-foreground`}><Save className="h-4 w-4" /> {busy ? "Salvando..." : "Salvar versão"}</button>
                <button type="button" onClick={resetReleaseForm} className={`${buttonClass} border`}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border bg-card">
            {releases.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma versão cadastrada. Use “Nova versão” para registrar o primeiro instalador.</div> :
              <div className="divide-y">{releases.map((release) => (
                <article key={release.id} className="space-y-3 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">AssinaPDF {release.version}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${release.is_published ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{release.is_published ? "Publicada" : "Rascunho / desativada"}</span>
                        {release.is_mandatory && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">Obrigatória</span>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{platformName(release.platform)} · {release.channel === "stable" ? "Estável" : "Beta"} · Build {release.build_number}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => editRelease(release)} disabled={busy} className={`${buttonClass} h-9 border px-3`}><Save className="h-4 w-4" /> Editar</button>
                      <button type="button" onClick={() => void toggleReleasePublished(release)} disabled={busy} className={`${buttonClass} h-9 px-3 ${release.is_published ? "border text-destructive" : "bg-primary text-primary-foreground"}`}><Power className="h-4 w-4" /> {release.is_published ? "Desativar" : "Publicar"}</button>
                    </div>
                  </div>
                  {release.release_notes && <p className="whitespace-pre-wrap text-sm">{release.release_notes}</p>}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <span>Versão mínima: {release.minimum_supported_version || "Não definida"}</span><span>Publicada: {dateTime(release.published_at)}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/50 p-2 text-xs"><Download className="h-4 w-4 shrink-0" /><a href={release.download_url} target="_blank" rel="noreferrer" className="truncate text-primary underline">{release.download_url}</a></div>
                  <p className="break-all font-mono text-[11px] text-muted-foreground">SHA-256: {release.sha256}</p>
                </article>
              ))}</div>}
          </div>
        </section>
      )}

      {activeTab === "devices" && (
        <section className="space-y-4">
          <div><h2 className="text-lg font-semibold">Dispositivos cadastrados</h2><p className="text-sm text-muted-foreground">Acompanhe plataforma, versão instalada e último contato informado pelo AssinaPDF.</p></div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Dispositivo</th><th className="p-3">Plataforma</th><th className="p-3">Versão</th><th className="p-3">Plano / licença</th><th className="p-3">Último contato</th><th className="p-3">Situação</th></tr></thead>
              <tbody className="divide-y">{devices.map((device) => <tr key={device.id}>
                <td className="p-3 font-medium">{device.device_label || "Dispositivo sem nome"}</td><td className="p-3">{device.platform || "—"}</td><td className="p-3">{device.app_version || "—"}</td>
                <td className="p-3">{device.assinapdf_licenses?.assinapdf_plans?.name || "—"}<span className="block text-xs text-muted-foreground">{device.assinapdf_licenses?.status || "Sem status"}</span></td>
                <td className="p-3">{dateTime(device.last_seen_at)}</td><td className="p-3">{device.revoked_at ? <span className="text-destructive">Revogado</span> : <span className="text-emerald-700 dark:text-emerald-300">Ativo</span>}</td>
              </tr>)}</tbody>
            </table>
            {devices.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum dispositivo foi registrado até agora.</p>}
          </div>
        </section>
      )}

      {activeTab === "audit" && (
        <section className="space-y-4">
          <div><h2 className="text-lg font-semibold">Auditoria administrativa</h2><p className="text-sm text-muted-foreground">Últimas operações administrativas registradas pelo serviço do AssinaPDF.</p></div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Data</th><th className="p-3">Administrador</th><th className="p-3">Ação</th><th className="p-3">Alvo</th><th className="p-3">Detalhes</th></tr></thead>
              <tbody className="divide-y">{audit.map((entry) => <tr key={entry.id}><td className="whitespace-nowrap p-3">{dateTime(entry.created_at)}</td><td className="p-3">{entry.actor_email}</td><td className="p-3 font-medium">{entry.action}</td><td className="p-3">{entry.target_type || "—"}</td><td className="max-w-xs truncate p-3 text-xs text-muted-foreground">{entry.metadata ? JSON.stringify(entry.metadata) : "—"}</td></tr>)}</tbody>
            </table>
            {audit.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum evento de auditoria encontrado.</p>}
          </div>
        </section>
      )}

      {activeTab === "keys" && (
        <section className="space-y-4">
          <div><h2 className="text-lg font-semibold">Geração de chave interna</h2><p className="text-sm text-muted-foreground">Ferramenta de teste existente, preservada nesta área administrativa.</p></div>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Acesso administrativo validado pelo serviço do AssinaPDF</div>
            <form onSubmit={createTestKey} className="grid gap-4 md:grid-cols-2">
              <label className={labelClass}><span className="font-medium">Plano a liberar</span><select className={inputClass} value={planId} onChange={(e) => setPlanId(e.target.value)} required><option value="">Selecione um plano</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.code})</option>)}</select></label>
              <label className={labelClass}><span className="font-medium">Validade da chave</span><input className={inputClass} type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required /></label>
              <label className={labelClass}><span className="font-medium">Nome do cliente</span><input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome para identificar o teste" /></label>
              <label className={labelClass}><span className="font-medium">E-mail do cliente (opcional)</span><input className={inputClass} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="cliente@exemplo.com" /></label>
              <label className={`${labelClass} md:col-span-2`}><span className="font-medium">WhatsApp (opcional)</span><input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(00) 00000-0000" /></label>
              <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100 md:col-span-2"><strong>Modo de teste:</strong> esta ação cria a chave com pagamento marcado como confirmado, sem gerar cobrança no Asaas. Use somente para testes internos.</div>
              <div className="flex flex-wrap gap-2 md:col-span-2"><button disabled={busy || plans.length === 0} type="submit" className={`${buttonClass} bg-primary text-primary-foreground`}><KeyRound className="h-4 w-4" /> {busy ? "Processando..." : "Gerar chave de teste"}</button></div>
            </form>
          </div>
          {generatedKey && <section className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5"><h3 className="font-semibold text-emerald-700 dark:text-emerald-300">Chave criada — copie agora</h3><p className="text-sm text-muted-foreground">No AssinaPDF, entre na conta que receberá o Premium, cole esta chave e clique em “Ativar minha chave”.</p><div className="flex flex-col gap-2 sm:flex-row"><code className="flex-1 break-all rounded-md border bg-background p-3 text-sm">{generatedKey}</code><button type="button" onClick={() => void copyKey()} className={`${buttonClass} border`}><Copy className="h-4 w-4" /> Copiar chave</button></div><p className="text-xs text-muted-foreground">O código completo não poderá ser recuperado depois desta tela; o sistema guarda somente o hash da chave.</p></section>}
        </section>
      )}
    </main>
  );
};

export default AssinaPDFAdmin;
