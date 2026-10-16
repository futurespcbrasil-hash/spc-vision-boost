import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { waha } from '@/services/ryzeService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Unplug, QrCode, Smartphone, RefreshCw, Loader2, Webhook } from 'lucide-react';
import { toast } from 'sonner';

type Account = {
  id: string; name: string; phone: string | null; status: string; created_at?: string;
  provider?: string | null; provider_instance_name?: string | null; qr_code?: string | null;
};
const readableError = (e: unknown) => e instanceof Error ? e.message : 'Erro inesperado';

export default function WhatsAppContas() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrAccount, setQrAccount] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).from('whatsapp_instances')
        .select('id,name,phone,status,created_at,provider,provider_instance_name,qr_code')
        .eq('owner_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts((data || []) as Account[]);
    } catch (e) { toast.error('Falha ao carregar contas WhatsApp: ' + readableError(e)); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const connect = async (account: Account) => {
    if (!account.provider_instance_name) {
      toast.error('Esta conta ainda não está vinculada a uma sessão WAHA. Não foi criada nenhuma sessão nova.');
      return;
    }
    setBusyId(account.id);
    try {
      const result: any = await waha.connect(account.id);
      setQr(typeof result?.qr === 'string' ? result.qr : null);
      setQrAccount(account.name);
      setShowQR(result?.status !== 'connected' && Boolean(result?.qr));
      if (result?.status === 'connected' || result?.already_connected) toast.success('WhatsApp já está conectado.');
      else if (result?.qr) toast.info('Leia o QR Code pelo WhatsApp no celular.');
      else toast.info('Solicitação de conexão enviada. Atualize o status em alguns segundos.');
      await load();
    } catch (e) { toast.error('Falha ao conectar: ' + readableError(e)); }
    finally { setBusyId(''); }
  };

  const disconnect = async (account: Account) => {
    if (!account.provider_instance_name) return toast.error('Esta conta não tem sessão WAHA vinculada.');
    if (!window.confirm('Deseja desconectar a sessão WhatsApp "' + account.name + '"?')) return;
    setBusyId(account.id);
    try {
      await waha.disconnect(account.id);
      toast.success('Sessão desconectada.');
      await load();
    } catch (e) { toast.error('Falha ao desconectar: ' + readableError(e)); }
    finally { setBusyId(''); }
  };

  const registerWebhook = async (account: Account) => {
    if (!account.provider_instance_name) return toast.error('Esta conta não tem sessão WAHA vinculada.');
    setBusyId(account.id);
    try {
      await waha.registerWebhook(account.id);
      toast.success('Webhook registrado novamente com o segredo configurado no Supabase. A sessão existente foi preservada.');
    } catch (e) { toast.error('Não foi possível registrar o webhook: ' + readableError(e)); }
    finally { setBusyId(''); }
  };

  const refreshStatus = async (account: Account) => {
    if (!account.provider_instance_name) return;
    setBusyId(account.id);
    try {
      const result: any = await waha.status(account.id);
      setAccounts((current) => current.map((item) => item.id === account.id
        ? { ...item, status: result?.status || item.status, phone: result?.phone || item.phone } : item));
      toast.success('Status atualizado.');
    } catch (e) { toast.error('Falha ao consultar status: ' + readableError(e)); }
    finally { setBusyId(''); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Sessões WAHA existentes, conexão e webhook.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Atualizar
        </Button>
      </div>

      {accounts.length === 0 && !loading && <Card><CardContent className="py-8 text-sm text-muted-foreground">Nenhuma conta cadastrada para este usuário.</CardContent></Card>}
      <div className="grid gap-4">
        {accounts.map((account) => {
          const working = account.status === 'connected' || account.status === 'working';
          const busy = busyId === account.id;
          return <Card key={account.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Smartphone size={20} className="text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{account.name}</p>
                  <p className="text-sm text-muted-foreground">{account.phone || 'Número não informado'}</p>
                  <p className="text-xs text-muted-foreground truncate">{account.provider_instance_name || 'Sem sessão WAHA vinculada'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={working ? 'default' : 'secondary'} className={working ? 'bg-green-600' : ''}>
                  {working ? 'Conectado' : account.status === 'connecting' || account.status === 'qr' ? 'Conectando' : account.status || 'Desconectado'}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => void refreshStatus(account)} disabled={busy || !account.provider_instance_name} title="Consultar estado real da sessão">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </Button>
                {working
                  ? <Button variant="outline" size="sm" onClick={() => void disconnect(account)} disabled={busy} className="gap-1"><Unplug size={14} /> Desconectar</Button>
                  : <Button size="sm" onClick={() => void connect(account)} disabled={busy || !account.provider_instance_name} className="gap-1"><QrCode size={14} /> Conectar</Button>}
                <Button variant="outline" size="sm" onClick={() => void registerWebhook(account)} disabled={busy || !account.provider_instance_name} className="gap-1" title="Atualiza a configuração do webhook sem alterar a API Key nem recriar a sessão">
                  <Webhook size={14} /> Corrigir webhook
                </Button>
              </div>
            </CardContent>
          </Card>;
        })}
      </div>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle>Conectar {qrAccount}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qr?.startsWith('data:image') || (qr && qr.length > 200)
              ? <img src={qr || ''} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
              : <div className="w-48 h-48 border-2 border-dashed border-muted-foreground/30 rounded-xl flex items-center justify-center"><QrCode size={120} className="text-muted-foreground/40" /></div>}
            <p className="text-sm text-muted-foreground">No celular, abra WhatsApp → Dispositivos conectados → Conectar dispositivo.</p>
            <Button variant="outline" onClick={() => { setShowQR(false); void load(); }}>Fechar e atualizar status</Button>
          </div>
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">“Corrigir webhook” reaplica o endereço e o segredo já configurados no Supabase. Não altera a API Key nem exclui/recria sessões.</p>
    </div>
  );
}
