# Prova técnica — seletor de certificado nativo do navegador

## Objetivo

Validar a experiência solicitada para o Assinador Digital Future: ao clicar em **Selecionar certificado instalado**, o navegador apresenta seu diálogo nativo para escolher um certificado disponível no sistema/dispositivo, sem upload de PFX e sem instalar um aplicativo Future.

## Descoberta principal

O seletor nativo é acionado pelo protocolo TLS quando o servidor solicita autenticação de certificado de cliente (mTLS) durante o handshake HTTPS. Não existe uma API JavaScript genérica que permita a uma página já aberta chamar diretamente esse diálogo ou listar livremente todos os certificados instalados.

O fluxo é, portanto, diferente de chamar uma função JavaScript:
1. O navegador abre uma conexão HTTPS com um endpoint cujo servidor está configurado para solicitar certificado de cliente.
2. Durante o handshake TLS, o navegador pode mostrar o diálogo nativo, conforme navegador, sistema operacional, certificados elegíveis e política local.
3. O certificado escolhido autentica a conexão com aquele endpoint. O JavaScript da página não recebe a chave privada nem ganha uma API genérica para assinar dados arbitrários.

Referências:
- Chrome/Chromium, certificados de cliente e políticas de seleção: https://support.google.com/chrome/a/answer/2657289
- Google Cloud, configuração de seleção de certificado cliente em Chrome, Safari e Edge: https://docs.cloud.google.com/access-context-manager/docs/enable-cba-web-apps
- Cloudflare, conceito e fluxo mTLS: https://developers.cloudflare.com/ssl/client-certificates/

## Arquitetura de teste recomendada

- Manter o CRM e a landing atual intactos.
- Criar um endpoint/subdomínio de laboratório separado (por exemplo, `cert-check.futuresolucoes.com.br`) com HTTPS e configuração de solicitação de certificado de cliente, sem exigir certificado válido para abrir a página informativa.
- O endpoint deve registrar somente o resultado mínimo do teste; nunca armazenar o PDF, PIN, senha, chave privada ou conteúdo secreto do certificado em logs.
- A página deve informar que a escolha serve apenas para testar autenticação do certificado. Não deve alegar que o PDF foi assinado.
- Testar primeiro com certificados de laboratório em Windows + Chrome/Edge e macOS + Safari/Chrome. Testar token/cartão A3 separadamente, pois driver/middleware e seleção de certificado podem variar.
- Se o navegador já tiver memorizado uma escolha para o site, o diálogo pode não aparecer novamente; o teste deve considerar cache de seleção e política do navegador.

## Limite essencial: selecionar não é assinar PDF

A seleção via mTLS comprova o uso do certificado para autenticar a conexão. A assinatura PDF (por exemplo, PAdES) exige uma operação criptográfica sobre o conteúdo apropriado do documento com a chave privada. A assinatura do handshake TLS não pode ser reutilizada como assinatura do PDF.

Depois de validar o seletor, será necessário escolher um mecanismo de assinatura separado:
- integração oficial do provedor de certificado em nuvem; ou
- mecanismo local compatível com A1/A3 (bridge/PKCS#11 ou solução equivalente); ou
- prova de conceito A1 no navegador, se a biblioteca e a chave importada permitirem o fluxo com segurança e conformidade.

Não se deve prometer assinatura PDF somente com o seletor TLS.

## Critérios de aceite

- [ ] O navegador exibe o seletor nativo quando a configuração TLS e o certificado permitem.
- [ ] O teste identifica apenas o certificado apresentado pelo cliente, sem expor chave privada.
- [ ] Ausência de certificado, cancelamento e erro de middleware têm mensagens claras.
- [ ] Nenhuma alteração é feita na `main` ou na produção.
- [ ] O relatório separa claramente autenticação TLS de assinatura criptográfica PDF.
- [ ] A assinatura PDF só será considerada pronta após validação independente do arquivo PAdES produzido.

## Estado

Documento de desenho técnico. O endpoint mTLS ainda não foi implantado e a experiência não foi testada em computadores reais.