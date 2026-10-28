# Assinador Digital Future — plano de implementação

## Objetivo

Permitir que um usuário abra um PDF no CRM Future e assine digitalmente usando um certificado disponível no computador, mantendo a chave privada fora do navegador e do servidor sempre que o certificado for local.

## Decisão técnica inicial

Usar o projeto [DocSigner](https://github.com/resilient-tech/docsigner) como referência de arquitetura e avaliar o reaproveitamento seletivo de componentes sob Apache-2.0. Não copiar o repositório inteiro para o CRM sem auditoria de dependências, avisos de licença, segurança e compatibilidade com ICP-Brasil.

Componentes de referência:
- **DocSigner**: integração página web → extensão → aplicativo nativo → PKCS#11; usa assinatura interrompida para que a chave privada permaneça no token.
- **pyHanko**: motor Python para estrutura e assinatura de PDF/PAdES.
- **Web-eID**: referência complementar para a comunicação entre navegador e aplicativo local.

## Escopo por fases

### Fase 0 — auditoria e desenho
- [x] Criar branch isolada para o trabalho.
- [x] Registrar arquitetura e limites do protótipo.
- [ ] Revisar licença, NOTICE e dependências de cada componente que se pretenda reutilizar.
- [ ] Inspecionar fluxo de certificados, tratamento de PIN, validação e armazenamento temporário.
- [ ] Definir os perfis de assinatura exigidos no Brasil com base em testes e requisitos reais.

### Fase 1 — prova de conceito local
- [ ] Executar DocSigner separadamente em ambiente de desenvolvimento.
- [ ] Testar fluxo sem hardware usando chaves de teste.
- [ ] Testar um PDF de amostra com certificado A1 de teste e validar a assinatura no Adobe Acrobat Reader.
- [ ] Registrar SO, navegador, algoritmo, cadeia, resultado de validação e erros.
- [ ] Não usar certificado, PIN ou documento real de cliente durante os testes iniciais.

### Fase 2 — integração com o CRM
- [ ] Criar uma interface Future de assinatura em uma rota isolada.
- [ ] Conectar a interface ao agente local com verificação explícita de origem e autorização.
- [ ] Criar sessão de assinatura curta, com expiração, proteção contra repetição e auditoria sem dados secretos.
- [ ] Armazenar o PDF assinado e os metadados mínimos necessários, aplicando políticas de acesso.
- [ ] Não enviar PIN ou chave privada para Supabase, Vercel, logs ou navegador.

### Fase 3 — compatibilidade
- [ ] Testar A1 instalado/arquivo PKCS#12 de forma segura.
- [ ] Testar A3 em token/cartão com os drivers e módulos PKCS#11 compatíveis.
- [ ] Testar Windows e macOS, incluindo assinatura e atualização segura do agente.
- [ ] Avaliar SafeID/certificados em nuvem como adaptadores independentes; não presumir que funcionem como certificados locais.

### Fase 4 — produção
- [ ] Revisão de segurança independente.
- [ ] Verificar cadeia ICP-Brasil, revogação, carimbo do tempo e política PAdES exigida para cada caso.
- [ ] Assinar instaladores Windows (Authenticode) e notarizar o aplicativo macOS.
- [ ] Publicar documentação, política de privacidade, suporte e procedimento de atualização.
- [ ] Só liberar após testes reais autorizados e aprovação do responsável pelo produto.

## Arquitetura pretendida

1. **CRM Future (React/Vite)**: seleciona PDF, apresenta certificados disponíveis e mostra o resultado.
2. **Extensão de navegador (quando necessária)**: faz a ponte autorizada entre a página e o agente local.
3. **Agente local Windows/macOS**: conversa com o token/certificado por interfaces do sistema ou PKCS#11; pede confirmação/PIN fora da página.
4. **Motor de assinatura**: prepara e finaliza o PDF assinado em padrão PAdES.
5. **Armazenamento do CRM**: guarda somente arquivos e metadados autorizados; nunca guarda PIN ou chave privada do certificado local.

## Requisitos de segurança

- A chave privada não deve sair do dispositivo criptográfico quando o certificado for A3.
- Não solicitar PIN em campos HTML nem enviá-lo ao backend.
- Permitir apenas origens autorizadas; não aceitar comandos arbitrários de qualquer site.
- Validar tamanho e tipo de arquivo, usuário autenticado e permissões antes de assinar.
- Limitar e expirar sessões; proteger endpoints contra CSRF, replay e abuso.
- Não registrar PIN, conteúdo do certificado sensível, tokens de sessão ou conteúdo integral de documentos nos logs.
- Usar arquivos temporários com permissões restritas e remoção controlada.
- A assinatura visual (imagem/rubrica) não substitui assinatura criptográfica.

## Limites conhecidos

- A1 local, A3 e certificado em nuvem são caminhos diferentes.
- Compatibilidade depende de drivers, middleware, sistema operacional, navegador e algoritmos do certificado.
- Uma assinatura matematicamente válida não garante, por si só, que o fluxo atenda à política jurídica ou operacional de qualquer destinatário.
- O DocSigner foi desenvolvido com foco em cartões/tokens e perfis de assinatura documentados pelo projeto; a compatibilidade ICP-Brasil precisa ser verificada, não presumida.
- A licença permissiva do projeto principal não substitui a auditoria das licenças das dependências e ativos distribuídos.

## Critério de conclusão da prova de conceito

A fase 1 só será considerada concluída quando um PDF de teste assinado puder ser aberto no Adobe Acrobat Reader sem alerta de alteração inválida, e o certificado/cadeia, a integridade e o perfil de assinatura tiverem sido verificados. Resultado ainda não testado não será descrito como funcionalidade pronta.
