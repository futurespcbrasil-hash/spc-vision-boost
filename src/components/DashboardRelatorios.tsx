import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, BarChart3, PieChart as PieIcon } from 'lucide-react';

interface CommissionData {
  vendedor: string;
  protocolo: string;
  valorVenda: number;
  comissao: number;
  produto: string;
  cliente: string;
}

const DashboardRelatorios = ({ data }: { data: CommissionData[] }) => {
  const vendedorStats = data.reduce((acc, curr) => {
    if (!acc[curr.vendedor]) acc[curr.vendedor] = { valor: 0, comissao: 0 };
    acc[curr.vendedor].valor += curr.valorVenda;
    acc[curr.vendedor].comissao += curr.comissao;
    return acc;
  }, {} as Record<string, { valor: number, comissao: number }>);

  const chartData = Object.entries(vendedorStats).map(([name, stats]) => ({
    name,
    valor: stats.valor,
    comissao: stats.comissao
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Vendas por Vendedor</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="valor" fill="#8884d8" name="Vendas (R$)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Comissões por Vendedor</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="comissao" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#82ca9d" label>
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#8884d8" : "#82ca9d"} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardRelatorios;
