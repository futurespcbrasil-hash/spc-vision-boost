import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Zap, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const WhatsAppAjustes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrShortcut, setQrShortcut] = useState('');
  const [qrText, setQrText] = useState('');
  const [replies, setReplies] = useState<any[]>([]);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#8B5CF6');
  const [labels, setLabels] = useState<any[]>([]);

  const load = async () => {
    const { data: r } = await supabase.from('whatsapp_quick_replies').select('*').order('shortcut');
    setReplies(r || []);
    const { data: l } = await supabase.from('whatsapp_labels').select('*').order('name');
    setLabels(l || []);
  };
  useEffect(() => { load(); }, []);

  const addReply = async () => {
    if (!qrShortcut.trim() || !qrText.trim() || !user) return;
    const { error } = await supabase.from('whatsapp_quick_replies')
      .insert({ user_id: user.id, shortcut: qrShortcut.trim(), text: qrText.trim() });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setQrShortcut(''); setQrText(''); load();
  };
  const delReply = async (id: string) => { await supabase.from('whatsapp_quick_replies').delete().eq('id', id); load(); };

  const addLabel = async () => {
    if (!labelName.trim() || !user) return;
    const { error } = await supabase.from('whatsapp_labels')
      .insert({ user_id: user.id, name: labelName.trim(), color: labelColor });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setLabelName(''); load();
  };
  const delLabel = async (id: string) => { await supabase.from('whatsapp_labels').delete().eq('id', id); load(); };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Ajustes WhatsApp</h1>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap size={16}/>Respostas rápidas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
            <Input placeholder="atalho (ex: ola)" value={qrShortcut} onChange={e => setQrShortcut(e.target.value)}/>
            <Textarea placeholder="Texto..." value={qrText} onChange={e => setQrText(e.target.value)} rows={2}/>
            <Button onClick={addReply} className="gap-1"><Plus size={14}/>Adicionar</Button>
          </div>
          <div className="space-y-2">
            {replies.map(r => (
              <div key={r.id} className="flex items-center justify-between border rounded p-2 text-sm">
                <div><span className="font-medium text-primary">/{r.shortcut}</span> — <span className="text-muted-foreground">{r.text}</span></div>
                <Button size="icon" variant="ghost" onClick={() => delReply(r.id)}><Trash2 size={14}/></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag size={16}/>Etiquetas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
            <Input placeholder="Nome da etiqueta" value={labelName} onChange={e => setLabelName(e.target.value)}/>
            <Input type="color" value={labelColor} onChange={e => setLabelColor(e.target.value)}/>
            <Button onClick={addLabel} className="gap-1"><Plus size={14}/>Adicionar</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {labels.map(l => (
              <Badge key={l.id} style={{ backgroundColor: l.color }} className="text-white gap-2 cursor-pointer" onClick={() => delLabel(l.id)}>
                {l.name} <Trash2 size={12}/>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppAjustes;
