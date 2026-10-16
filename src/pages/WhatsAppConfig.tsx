import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, Server, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { waha } from '@/services/ryzeService';

type Instance = { id: string; name: string; status: string; phone: string | null; provider?: string | null };

const statusLabel: Record<string, string> = {
  connected: 'Conectado', qr: 'Aguardando QR Code', connecting: 'Conectando',
  disconnected: 'Desconectado', created: 'Criado', unknown: 'Desconhecido',
};
const statusVariant = (status: string) => status === 'connected' ? 'default' : status === 'qr' || status === 'connecting' ? 'secondary' : 'destructive';

const WhatsAppConfig = () => {
  const { toast } = useToast();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await waha.syncInstances();
      const list = (response?.instances || []) as Instance[];
      const statuses = await Promise.all(list.map(async (item) => {
        try {
          const result = await waha.status(item.id);
          return { ...item, status: result?.status || item.status, phone: result?.phone || item.phone };
        } catch {
          return item;
        }
      }));
      setInstances(statuses);
    } catch (error: any) {
      toast({ title: 'Falha ao consultar a WAHA', description: error?.message || 'Verifique os secrets do Supabase.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Diagnóstico real das instâncias e da conexão com a WAHA.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Verificar conexão
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Server size={18} /> Estado das instâncias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Consultando instâncias e status na WAHA...</p>}
          {!loading && instances.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma instância disponível para este usuário. Crie uma em WhatsApp → Instâncias WAHA.</p>}
          {instances.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.phone || 'Número ainda não identificado'}</p></div>
              <Badge variant={statusVariant(item.status)}>{statusLabel[item.status] || item.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={18} /> Segurança e configuração do servidor</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>As credenciais da WAHA devem ficar exclusivamente nos secrets do Supabase, nunca no navegador nem no código do CRM.</p>
          <div className="rounded-md border p-3 space-y-1">
            <p className="font-medium">Secrets necessários</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><code>WAHA_API_URL</code> — endereço base da API WAHA</li>
              <li><code>WAHA_API_KEY</code> — chave da API</li>
              <li><code>WAHA_WEBHOOK_URL</code> — URL da função <code>waha-webhook</code></li>
              <li><code>WAHA_WEBHOOK_SECRET</code> — segredo compartilhado do webhook</li>
            </ul>
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>Esta tela consulta o estado real da API; ela não simula salvamento de credenciais. Se a consulta falhar, a mensagem de erro indica o próximo diagnóstico necessário.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppConfig;
