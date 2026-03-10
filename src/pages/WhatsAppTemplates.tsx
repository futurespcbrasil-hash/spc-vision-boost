import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Copy, Trash2, FileText } from 'lucide-react';
import { mockTemplates, WhatsAppTemplate } from '@/data/whatsappMockData';
import { useToast } from '@/hooks/use-toast';

const VARIABLES = ['{nome}', '{empresa}', '{valor}', '{vencimento}', '{boleto_link}'];

const WhatsAppTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(mockTemplates);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;
    setTemplates(prev => [...prev, { id: String(Date.now()), name, content, createdAt: new Date().toISOString().split('T')[0] }]);
    setName(''); setContent(''); setOpen(false);
    toast({ title: 'Template salvo!' });
  };

  const handleDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast({ title: 'Template removido' });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates de Mensagem</h1>
          <p className="text-muted-foreground text-sm">Mensagens prontas com variáveis dinâmicas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={16} /> Novo Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do template</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Envio de Boleto" />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea rows={6} value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Olá {nome}, segue seu boleto..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Variáveis disponíveis:</Label>
                <div className="flex flex-wrap gap-1">
                  {VARIABLES.map(v => (
                    <Button key={v} variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => setContent(prev => prev + v)}>{v}</Button>
                  ))}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">Salvar Template</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <Card key={template.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText size={16} className="text-primary" /> {template.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(template.content)}>
                    <Copy size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(template.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">{template.content}</p>
              <p className="text-[10px] text-muted-foreground mt-2">Criado em {template.createdAt}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default WhatsAppTemplates;
