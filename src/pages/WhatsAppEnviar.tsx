import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, RefreshCw, Loader2, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { waha } from '@/services/ryzeService';

type Instance = { id: string; name: string; status: string; phone: string | null };

const digits = (value: string) => value.replace(/\\D/g, '');
const normalizeNumber = (value: string) => {
  const raw = digits(value);
  const number = raw.startsWith('55') ? raw : `55${raw}`;
  return number.length >= 12 && number.length <= 13 ? number : null;
};

const WhatsAppEnviar = () => {
  const { toast } = useToast();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceId, setInstanceId] = useState('');
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ number: string; ok: boolean; error?: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await waha.syncInstances();
      const list = (response?.instances || []) as Instance[];
      setInstances(list);
      setInstanceId((current) => list.some((item) => item.id === current && item.status === 'connected')
        ? current : list.find((item) => item.status === 'connected')?.id || '');
    } catch (error: any) {
      toast({ title: 'Não foi possível carregar as instâncias WAHA', description: error?.message || 'Verifique a configuração do servidor.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const connected = useMemo(() => instances.filter((item) => item.status === 'connected'), [instances]);
  const parsedRecipients = useMemo(() => recipients.split(/[\\n,;]+/).map((item) => item.trim()).filter(Boolean), [recipients]);

  const handleSend = async () => {
    if (!instanceId) {
      toast({ title: 'Selecione uma instância conectada', variant: 'destructive' });
      return;
    }
    if (!message.trim()) {
      toast({ title: 'Digite a mensagem', variant: 'destructive' });
      return;
    }
    if (!parsedRecipients.length) {
      toast({ title: 'Informe pelo menos um número', variant: 'destructive' });
      return;
    }
    const normalized = parsedRecipients.map((item) => ({ original: item, number: normalizeNumber(item) }));
    const invalid = normalized.filter((item) => !item.number);
    if (invalid.length) {
      toast({ title: 'Revise os números inválidos', description: invalid.map((item) => item.original).join(', '), variant: 'destructive' });
      return;
    }

    setSending(true);
    setResults([]);
    setProgress({ done: 0, total: normalized.length });
    const nextResults: { number: string; ok: boolean; error?: string }[] = [];
    try {
      for (const item of normalized) {
        try {
          await waha.sendText(instanceId, item.number!, message.trim());
          nextResults.push({ number: item.number!, ok: true });
        } catch (error: any) {
          nextResults.push({ number: item.number!, ok: false, error: error?.message || 'Falha no envio' });
        }
        setResults([...nextResults]);
        setProgress({ done: nextResults.length, total: normalized.length });
        if (nextResults.length < normalized.length) await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      const ok = nextResults.filter((item) => item.ok).length;
      const failed = nextResults.length - ok;
      toast({
        title: failed ? 'Envio concluído com falhas' : 'Mensagens aceitas pela WAHA',
        description: `${ok} enviado(s), ${failed} com erro. Consulte os resultados abaixo.`,
        variant: failed && !ok ? 'destructive' : 'default',
      });
      if (!failed) {
        setMessage('');
        setRecipients('');
      }
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enviar mensagem pelo WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Envio real pela WAHA usando uma instância conectada.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || sending} className="gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle size={18} /> Destinatários e mensagem</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <Select value={instanceId} onValueChange={setInstanceId} disabled={loading || sending}>
              <SelectTrigger><SelectValue placeholder="Selecione uma instância conectada" /></SelectTrigger>
              <SelectContent>
                {connected.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{item.phone ? ` — ${item.phone}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            {!loading && connected.length === 0 && <p className="text-sm text-amber-700">Nenhuma instância conectada. Acesse WhatsApp → Instâncias WAHA e conecte um número pelo QR Code.</p>}
          </div>
          <div className="space-y-2">
            <Label>Números de WhatsApp</Label>
            <Textarea value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="Digite um número por linha, com DDD. Ex.: 54999999999" rows={4} disabled={sending} />
            <p className="text-xs text-muted-foreground">Aceita números separados por linha, vírgula ou ponto e vírgula. O código do Brasil (55) é adicionado quando necessário.</p>
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Digite a mensagem que deseja enviar..." rows={6} disabled={sending} />
          </div>
          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Processando envios</span><span>{progress.done}/{progress.total}</span></div>
              <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }} /></div>
            </div>
          )}
          <Button onClick={() => void handleSend()} disabled={sending || loading || !connected.length} className="gap-2">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Enviando...' : `Enviar para ${parsedRecipients.length || 0} contato(s)`}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resultado dos envios</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.map((item, index) => (
              <div key={`${item.number}-${index}`} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0"><p className="font-medium">{item.number}</p>{item.error && <p className="text-sm text-destructive break-words">{item.error}</p>}</div>
                <Badge variant={item.ok ? 'default' : 'destructive'}>{item.ok ? 'Aceito pela WAHA' : 'Falhou'}</Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">“Aceito pela WAHA” confirma que a API aceitou o pedido, não garante que o destinatário leu a mensagem.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WhatsAppEnviar;
