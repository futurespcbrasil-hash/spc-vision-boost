import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Paperclip, Users } from 'lucide-react';
import { mockAccounts } from '@/data/whatsappMockData';
import { useToast } from '@/hooks/use-toast';

const mockLeads = [
  { id: '1', name: 'João Silva', phone: '+55 11 98888-1111' },
  { id: '2', name: 'Maria Oliveira', phone: '+55 21 97777-2222' },
  { id: '3', name: 'Carlos Santos', phone: '+55 31 96666-3333' },
  { id: '4', name: 'Ana Costa', phone: '+55 41 95555-4444' },
  { id: '5', name: 'Pedro Lima', phone: '+55 51 94444-5555' },
];

const WhatsAppEnviar = () => {
  const { toast } = useToast();
  const [account, setAccount] = useState('');
  const [message, setMessage] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [sendMode, setSendMode] = useState<'single' | 'multi'>('single');
  const [singleContact, setSingleContact] = useState('');

  const toggleLead = (id: string) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  const handleSend = () => {
    const count = sendMode === 'single' ? 1 : selectedLeads.length;
    if (!account || !message.trim() || count === 0) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    toast({ title: `Mensagem enviada para ${count} contato(s)` });
    setMessage('');
    setSelectedLeads([]);
    setSingleContact('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Enviar Mensagem</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Conta WhatsApp</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {mockAccounts.filter(a => a.status === 'connected').map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} - {a.number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant={sendMode === 'single' ? 'default' : 'outline'} size="sm" onClick={() => setSendMode('single')}>
                Um contato
              </Button>
              <Button variant={sendMode === 'multi' ? 'default' : 'outline'} size="sm" onClick={() => setSendMode('multi')} className="gap-1">
                <Users size={14} /> Múltiplos
              </Button>
            </div>

            {sendMode === 'single' ? (
              <div className="space-y-2">
                <Label>Contato</Label>
                <Select value={singleContact} onValueChange={setSingleContact}>
                  <SelectTrigger><SelectValue placeholder="Selecione o contato" /></SelectTrigger>
                  <SelectContent>
                    {mockLeads.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} - {l.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Selecione os contatos ({selectedLeads.length})</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {mockLeads.map(lead => (
                    <label key={lead.id} className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-b-0">
                      <Checkbox checked={selectedLeads.includes(lead.id)} onCheckedChange={() => toggleLead(lead.id)} />
                      <div>
                        <p className="text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Mensagem</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea placeholder="Digite sua mensagem..." rows={8} value={message} onChange={e => setMessage(e.target.value)} />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" className="gap-1"><Paperclip size={14} /> Anexar</Button>
              <Button onClick={handleSend} className="gap-2 bg-green-500 hover:bg-green-600">
                <Send size={16} /> Enviar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppEnviar;
