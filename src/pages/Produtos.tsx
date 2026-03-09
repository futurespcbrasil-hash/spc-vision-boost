import { useState, useRef, useEffect } from 'react';
import { PRODUCTS, PRODUCT_CATEGORIES, Product } from '@/data/productsData';
import { useAppState } from '@/context/AppContext';
import { Lead } from '@/data/spcData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FileCheck, UserSearch, CreditCard, Building2, Briefcase,
  TrendingUp, Wheat, PlusCircle, Shield, CheckCircle2, X,
  ChevronRight, Send, DollarSign, Package, ArrowLeft, Upload, Table2, User2, FileText, Trash2, Plus, Edit2, Save
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// Configure PDF.js worker - must match installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

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
  const [parsingPdf, setParsingPdf] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', code: '', category: PRODUCT_CATEGORIES[0].key, description: '', price: '', features: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Load imported tables from DB
  useEffect(() => {
    const loadTables = async () => {
      const { data } = await supabase.from('imported_tables').select('*').order('created_at', { ascending: false });
      if (data) {
        setImportedTables(data.map((t: any) => ({ id: t.id, name: t.name, products: t.products as unknown as Product[] })));
      }
    };
    loadTables();
  }, []);

  const allProducts = activeTable === 'default'
    ? PRODUCTS
    : importedTables.find(t => t.id === activeTable)?.products || [];

  const filteredProducts = allProducts.filter(p => p.category === selectedCategory);

  const saveImportedTable = async (name: string, products: Product[]) => {
    const { data } = await supabase.from('imported_tables').insert({
      name,
      products: products as any,
    }).select().single();
    if (data) {
      const newTable = { id: data.id, name: data.name, products: (data.products as unknown) as Product[] };
      setImportedTables(prev => [newTable, ...prev]);
      setActiveTable(data.id);
    }
  };

  const deleteImportedTable = async (tableId: string) => {
    await supabase.from('imported_tables').delete().eq('id', tableId);
    setImportedTables(prev => prev.filter(t => t.id !== tableId));
    if (activeTable === tableId) setActiveTable('default');
  };

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
      saveImportedTable(tableName, products);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingPdf(true);
    toast.info('Extraindo texto do PDF...');

    try {
      // Step 1: Extract text from PDF using pdfjs on client
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let allText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const rows: { y: number; items: { x: number; text: string }[] }[] = [];
        for (const item of textContent.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          const y = Math.round((item as any).transform[5]);
          const x = Math.round((item as any).transform[4]);
          let row = rows.find(r => Math.abs(r.y - y) < 5);
          if (!row) { row = { y, items: [] }; rows.push(row); }
          row.items.push({ x, text: item.str.trim() });
        }
        rows.sort((a, b) => b.y - a.y);
        rows.forEach(r => r.items.sort((a, b) => a.x - b.x));
        
        for (const row of rows) {
          allText += row.items.map(i => i.text).join(' | ') + '\n';
        }
        allText += '\n';
      }

      console.log('PDF text extracted, length:', allText.length);
      
      if (allText.trim().length < 20) {
        toast.error('Não foi possível extrair texto do PDF');
        setParsingPdf(false);
        return;
      }

      // Step 2: Send extracted text to AI for structured extraction
      toast.info('Processando com IA... Aguarde.');
      const { data, error } = await supabase.functions.invoke('extract-pdf-products', {
        body: { pdfText: allText },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Erro ao processar PDF');
        throw error;
      }

      const tableName = file.name.replace(/\.[^.]+$/, '');

      if (data?.success && Array.isArray(data.products) && data.products.length > 0) {
        const products: Product[] = data.products.map((p: any, idx: number) => ({
          id: `pdf-${Date.now()}-${idx}`,
          code: String(idx + 1),
          name: p.name || 'Produto sem nome',
          category: p.category || 'adicionais',
          description: p.description || p.name || '',
          price: p.price || 'Sob consulta',
          features: p.description ? [p.description] : ['Importado via PDF'],
        }));
        await saveImportedTable(`📄 ${tableName} (${products.length})`, products);
        toast.success(`${products.length} produtos importados com sucesso!`);
      } else {
        toast.warning('Nenhum produto encontrado no PDF');
      }
    } catch (err) {
      console.error('Error parsing PDF:', err);
      toast.error('Erro ao importar PDF: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setParsingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleAddProduct = () => {
    if (!newProduct.name) return;
    const product: Product = {
      id: `custom-${Date.now()}`,
      code: newProduct.code || '-',
      name: newProduct.name,
      category: newProduct.category,
      description: newProduct.description || newProduct.name,
      price: newProduct.price || 'Sob consulta',
      features: newProduct.features.split('|').filter(Boolean),
    };

    if (activeTable === 'default') {
      // Save as a new custom table
      saveImportedTable(`✏️ Produtos Customizados`, [product]);
    } else {
      // Add to existing imported table
      const table = importedTables.find(t => t.id === activeTable);
      if (table) {
        const updatedProducts = [...table.products, product];
        supabase.from('imported_tables').update({ products: updatedProducts as any }).eq('id', activeTable).then(() => {
          setImportedTables(prev => prev.map(t => t.id === activeTable ? { ...t, products: updatedProducts } : t));
        });
      }
    }
    setNewProduct({ name: '', code: '', category: PRODUCT_CATEGORIES[0].key, description: '', price: '', features: '' });
    setShowNewProduct(false);
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
        <div className="flex gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleImportTable} />
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleImportPdf} />
          <button
            onClick={() => setShowNewProduct(!showNewProduct)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <Plus size={16} /> Cadastrar Produto
          </button>
          <button
            onClick={() => pdfInputRef.current?.click()}
            disabled={parsingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition disabled:opacity-50"
          >
            <FileText size={16} /> {parsingPdf ? 'Processando...' : 'Importar PDF'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition"
          >
            <Upload size={16} /> Importar CSV/TXT
          </button>
        </div>
      </div>

      {/* New product form */}
      {showNewProduct && (
        <div className="stat-card space-y-3 animate-slide-in ring-2 ring-primary/20">
          <h3 className="text-sm font-bold text-foreground">Cadastrar Novo Produto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nome do produto *" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
            <input placeholder="Código" value={newProduct.code} onChange={e => setNewProduct(p => ({ ...p, code: e.target.value }))} className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
            <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))} className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm">
              {PRODUCT_CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
            </select>
            <input placeholder="Preço (ex: R$ 5,00)" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm" />
            <input placeholder="Descrição" value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm col-span-full" />
            <input placeholder="Recursos (separados por |)" value={newProduct.features} onChange={e => setNewProduct(p => ({ ...p, features: e.target.value }))} className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm col-span-full" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddProduct} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
              <Save size={14} /> Salvar
            </button>
            <button onClick={() => setShowNewProduct(false)} className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Table selector - dropdown */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Table2 size={16} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Selecionar Tabela:</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={activeTable}
            onChange={e => setActiveTable(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="default">📋 Padrão SPC</option>
            {importedTables.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.products.length})</option>
            ))}
          </select>
          {activeTable !== 'default' && (
            <button
              onClick={() => deleteImportedTable(activeTable)}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
              title="Excluir tabela selecionada"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
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
        💡 Importe tabelas em CSV/TXT ou PDF. Para CSV use colunas: Código, Nome, Categoria, Descrição, Preço, Recursos (separados por |)
      </div>
    </div>
  );
};

export default Produtos;
