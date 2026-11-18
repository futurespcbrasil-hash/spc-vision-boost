import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, BadgeCheck, Ban, CheckCircle2, Copy, Download, FileCheck2, KeyRound, Loader2, Package, Pencil, Plus, RefreshCw, Save, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const API_URL = "https://zcquhikpsqohrclflnjo.supabase.co";
const API_KEY = "sb_publishable_QGohhsJ9qwrmjzzT_QKqrw_dPQ_lRY7";

const FEATURES = [
  { key: "pdf.sign", label: "Assinar PDF" },
  { key: "pdf.validate", label: "Validar assinatura" },
  { key: "pdf.edit", label: "Editar PDF" },
];

type Plan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price_cents: number | null;
  billing_interval: "monthly" | "yearly" | "lifetime" | null;
  device_limit: number;
  is_active: boolean;
  sort_order: number;
  assinapdf_plan_features?: Array<{ feature_key: string; is_enabled: boolean }>;
};

type Release = {
  id: string;
  platform: string;
  channel: string;
  version: string;
  download_url: string;
  sha256: string;
  is_published: boolean;
  is_mandatory: boolean;
  release_notes?: string | null;
  published_at?: string | null;
};

const emptyPlan = {
  id: "",
  code: "",
  name: "",
  description: "",
  price: "",
  billing_interval: "",
  device_limit: "1",
  is_active: true,
  sort_order: "0",
  features: { "pdf.sign": true, "pdf.validate": true, "pdf.edit": false } as Record<string, boolean>,
};

const emptyRelease = {
  platform: "windows-x64",
  channel: "stable",
  version: "",
  build_number: "1",
  minimum_supported_version: "",
  download_url: "",
  sha256: "",
  signature: "",
  release_notes: "",
  is_mandatory: false,
  is_published: false,
};

const formatPrice = (value: number | null) =>
  value === null ? "Preço a definir" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

