import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, MessageSquare, Send, ArrowDownLeft, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const stats = [
  { label: 'Contas Conectadas', value: '2', icon: Smartphone, color: 'text-green-500' },
  { label: 'Conversas Ativas', value: '12', icon: MessageSquare, color: 'text-primary' },
  { label: 'Enviadas Hoje', value: '48', icon: Send, color: 'text-blue-500' },
  { label: 'Recebidas Hoje', value: '35', icon: ArrowDownLeft, color: 'text-orange-500' },
  { label: 'Tempo Médio Resposta', value: '4min', icon: Clock, color: 'text-purple-500' },
];

const activityData = [
  { dia: 'Seg', enviadas: 42, recebidas: 30 },
  { dia: 'Ter', enviadas: 55, recebidas: 40 },
  { dia: 'Qua', enviadas: 38, recebidas: 35 },
  { dia: 'Qui', enviadas: 60, recebidas: 45 },
  { dia: 'Sex', enviadas: 48, recebidas: 35 },
  { dia: 'Sáb', enviadas: 20, recebidas: 15 },
  { dia: 'Dom', enviadas: 10, recebidas: 8 },
];

const responseData = [
  { hora: '08h', tempo: 3 }, { hora: '09h', tempo: 2 }, { hora: '10h', tempo: 5 },
  { hora: '11h', tempo: 4 }, { hora: '12h', tempo: 8 }, { hora: '13h', tempo: 6 },
  { hora: '14h', tempo: 3 }, { hora: '15h', tempo: 4 }, { hora: '16h', tempo: 5 },
  { hora: '17h', tempo: 7 }, { hora: '18h', tempo: 10 },
];

const WhatsAppDashboard = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-foreground">Dashboard WhatsApp</h1>

    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map(s => (
        <Card key={s.label}>
          <CardContent className="pt-4 pb-4 text-center">
            <s.icon size={24} className={`mx-auto mb-2 ${s.color}`} />
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Atividade Semanal</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="enviadas" fill="hsl(262, 70%, 50%)" name="Enviadas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recebidas" fill="hsl(152, 60%, 40%)" name="Recebidas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tempo de Resposta (min)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={responseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hora" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="tempo" stroke="hsl(270, 50%, 45%)" strokeWidth={2} name="Minutos" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default WhatsAppDashboard;
