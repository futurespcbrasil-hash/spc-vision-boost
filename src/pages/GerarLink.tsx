import { useState } from 'react';
import { COMPARISON_DATA } from '@/data/spcData';
import { Link2, Copy, Check, ExternalLink } from 'lucide-react';

const GerarLink = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [vendorName, setVendorName] = useState('');
  const [copied, setCopied] = useState(false);

  const comparison = COMPARISON_DATA[selectedIdx];
  const linkBase = window.location.origin;
  const link = `${linkBase}/comparacao/${selectedIdx}${vendorName ? `?vendedor=${encodeURIComponent(vendorName)}` : ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerar Link para Cliente</h1>
        <p className="text-muted-foreground text-sm mt-1">Crie um link de comparação para enviar ao cliente via WhatsApp</p>
      </div>

      <div className="stat-card space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Seu nome (vendedor)</label>
          <input
            type="text"
            placeholder="Ex: João Silva"
            value={vendorName}
            onChange={e => setVendorName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Comparação</label>
          <div className="flex gap-2 flex-wrap">
            {COMPARISON_DATA.map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedIdx === i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {c.spc.name} x {c.competitor.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Link gerado</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 rounded-lg bg-muted text-sm text-foreground font-mono break-all">
              {link}
            </div>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex-shrink-0"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink size={14} /> Visualizar página do cliente
        </a>
      </div>

      <div className="stat-card bg-spc-light border-primary/20">
        <p className="text-sm text-foreground">
          <strong>💡 Dica:</strong> Copie o link e envie diretamente pelo WhatsApp. O cliente verá a comparação sem precisar de login, 
          e ao final poderá solicitar o relatório com você.
        </p>
      </div>
    </div>
  );
};

export default GerarLink;
