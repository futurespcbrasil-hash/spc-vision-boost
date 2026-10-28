# Assinador Digital Future — plano de implementação

## Objetivo do produto

Prioridade máxima: a pessoa recebe um link público, abre no navegador, envia um PDF e conclui o fluxo com o mínimo de passos possível. **A experiência principal deve ser web-first, sem exigir extensão ou aplicativo quando a modalidade de assinatura permitir.**

A assinatura com certificado ICP-Brasil deve preservar a chave privada e o PIN. Não prometer que todos os certificados A1/A3 funcionam em um site puro antes de validar a prova de conceito e a compatibilidade real.

## Estratégia de produto

1. **Fluxo web sem instalação:** oferecer assinatura eletrônica com evidências, quando adequada ao tipo de documento e às exigências do usuário. Explicar claramente que ela não é a mesma modalidade que uma assinatura qualificada ICP-Brasil.
2. **Certificado em nuvem:** priorizar integração web via API/SDK ou autorização oficial do provedor, se disponível. SafeID precisa de validação técnica e comercial com a Safeweb; não presumir que existe API pública.
3. **A1 em arquivo:** investigar uma prova de conceito em que o próprio usuário seleciona o PFX/P12 e a operação criptográfica ocorre no navegador, sem enviar arquivo, senha ou chave privada ao servidor. Só adotar após análise de bibliotecas, proteção de memória, PAdES e testes de validação.
4. **A3 em token/cartão:** manter como modalidade compatível opcional. Para dispositivos físicos, pode ser necessário componente local/extensão por limitações do navegador. Não exigir essa instalação de quem escolher outro fluxo.
5. **Fallback transparente:** se o certificado escolhido exigir componente local não instalado, explicar isso antes de começar e oferecer outra modalidade suportada, sem bloquear o restante do site.

## Decisão técnica atualizada

Usar o DocSigner como referência de arquitetura para a modalidade local opcional, não como requisito para todo usuário. Avaliar reaproveitamento seletivo sob Apache-2.0 somente após auditoria de código, dependências, avisos de licença, segurança e compatibilidade ICP-Brasil.

Referências:
- DocSigner: extensão + agente local + PKCS#11.
- pyHanko: motor Python para estrutura e assinatura PDF/PAdES.
- Web Crypto API: primitives criptográficas no navegador; não oferece, por si só, acesso direto a tokens USB/cartões inteligentes nem a todas as chaves do sistema operacional.

## Progresso real

- [x] Criada branch isolada e PR draft; main e produção não foram alteradas.
- [x] Registrado plano e decisões técnicas.
- [x] Revisados inicialmente README, arquitetura, contratos, extensão, host, licença e NOTICE do DocSigner.
- [x] Criado scaffold inicial da extensão Manifest V3, com allowlist de origens, validação de protocolo e relay Native Messaging.
- [x] Registrados achados e bloqueadores na auditoria inicial.
- [x] Definida prioridade de produto web-first, com instalação local como fallback opcional para certificados que exigirem.
- [ ] Validar tecnicamente a viabilidade de A1 client-side com bibliotecas e testes independentes.
- [ ] Verificar oficialmente a disponibilidade de API/SDK SafeID com a Safeweb.
- [ ] Auditoria completa de código e dependências transitivas.
- [ ] Implementar e testar os caminhos de assinatura selecionados.
- [ ] Executar testes automatizados, builds e validação de PDF assinado.

## Escopo por fases

### Fase 0 — auditoria e desenho
- [x] Criar branch isolada.
- [x] Registrar arquitetura e limites do protótipo.
- [x] Revisar licença principal, NOTICE e documentação de arquitetura do projeto de referência.
- [x] Definir a experiência web-first como prioridade.
- [ ] Revisar código e dependências dos componentes que se pretenda reutilizar.
- [ ] Validar requisitos ICP-Brasil/PAdES com cenários de teste reais.

