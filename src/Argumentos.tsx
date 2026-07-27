import { SALES_ARGUMENTS } from '@/data/spcData';
import { Copy, Check, Sparkles, Send, MessageCircle, Mail, MessageSquare, Loader2 } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

type CopyType = 'whatsapp' | 'email' | 'conversa';

const COPY_TYPES: { key: CopyType; label: string; icon: React.ElementType }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'conversa', label: 'Conversa', icon: MessageSquare },
];

const Argumentos = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [copyType, setCopyType] = useState<CopyType>('whatsapp');
  const [context, setContext] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiCopied, setAiCopied] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAI = () => {
    navigator.clipboard.writeText(aiResult);
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 2000);
  };

  const generateCopy = async () => {
    if (!context.trim()) return;
    setIsGenerating(true);
    setAiResult('');

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: copyType,
          messages: [{ role: 'user', content: context }],
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        setAiResult(`❌ ${err.error || 'Erro ao gerar copy'}`);
        setIsGenerating(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setIsGenerating(false); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              result += content;
              setAiResult(result);
            }
          } catch {}
        }
      }
    } catch (err) {
      setAiResult('❌ Erro ao conectar com o serviço de IA');
    }
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Argumentos de Venda</h1>
          <p className="text-muted-foreground text-sm mt-1">Textos prontos para copiar e colar no WhatsApp</p>
        </div>
        <button
          onClick={() => setShowAI(!showAI)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            showAI ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'
          }`}
        >
          <Sparkles size={16} /> Gerar Copy com IA
        </button>
      </div>

      {/* AI Section */}
      {showAI && (
        <div className="stat-card ring-2 ring-primary/20 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Sparkles size={16} className="text-primary" /> Gerador de Copy com IA</h3>
          
          <div className="flex gap-2">
            {COPY_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setCopyType(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  copyType === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder={`Ex: "Cliente do ramo imobiliário que usa Serasa e reclama do preço. Quer consultar CPF com score e renda presumida."`}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm min-h-[80px] placeholder:text-muted-foreground"
          />

          <button
            onClick={generateCopy}
            disabled={isGenerating || !context.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isGenerating ? 'Gerando...' : 'Gerar'}
          </button>

          {aiResult && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50 prose prose-sm max-w-none text-foreground">
                <ReactMarkdown>{aiResult}</ReactMarkdown>
              </div>
              <button
                onClick={handleCopyAI}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition"
              >
                {aiCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {aiCopied ? 'Copiado!' : 'Copiar texto'}
              </button>
            </div>
          )}
        </div>
      )}

      {SALES_ARGUMENTS.map(cat => (
        <div key={cat.category} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span>{cat.icon}</span> {cat.category}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cat.arguments.map((arg, i) => {
              const id = `${cat.category}-${i}`;
              const isCopied = copiedId === id;
              return (
                <div key={i} className="stat-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-foreground">{arg.title}</h3>
                    <button
                      onClick={() => handleCopy(arg.text, id)}
                      className="flex-shrink-0 p-1.5 rounded-md hover:bg-muted transition text-muted-foreground hover:text-primary"
                      title="Copiar"
                    >
                      {isCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{arg.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Argumentos;
