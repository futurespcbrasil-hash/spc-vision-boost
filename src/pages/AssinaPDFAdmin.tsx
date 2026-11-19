import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Copy, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ASSINAPDF_URL = "https://zcquhikpsqohrclflnjo.supabase.co";
const ASSINAPDF_PUBLISHABLE_KEY = "sb_publishable_QGohhsJ9qwrmjzzT_QKqrw_dPQ_lRY7";

type Plan = {
  id: string;
  code: string;
  name: string;
  price_cents: number | null;
  is_active: boolean;
};

type AdminResponse = {
  plans?: Plan[];
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

function defaultValidity() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

const AssinaPDFAdmin = () => {
  const { user, canManageUsers, loading } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [customerName, setCustomerName] = useState("Teste AssinaPDF");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidity);
  const [generatedKey, setGeneratedKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

  const loadPlans = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await callAdmin({ action: "list_plans" });
      const activePlans = (result.plans || []).filter((plan) => plan.is_active);
      setPlans(activePlans);
      setPlanId((current) => current || activePlans.find((plan) => plan.code === "premium")?.id || activePlans[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar planos.");
    } finally {
      setBusy(false);
    }
  }, [callAdmin]);

  useEffect(() => {
    if (user && canManageUsers) void loadPlans();
  }, [user, canManageUsers, loadPlans]);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando permissões...</div>;
  if (!user || !canManageUsers) return <Navigate to="/" replace />;

  const createTestKey = async (event: React.FormEvent) => {
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
          plan_id: planId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          valid_until: new Date(validUntil).toISOString(),
          payment_confirmed: true,
          payment_reference: "TESTE INTERNO CRM — sem cobrança",
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

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><KeyRound className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AssinaPDF — Chaves de acesso</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie uma chave de teste para ativar o Premium no aplicativo AssinaPDF.</p>
        </div>
      </header>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Acesso administrativo validado pelo serviço do AssinaPDF
        </div>
        <form onSubmit={createTestKey} className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Plano a liberar</span>
            <select className="h-10 rounded-md border bg-background px-3" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
              <option value="">Selecione um plano</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.code})</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Validade da chave</span>
            <input className="h-10 rounded-md border bg-background px-3" type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Nome do cliente</span>
            <input className="h-10 rounded-md border bg-background px-3" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome para identificar o teste" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">E-mail do cliente (opcional)</span>
            <input className="h-10 rounded-md border bg-background px-3" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="cliente@exemplo.com" />
          </label>
          <label className="grid gap-1.5 text-sm md:col-span-2">
            <span className="font-medium">WhatsApp (opcional)</span>
            <input className="h-10 rounded-md border bg-background px-3" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </label>
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100 md:col-span-2">
            <strong>Modo de teste:</strong> esta ação cria a chave com pagamento marcado como confirmado, sem gerar cobrança no Asaas. Use somente para testes internos.
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button disabled={busy || plans.length === 0} type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <KeyRound className="h-4 w-4" /> {busy ? "Processando..." : "Gerar chave de teste"}
            </button>
            <button disabled={busy} type="button" onClick={() => void loadPlans()} className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm">
              <RefreshCw className="h-4 w-4" /> Atualizar planos
            </button>
          </div>
        </form>
      </section>

      {message && <div role="status" className="rounded-lg border bg-muted/50 p-3 text-sm">{message}</div>}

      {generatedKey && (
        <section className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <h2 className="font-semibold text-emerald-700 dark:text-emerald-300">Chave criada — copie agora</h2>
          <p className="text-sm text-muted-foreground">No AssinaPDF, entre na conta que receberá o Premium, cole esta chave e clique em “Ativar minha chave”.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="flex-1 break-all rounded-md border bg-background p-3 text-sm">{generatedKey}</code>
            <button type="button" onClick={() => void copyKey()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium">
              <Copy className="h-4 w-4" /> Copiar chave
            </button>
          </div>
          <p className="text-xs text-muted-foreground">O código completo não poderá ser recuperado depois desta tela; o sistema guarda somente o hash da chave.</p>
        </section>
      )}
    </main>
  );
};

export default AssinaPDFAdmin;
