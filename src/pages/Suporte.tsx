import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { validateCode, formatCode } from '@/services/meshCentralService';

const MOTIVOS: Record<string, string> = {
  formato_invalido: 'O código deve ter 12 dígitos.',
  nao_encontrado: 'Código não encontrado. Confira com o nosso suporte.',
  expirado: 'Este código expirou. Peça um novo ao nosso suporte.',
  encerrado: 'Este atendimento já foi encerrado.',
};

const Suporte = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<{ client_name?: string; agent_download_url?: string | null } | null>(null);

  const onChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 12);
    setCode(formatCode(digits));
  };

  const iniciar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await validateCode(code);
      if (res?.valid) setOk({ client_name: res.client_name, agent_download_url: res.agent_download_url });
      else setErro(MOTIVOS[res?.reason ?? ''] ?? 'Não foi possível validar o código.');
    } catch {
      setErro('Não foi possível validar o código agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen gradient-spc flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-5 p-8 text-center">
          <img src="/logo-future.png" alt="Future Soluções" className="mx-auto h-10 w-auto object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Future Remote</h1>
            <p className="text-sm text-muted-foreground">Suporte remoto Future Soluções</p>
          </div>

          {!ok ? (
            <>
              <p className="text-sm text-foreground">
                Digite o código fornecido pelo nosso suporte para iniciar o atendimento.
              </p>
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium text-foreground" htmlFor="codigo">Código de atendimento</label>
                <Input
                  id="codigo"
                  inputMode="numeric"
                  placeholder="847 291 563 724"
                  value={code}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-14 text-center font-mono text-2xl tracking-widest"
                />
              </div>
              {erro && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  <AlertTriangle size={16} />{erro}
                </div>
              )}
              <Button className="w-full h-12 text-base" onClick={iniciar} disabled={loading || code.replace(/\D/g, '').length !== 12}>
                {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : null}
                Iniciar suporte
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <CheckCircle2 size={20} /><span className="font-medium">Código validado</span>
              </div>
              <p className="text-sm text-foreground">
                Olá{ok.client_name ? `, ${ok.client_name}` : ''}! Agora baixe e execute o programa de atendimento.
                Deixe esta janela aberta e aguarde o nosso técnico.
              </p>
              {ok.agent_download_url ? (
                <Button asChild className="w-full h-12">
                  <a href={ok.agent_download_url} target="_blank" rel="noopener noreferrer">
                    <Download size={18} className="mr-2" />Baixar programa de atendimento
                  </a>
                </Button>
              ) : (
                <p className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                  Configuração pendente: o servidor de atendimento ainda não foi configurado.
                  Fale com o nosso suporte.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Suporte;
