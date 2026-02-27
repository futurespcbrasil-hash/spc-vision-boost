import { useState, useRef } from 'react';
import { PRODUCTS, PRODUCT_CATEGORIES, Product } from '@/data/productsData';
import {
  FileCheck, UserSearch, CreditCard, Building2, Briefcase,
  TrendingUp, Wheat, PlusCircle, Shield, CheckCircle2, X,
  ChevronRight, Send, DollarSign, Package, ArrowLeft
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const ICON_MAP: Record<string, React.ElementType> = {
  FileCheck, UserSearch, CreditCard, Building2, Briefcase,
  TrendingUp, Wheat, PlusCircle, Shield,
};

const Produtos = () => {
  const [selectedCategory, setSelectedCategory] = useState(PRODUCT_CATEGORIES[0].key);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filteredProducts = PRODUCTS.filter(p => p.category === selectedCategory);
  const currentCategory = PRODUCT_CATEGORIES.find(c => c.key === selectedCategory);

  const handleShareWhatsApp = (product: Product) => {
    const msg = encodeURIComponent(
      `🔵 *${product.name}* - SPC Brasil\n\n` +
      `${product.description}\n\n` +
      `💰 Valor: ${product.price}\n\n` +
      `✅ O que está incluso:\n${product.features.map(f => `• ${f}`).join('\n')}\n\n` +
      `📞 Fale com seu consultor para contratar!`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  if (selectedProduct) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button
          onClick={() => setSelectedProduct(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Voltar aos produtos
        </button>

        <div className="stat-card ring-2 ring-primary/20 relative">
          <div className="absolute -top-3 left-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            <Package size={12} /> SPC Brasil
          </div>

          <div className="mt-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl gradient-spc flex items-center justify-center text-primary-foreground font-bold text-sm">
                  SPC
                </div>
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
            onClick={() => handleShareWhatsApp(selectedProduct)}
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Produtos SPC Brasil</h1>
        <p className="text-muted-foreground text-sm mt-1">Tabela de Preços – Faturamento Mínimo R$ 109,00</p>
      </div>

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
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-card border border-border text-foreground hover:bg-muted'
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

      {/* Products grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProducts.map(product => (
          <button
            key={product.id}
            onClick={() => setSelectedProduct(product)}
            className="stat-card text-left hover:ring-2 hover:ring-primary/30 transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg gradient-spc flex items-center justify-center text-primary-foreground font-bold text-[10px] shrink-0">
                  SPC
                </div>
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
    </div>
  );
};

export default Produtos;