### Fase 1 — prova de conceito web-first
- [ ] Criar uma página de teste sem instalação para upload de PDF e seleção de modalidade.
- [ ] Provar parsing de PFX/P12 e assinatura local no navegador com certificado de laboratório; não enviar o PFX nem a senha ao backend.
- [ ] Verificar se a solução permite gerar PAdES verificável em leitor independente e no verificador oficial aplicável.
- [ ] Avaliar WebAssembly/bibliotecas e ameaças de XSS, memória, dependências e arquivos temporários.
- [ ] Se a prova de conceito não passar nos requisitos de segurança/conformidade, não liberar A1 puro-web; oferecer integração oficial em nuvem ou bridge opcional.
- [ ] Testar assinatura eletrônica web separadamente, com texto claro sobre o nível e o método de assinatura.

### Fase 2 — integração com o CRM
- [x] Criar scaffold isolado de bridge local opcional, ainda sem integração visual.
- [ ] Integrar a experiência pública com escolha clara da modalidade e mensagens sem jargão.
- [ ] Implementar sessão curta, expiração, proteção contra repetição e trilha de auditoria sem dados secretos.
- [ ] Armazenar o PDF final e metadados mínimos com acesso controlado.
- [ ] Nunca enviar PIN ou chave privada para Supabase, Vercel, logs ou navegador servidor-side.

### Fase 3 — compatibilidade
- [ ] Testar A1 client-side, se a fase 1 for aprovada.
- [ ] Testar A3 em token/cartão com drivers e módulos PKCS#11 compatíveis, usando bridge opcional.
- [ ] Testar Windows/macOS e navegadores suportados.
- [ ] Verificar oficialmente a integração SafeID; implementar adaptador web apenas com API/SDK/fluxo autorizado.

### Fase 4 — produção
- [ ] Revisão de segurança independente.
- [ ] Validar cadeia, revogação, carimbo do tempo e perfil PAdES exigido em cada caso.
- [ ] Assinar instaladores/notarizar aplicativo se a bridge for distribuída.
- [ ] Publicar documentação, política de privacidade, suporte e procedimento de atualização.
- [ ] Liberar somente após testes autorizados e aprovação do responsável pelo produto.

## Arquitetura pretendida

1. **Portal Future:** upload, instruções e escolha da modalidade na mesma tela.
2. **Motor web:** tenta assinatura no navegador somente em fluxos tecnicamente validados; nenhuma chave privada ou senha é enviada ao backend.
3. **Adaptador de nuvem:** autorização oficial do provedor para certificados cloud, se disponível.
4. **Bridge local opcional:** extensão + agente local para A3 e outros cenários em que o navegador não oferece acesso direto ao certificado.
5. **Armazenamento CRM:** PDF final e metadados estritamente necessários, com política de retenção e controle de acesso.

## Requisitos de segurança

- Não enviar PIN, senha do PFX ou chave privada ao servidor, Supabase, Vercel, telemetria ou logs.
- Não prometer acesso direto a todos os certificados via site puro.
- O caminho web de A1 só pode ser liberado após revisão do modelo de ameaças, bibliotecas e validação de assinatura independente.
- A bridge local deve validar a origem e exibir confirmação local antes de assinar.
- Validar tamanho/tipo de arquivo, autenticação quando necessária, autorização, expiração e proteção contra replay.
- Não registrar conteúdo integral de documentos nem segredos.
- A assinatura visual não substitui assinatura criptográfica.

## Limites conhecidos

- O scaffold de extensão existente é apenas uma ponte de desenvolvimento; não lista certificados nem assina documentos.
- Web Crypto API, sozinha, não acessa tokens USB/cartões inteligentes nem descobre todas as chaves do sistema.
- A1, A3 físico e certificados em nuvem são caminhos distintos.
- A integração SafeID depende de confirmação da API/SDK/fluxo oficial.
- Assinatura matematicamente válida não garante, isoladamente, que o fluxo atenda à política jurídica/operacional de qualquer destinatário.

## Critério de conclusão da prova de conceito

A prova de conceito só será considerada concluída quando o PDF de teste assinado for validado em ferramenta independente, e a integridade, cadeia, perfil de assinatura e segurança do tratamento de chave/senha forem verificados. Resultado não testado não será descrito como funcionalidade pronta.
