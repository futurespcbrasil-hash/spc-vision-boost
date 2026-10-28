# Future Assinador — plano de implementação verificável

**Estado em 2026-10-28: planejamento técnico; assinatura PAdES ainda não implementada.**
A rota pública permanece \`https://crm.futuresolucoes.com.br/assinar\`. Nenhum PDF, certificado ou chave privada deve ser enviado ao Supabase ou ao servidor web.

## Decisão técnica

A primeira entrega deve atender Windows 11 + Chrome/Edge + certificado A1 instalado no repositório de certificados do usuário atual do Windows. O certificado e a chave privada precisam continuar no computador.

Uma página web comum não pode enumerar livremente o repositório de certificados do Windows nem pedir ao sistema que assine um PDF arbitrário. O seletor de certificado TLS (mTLS) autentica uma conexão HTTPS e **não** produz uma assinatura PAdES. Não usar o laboratório TLS como solução de assinatura.

Para usar diretamente certificados instalados, a opção viável é um componente local confiável (agente nativo) com uma ponte autorizada para o site, por exemplo extensão Chrome/Edge + Native Messaging. Isso exige instalação local uma única vez. Se “zero instalação” for requisito absoluto, será necessário mudar o requisito: aceitar um certificado/assinatura em nuvem compatível ou avaliar a seleção manual de um arquivo PFX/P12 (o que não atende ao desejo de usar a chave já instalada). Não prometer compatibilidade universal antes de testes.

## Escopo inicial

1. Windows 11, Chrome e Edge atuais.
2. Certificados A1 presentes em \`CurrentUser\\My\` e com chave privada acessível ao usuário logado.
3. PDF de até 20 MB, inicialmente sem senha e com estrutura suportada pela biblioteca PAdES escolhida.
4. Assinatura PAdES incorporada no PDF, validável por um verificador independente.
5. A página principal continua no mesmo endereço; nenhum subdomínio adicional é necessário para a landing page.

A3/token, macOS, SafeID/nuvem, certificados com algoritmos/provedores não suportados e PDFs protegidos são etapas posteriores, cada uma com testes próprios.

## Componentes necessários

- **UI web**: seleciona PDF local, mostra metadados não sensíveis e solicita a operação; nunca pede PIN/senha do certificado em HTML.
- **Ponte Chrome/Edge**: permite mensagens somente das origens oficiais e valida protocolo, tamanho, nonce/request ID e timeout.
- **Agente local Windows**: enumera certificados elegíveis; valida novamente cada solicitação; identifica certificado por thumbprint; exibe confirmação nativa com origem, nome do certificado e documento/ação; usa a chave privada via APIs do Windows sem exportá-la.
- **Módulo PAdES**: prepara o PDF com placeholder e ByteRange, calcula o digest do conteúdo, cria CMS/CAdES com cadeia de certificados e carimbo de tempo quando configurado, finaliza o PDF e retorna os bytes assinados. A biblioteca e sua licença devem ser aprovadas antes de integrar ao produto proprietário.
- **Verificação independente**: valida integridade, cadeia, período de validade, revogação quando aplicável, perfil PAdES e que o PDF final abre em leitores comuns.

## Regras de segurança obrigatórias

- Nunca transmitir ou registrar PFX/P12, PIN, senha, chave privada, conteúdo completo do PDF, CPF/CNPJ ou detalhes completos do certificado.
- Não armazenar documentos no CRM/Supabase por padrão.
- Exigir confirmação nativa a cada assinatura; não assinar silenciosamente em resposta a uma mensagem da página.
- Restringir o host às origens oficiais, limitar tamanho/tempo e rejeitar campos inesperados.
- Tratar o conteúdo do PDF como não confiável; não executar scripts nem carregar links incorporados.
- Não considerar “assinado” até a verificação independente passar.
- Se o agente não estiver instalado, falhar com uma instrução clara; nunca simular uma assinatura.
- Assinatura eletrônica visual (imagem/carimbo) não substitui assinatura criptográfica PAdES.

## Critérios de aceite antes de ativar o botão de assinatura

- [ ] O agente só lista certificados com chave privada acessível e informa algoritmo/uso compatível sem expor dados desnecessários.
- [ ] Cancelar a seleção ou confirmação não gera PDF assinado.
- [ ] A chave privada permanece no Windows; tráfego de rede inspecionado não contém segredo ou bytes do PDF.
- [ ] Assinatura de teste é validada por pelo menos dois validadores independentes.
- [ ] Alterar um byte do PDF assinado faz a verificação de integridade falhar.
- [ ] PDFs grandes, inválidos, criptografados e assinados previamente são tratados com erro compreensível.
- [ ] Ausência/desconexão do agente, timeout e certificado sem chave privada não travam a landing.
- [ ] Testes automatizados do protocolo e testes manuais no Windows 11 Chrome/Edge passam.
- [ ] Licenças de bibliotecas e política de distribuição/assinatura do instalador são aprovadas.
- [ ] A landing só muda de “Demonstração” para “Assinar” depois de todos os critérios acima.

## Plano de execução

**Etapa 1 — contrato e agente em modo de teste:** implementar protocolo Native Messaging, teste PING, enumeração de certificados sem exportação de chave e confirmação nativa. Nenhuma operação criptográfica em produção.

**Etapa 2 — prova PAdES:** selecionar uma biblioteca com licença compatível, implementar assinatura com certificado de teste, verificar o PDF resultante de forma independente e automatizar testes negativos.

**Etapa 3 — integração da UI:** habilitar a escolha de certificado e assinatura somente quando o agente e o módulo PAdES responderem com versões compatíveis; mostrar estados de instalação, seleção, confirmação, assinatura, validação e download.

**Etapa 4 — pacote Windows:** criar instalador assinado, registro de Native Messaging e desinstalação limpa; publicar instruções e hash do pacote. Não distribuir binários não assinados.

**Etapa 5 — homologação:** testar autoridades diferentes, renovação/expiração, RSA/ECDSA suportados, cancelamento, PDFs de referência e validadores independentes. Só então avaliar A3, macOS e certificados em nuvem.

## Situação da produção

- A landing \`/assinar\` continua disponível para pré-visualização e captação de leads.
- A pré-visualização local não assina documentos.
- O formulário de leads é independente da assinatura.
- Esta branch contém documentação de decisão e critérios de aceite; não habilita assinatura nem altera a produção.