const AssinaPdfAdmin = () => {
  const { session } = useAuth();
  const [tab, setTab] = useState<"overview" | "plans" | "customers" | "keys" | "updates">("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [overview, setOverview] = useState({ customers: 0, activeLicenses: 0, activeSubscriptions: 0, publishedReleases: 0 });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [activationKeys, setActivationKeys] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [newPlaintextKey, setNewPlaintextKey] = useState("");
  const [keyForm, setKeyForm] = useState({ plan_id: "", customer_name: "", customer_email: "", customer_phone: "", valid_until: "", payment_reference: "", payment_confirmed: false });
  const [releases, setReleases] = useState<Release[]>([]);
  const [planForm, setPlanForm] = useState({ ...emptyPlan, features: { ...emptyPlan.features } });
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [releaseForm, setReleaseForm] = useState({ ...emptyRelease });
  const [licenseUserId, setLicenseUserId] = useState("");
  const [licensePlanId, setLicensePlanId] = useState("");
  const [licenseValidUntil, setLicenseValidUntil] = useState("");

  const callAdmin = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const token = session?.access_token;
    if (!token) throw new Error("Sua sessão do CRM expirou. Entre novamente.");
    const response = await fetch(`${API_URL}/functions/v1/assinapdf-admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: API_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível acessar o painel AssinaPDF.");
    return result;
  }, [session?.access_token]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, planData, customerData, releaseData, keyData, paymentData, deviceData] = await Promise.all([
        callAdmin("overview"),
        callAdmin("list_plans"),
        callAdmin("list_customers"),
        callAdmin("list_releases"),
        callAdmin("list_activation_keys"),
        callAdmin("list_payments"),
        callAdmin("list_devices"),
      ]);
      setOverview(summary);
      setPlans(planData.plans || []);
      setCustomers(customerData.customers || []);
      setLicenses(customerData.licenses || []);
      setSubscriptions(customerData.subscriptions || []);
      setReleases(releaseData.releases || []);
      setActivationKeys(keyData.activation_keys || []);
      setPayments(paymentData.payments || []);
      setDevices(deviceData.devices || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [callAdmin]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const startNewPlan = () => {
    setPlanForm({ ...emptyPlan, features: { ...emptyPlan.features } });
    setShowPlanForm(true);
  };

  const editPlan = (plan: Plan) => {
    const current = Object.fromEntries(
      FEATURES.map(feature => [
        feature.key,
        plan.assinapdf_plan_features?.find(item => item.feature_key === feature.key)?.is_enabled === true,
      ])
    );
    setPlanForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description || "",
      price: plan.price_cents === null ? "" : (plan.price_cents / 100).toFixed(2).replace(".", ","),
      billing_interval: plan.billing_interval || "",
      device_limit: String(plan.device_limit),
      is_active: plan.is_active,
      sort_order: String(plan.sort_order),
      features: current,
    });
    setShowPlanForm(true);
  };

  const savePlan = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const normalizedPrice = planForm.price.trim() === ""
        ? null
        : Math.round(Number(planForm.price.replace(",", ".")) * 100);
      if (normalizedPrice !== null && (!Number.isFinite(normalizedPrice) || normalizedPrice < 0)) {
        throw new Error("Informe um preço válido em reais.");
      }
      await callAdmin("save_plan", {
        plan: {
          id: planForm.id || undefined,
          code: planForm.code,
          name: planForm.name,
          description: planForm.description,
          price_cents: normalizedPrice,
          billing_interval: planForm.billing_interval || null,
          device_limit: Number(planForm.device_limit),
          is_active: planForm.is_active,
          sort_order: Number(planForm.sort_order),
          features: FEATURES.map(feature => ({
            feature_key: feature.key,
            is_enabled: planForm.features[feature.key] === true,
          })),
        },
      });
      setShowPlanForm(false);
      setNotice("Plano salvo com sucesso.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };

  const assignLicense = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await callAdmin("assign_license", { license: { user_id: licenseUserId.trim(), plan_id: licensePlanId, valid_until: licenseValidUntil || null } });
      setLicenseUserId("");
      setLicensePlanId("");
      setLicenseValidUntil("");
      setNotice("Plano atribuído/atualizado com sucesso. A licença e a assinatura manual foram sincronizadas.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível cadastrar a licença.");
    } finally {
      setSaving(false);
    }
  };


  const createActivationKey = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    setNewPlaintextKey("");
    try {
      if (!keyForm.plan_id) throw new Error("Selecione o plano que será liberado.");
      if (!keyForm.valid_until) throw new Error("Defina a validade personalizada da chave.");
      if (new Date(keyForm.valid_until).getTime() <= Date.now()) throw new Error("A validade precisa ser futura.");
      const result = await callAdmin("create_activation_key", {
        activation_key: { ...keyForm, valid_until: new Date(keyForm.valid_until).toISOString() },
      });
      setNewPlaintextKey(result.plaintext_key || "");
      setNotice(keyForm.payment_confirmed
        ? "Chave criada e liberada para ativação. Copie o código agora; ele não será exibido novamente."
        : "Chave criada como pendente de pagamento. Ela não poderá ser ativada até a confirmação do pagamento.");
      setKeyForm({ plan_id: keyForm.plan_id, customer_name: "", customer_email: "", customer_phone: "", valid_until: "", payment_reference: "", payment_confirmed: false });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível emitir a chave.");
    } finally {
      setSaving(false);
    }
  };

  const confirmActivationPayment = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      await callAdmin("confirm_activation_payment", { activation_key: { id } });
      setNotice("Pagamento confirmado. A chave agora está liberada para ativação.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível confirmar o pagamento.");
    } finally {
      setSaving(false);
    }
  };

  const revokeActivationKey = async (id: string) => {
    if (!window.confirm("Deseja realmente cancelar esta chave? Ela não poderá mais ser utilizada.")) return;
    setSaving(true);
    setError("");
    try {
      await callAdmin("revoke_activation_key", { activation_key: { id } });
      setNotice("Chave cancelada.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível cancelar a chave.");
    } finally {
      setSaving(false);
    }
  };



  const cancelAsaasSubscription = async (id: string) => {
    if (!window.confirm("Cancelar a recorrência no Asaas? As próximas cobranças serão interrompidas. O acesso já pago permanece até o fim do período vigente.")) return;
    setSaving(true);
    setError("");
    try {
      await callAdmin("cancel_asaas_subscription", { subscription: { id } });
      setNotice("Recorrência cancelada no Asaas. O acesso pago permanece até o vencimento atual.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível cancelar a recorrência.");
    } finally {
      setSaving(false);
    }
  };

  const revokeDevice = async (id: string) => {
    if (!window.confirm("Revogar este dispositivo? Ele deixará de acessar os recursos Premium.")) return;
    setSaving(true);
    setError("");
    try {
      await callAdmin("revoke_device", { device: { id } });
      setNotice("Dispositivo revogado. O cliente poderá solicitar a liberação de outro equipamento.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível revogar o dispositivo.");
    } finally {
      setSaving(false);
    }
  };

  const changeLicenseStatus = async (id: string, status: string) => {
    setSaving(true);
    setError("");
    try {
      await callAdmin("set_license_status", { license: { id, status } });
      setNotice("Status da licença atualizado.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar a licença.");
    } finally {
      setSaving(false);
    }
  };

  const saveRelease = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await callAdmin("save_release", {
        release: {
          ...releaseForm,
          build_number: Number(releaseForm.build_number),
        },
      });
      setReleaseForm({ ...emptyRelease });
      setNotice("Versão cadastrada com sucesso.");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível cadastrar a versão.");
    } finally {
      setSaving(false);
    }
  };

  const customerMap = useMemo(() => new Map(customers.map(customer => [customer.user_id, customer])), [customers]);
  const tabs = [
    { id: "overview", label: "Visão geral", icon: Activity },
    { id: "plans", label: "Planos", icon: BadgeCheck },
    { id: "customers", label: "Clientes e licenças", icon: Users },
    { id: "keys", label: "Chaves de ativação", icon: KeyRound },
    { id: "updates", label: "Atualizações", icon: Download },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <FileCheck2 size={17} /> FUTURE SOLUÇÕES
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Administração do AssinaPDF</h1>
          <p className="mt-1 text-sm text-muted-foreground">Planos, clientes, licenças e versões do aplicativo.</p>
        </div>
        <button onClick={() => void loadAll()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Atualizar dados
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <Icon size={16} /> {item.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="animate-spin" /> Carregando dados do AssinaPDF...</div>
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Clientes cadastrados", value: overview.customers, icon: Users },
                  { label: "Licenças ativas", value: overview.activeLicenses, icon: ShieldCheck },
                  { label: "Assinaturas ativas", value: overview.activeSubscriptions, icon: BadgeCheck },
                  { label: "Versões publicadas", value: overview.publishedReleases, icon: Package },
                ].map(item => {
                  const Icon = item.icon;
                  return <div key={item.label} className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{item.label}</span><Icon size={18} /></div><div className="mt-3 text-3xl font-bold tabular-nums">{item.value}</div></div>;
                })}
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold">Estrutura conectada</h2>
                <p className="mt-1 text-sm text-muted-foreground">Este painel utiliza o banco exclusivo do AssinaPDF. O CRM continua usando seu próprio Supabase para os demais módulos.</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">Banco separado</span><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">Acesso administrativo validado no servidor</span><span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">Windows e macOS</span></div>
              </div>
            </div>
          )}

          {tab === "plans" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Planos comerciais</h2><p className="text-sm text-muted-foreground">Preço, limite de dispositivos e funcionalidades liberadas.</p></div><button onClick={startNewPlan} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><Plus size={16} /> Novo plano</button></div>
              {showPlanForm && (
                <form onSubmit={savePlan} className="space-y-4 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between"><h3 className="font-semibold">{planForm.id ? "Editar plano" : "Novo plano"}</h3><button type="button" onClick={() => setShowPlanForm(false)} className="text-sm text-muted-foreground hover:text-foreground">Fechar</button></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm"><span className="font-medium">Código interno</span><input required value={planForm.code} onChange={e => setPlanForm(v => ({ ...v, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))} placeholder="ex.: premium" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                    <label className="space-y-1 text-sm"><span className="font-medium">Nome do plano</span><input required value={planForm.name} onChange={e => setPlanForm(v => ({ ...v, name: e.target.value }))} placeholder="ex.: Premium" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                    <label className="space-y-1 text-sm"><span className="font-medium">Preço (R$)</span><input value={planForm.price} onChange={e => setPlanForm(v => ({ ...v, price: e.target.value }))} placeholder="Deixe vazio se ainda não definido" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                    <label className="space-y-1 text-sm"><span className="font-medium">Periodicidade</span><select value={planForm.billing_interval} onChange={e => setPlanForm(v => ({ ...v, billing_interval: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2"><option value="">A definir / sem cobrança</option><option value="monthly">Mensal recorrente</option><option value="yearly">Anual</option><option value="lifetime">Vitalício</option></select></label>
                    <label className="space-y-1 text-sm"><span className="font-medium">Dispositivos por licença</span><input type="number" min="1" value={planForm.device_limit} onChange={e => setPlanForm(v => ({ ...v, device_limit: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                    <label className="space-y-1 text-sm"><span className="font-medium">Ordem de exibição</span><input type="number" value={planForm.sort_order} onChange={e => setPlanForm(v => ({ ...v, sort_order: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                  </div>
                  <label className="block space-y-1 text-sm"><span className="font-medium">Descrição</span><textarea rows={2} value={planForm.description} onChange={e => setPlanForm(v => ({ ...v, description: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                  <div className="space-y-2"><span className="text-sm font-medium">Funcionalidades liberadas</span><div className="grid gap-2 sm:grid-cols-3">{FEATURES.map(feature => <label key={feature.key} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={planForm.features[feature.key] === true} onChange={e => setPlanForm(v => ({ ...v, features: { ...v.features, [feature.key]: e.target.checked } }))} />{feature.label}</label>)}</div></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={planForm.is_active} onChange={e => setPlanForm(v => ({ ...v, is_active: e.target.checked }))} /> Plano ativo para novas licenças</label>
                  <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={15} /> {saving ? "Salvando..." : "Salvar plano"}</button></div>
                </form>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {plans.map(plan => <div key={plan.id} className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{plan.name}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${plan.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{plan.is_active ? "Ativo" : "Inativo"}</span></div><p className="mt-1 text-sm text-muted-foreground">{plan.description || plan.code}</p></div><button onClick={() => editPlan(plan)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"><Pencil size={13} /> Editar</button></div><div className="mt-4 text-2xl font-bold">{formatPrice(plan.price_cents)}<span className="ml-1 text-xs font-normal text-muted-foreground">{plan.billing_interval === "monthly" ? "/mês" : plan.billing_interval === "yearly" ? "/ano" : plan.billing_interval === "lifetime" ? "único" : ""}</span></div><p className="mt-1 text-xs text-muted-foreground">Até {plan.device_limit} dispositivo(s)</p><div className="mt-4 flex flex-wrap gap-2">{FEATURES.map(feature => { const enabled = plan.assinapdf_plan_features?.find(item => item.feature_key === feature.key)?.is_enabled === true; return <span key={feature.key} className={`rounded-full px-2.5 py-1 text-xs ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground line-through"}`}>{feature.label}</span>; })}</div></div>)}
              </div>
            </div>
          )}

          {tab === "customers" && (
            <div className="space-y-4">
              <div><h2 className="text-lg font-semibold">Clientes e licenças</h2><p className="text-sm text-muted-foreground">Usuários cadastrados no AssinaPDF, licenças e assinaturas.</p></div>
              <form onSubmit={assignLicense} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[minmax(220px,1fr)_220px_180px_auto] sm:items-end">
                <label className="space-y-1 text-sm"><span className="font-medium">Cliente do AssinaPDF</span><select required value={licenseUserId} onChange={e => setLicenseUserId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2"><option value="">Selecione um cliente</option>{customers.map(customer => <option key={customer.user_id} value={customer.user_id}>{customer.full_name || customer.email} — {customer.email}</option>)}</select></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Plano a atribuir</span><select required value={licensePlanId} onChange={e => setLicensePlanId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2"><option value="">Selecione</option>{plans.filter(plan => plan.is_active).map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Validade (opcional)</span><input type="date" value={licenseValidUntil} onChange={e => setLicenseValidUntil(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                <button disabled={saving || customers.length === 0} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Atribuir plano</button>
              </form>
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Dispositivos</th><th className="px-4 py-3">Validade</th><th className="px-4 py-3">Ação</th></tr></thead><tbody>{licenses.map(license => { const customer = customerMap.get(license.user_id); return <tr key={license.id} className="border-t border-border"><td className="px-4 py-3"><div className="font-medium">{customer?.full_name || customer?.email || "Cliente"}</div><div className="max-w-64 truncate text-xs text-muted-foreground">{license.user_id}</div></td><td className="px-4 py-3">{license.assinapdf_plans?.name || "—"}</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{license.status}</span></td><td className="px-4 py-3">{license.max_devices}</td><td className="px-4 py-3">{formatDate(license.valid_until)}</td><td className="px-4 py-3"><select value={license.status} disabled={saving} onChange={e => void changeLicenseStatus(license.id, e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs"><option value="pending">Pendente</option><option value="active">Ativa</option><option value="suspended">Suspensa</option><option value="revoked">Revogada</option><option value="expired">Expirada</option></select></td></tr>; })}{licenses.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhuma licença cadastrada. Os clientes aparecerão aqui após criarem suas contas.</td></tr>}</tbody></table>
              </div>

              <div className="space-y-3">
                <div><h3 className="font-semibold">Pagamentos e recorrências</h3><p className="text-xs text-muted-foreground">Eventos recebidos do Asaas e pagamentos registrados manualmente.</p></div>
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Pagamento</th><th className="px-4 py-3">Recorrência</th></tr></thead>
                    <tbody>{payments.map(payment => { const customer = customerMap.get(payment.user_id); return <tr key={payment.id} className="border-t border-border"><td className="px-4 py-3"><div className="font-medium">{payment.metadata?.customer_name || customer?.full_name || customer?.email || payment.user_id || "—"}</div><div className="text-xs text-muted-foreground">{payment.metadata?.customer_email || customer?.email || ""}</div></td><td className="px-4 py-3">{payment.assinapdf_subscriptions?.assinapdf_plans?.name || "Premium"}</td><td className="px-4 py-3">{payment.provider === "asaas" ? "Asaas" : "Manual"}</td><td className="px-4 py-3">{formatPrice(Number(payment.amount_cents || 0))}</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{payment.status === "confirmed" ? "Confirmado" : payment.status === "overdue" ? "Em atraso" : payment.status === "refunded" ? "Estornado" : payment.status === "canceled" ? "Cancelado" : "Pendente"}</span></td><td className="px-4 py-3">{payment.due_date || "—"}</td><td className="px-4 py-3">{formatDate(payment.paid_at)}</td><td className="px-4 py-3">{payment.provider === "asaas" && payment.assinapdf_subscriptions?.id && ["pending","active","past_due"].includes(payment.assinapdf_subscriptions?.status) ? <button disabled={saving} onClick={() => void cancelAsaasSubscription(payment.assinapdf_subscriptions.id)} className="rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/5">Cancelar</button> : "—"}</td></tr>; })}{payments.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum pagamento registrado.</td></tr>}</tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div><h3 className="font-semibold">Dispositivos autorizados</h3><p className="text-xs text-muted-foreground">Revogue um dispositivo para liberar uma vaga na licença do cliente.</p></div>
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Dispositivo</th><th className="px-4 py-3">Plataforma</th><th className="px-4 py-3">Último acesso</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ação</th></tr></thead>
                    <tbody>{devices.map(device => { const customer = customerMap.get(device.assinapdf_licenses?.user_id); return <tr key={device.id} className="border-t border-border"><td className="px-4 py-3">{customer?.full_name || customer?.email || device.assinapdf_licenses?.user_id || "—"}</td><td className="px-4 py-3">{device.device_label || "Equipamento"}</td><td className="px-4 py-3">{device.platform || "—"}</td><td className="px-4 py-3">{formatDate(device.last_seen_at)}</td><td className="px-4 py-3">{device.revoked_at ? "Revogado" : "Ativo"}</td><td className="px-4 py-3">{!device.revoked_at && <button disabled={saving} onClick={() => void revokeDevice(device.id)} className="rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/5">Revogar</button>}</td></tr>; })}{devices.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum dispositivo registrado.</td></tr>}</tbody>
                  </table>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{customers.length} cliente(s) e {subscriptions.length} assinatura(s) registrada(s).</div>
            </div>
          )}


          {tab === "keys" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Emissão de chaves manuais</h2>
                <p className="text-sm text-muted-foreground">Venda via WhatsApp: confirme o pagamento e gere uma chave com validade escolhida pelo administrador. O código completo aparece somente uma vez.</p>
              </div>
              <form onSubmit={createActivationKey} className="space-y-4 rounded-xl border border-border bg-card p-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="space-y-1 text-sm"><span className="font-medium">Plano</span><select required value={keyForm.plan_id} onChange={e => setKeyForm(v => ({ ...v, plan_id: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2"><option value="">Selecione</option>{plans.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}{p.billing_interval === "monthly" ? " · mensal" : ""}</option>)}</select></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">Nome do cliente (opcional)</span><input value={keyForm.customer_name} onChange={e => setKeyForm(v => ({ ...v, customer_name: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">E-mail de ativação (opcional)</span><input type="email" value={keyForm.customer_email} onChange={e => setKeyForm(v => ({ ...v, customer_email: e.target.value }))} placeholder="Se preenchido, restringe a este e-mail" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">WhatsApp (opcional)</span><input value={keyForm.customer_phone} onChange={e => setKeyForm(v => ({ ...v, customer_phone: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">Validade da chave</span><input required type="datetime-local" value={keyForm.valid_until} onChange={e => setKeyForm(v => ({ ...v, valid_until: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span className="font-medium">Referência do pagamento</span><input value={keyForm.payment_reference} onChange={e => setKeyForm(v => ({ ...v, payment_reference: e.target.value }))} placeholder="Comprovante, observação..." className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                </div>
                <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                  <input type="checkbox" checked={keyForm.payment_confirmed} onChange={e => setKeyForm(v => ({ ...v, payment_confirmed: e.target.checked }))} className="mt-0.5" />
                  <span><strong>Pagamento já confirmado</strong><span className="block text-xs text-muted-foreground">Marque somente depois de conferir o recebimento. Sem esta confirmação, a chave fica bloqueada para ativação.</span></span>
                </label>
                <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><KeyRound size={15} /> {saving ? "Gerando..." : "Gerar chave de ativação"}</button></div>
              </form>

              {newPlaintextKey && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={17} /> Chave gerada — copie agora</div>
                  <p className="mt-1 text-xs text-muted-foreground">Por segurança, o sistema guarda somente o hash. Se perder este código, será necessário cancelar e emitir outro.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm">{newPlaintextKey}</code><button type="button" onClick={() => void navigator.clipboard.writeText(newPlaintextKey)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"><Copy size={15} /> Copiar</button></div>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Chave</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Pagamento</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Validade</th><th className="px-4 py-3">Ações</th></tr></thead>
                  <tbody>{activationKeys.map(item => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{item.key_prefix}••••</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.customer_name || "—"}</div><div className="text-xs text-muted-foreground">{item.customer_email || item.customer_phone || "Sem vínculo"}</div></td>
                      <td className="px-4 py-3">{item.assinapdf_plans?.name || "—"}</td>
                      <td className="px-4 py-3">{item.payment_status === "confirmed" ? "Confirmado" : item.payment_status === "refunded" ? "Estornado" : "Pendente"}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{item.status === "pending_payment" ? "Aguardando pagamento" : item.status === "available" ? "Disponível" : item.status === "redeemed" ? "Resgatada" : item.status === "revoked" ? "Cancelada" : "Expirada"}</span></td>
                      <td className="px-4 py-3">{formatDate(item.valid_until)}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2">{item.status === "pending_payment" && <button disabled={saving} onClick={() => void confirmActivationPayment(item.id)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"><CheckCircle2 size={13} /> Confirmar</button>}{["pending_payment","available"].includes(item.status) && <button disabled={saving} onClick={() => void revokeActivationKey(item.id)} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/5"><Ban size={13} /> Cancelar</button>}</div></td>
                    </tr>
                  ))}{activationKeys.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhuma chave emitida.</td></tr>}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "updates" && (
            <div className="space-y-4">
              <div><h2 className="text-lg font-semibold">Atualizações do aplicativo</h2><p className="text-sm text-muted-foreground">Cadastre o manifesto de cada versão. O aplicativo consultará esta lista para verificar atualizações.</p></div>
              <form onSubmit={saveRelease} className="grid gap-3 rounded-xl border border-border bg-card p-5 md:grid-cols-2">
                <label className="space-y-1 text-sm"><span className="font-medium">Plataforma</span><select value={releaseForm.platform} onChange={e => setReleaseForm(v => ({ ...v, platform: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2"><option value="windows-x64">Windows 64-bit</option><option value="macos-universal">macOS Universal</option><option value="macos-arm64">macOS Apple Silicon</option><option value="macos-x64">macOS Intel</option></select></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Canal</span><select value={releaseForm.channel} onChange={e => setReleaseForm(v => ({ ...v, channel: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2"><option value="stable">Estável</option><option value="beta">Beta</option></select></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Versão</span><input required value={releaseForm.version} onChange={e => setReleaseForm(v => ({ ...v, version: e.target.value }))} placeholder="1.0.0" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Número do build</span><input type="number" min="1" value={releaseForm.build_number} onChange={e => setReleaseForm(v => ({ ...v, build_number: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">Link HTTPS do pacote</span><input required type="url" value={releaseForm.download_url} onChange={e => setReleaseForm(v => ({ ...v, download_url: e.target.value }))} placeholder="https://..." className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">SHA-256 do arquivo</span><input required value={releaseForm.sha256} onChange={e => setReleaseForm(v => ({ ...v, sha256: e.target.value.toLowerCase() }))} placeholder="64 caracteres hexadecimais" className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs" /></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Versão mínima suportada</span><input value={releaseForm.minimum_supported_version} onChange={e => setReleaseForm(v => ({ ...v, minimum_supported_version: e.target.value }))} placeholder="Opcional" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Assinatura do pacote</span><input value={releaseForm.signature} onChange={e => setReleaseForm(v => ({ ...v, signature: e.target.value }))} placeholder="Opcional nesta etapa" className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">Notas da versão</span><textarea rows={2} value={releaseForm.release_notes} onChange={e => setReleaseForm(v => ({ ...v, release_notes: e.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
                <div className="flex flex-wrap gap-4 text-sm md:col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={releaseForm.is_mandatory} onChange={e => setReleaseForm(v => ({ ...v, is_mandatory: e.target.checked }))} /> Atualização obrigatória</label><label className="flex items-center gap-2"><input type="checkbox" checked={releaseForm.is_published} onChange={e => setReleaseForm(v => ({ ...v, is_published: e.target.checked }))} /> Publicar imediatamente</label></div>
                <div className="flex justify-end md:col-span-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={15} /> Cadastrar versão</button></div>
              </form>
              <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Plataforma</th><th className="px-4 py-3">Versão</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Publicada em</th></tr></thead><tbody>{releases.map(release => <tr key={release.id} className="border-t border-border"><td className="px-4 py-3">{release.platform}</td><td className="px-4 py-3 font-medium">{release.version}</td><td className="px-4 py-3">{release.channel}</td><td className="px-4 py-3">{release.is_published ? "Publicada" : "Rascunho"}{release.is_mandatory ? " · Obrigatória" : ""}</td><td className="px-4 py-3">{formatDate(release.published_at)}</td></tr>)}{releases.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhuma versão cadastrada ainda.</td></tr>}</tbody></table></div>
              <p className="text-xs text-muted-foreground">Importante: o cadastro da versão é a parte administrativa. Para atualizar sem intervenção do cliente, também vamos integrar e validar o mecanismo de atualização automática no aplicativo Windows e macOS, com verificação de hash e assinatura do pacote.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AssinaPdfAdmin;
