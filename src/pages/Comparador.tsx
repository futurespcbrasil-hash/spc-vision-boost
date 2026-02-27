import { useState } from 'react';
import { COMPARISON_DATA } from '@/data/spcData';
import { CheckCircle2, XCircle, Trophy, Star } from 'lucide-react';

const Comparador = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const comparison = COMPARISON_DATA[selectedIdx];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comparador Inteligente</h1>
        <p className="text-muted-foreground text-sm mt-1">Compare produtos SPC com a concorrência</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {COMPARISON_DATA.map((c, i) => (
          <button
            key={i}
            onClick={() => setSelectedIdx(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedIdx === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            {c.category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SPC Product */}
        <div className="stat-card ring-2 ring-primary/20 relative">
          <div className="absolute -top-3 left-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            <Trophy size={12} /> Melhor custo-benefício
          </div>
          <div className="mt-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg gradient-spc flex items-center justify-center text-primary-foreground font-bold text-xs">SPC</div>
              <div>
                <h3 className="font-bold text-foreground">{comparison.spc.name}</h3>
                <span className="text-xs text-muted-foreground">SPC Brasil</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(comparison.spc.features).map(([feature, value]) => (
              <div key={feature} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <span className="text-sm text-foreground">{feature}</span>
                {value === true ? (
                  <CheckCircle2 size={18} className="advantage-check" />
                ) : value === false ? (
                  <XCircle size={18} className="disadvantage-x" />
                ) : (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-success">
            <Star size={14} /> {Object.values(comparison.spc.features).filter(v => v === true).length} recursos inclusos
          </div>
        </div>

        {/* Competitor Product */}
        <div className="stat-card opacity-90">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs ${
                comparison.competitor.provider === 'serasa' ? 'bg-serasa' : 'bg-equifax'
              }`}>
                {comparison.competitor.provider === 'serasa' ? 'SER' : 'EQF'}
              </div>
              <div>
                <h3 className="font-bold text-foreground">{comparison.competitor.name}</h3>
                <span className="text-xs text-muted-foreground">{comparison.competitor.provider === 'serasa' ? 'Serasa Experian' : 'Equifax'}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(comparison.competitor.features).map(([feature, value]) => (
              <div key={feature} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <span className="text-sm text-foreground">{feature}</span>
                {value === true ? (
                  <CheckCircle2 size={18} className="advantage-check" />
                ) : (
                  <XCircle size={18} className="disadvantage-x" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            {Object.values(comparison.competitor.features).filter(v => v === true).length} recursos inclusos
          </div>
        </div>
      </div>

      <div className="stat-card bg-spc-light border-primary/20">
        <p className="text-sm text-foreground">
          <strong>💡 Conclusão:</strong> O <strong>{comparison.spc.name}</strong> oferece{' '}
          <strong className="text-primary">
            {Object.values(comparison.spc.features).filter(v => v === true).length - Object.values(comparison.competitor.features).filter(v => v === true).length} recursos a mais
          </strong>{' '}
          que o {comparison.competitor.name}, com melhor custo-benefício e dados mais completos.
          O SPC Brasil integra dados da base Serasa, entregando visão mais completa.
        </p>
      </div>
    </div>
  );
};

export default Comparador;
