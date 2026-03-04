import { useState } from 'react';
import { COMPARISON_DATA, COMPANIES } from '@/data/spcData';
import { PRODUCTS, PRODUCT_CATEGORIES } from '@/data/productsData';
import { CheckCircle2, XCircle, Trophy, Star, ArrowRight, Package } from 'lucide-react';

const Comparador = () => {
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('serasa');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedSpcProduct, setSelectedSpcProduct] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState(PRODUCT_CATEGORIES[0].key);

  const filteredComparisons = COMPARISON_DATA.filter(c => c.competitorKey === selectedCompetitor);
  const selectedComparison = selectedProductId 
    ? filteredComparisons.find((_, i) => `${selectedCompetitor}-${i}` === selectedProductId) 
    : filteredComparisons[0];

  const competitorCompanies = COMPANIES.filter(c => c.key !== 'spc');
  
  const spcProduct = selectedSpcProduct ? PRODUCTS.find(p => p.id === selectedSpcProduct) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comparador Inteligente</h1>
        <p className="text-muted-foreground text-sm mt-1">Compare produtos SPC com a concorrência</p>
      </div>

      {/* Company selector */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">Comparar SPC Brasil com:</label>
        <div className="flex gap-2 flex-wrap">
          {competitorCompanies.map(company => (
            <button
              key={company.key}
              onClick={() => { setSelectedCompetitor(company.key); setSelectedProductId(null); }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                selectedCompetitor === company.key
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-card border border-border text-foreground hover:bg-muted'
              }`}
            >
              {company.label}
            </button>
          ))}
        </div>
      </div>

      {/* SPC Product selector from Produtos menu */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">Selecionar produto SPC (do catálogo):</label>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowProductPicker(!showProductPicker)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-card border border-border text-foreground hover:bg-muted transition"
          >
            <Package size={16} />
            {spcProduct ? spcProduct.name : 'Escolher produto do catálogo'}
          </button>
          {spcProduct && (
            <button onClick={() => setSelectedSpcProduct(null)} className="text-xs text-muted-foreground hover:text-destructive">✕ Limpar</button>
          )}
        </div>

        {showProductPicker && (
          <div className="stat-card space-y-3 animate-slide-in">
            <div className="flex gap-2 flex-wrap">
              {PRODUCT_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setPickerCategory(cat.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${pickerCategory === cat.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {PRODUCTS.filter(p => p.category === pickerCategory).map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedSpcProduct(p.id); setShowProductPicker(false); }}
                  className={`text-left p-2.5 rounded-lg border transition text-sm ${selectedSpcProduct === p.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                >
                  <div className="font-medium text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.price} • {p.features.length} recursos</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product/category selector */}
      {filteredComparisons.length > 0 && (
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground">Comparações disponíveis:</label>
          <div className="flex gap-2 flex-wrap">
            {filteredComparisons.map((c, i) => {
              const id = `${selectedCompetitor}-${i}`;
              const isActive = selectedProductId === id || (!selectedProductId && i === 0);
              return (
                <button
                  key={id}
                  onClick={() => setSelectedProductId(id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {c.category}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected SPC product detail */}
      {spcProduct && (
        <div className="stat-card ring-2 ring-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg gradient-spc flex items-center justify-center text-primary-foreground font-bold text-[10px]">SPC</div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{spcProduct.name}</h3>
              <span className="text-xs text-muted-foreground">Cód. {spcProduct.code} • {spcProduct.price}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {spcProduct.features.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={12} className="text-success shrink-0" />
                <span className="text-foreground">{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedComparison ? (
        <>
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
                    <h3 className="font-bold text-foreground">{selectedComparison.spc.name}</h3>
                    <span className="text-xs text-muted-foreground">SPC Brasil</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(selectedComparison.spc.features).map(([feature, value]) => (
                  <div key={feature} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-sm text-foreground">{feature}</span>
                    {value === true ? <CheckCircle2 size={18} className="advantage-check" /> : value === false ? <XCircle size={18} className="disadvantage-x" /> : <span className="text-sm text-muted-foreground">{value}</span>}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-success">
                <Star size={14} /> {Object.values(selectedComparison.spc.features).filter(v => v === true).length} recursos inclusos
              </div>
            </div>

            {/* Competitor */}
            <div className="stat-card opacity-90">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs ${
                    selectedComparison.competitor.provider === 'serasa' ? 'bg-serasa' 
                    : selectedComparison.competitor.provider === 'boa_vista' ? 'bg-boa-vista'
                    : 'bg-equifax'
                  }`}>
                    {selectedComparison.competitor.provider === 'serasa' ? 'SER' 
                     : selectedComparison.competitor.provider === 'boa_vista' ? 'BV' : 'EQF'}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{selectedComparison.competitor.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {COMPANIES.find(c => c.key === selectedComparison.competitor.provider)?.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(selectedComparison.competitor.features).map(([feature, value]) => (
                  <div key={feature} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-sm text-foreground">{feature}</span>
                    {value === true ? <CheckCircle2 size={18} className="advantage-check" /> : <XCircle size={18} className="disadvantage-x" />}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                {Object.values(selectedComparison.competitor.features).filter(v => v === true).length} recursos inclusos
              </div>
            </div>
          </div>

          <div className="stat-card bg-spc-light border-primary/20">
            <p className="text-sm text-foreground">
              <strong>💡 Conclusão:</strong> O <strong>{selectedComparison.spc.name}</strong> oferece{' '}
              <strong className="text-primary">
                {Object.values(selectedComparison.spc.features).filter(v => v === true).length - Object.values(selectedComparison.competitor.features).filter(v => v === true).length} recursos a mais
              </strong>{' '}
              que o {selectedComparison.competitor.name}, com melhor custo-benefício e dados mais completos.
            </p>
          </div>
        </>
      ) : (
        <div className="stat-card text-center py-8">
          <p className="text-muted-foreground">Nenhuma comparação disponível para este concorrente ainda.</p>
        </div>
      )}
    </div>
  );
};

export default Comparador;
