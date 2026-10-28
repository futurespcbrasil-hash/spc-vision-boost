# Future Assinador Windows — integração com certificados instalados

Componente local de prova de conceito para assinar PDFs com certificados que já estão instalados em `CurrentUser\\My` no Windows. A chave privada não é exportada nem enviada ao CRM.

## Rodar em modo de desenvolvimento

Requer Windows e .NET 8 SDK:

```powershell
dotnet run --project .\tools\FutureAssinadorWindows\FutureAssinadorWindows.csproj
```

O serviço escuta somente em `127.0.0.1:21591`. A página pública permitida é `https://crm.futuresolucoes.com.br` e a prévia Vercel conhecida.

## API

- `GET /api/health`: status do agente local.
- `GET /api/certificates`: lista certificados válidos com chave privada acessível no repositório Pessoal do usuário atual.
- `POST /api/sign-pdf`: recebe PDF em base64, thumbprint e posição; devolve o PDF assinado em base64. O arquivo é processado apenas na máquina local.

O PDF é limitado a 20 MB. A API não aceita origens web arbitrárias; o serviço não deve ser exposto na rede.

## Segurança e limitações desta prova

- O processo local deve ser executado pelo usuário do Windows que possui os certificados.
- Certificados A3/token/cartão podem solicitar PIN ou depender do middleware do fabricante.
- O agente ainda não é um instalador Future assinado; a distribuição final precisa de build, testes e assinatura de código.
- A aparência da assinatura é colocada na página/posição selecionada, mas a biblioteca define automaticamente as dimensões do carimbo.
- A seleção do certificado na página apenas escolhe um certificado. O Windows ou middleware ainda pode exibir seu próprio prompt de PIN/confirmação.
