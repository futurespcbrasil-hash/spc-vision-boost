import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, QrCode, RefreshCcw, Smartphone, Unplug, Webhook } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ryze } from '@/services/ryzeService';
import { useToast } from '@/hooks/use-toast';

interface Instance {
  id: string; name: string; status: string; phone: string | null; qr_code: string | null;
  ryze_instance_id: string | null; last_status_at: string | null;
}

const statusColor = (s: string) => {
  if (s === 'connected') return 'bg-green-500 hover:bg-green-600';
  if (s === 'qr' || s === 'connecting') return 'bg-yellow-500 hover:bg-yellow-600';
  return 'bg-muted';
};
const statusLabel = (s: string) => ({
  connected: 'Online', disconnected: 'Offline', qr: 'Aguardando QR',
  connecting: 'Conectando', created: 'Criada',
} as Record<string, string>)[s] || s;

const WhatsAppInstancias = () => {
  const { toast } = useToast();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrOpen, setQrOpen] = useState<Instance | null>(null);

  const load = async () => {
    const { data } = await supabase.from('whatsapp_instances').select('*').order('created_at', { ascending: false });
    setInstances((data as Instance[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('wa-instances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await ryze.createInstance(newName.trim());
      setNewName('');
      toast({ title: 'Instância criada!' });
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao criar', description: e.message, variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const handleConnect = async (inst: Instance) => {
    setLoading(true);
    try {
      const r = await ryze.connect(inst.id);
      await load();
      const updated = { ...inst, qr_code: r.qr };
      setQrOpen(updated);
      // Poll status
      const iv = setInterval(async () => {
        const s = await ryze.status(inst.id).catch(() => null);
        if (s?.status === 'connected') { clearInterval(iv); setQrOpen(null); load(); toast({ title: 'Conectado!' }); }
      }, 3000);
      setTimeout(() => clearInterval(iv), 120000);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleStatus = async (inst: Instance) => {
    try { await ryze.status(inst.id); load(); } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleWebhook = async (inst: Instance) => {
    try {
      await ryze.registerWebhook(inst.id);
      toast({ title: 'Webhook registrado!' });
    } catch (e: any) {
      toast({ title: 'Erro webhook', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp — Instâncias</h1>
        <p className="text-muted-foreground text-sm">Conecte números via Ryze API. Preparado para múltiplas instâncias.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nova instância</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Nome (ex: atendimento-01)" value={newName} onChange={e => setNewName(e.target.value)} />
          <Button onClick={handleCreate} disabled={creating} className="gap-2"><Plus size={16}/>Criar</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {instances.map(inst => (
          <Card key={inst.id}>
            <CardContent className="flex items-center justify-between py-4 gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Smartphone size={20} className="text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{inst.name}</p>
                  <p className="text-xs text-muted-foreground">{inst.phone || 'Sem número vinculado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusColor(inst.status)}>{statusLabel(inst.status)}</Badge>
                <Button variant="outline" size="sm" onClick={() => handleStatus(inst)} className="gap-1">
                  <RefreshCcw size={14}/>Status
                </Button>
                {inst.status !== 'connected' ? (
                  <Button size="sm" onClick={() => handleConnect(inst)} disabled={loading} className="gap-1">
                    <QrCode size={14}/>Conectar
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleWebhook(inst)} className="gap-1">
                    <Webhook size={14}/>Registrar Webhook
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {instances.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma instância criada.</p>
        )}
      </div>

      <Dialog open={!!qrOpen} onOpenChange={o => !o && setQrOpen(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle>Escaneie o QR Code</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            {qrOpen?.qr_code ? (
              <img src={qrOpen.qr_code} alt="QR" className="w-64 h-64 rounded-lg border object-contain" />
            ) : (
              <div className="w-64 h-64 flex flex-col items-center justify-center bg-muted rounded-lg p-4 gap-2">
                <QrCode size={64} className="text-muted-foreground/40 animate-pulse" />
                <p className="text-xs text-muted-foreground">
                  Aguardando geração do QR Code pela API Ryze...
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              No celular: WhatsApp → Dispositivos conectados → Vincular dispositivo
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppInstancias;
