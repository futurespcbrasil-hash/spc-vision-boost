// Relatório de Comissões - Ajustado para filtragem dinâmica e persistência de estado.
// Versão corrigida: Atualiza vendedoresDB imediatamente após importação e flexibiliza matching.
import React, { useState, useRef, useEffect } from 'react';
import { FileBarChart, Upload, FileDown, Loader2, CheckCircle2, AlertCircle, BarChart3, FileText, Filter, MoreHorizontal, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from "@/integrations/supabase/client";
import { Database, Tables } from "@/integrations/supabase/types";

type ImportacaoComissoes = Database['public']['Tables']['importacoes_comissoes']['Row'];
import DashboardRelatorios from '@/components/DashboardRelatorios';


interface CommissionData {
  vendedor: string;
  email?: string;
  protocolo: string;
  valorVenda: number;
  comissao: number;
  produto: string;
  cliente: string;
  telefone?: string;
  numeroPedido?: string;
  tipoEmissao?: string;
  statusVenda?: string;
  regra?: number;
  dataVenda?: string;
}


const RelatoriosComissoes = () => {
  const [results, setResults] = useState<Record<string, CommissionData[]>>({});
  const [loading, setLoading] = useState(false);
  const [vendedoresDB, setVendedoresDB] = useState<Record<string, { percentual: number, email?: string }>>({});
  const [savedImports, setSavedImports] = useState<ImportacaoComissoes[]>([]);
  const [importName, setImportName] = useState("");
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [filterConfig, setFilterConfig] = useState({
    onlyVendedoresList: true,
    statusFilter: 'emitida', // 'all', 'emitida', 'protocolo gerado', 'revogado', etc.
  });

  useEffect(() => {
    fetchVendedores();
    fetchImports();
  }, []);

  const fetchVendedores = async () => {
    const { data, error } = await supabase
      .from('vendedores_comissoes')
      .select('nome, percentual_comissao, email');
    
    if (!error && data) {
      const config: Record<string, { percentual: number, email?: string }> = {};
      data.forEach(v => {
        config[v.nome.trim()] = { 
          percentual: Number(v.percentual_comissao),
          email: v.email || undefined
        };
      });
      setVendedoresDB(config);
    }
  };

  const fetchImports = async () => {
    const { data, error } = await supabase
      .from('importacoes_comissoes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setSavedImports(data);
    }
  };

  const deleteImport = async (id: string) => {
    const { error } = await supabase
      .from('importacoes_comissoes')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao excluir importação.');
    } else {
      toast.success('Importação excluída.');
      if (selectedImportId === id) {
        setResults({});
        setSelectedImportId(null);
      }
      fetchImports();
    }
  };

  const loadImport = (imp: any) => {
    setResults(imp.dados_processados as unknown as Record<string, CommissionData[]>);
    setSelectedImportId(imp.id);
    setImportName(imp.nome_importacao);
    toast.success(`Importação "${imp.nome_importacao}" carregada.`);
  };
  
  const fileInputVendedores = useRef<HTMLInputElement>(null);
  const fileInputVendas = useRef<HTMLInputElement>(null);

  const processFiles = async () => {
    const vendsFile = fileInputVendedores.current?.files?.[0];
    const salesFile = fileInputVendas.current?.files?.[0];

    if (!vendsFile || !salesFile) {
      toast.error('Por favor, selecione as duas planilhas.');
      return;
    }

    setLoading(true);
    try {
      // 1. Process Vendedores XLSX
      const vendsData = await vendsFile.arrayBuffer();
      const vendsWorkbook = XLSX.read(vendsData);
      const vendsSheet = vendsWorkbook.Sheets[vendsWorkbook.SheetNames[0]];
      const vendsJson: any[] = XLSX.utils.sheet_to_json(vendsSheet);
      
      const config = { ...vendedoresDB };
      vendsJson.forEach(row => {
        const comissaoRaw = row['Comissão'] || row['Comissao'] || row['REGRA'];
        let percentual = 0;
        
        if (typeof comissaoRaw === 'string') {
          percentual = parseFloat(comissaoRaw.replace('%', '').replace(',', '.'));
        } else if (typeof comissaoRaw === 'number') {
          percentual = comissaoRaw < 1 ? comissaoRaw * 100 : comissaoRaw;
        }

        const nome = String(row['Contabilidade'] || row['Vendedor'] || row['VENDEDOR'] || row['Nome'] || '').trim();
        const email = String(row['ENVIO'] || row['Envio'] || row['E-MAIL'] || row['Email'] || row['email'] || '').trim();
        if (nome && !isNaN(percentual)) {
          config[nome] = { 
            percentual,
            email: email || config[nome]?.email 
          };
        }
      });
      
      // Update state immediately so filteredResults can use it
      setVendedoresDB(config);


      // 2. Process Vendas CSV
      const salesText = await salesFile.text();
      Papa.parse(salesText, {
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[];
          const commissions: Record<string, CommissionData[]> = {};

          rows.forEach(row => {
            const statusVendaRaw = (row['Status Venda'] || row['status da venda'] || row['STATUS'] || row['Status'] || '').trim();
            const statusVenda = statusVendaRaw.toLowerCase();
            let vendedorRaw = (row['Vendedor'] || row['vendedor'] || row['VENDEDOR'] || '').trim();
            
            // Regra 13: "Neura" e "Solução" devem ser considerados o mesmo vendedor ("Solução")
            if (vendedorRaw.toLowerCase() === 'neura') {
              vendedorRaw = 'Solução';
            }

            const valorVenda = parseFloat(String(row['Valor Venda'] || row['valor da venda'] || row['VALOR'] || '0').replace(',', '.'));
            const protocolo = row['Nº Protocolo'] || row['numero do protocolo'] || row['PROTOCOLO'] || '';
            const produto = row['Produto'] || row['produto'] || row['PRODUTO'] || '';
            const cliente = row['Cliente'] || row['nome do cliente'] || row['CLIENTE'] || '';
            const telefone = row['Telefone'] || row['telefone'] || row['TELEFONE'] || '';
            const numeroPedido = row['Nº Pedido'] || row['numero do pedido'] || row['PEDIDO'] || '';
            const tipoEmissao = row['Tipo Emissão'] || row['tipo de emissao'] || row['TIPO EMISSAO'] || '';
            const dataVenda = row['Data Venda'] || row['data da venda'] || row['DATA'] || '';
            
            if (vendedorRaw) {
              const configToUse = config; // Use the freshly processed config
              
              let matchedVendedor = '';
              let basePercentual = 0;
              let matchedEmail = '';

              const normalizedVendedor = vendedorRaw.toLowerCase().trim();

              const match = Object.entries(configToUse).find(([name]) => {
                const normalizedName = name.toLowerCase().trim();
                
                return normalizedVendedor === normalizedName || 
                       normalizedVendedor.startsWith(normalizedName + " ") ||
                       normalizedVendedor.startsWith(normalizedName + "-") ||
                       normalizedName.startsWith(normalizedVendedor + " ");
              });

              if (match) {
                matchedVendedor = match[0];
                basePercentual = match[1].percentual;
                matchedEmail = match[1].email || '';
              } else {
                console.log(`No match for vendedor: "${vendedorRaw}"`);
              }

              const reportKey = matchedVendedor || vendedorRaw;
              
              // Regra 2 & 3: Considerar somente status "Emitida" para comissão.
              const valorComissao = statusVenda === 'emitida' ? (valorVenda * basePercentual) / 100 : 0;
              
              if (!commissions[reportKey]) commissions[reportKey] = [];
              
              commissions[reportKey].push({
                vendedor: reportKey,
                email: matchedEmail,
                protocolo,
                valorVenda,
                comissao: valorComissao,
                produto,
                cliente,
                telefone,
                numeroPedido,
                tipoEmissao,
                statusVenda: statusVendaRaw || 'Não informado',
                regra: basePercentual,
                dataVenda: dataVenda 
              });
            }
          });

          const allProcessed = commissions;
          setResults(allProcessed);
          
          // Salvar no banco automaticamente se tiver um nome
          saveToDatabase(allProcessed);

          setLoading(false);
          toast.success('Relatório processado com sucesso!');
        },
        error: (err) => {
          console.error(err);
          setLoading(false);
          toast.error('Erro ao processar CSV de vendas.');
        }
      });

    } catch (err) {
      console.error(err);
      setLoading(false);
      toast.error('Erro ao processar arquivos.');
    }
  };

  const saveToDatabase = async (data: Record<string, CommissionData[]>) => {
    const allRows = Object.values(data).flat();
    const totalVendas = allRows.reduce((acc, curr) => acc + curr.valorVenda, 0);
    const totalComissao = allRows.reduce((acc, curr) => acc + curr.comissao, 0);
    
    const finalName = importName || `Importação ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const { data: saved, error } = await supabase
      .from('importacoes_comissoes')
      .insert({
        nome_importacao: finalName,
        dados_processados: data as any,
        total_vendas: totalVendas,
        total_comissao: totalComissao,
        quantidade_vendas: allRows.length
      })
      .select()
      .single();

    if (!error && saved) {
      fetchImports();
      setSelectedImportId(saved.id);
    }
  };

  const exportPDF = (vendedor: string, data: CommissionData[], type: 'resumido' | 'completo' | 'avancado' = 'resumido') => {
    // Regra 8 & 15: Filtrar apenas comissões maiores que zero
    const validData = data.filter(item => item.comissao > 0);
    
    if (validData.length === 0 && vendedor !== 'Resumo Geral') {
      return; 
    }

    const pdf = new jsPDF('l', 'mm', 'a4');
    const totalComissao = validData.reduce((acc, curr) => acc + curr.comissao, 0);
    const totalVendas = validData.reduce((acc, curr) => acc + curr.valorVenda, 0);

    const addHeader = () => {
      pdf.setFillColor(63, 81, 181);
      pdf.rect(0, 0, 297, 40, 'F');
      
      try {
        const img = new Image();
        img.src = '/logo-future.png';
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(10, 5, 45, 15, 2, 2, 'F');
        pdf.addImage(img, 'PNG', 12, 7, 40, 10);
      } catch (e) {
        console.error('Erro ao carregar logo no PDF:', e);
      }

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.text(vendedor === 'Resumo Geral' ? 'Resumo Geral de Vendas' : 'Relatório de Comissões', 65, 20);
      pdf.setFontSize(12);
      pdf.text('Future Soluções', 65, 30);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.text(`Vendedor: ${vendedor}`, 15, 50);
      const typeLabel = type === 'resumido' ? 'Resumido' : type === 'completo' ? 'Individual' : 'Avançado';
      pdf.text(`Tipo: ${typeLabel}`, 15, 58);
      pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 240, 50);
    };

    addHeader();

    let headers: string[][] = [];
    let body: any[][] = [];

    if (vendedor === 'Resumo Geral') {
      // Regra 11: Aba "Resumo Geral"
      headers = [['Vendedor', 'Qtd Vendas Emitidas', 'Total Vendido', 'Perc. Comissão', 'Total Comissão']];
      
      const summary: Record<string, { count: number, totalVendas: number, perc: string, totalComissao: number }> = {};
      data.forEach(item => {
        if (item.comissao > 0) {
          if (!summary[item.vendedor]) {
            summary[item.vendedor] = { count: 0, totalVendas: 0, perc: `${item.regra}%`, totalComissao: 0 };
          }
          summary[item.vendedor].count += 1;
          summary[item.vendedor].totalVendas += item.valorVenda;
          summary[item.vendedor].totalComissao += item.comissao;
        }
      });

      body = Object.entries(summary).map(([vend, info]) => [
        vend,
        info.count,
        `R$ ${info.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        info.perc,
        `R$ ${info.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);
    } else if (type === 'resumido') {
      headers = [['Vendedor', 'E-mail', 'Regra', 'Protocolos', 'Total Vendas', 'Total a Pagar']];
      
      const groupedByVendedor: Record<string, { email: string, regra: string, protocolos: number, totalVendas: number, totalComissao: number }> = {};
      
      validData.forEach(item => {
        if (!groupedByVendedor[item.vendedor]) {
          groupedByVendedor[item.vendedor] = {
            email: item.email || '-',
            regra: `${item.regra}%`,
            protocolos: 0,
            totalVendas: 0,
            totalComissao: 0
          };
        }
        groupedByVendedor[item.vendedor].protocolos += 1;
        groupedByVendedor[item.vendedor].totalVendas += item.valorVenda;
        groupedByVendedor[item.vendedor].totalComissao += item.comissao;
      });

      body = Object.entries(groupedByVendedor).map(([vend, info]) => [
        vend,
        info.email,
        info.regra,
        info.protocolos,
        `R$ ${info.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${info.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);
    } else {
      // Regras 6 & 14: Colunas obrigatórias
      headers = [['Nº Protocolo', 'Cliente', 'Produto', 'Data Venda', 'Valor Venda', 'Valor Comissão']];
      body = validData.map(item => [
        item.protocolo,
        item.cliente,
        item.produto,
        item.dataVenda || '-',
        `R$ ${item.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${item.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);
    }

    autoTable(pdf, {
      startY: 65,
      head: headers,
      body: body,
      foot: [[
        'TOTAL GERAL',
        '',
        '',
        vendedor === 'Resumo Geral' ? '' : validData.length,
        `R$ ${totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]],
      theme: 'striped',
      headStyles: { fillColor: [63, 81, 181] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    pdf.save(`${vendedor.toLowerCase().replace(/\s+/g, '-')}-relatorio.pdf`);
  };

  const exportGeneralReport = (type: 'resumido' | 'completo' | 'avancado' = 'resumido') => {
    const allData = Object.values(filteredResults).flat();
    
    if (allData.length === 0) {
      toast.error('Nenhum dado para exportar com os filtros atuais.');
      return;
    }
    
    if (type === 'resumido') {
      exportPDF('Resumo Geral', allData, 'resumido');
    } else {
      const filterLabel = filterConfig.statusFilter === 'all' ? 'Todos Status' : filterConfig.statusFilter;
      exportPDF(`Geral (${filterLabel})`, allData, type);
    }
  };

  const exportAllPDFs = () => {
    Object.entries(filteredResults).forEach(([vendedor, data]) => {
      const hasCommission = data.some(item => item.comissao > 0);
      if (hasCommission) {
        exportPDF(vendedor, data, 'completo');
      }
    });
    toast.success('Todos os PDFs individuais foram gerados (apenas comissões > 0).');
  };

  const filteredResults = React.useMemo(() => {
    const newResults: Record<string, CommissionData[]> = {};
    
    Object.entries(results).forEach(([vendedor, data]) => {
      const normalizedVendedor = vendedor.toLowerCase().trim();

      // Filtro 1: Apenas vendedores da lista (Planilha Vendedores)
      if (filterConfig.onlyVendedoresList) {
        const isRegistered = Object.keys(vendedoresDB).some(name => {
          const normalizedName = name.toLowerCase().trim();
          return normalizedVendedor === normalizedName || 
                 normalizedVendedor.startsWith(normalizedName + " ") ||
                 normalizedVendedor.startsWith(normalizedName + "-") ||
                 normalizedName.startsWith(normalizedVendedor + " ");
        });
        
        if (!isRegistered) {
          return;
        }
      }

      // Filtro 2: Status e Regra de Comissão > 0
      const filteredData = data.filter(item => {
        // Regra do prompt: Só puxar os que geram comissão (não puxar comissão zero)
        if (item.comissao <= 0) return false;

        if (filterConfig.statusFilter === 'all') return true;
        
        const itemStatus = (item.statusVenda || '').toLowerCase().trim();
        const targetStatus = filterConfig.statusFilter.toLowerCase().trim();
        
        return itemStatus === targetStatus;
      });

      if (filteredData.length > 0) {
        newResults[vendedor] = filteredData;
      }
    });

    return newResults;
  }, [results, filterConfig, vendedoresDB]);

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileBarChart className="text-primary" size={24} />
          <h1 className="text-2xl font-bold text-foreground">Relatório de Comissões</h1>
        </div>
        
        {Object.keys(results).length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-lg">
              <select 
                value={filterConfig.statusFilter}
                onChange={(e) => setFilterConfig({...filterConfig, statusFilter: e.target.value})}
                className="bg-transparent text-xs border-none outline-none px-2 py-1"
              >
                <option value="all">Todos Status</option>
                <option value="emitida">Somente Emitidos</option>
                <option value="protocolo gerado">Protocolo Gerado</option>
                <option value="revogado">Revogado</option>
                <option value="cancelada">Cancelada</option>
              </select>
              <div className="w-[1px] h-4 bg-border" />
              <label className="flex items-center gap-2 px-2 py-1 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={filterConfig.onlyVendedoresList}
                  onChange={(e) => setFilterConfig({...filterConfig, onlyVendedoresList: e.target.checked})}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Apenas Vendedores Cadastrados</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportGeneralReport('resumido')}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition text-sm font-medium"
              >
                <FileDown size={18} />
                Exportar Resumido
              </button>
              
              <div className="relative group">
                <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-2 rounded-lg hover:opacity-90 transition text-sm">
                  <MoreHorizontal size={18} />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-xl hidden group-hover:block z-50 p-1">
                  <button
                    onClick={() => exportGeneralReport('avancado')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-lg transition"
                  >
                    <FileText size={14} />
                    Exportar Geral Avançado
                  </button>
                  <button
                    onClick={exportAllPDFs}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded-lg transition text-success"
                  >
                    <FileDown size={14} />
                    Exportar Todos Individuais
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {Object.keys(filteredResults).length > 0 && (
        <DashboardRelatorios data={Object.values(filteredResults).flat()} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload size={20} className="text-primary" />
            Nova Importação
          </h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Nome do Relatório (Ex: Julho 2024)</label>
              <input 
                type="text" 
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Identificador da importação..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Planilha Vendedores (XLSX)</label>
              <input 
                type="file" 
                ref={fileInputVendedores}
                accept=".xlsx, .xls"
                className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Relatório Vendas (CSV)</label>
              <input 
                type="file" 
                ref={fileInputVendas}
                accept=".csv"
                className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>

            <button
              onClick={processFiles}
              disabled={loading}
              className="w-full mt-4 bg-primary text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Processar e Salvar'}
            </button>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border shadow-sm col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Histórico de Importações</h2>
            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {savedImports.length} relatórios salvos
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {savedImports.length > 0 ? (
              savedImports.map((imp) => (
                <div 
                  key={imp.id} 
                  className={`group flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                    selectedImportId === imp.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-muted/30 hover:bg-muted/50'
                  }`}
                  onClick={() => loadImport(imp)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{imp.nome_importacao}</span>
                      {selectedImportId === imp.id && <CheckCircle2 size={14} className="text-primary" />}
                    </div>
                    <div className="flex gap-4 mt-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        {new Date(imp.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        {imp.quantidade_vendas} vendas
                      </span>
                      <span className="text-[10px] font-bold text-primary">
                        R$ {Number(imp.total_vendas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteImport(imp.id);
                      }}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition"
                      title="Excluir Importação"
                    >
                      <AlertCircle size={18} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                <Upload size={40} className="mb-2 opacity-10" />
                <p className="text-sm">Nenhuma importação salva no banco.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {Object.keys(filteredResults).length > 0 && (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Vendedores Processados</h2>
            <div className="text-xs text-muted-foreground italic">
              Clique para baixar os relatórios do período selecionado
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(filteredResults).map(([vendedor, data]) => (
              <div key={vendedor} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border hover:border-primary/50 transition group">
                <div className="overflow-hidden">
                  <div className="font-bold text-xs truncate">{vendedor}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {data.length} vendas • <span className="text-success font-medium">R$ {data.reduce((acc, curr) => acc + curr.comissao, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => exportPDF(vendedor, data, 'resumido')}
                    className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition"
                    title="PDF Resumido"
                  >
                    <FileDown size={14} />
                  </button>
                  <button
                    onClick={() => exportPDF(vendedor, data, 'avancado')}
                    className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg transition"
                    title="PDF Avançado"
                  >
                    <FileBarChart size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default RelatoriosComissoes;