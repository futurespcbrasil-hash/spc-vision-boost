import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const WhatsAppConfig = () => {
  const { toast } = useToast();
  const [api, setApi] = useState('evolution');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [reconnectTime, setReconnectTime] = useState('30');
  const [sendLimit, setSendLimit] = useState('20');
  const [notifyDisconnect, setNotifyDisconnect] = useState(true);

  const handleSave = () => toast({ title: 'Configurações salvas!' });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configurações WhatsApp</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">API WhatsApp</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provedor da API</Label>
              <Select value={api} onValueChange={setApi}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                  <SelectItem value="wppconnect">WPPConnect</SelectItem>
                  <SelectItem value="zapi">Z-API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input placeholder="https://api.exemplo.com" value={apiUrl} onChange={e => setApiUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Chave da API</Label>
              <Input type="password" placeholder="Sua chave de API" value={apiKey} onChange={e => setApiKey(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Comportamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tempo de reconexão (segundos)</Label>
              <Input type="number" value={reconnectTime} onChange={e => setReconnectTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Limite de envio por minuto</Label>
              <Input type="number" value={sendLimit} onChange={e => setSendLimit(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Notificar desconexão</Label>
              <Switch checked={notifyDisconnect} onCheckedChange={setNotifyDisconnect} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} className="gap-2"><Save size={16} /> Salvar Configurações</Button>
    </div>
  );
};

export default WhatsAppConfig;
