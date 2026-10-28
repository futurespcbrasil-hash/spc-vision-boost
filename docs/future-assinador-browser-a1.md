# Future Assinador — A1 no navegador, sem instalador

**Estado: estudo técnico e critérios de prova; assinatura ainda não implementada nem habilitada.**
URL alvo: `https://crm.futuresolucoes.com.br/assinar`. A solução inicial deve permanecer no mesmo endereço e focar exclusivamente em certificados A1.

## Decisão de fluxo

Para manter o fluxo sem extensão, aplicativo ou instalador, a primeira prova de conceito deve permitir que o cliente selecione localmente:
1. o PDF a assinar;
2. o arquivo de certificado A1 `.pfx` ou `.p12`;
3. a senha desse arquivo.

Isso **não** acessa automaticamente o repositório de certificados do Windows. Um certificado que aparece em `certmgr.msc` não significa que o navegador possa ler sua chave privada nem que o cliente tenha o arquivo PFX/P12 disponível. Não solicitar que o cliente exporte sua chave privada sem aviso claro dos riscos e sem orientar a proteger/eliminar cópias de forma segura.

O PDF, o arquivo PFX/P12 e a senha devem ser processados apenas na memória do navegador. Não enviar esses bytes para Supabase, CRM, logs, analytics ou servidor. Não salvar senha em estado persistente, armazenamento local, URL ou telemetria. Limpar referências e campos sensíveis ao terminar/cancelar. Ainda é necessário confirmar que a biblioteca escolhida realmente mantém o fluxo local em runtime e não faz chamadas de rede.

## Biblioteca candidata para prova de conceito

Avaliar `@signature-kit/pdf` + `@signature-kit/a1` + dependências diretas `@signature-kit/signatures`, `@signature-kit/cms` e `effect`. O projeto publica documentação e declara licença MIT, mas é uma dependência candidata, não aprovada para produção até revisão de versão, cadeia de dependências, APIs browser, manutenção e testes.

A documentação do projeto demonstra esta API de alto nível:

```ts
import { signPdf } from "@signature-kit/pdf/sign";
import { a1SignaturesLayer } from "@signature-kit/a1/signer";
import { Effect, Redacted } from "effect";

const program = signPdf({
  pdf: pdfBytes,
  reason: "Assinatura digital",
  signatureLength: 32768,
  policy: "pades-icp-brasil",
  appearance: {
    placement: {
      kind: "auto",
      page: "last",
      anchor: "bottom-right",
      width: 180,
      height: 54,
      margin: 36,
    },
  },
}).pipe(
  Effect.provide(
    a1SignaturesLayer({
      pfx: pfxBytes,
      password: Redacted.make(password),
    }),
  ),
);

const signedBytes = await Effect.runPromise(program);
```

Este trecho é uma referência da documentação, **não código validado no CRM**. Antes de adotar, confirmar que a versão publicada exporta exatamente essas APIs, que funciona nos navegadores alvo, que o algoritmo/estrutura do certificado é compatível com ICP-Brasil e que a política `pades-icp-brasil` gera assinatura reconhecida pelos validadores independentes. O `signatureLength` precisa ser testado com cadeias de certificados reais e falhar com erro compreensível se o espaço for insuficiente.

## UX prevista

- Manter a seleção/visualização de PDF que já existe na landing.
- Acrescentar área separada para selecionar PFX/P12 e senha, com aviso de segurança explícito.
- Nunca chamar uma imagem ou carimbo visual de assinatura digital.
- Mostrar estados: lendo arquivos localmente, validando certificado, assinando, verificando resultado, pronto para baixar, erro/cancelado.
- Só habilitar download depois de a assinatura criptográfica ser criada e a verificação estrutural passar.
- Download do PDF assinado pelo navegador; não armazenar o documento no CRM.
- Não exibir como suportado certificado A3/token, certificado em nuvem ou certificado apenas instalado no Windows nesta etapa.
- Manter o aviso “demonstração” até completar os testes abaixo.

## Critérios de aceite antes de ativar a assinatura

- [ ] Dependências e versões revisadas; licença compatível com o produto.
- [ ] Build e lint do projeto passam com lockfile atualizado.
- [ ] Teste de rede comprova que PDF, PFX/P12 e senha não são enviados ao servidor.
- [ ] Senha não aparece em logs, URL, storage ou telemetria; campos e referências são limpos após uso/cancelamento.
- [ ] Testar senha incorreta, arquivo PFX inválido, certificado expirado, algoritmo não suportado, PDF inválido/grande e cancelamento.
- [ ] PDF assinado abre em leitor comum e assinatura é validada por pelo menos dois validadores independentes, incluindo o VALIDAR do ITI quando aplicável.
- [ ] Alteração de conteúdo após assinatura é detectada como violação de integridade.
- [ ] Confirmar cadeia de certificados, política PAdES/ICP-Brasil, carimbo de tempo e revogação; não declarar revogação validada se não foi consultada.
- [ ] Testar Windows 11 + Chrome e Edge com certificados de teste autorizados, sem compartilhar chaves privadas.
- [ ] A UI não promete usar automaticamente o certificado que está apenas instalado no Windows.

## Situação da produção

A landing atual permite selecionar e pré-visualizar o PDF e captar leads, mas ainda não assina criptograficamente. Este documento não ativa a assinatura, não altera a rota de produção e não deve ser considerado homologação. Manter separado da `main` até a prova de conceito e os critérios de aceite passarem.
