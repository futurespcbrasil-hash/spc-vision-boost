import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Download, Monitor, ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { validateCode, formatCode } from '@/services/meshCentralService';

// O portal usa o domínio oficial mesmo quando a equipe abre o CRM pelo domínio vercel.app.
const CRM_PUBLIC_URL = 'https://crm.futuresolucoes.com.br';
const AGENT_DOWNLOAD_URL = 'https://future-remote.duckdns.org/agentinvite?c=xQjX82Y$4LSrmWsJs8FzYPKaatOVMl2RhmfsbGpOVq3TwBBc45C@sGMW$vA8J$r8L5FITL6JK8AByIqsitWRKjx0xYn2h8JfMFAXUP6ssJgz$Y$MXvVk@8qB7QocwyjvMgMUMsnSBTJACWFlasYtTarQwQoIkHAzmZrvd1VbdDtENWcLjk$E77DYjPbUZjQ7oiPVg7o=';

const Suporte = () => {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [clientName, setClientName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleValidate = async () => {
    const normalizedCode = code.replace(/\D/g, '');
    if (normalizedCode.length !== 12) {
      setErrorMessage('Informe o código de atendimento de 12 dígitos enviado pela equipe Future Soluções.');
      return;
    }

    setValidating(true);
    setErrorMessage('');
    setValidated(false);
    try {
      const result = await validateCode(normalizedCode);
      if (!result?.valid) {
        const messages: Record<string, string> = {
          formato_invalido: 'O código deve conter 12 dígitos.',
          nao_encontrado: 'Código não encontrado. Confira os números com a equipe de suporte.',
          encerrado: 'Este atendimento já foi encerrado. Solicite um novo código à equipe.',
          expirado: 'Este código expirou. Solicite um novo código à equipe de suporte.',
        };
        setErrorMessage(messages[result?.reason ?? ''] ?? 'Não foi possível validar o código. Tente novamente.');
        return;
      }

      setClientName(result.client_name ?? '');
      setValidated(true);
    } catch {
      setErrorMessage('Não foi possível validar agora. Verifique sua conexão e tente novamente.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <main className="min-h-screen gradient-spc flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="text-center space-y-3">
            <img src="/logo-future.png" alt="Future Soluções" className="mx-auto h-10 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Future Remote</h1>
              <p className="text-sm text-muted-foreground">Suporte remoto Future Soluções</p>
            </div>
            <p className="text-sm text-foreground">
              Use o código fornecido pela equipe Future Soluções para liberar as instruções de instalação do aplicativo de suporte.
            </p>
          </div>

          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void handleValidate(); }}>
            <label htmlFor="support-code" className="text-sm font-medium text-foreground">Código de atendimento</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="support-code"
                value={formatCode(code)}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 12));
                  setValidated(false);
                  setErrorMessage('');
                }}
                placeholder="000 000 000 000"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-describedby={errorMessage ? 'support-code-error' : undefined}
              />
              <Button type="submit" disabled={validating || code.replace(/\D/g, '').length !== 12} className="sm:min-w-40">
                {validating ? <Loader2 size={16} className="mr-2 animate-spin" /> : <KeyRound size={16} className="mr-2" />}
                {validating ? 'Validando...' : 'Validar código'}
              </Button>
            </div>
            {errorMessage && <p id="support-code-error" role="alert" className="text-sm text-destructive">{errorMessage}</p>}
          </form>

          {validated && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-background p-2 text-primary"><CheckCircle2 size={20} /></div>
                <div className="flex-1 space-y-1">
                  <h2 className="font-semibold text-foreground">Código validado com sucesso</h2>
                  <p className="text-sm text-muted-foreground">
                    {clientName ? `Atendimento de ${clientName} confirmado. ` : ''}Baixe o aplicativo somente se você estiver aguardando este atendimento da Future Soluções.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-background p-2 text-primary"><Monitor size={20} /></div>
                <div className="flex-1 space-y-1">
                  <h2 className="font-semibold text-foreground">Instale o aplicativo</h2>
                  <p className="text-sm text-muted-foreground">
                    Abra o arquivo baixado e siga as instruções. Depois, avise a equipe que a instalação terminou e autorize a conexão apenas quando estiver esperando o atendimento.
                  </p>
                </div>
              </div>
              <Button asChild className="w-full h-12 text-base">
                <a href={AGENT_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
                  <Download size={18} className="mr-2" />
                  Baixar aplicativo de suporte
                </a>
              </Button>
            </div>
          )}

          {!validated && (
            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2 text-muted-foreground"><ShieldCheck size={20} /></div>
                <div className="space-y-1">
                  <h2 className="font-semibold text-foreground">Atendimento seguro</h2>
                  <p className="text-sm text-muted-foreground">
                    Os códigos têm validade limitada. Se o código expirou ou não funcionar, solicite outro à equipe de suporte.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Portal oficial: {CRM_PUBLIC_URL}/suporte
          </p>
        </CardContent>
      </Card>
    </main>
  );
};

export default Suporte;
