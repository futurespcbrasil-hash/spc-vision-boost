import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy } from 'lucide-react';

interface CommissionData {
  vendedor: string;
  protocolo: string;
  valorVenda: number;
  comissao: number;
  produto: string;
  cliente: string;
  statusVenda?: string;
}

const DashboardRelatorios = ({ data }: { data: CommissionData[] }) => {
  const statusStats = data.reduce((acc, curr) => {
    const status = curr.statusVenda || 'Não informado';
    if (!acc[status]) acc[status] = 0;
    acc[status] += 1;
    return acc;
  }, {} as Record<string, number>);

  const statusChartData = Object.entries(statusStats)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const vendedorStats = data.reduce((acc, curr) => {
    if (!acc[curr.vendedor]) acc[curr.vendedor] = { valor: 0, comissao: 0, count: 0 };
    acc[curr.vendedor].valor += curr.valorVenda;
    acc[curr.vendedor].comissao += curr.comissao;
    acc[curr.vendedor].count += 1;
    return acc;
  }, {} as Record<string, { valor: number, comissao: number, count: number }>);

  const chartData = Object.entries(vendedorStats)
    .map(([name, stats]) => ({
      name,
      valor: stats.valor,
      comissao: stats.comissao,
      count: stats.count
    }))
    .sort((a, b) => b.valor - a.valor);

  const maxVendas = Math.max(...chartData.map(d => d.valor), 1);
  const totalGeralVendas = chartData.reduce((acc, d) => acc + d.valor, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking de Vendas (Estilo Futebol) */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className="text-yellow-500" size={20} />
              Ranking de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {chartData.map((item, index) => (
                <div key={item.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' : 
                        index === 1 ? 'bg-slate-300 text-slate-700' : 
                        index === 2 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}º
                      </span>
                      <span className="font-semibold">{item.name}</span>
                    </div>
                    <span className="font-bold">
                      R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={(item.valor / maxVendas) * 100} className="h-2" />
                    <span className="text-[10px] text-muted-foreground w-8 text-right">
                      {Math.round((item.valor / totalGeralVendas) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Barras */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Volume de Vendas por Vendedor</CardTitle></CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  interval={0}
                  height={60}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Vendas']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.6)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Distribuição de Comissões</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={chartData} 
                  dataKey="comissao" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={100} 
                  innerRadius={60}
                  paddingAngle={5}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - (index * 0.1)})`} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resumo Estatístico</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="text-sm text-muted-foreground">Total Vendas</div>
                <div className="text-xl font-bold text-primary">
                  R$ {totalGeralVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 bg-secondary/5 rounded-xl border border-secondary/10">
                <div className="text-sm text-muted-foreground">Total Comissões</div>
                <div className="text-xl font-bold text-secondary">
                  R$ {chartData.reduce((acc, d) => acc + d.comissao, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <div className="text-sm text-muted-foreground">Média por Venda</div>
                <div className="text-xl font-bold">
                  R$ {(totalGeralVendas / data.length || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl border border-border">
                <div className="text-sm text-muted-foreground">Total de Pedidos</div>
                <div className="text-xl font-bold">{data.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardRelatorios;
