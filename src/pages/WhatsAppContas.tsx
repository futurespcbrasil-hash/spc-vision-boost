import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Unplug, QrCode, Smartphone } from 'lucide-react';
import { mockAccounts, WhatsAppAccount } from '@/data/whatsappMockData';

const WhatsAppContas = () => {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>(mockAccounts);
  const [showQR, setShowQR] = useState(false);

  const handleDisconnect = (id: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, status: 'disconnected' as const } : a));
  };

  const handleConnect = () => {
    setShowQR(true);
    setTimeout(() => {
      const newId = String(Date.now());
      setAccounts(prev => [...prev, {
        id: newId, name: `Conta ${prev.length + 1}`, number: '+55 XX XXXXX-XXXX',
        status: 'connected', connectedAt: new Date().toISOString(),
      }]);
      setShowQR(false);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas Conectadas</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas contas WhatsApp</p>
        </div>
        <Button onClick={handleConnect} className="gap-2">
          <Plus size={16} /> Conectar WhatsApp
        </Button>
      </div>

      <div className="grid gap-4">
        {accounts.map(account => (
          <Card key={account.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Smartphone size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{account.name}</p>
                  <p className="text-sm text-muted-foreground">{account.number}</p>
                  {account.connectedAt && (
                    <p className="text-xs text-muted-foreground">
                      Conectado em {new Date(account.connectedAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={account.status === 'connected' ? 'default' : 'secondary'}
                  className={account.status === 'connected' ? 'bg-green-500 hover:bg-green-600' : ''}>
                  {account.status === 'connected' ? 'Conectado' : account.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                </Badge>
                {account.status === 'connected' ? (
                  <Button variant="outline" size="sm" onClick={() => handleDisconnect(account.id)} className="gap-1">
                    <Unplug size={14} /> Desconectar
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleConnect} className="gap-1">
                    <Plus size={14} /> Conectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-48 h-48 border-2 border-dashed border-muted-foreground/30 rounded-xl flex items-center justify-center bg-muted/30">
              <QrCode size={120} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">
              Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
            </p>
            <p className="text-xs text-muted-foreground animate-pulse">Aguardando leitura do QR Code...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppContas;
