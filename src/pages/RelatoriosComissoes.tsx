import React, { useState, useRef, useEffect } from 'react';
import { FileBarChart, Upload, FileDown, Loader2, CheckCircle2, AlertCircle, BarChart3, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from "@/integrations/supabase/client";
import DashboardRelatorios from '@/components/DashboardRelatorios';


interface CommissionData {
  vendedor: string;
  protocolo: string;
  valorVenda: number;
  comissao: number;
  produto: string;
  cliente: string;
  telefone?: string;
  numeroPedido?: string;
  tipoEmissao?: string;
  statusVenda?: string;
}


const RelatoriosComissoes = () => {
  const [loading, setLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [results, setResults] = useState<Record<string, CommissionData[]>>({});
  const [vendedoresConfig, setVendedoresConfig] = useState<Record<string, number>>({});
  const [vendedoresDB, setVendedoresDB] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchVendedores = async () => {
      const { data, error } = await supabase
        .from('vendedores_comissoes')
        .select('nome, percentual_comissao');
      
      if (!error && data) {
        const config: Record<string, number> = {};
        data.forEach(v => {
          config[v.nome.trim()] = Number(v.percentual_comissao);
        });
        setVendedoresDB(config);
      }
    };
    fetchVendedores();
  }, []);
  
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
        const valor = parseFloat(String(row['Comissão'] || row['Base'] || Object.values(row)[0]).replace(',', '.'));
        const nome = String(row['Vendedor'] || Object.values(row)[1]);
        if (nome && !isNaN(valor)) {
          config[nome.trim()] = valor;
        }
      });
      setVendedoresConfig(config);

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
            const statusVenda = row['Status Venda'] || row['status da venda'];
            const vendedorRaw = row['Vendedor'] || row['vendedor'];
            const valorVenda = parseFloat(String(row['Valor Venda'] || row['valor da venda']).replace(',', '.'));
            const protocolo = row['Nº Protocolo'] || row['numero do protocolo'];
            const produto = row['Produto'] || row['produto'];
            const cliente = row['Cliente'] || row['nome do cliente'];
            const telefone = row['Telefone'] || row['telefone'];
            const numeroPedido = row['Nº Pedido'] || row['numero do pedido'];
            const tipoEmissao = row['Tipo Emissão'] || row['tipo de emissao'];

            // "protocolo gerado" não gera comissão, "Emitida" gera.
            if (vendedorRaw && statusVenda === 'Emitida') {
              let vendedorNome = vendedorRaw.trim();
              
              const configToUse = Object.keys(vendedoresConfig).length > 0 ? vendedoresConfig : vendedoresDB;
              const basePercentual = configToUse[vendedorNome] || Object.entries(configToUse).find(([k]) => vendedorNome.includes(k))?.[1];

              if (basePercentual && basePercentual > 0) {
                if (!commissions[vendedorNome]) commissions[vendedorNome] = [];
                
                const valorComissao = (valorVenda * basePercentual) / 100;
                
                commissions[vendedorNome].push({
                  vendedor: vendedorNome,
                  protocolo,
                  valorVenda,
                  comissao: valorComissao,
                  produto,
                  cliente,
                  telefone,
                  numeroPedido,
                  tipoEmissao,
                  statusVenda
                });
              }
            }
          });


          setResults(commissions);
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

  const exportPDF = (vendedor: string, data: CommissionData[], type: 'resumido' | 'completo' = 'resumido') => {
    const pdf = new jsPDF();
    const totalComissao = data.reduce((acc, curr) => acc + curr.comissao, 0);
    const totalVendas = data.reduce((acc, curr) => acc + curr.valorVenda, 0);

    // Header
    pdf.setFillColor(63, 81, 181); // Primary color (roxa/azulada)
    pdf.rect(0, 0, 210, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.text('Relatório de Comissões', 15, 20);
    pdf.setFontSize(12);
    pdf.text('Future Soluções', 15, 30);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.text(`Vendedor: ${vendedor}`, 15, 55);
    pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 150, 55);

    autoTable(pdf, {
      startY: 65,
      head: [['Protocolo', 'Cliente', 'Produto', 'Valor Venda', 'Comissão']],
      body: data.map(item => [
        item.protocolo,
        item.cliente,
        item.produto,
        `R$ ${item.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${item.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]),
      foot: [[
        'TOTAL',
        '',
        '',
        `R$ ${totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]],
      theme: 'striped',
      headStyles: { fillColor: [63, 81, 181] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    pdf.save(`comissao-${vendedor.toLowerCase().replace(/\s+/g, '-')}-${type}.pdf`);
  };

  const exportAllPDFs = () => {
    Object.entries(results).forEach(([vendedor, data]) => {
      exportPDF(vendedor, data);
    });
    toast.success('Todos os PDFs foram gerados.');
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileBarChart className="text-primary" size={24} />
          <h1 className="text-2xl font-bold text-foreground">Relatório de Comissões</h1>
        </div>
        <div className="flex gap-2">
          {Object.keys(results).length > 0 && (
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              <BarChart3 size={18} />
              {showDashboard ? 'Voltar ao Relatório' : 'Ver Dashboard'}
            </button>
          )}
          {Object.keys(results).length > 0 && (
            <button
              onClick={exportAllPDFs}
              className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              <FileDown size={18} />
              Exportar Todos PDFs
            </button>
          )}
        </div>
      </div>

      {showDashboard ? (
        <DashboardRelatorios data={Object.values(results).flat()} />
      ) : (

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload size={20} className="text-primary" />
            Importar Dados
          </h2>
          
          <div className="space-y-3">
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
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Processar Comissões'}
            </button>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Resumo do Processamento</h2>
          {Object.keys(results).length > 0 ? (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {Object.entries(results).map(([vendedor, data]) => (
                <div key={vendedor} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <div className="font-medium text-sm">{vendedor}</div>
                    <div className="text-xs text-muted-foreground">
                      {data.length} vendas • Total: R$ {data.reduce((acc, curr) => acc + curr.comissao, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportPDF(vendedor, data, 'resumido')}
                      className="p-2 text-primary hover:bg-primary/10 rounded-full transition"
                      title="Baixar PDF Resumido"
                    >
                      <FileDown size={18} />
                    </button>
                    <button
                      onClick={() => exportPDF(vendedor, data, 'completo')}
                      className="p-2 text-primary hover:bg-primary/10 rounded-full transition"
                      title="Baixar PDF Completo"
                    >
                      <FileText size={18} className="text-secondary" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle size={40} className="mb-2 opacity-20" />
              <p className="text-sm">Nenhum dado processado ainda.</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default RelatoriosComissoes;
