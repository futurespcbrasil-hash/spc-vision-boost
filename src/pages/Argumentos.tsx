import { SALES_ARGUMENTS } from '@/data/spcData';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

const Argumentos = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Central de Argumentos de Venda</h1>
        <p className="text-muted-foreground text-sm mt-1">Textos prontos para copiar e colar no WhatsApp</p>
      </div>

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
