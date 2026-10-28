# Assinador Digital Future — plano de implementação

## Objetivo

Permitir que um usuário abra um PDF no portal Future e assine digitalmente usando um certificado compatível do computador, mantendo a chave privada fora do navegador e do servidor sempre que o certificado for local. A página pública já existente é uma demonstração/landing; assinatura criptográfica ainda não está habilitada.

## Decisão técnica inicial

Usar o projeto [DocSigner](https://github.com/resilient-tech/docsigner) como referência de arquitetura e avaliar o reaproveitamento seletivo de componentes sob Apache-2.0. Não copiar o repositório inteiro para o CRM sem auditoria de dependências, avisos de licença, segurança e compatibilidade com ICP-Brasil.

Componentes de referência:
- **DocSigner**: integração página web → extensão → aplicativo nativo → PKCS#11; usa assinatura interrompida para que a chave privada permaneça no token.
- **pyHanko**: motor Python para estrutura e assinatura de PDF/PAdES.
- **Web-eID**: referência complementar para a comunicação entre navegador e aplicativo local.

## Progresso real

- [x] Criada branch isolada e PR draft; main e produção não foram alteradas.
- [x] Registrado plano e decisões técnicas.
- [x] Revisados inicialmente README, arquitetura, contratos, extensão, host, licença e NOTICE do DocSigner.
- [x] Criado scaffold inicial da extensão Manifest V3, com allowlist de origens, validação de protocolo e relay Native Messaging.
- [x] Registrados achados e bloqueadores na auditoria inicial.
- [ ] Auditoria completa de código e dependências transitivas.
- [ ] Implementar o agente nativo; ele ainda não existe neste projeto.
- [ ] Executar testes automatizados e builds da extensão e do agente.
- [ ] Executar prova de conceito com certificado e PDF de teste.

## Escopo por fases

### Fase 0 — auditoria e desenho
- [x] Criar branch isolada para o trabalho.
- [x] Registrar arquitetura e limites do protótipo.
- [x] Revisar licença principal, NOTICE e documentação de arquitetura do projeto de referência.
- [x] Inspecionar o fluxo documentado de certificados, PIN, Native Messaging e validação.
- [ ] Revisar código e dependências de cada componente que se pretenda reutilizar.
- [ ] Definir os perfis de assinatura exigidos no Brasil com base em testes e requisitos reais.

### Fase 1 — prova de conceito local
- [ ] Executar DocSigner separadamente em ambiente de desenvolvimento.
- [ ] Testar fluxo sem hardware usando chaves de teste.
- [ ] Testar um PDF de amostra com certificado de laboratório e validar a assinatura em leitor independente.
- [ ] Registrar sistema operacional, navegador, algoritmo, cadeia, resultado de validação e erros.
- [ ] Não usar certificado, PIN ou documento real de cliente durante os testes iniciais.

### Fase 2 — integração com o CRM
- [x] Criar scaffold isolado da extensão, ainda sem integração visual com a landing.
- [ ] Implementar agente local e contrato nativo testado.
- [ ] Conectar a interface ao agente local com verificação explícita de origem e autorização.
- [ ] Criar sessão de assinatura curta, com expiração, proteção contra repetição e auditoria sem dados secretos.
- [ ] Armazenar o PDF assinado e metadados mínimos, aplicando políticas de acesso.
- [ ] Não enviar PIN ou chave privada para Supabase, Vercel, logs ou navegador.

### Fase 3 — compatibilidade
- [ ] Testar A1 instalado/arquivo PKCS#12 de forma segura.
- [ ] Testar A3 em token/cartão com drivers e módulos PKCS#11 compatíveis.
- [ ] Testar Windows e macOS, incluindo assinatura e atualização segura do agente.
- [ ] Avaliar SafeID/certificados em nuvem como adaptadores independentes; não presumir que funcionem como certificados locais.

### Fase 4 — produção
- [ ] Revisão de segurança independente.
- [ ] Verificar cadeia ICP-Brasil, revogação, carimbo do tempo e política PAdES exigida para cada caso.
- [ ] Assinar instaladores Windows (Authenticode) e notarizar o aplicativo macOS.
- [ ] Publicar documentação, política de privacidade, suporte e procedimento de atualização.
- [ ] Só liberar após testes reais autorizados e aprovação do responsável pelo produto.

## Arquitetura pretendida

1. **Portal Future (React/Vite)**: seleciona PDF, apresenta certificados disponíveis e mostra o resultado.
2. **Extensão de navegador**: ponte autorizada entre a página e o agente local.
3. **Agente local Windows/macOS**: conversa com token/certificado por interfaces do sistema ou PKCS#11; pede confirmação/PIN fora da página.
4. **Motor de assinatura**: prepara e finaliza o PDF assinado em padrão PAdES.
5. **Armazenamento do CRM**: guarda somente arquivos e metadados autorizados; nunca guarda PIN ou chave privada do certificado local.

## Requisitos de segurança

- A chave privada não deve sair do dispositivo criptográfico quando o certificado for A3.
- Não solicitar PIN em campos HTML nem enviá-lo ao backend.
- Permitir apenas origens autorizadas; não aceitar comandos arbitrários de qualquer site.
- O agente nativo deve validar todos os pedidos novamente e exibir confirmação local antes de assinar.
- Validar tamanho e tipo de arquivo, usuário autenticado e permissões antes de assinar.
- Limitar e expirar sessões; proteger endpoints contra CSRF, replay e abuso.
- Não registrar PIN, tokens de sessão ou conteúdo integral de documentos nos logs.
- Usar arquivos temporários com permissões restritas e remoção controlada.
- A assinatura visual (imagem/rubrica) não substitui assinatura criptográfica.

## Limites conhecidos

- A extensão criada é apenas um scaffold. Sem agente nativo, ela não lista certificados nem assina documentos.
- A1 local, A3 e certificado em nuvem são caminhos diferentes.
- Compatibilidade depende de drivers, middleware, sistema operacional, navegador e algoritmos do certificado.
- O projeto DocSigner documenta um risco específico: o caminho Windows do host não foi verificado pelo mantenedor em hardware real; exige testes independentes.
- Uma assinatura matematicamente válida não garante, por si só, que o fluxo atenda à política jurídica ou operacional de qualquer destinatário.
- A licença permissiva do projeto principal não substitui a auditoria das licenças das dependências e ativos distribuídos.

## Critério de conclusão da prova de conceito

A fase 1 só será considerada concluída quando um PDF de teste assinado puder ser validado em leitor independente sem alerta de alteração inválida, e certificado/cadeia, integridade e perfil de assinatura tiverem sido verificados. Resultado ainda não testado não será descrito como funcionalidade pronta.
