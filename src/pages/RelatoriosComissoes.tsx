import React from 'react';
import { FileBarChart } from 'lucide-react';

const RelatoriosComissoes = () => {
  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex items-center gap-3">
        <FileBarChart className="text-primary" size={24} />
        <h1 className="text-2xl font-bold text-foreground">Relatório de Comissões</h1>
      </div>
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <p className="text-muted-foreground text-sm">
          Módulo de relatórios de comissões para gestores. Importe os dados de vendas para gerar os cálculos e relatórios individuais em PDF.
        </p>
        <div className="mt-6">
          <button className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90">
            Importar Planilhas e Processar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RelatoriosComissoes;
