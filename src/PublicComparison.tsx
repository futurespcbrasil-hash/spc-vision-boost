import { useParams, useSearchParams } from 'react-router-dom';
import { COMPARISON_DATA } from '@/data/spcData';
import { CheckCircle2, XCircle, Trophy, Star, MessageCircle } from 'lucide-react';

const PublicComparison = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const vendedor = searchParams.get('vendedor') || '';
  const idx = parseInt(id || '0');
  const comparison = COMPARISON_DATA[idx] || COMPARISON_DATA[0];

  const spcCount = Object.values(comparison.spc.features).filter(v => v === true).length;
  const compCount = Object.values(comparison.competitor.features).filter(v => v === true).length;

  const phrases = [
    'O SPC Brasil integra dados da base Serasa, entregando visão mais completa.',
    'Com o SPC, você consulta uma única vez e recebe dados de múltiplas fontes.',
    'Mais informações por consulta = decisões de crédito mais seguras.',
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-spc py-8 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center mx-auto mb-3 text-primary-foreground font-bold">
            SPC
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground mb-2">Comparativo de Relatórios de Crédito</h1>
          <p className="text-primary-foreground/80 text-sm">{comparison.spc.name} vs {comparison.competitor.name}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Highlight phrase */}
        <div className="text-center p-4 rounded-xl bg-spc-light border border-primary/10">
          <p className="text-sm text-foreground font-medium">{phrases[idx % phrases.length]}</p>
        </div>

        {/* Comparison table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/30 border-b border-border">
            <div className="px-4 py-3 text-sm font-semibold text-muted-foreground">Recurso</div>
            <div className="px-4 py-3 text-sm font-semibold text-center">
              <div className="flex items-center justify-center gap-1 text-primary">
                <Trophy size={14} /> {comparison.spc.name}
              </div>
            </div>
            <div className="px-4 py-3 text-sm font-semibold text-center text-muted-foreground">
              {comparison.competitor.name}
            </div>
          </div>
          {Object.keys(comparison.spc.features).map(feature => (
            <div key={feature} className="grid grid-cols-3 border-b border-border/30 last:border-0">
              <div className="px-4 py-3 text-sm text-foreground">{feature}</div>
              <div className="px-4 py-3 text-center">
                {comparison.spc.features[feature] === true ? (
                  <CheckCircle2 size={18} className="advantage-check inline-block" />
                ) : (
                  <XCircle size={18} className="disadvantage-x inline-block" />
                )}
              </div>
              <div className="px-4 py-3 text-center">
                {comparison.competitor.features[feature] === true ? (
                  <CheckCircle2 size={18} className="advantage-check inline-block" />
                ) : (
                  <XCircle size={18} className="disadvantage-x inline-block" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Score */}
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card text-center ring-2 ring-primary/20">
            <div className="text-3xl font-bold text-primary">{spcCount}</div>
            <div className="text-sm text-muted-foreground mt-1">recursos no SPC</div>
            <div className="flex items-center justify-center gap-1 mt-2 text-xs font-semibold text-primary">
              <Star size={12} /> Recomendado
            </div>
          </div>
          <div className="stat-card text-center">
            <div className="text-3xl font-bold text-muted-foreground">{compCount}</div>
            <div className="text-sm text-muted-foreground mt-1">recursos no {comparison.competitor.provider === 'serasa' ? 'Serasa' : 'Equifax'}</div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-6 rounded-xl gradient-spc">
          <h2 className="text-lg font-bold text-primary-foreground mb-2">Quer este relatório para sua empresa?</h2>
          <p className="text-primary-foreground/80 text-sm mb-4">
            Solicite agora com {vendedor ? `o consultor ${vendedor}` : 'um consultor especializado'}
          </p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Olá${vendedor ? ` ${vendedor}` : ''}! Gostaria de saber mais sobre o ${comparison.spc.name}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-foreground text-primary font-semibold text-sm hover:opacity-90 transition"
          >
            <MessageCircle size={18} /> Solicite este relatório com um consultor
          </a>
        </div>
      </div>
    </div>
  );
};

export default PublicComparison;
