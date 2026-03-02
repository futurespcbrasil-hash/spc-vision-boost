import { useState, useRef } from 'react';
import { PRODUCTS, PRODUCT_CATEGORIES, Product } from '@/data/productsData';
import { useAppState } from '@/context/AppContext';
import { Lead } from '@/data/spcData';
import {
  FileCheck, UserSearch, CreditCard, Building2, Briefcase,
  TrendingUp, Wheat, PlusCircle, Shield, CheckCircle2, X,
  ChevronRight, Send, DollarSign, Package, ArrowLeft, Upload, Table2, User2
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const ICON_MAP: Record<string, React.ElementType> = {
  FileCheck, UserSearch, CreditCard, Building2, Briefcase,
  TrendingUp, Wheat, PlusCircle, Shield,
};

interface ImportedTable {
  id: string;
  name: string;
  products: Product[];
}

const Produtos = () => {
  const { leads } = useAppState();
  const [selectedCategory, setSelectedCategory] = useState(PRODUCT_CATEGORIES[0].key);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [importedTables, setImportedTables] = useState<ImportedTable[]>([]);
  const [activeTable, setActiveTable] = useState<string>('default');
  const [showLeadPicker, setShowLeadPicker] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allProducts = activeTable === 'default'
    ? PRODUCTS
    : importedTables.find(t => t.id === activeTable)?.products || [];

  const filteredProducts = allProducts.filter(p => p.category === selectedCategory);

  const handleImportTable = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(l => l.trim());
      const dataLines = lines.slice(1);

      const products: Product[] = dataLines.map((line, idx) => {
        const sep = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
        const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        return {
          id: `imp-${Date.now()}-${idx}`,
          code: cols[0] || '',
          name: cols[1] || '',
          category: (cols[2] || 'adicionais').toLowerCase().replace(/ /g, '_'),
          description: cols[3] || '',
          price: cols[4] || 'Sob consulta',
          features: (cols[5] || '').split('|').filter(Boolean),
        };
      }).filter(p => p.name);

      const tableName = file.name.replace(/\.[^.]+$/, '');
      setImportedTables(prev => [...prev, { id: `table-${Date.now()}`, name: tableName, products }]);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleShareWhatsApp = (product: Product, lead?: Lead) => {
    const msg = encodeURIComponent(
      `🔵 *${product.name}* - SPC Brasil\n\n` +
      `${product.description}\n\n` +
      `💰 Valor: ${product.price}\n\n` +
      `✅ O que está incluso:\n${product.features.map(f => `• ${f}`).join('\n')}\n\n` +
      `📞 Fale com seu consultor para contratar!`
    );
    const phone = lead?.whatsapp ? lead.whatsapp : '';
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleShareTableWhatsApp = (lead?: Lead) => {
    const products = allProducts.filter(p => p.category === selectedCategory);
    const msg = encodeURIComponent(
      `🔵 *Tabela de Produtos SPC Brasil*\n` +
      `📋 Categoria: ${PRODUCT_CATEGORIES.find(c => c.key === selectedCategory)?.label}\n\n` +
      products.map(p => `• *${p.name}* — ${p.price}`).join('\n') +
      `\n\n📞 Fale com seu consultor para mais informações!`
    );
    const phone = lead?.whatsapp ? lead.whatsapp : '';
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  // Lead picker modal
  if (showLeadPicker) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => setShowLeadPicker(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Voltar
        </button>
        <h2 className="text-lg font-bold text-foreground">Selecionar Lead para enviar</h2>
        <p className="text-sm text-muted-foreground">Escolha um lead cadastrado ou envie sem número definido.</p>
        <button
          onClick={() => { handleShareWhatsApp(showLeadPicker); setShowLeadPicker(null); }}
          className="w-full py-3 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition mb-2"
        >
          Enviar sem selecionar lead (número em branco)
        </button>
        {leads.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum lead cadastrado.</p>}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {leads.map(lead => (
            <button
              key={lead.id}
              onClick={() => { handleShareWhatsApp(showLeadPicker, lead); setShowLeadPicker(null); }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:ring-2 hover:ring-primary/30 transition text-left"
            >
              <User2 size={18} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{lead.name}</div>
                <div className="text-xs text-muted-foreground truncate">{lead.company} • {lead.whatsapp || lead.phone}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selectedProduct) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => setSelectedProduct(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> Voltar aos produtos
        </button>

        <div className="stat-card ring-2 ring-primary/20 relative">
          <div className="absolute -top-3 left-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            <Package size={12} /> SPC Brasil
          </div>

          <div className="mt-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl gradient-spc flex items-center justify-center text-primary-foreground font-bold text-sm">SPC</div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedProduct.name}</h2>
                  <span className="text-xs text-muted-foreground">Código: {selectedProduct.code}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-success/10 border border-success/20">
                <DollarSign size={18} className="text-success" />
                <span className="text-lg font-bold text-success">{selectedProduct.price}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{selectedProduct.description}</p>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">✅ O que está incluso:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedProduct.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50">
                  <CheckCircle2 size={16} className="text-success shrink-0" />
                  <span className="text-sm text-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowLeadPicker(selectedProduct)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#1fb855] text-white font-semibold text-sm transition-colors"
          >
            <Send size={16} /> Enviar para cliente via WhatsApp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos SPC Brasil</h1>
          <p className="text-muted-foreground text-sm mt-1">Tabela de Preços – Faturamento Mínimo R$ 109,00</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleImportTable} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition"
          >
            <Upload size={16} /> Importar Tabela
          </button>
        </div>
      </div>

      {/* Table selector */}
      {importedTables.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Table2 size={16} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-1">Tabela:</span>
          <button
            onClick={() => setActiveTable('default')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTable === 'default' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}`}
          >
            Padrão
          </button>
          {importedTables.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTable(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTable === t.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Category scroll */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-3">
          {PRODUCT_CATEGORIES.map(cat => {
            const Icon = ICON_MAP[cat.icon] || Package;
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                  isActive ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border border-border text-foreground hover:bg-muted'
                }`}
              >
                <Icon size={16} />
                {cat.label}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Send table button */}
      <div className="flex gap-2">
        <button
          onClick={() => handleShareTableWhatsApp()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition"
        >
          <Send size={14} /> Enviar tabela via WhatsApp
        </button>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProducts.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 col-span-full">Nenhum produto nesta categoria{activeTable !== 'default' ? ' (tabela importada)' : ''}.</p>
        )}
        {filteredProducts.map(product => (
          <button
            key={product.id}
            onClick={() => setSelectedProduct(product)}
            className="stat-card text-left hover:ring-2 hover:ring-primary/30 transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg gradient-spc flex items-center justify-center text-primary-foreground font-bold text-[10px] shrink-0">SPC</div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm leading-tight">{product.name}</h3>
                  <span className="text-[11px] text-muted-foreground">Cód. {product.code}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors mt-1" />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{product.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-success font-bold text-sm">
                <DollarSign size={14} />
                {product.price}
              </div>
              <span className="text-[11px] text-muted-foreground">{product.features.length} recursos</span>
            </div>
          </button>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        💡 Para importar tabelas, use CSV/TXT com colunas: Código, Nome, Categoria, Descrição, Preço, Recursos (separados por |)
      </div>
    </div>
  );
};

export default Produtos;
