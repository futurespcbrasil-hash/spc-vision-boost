# Decisões técnicas — Assinador Digital Future

## ADR-001 — estratégia web-first e bridge local opcional

**Status:** proposta para prova de conceito.

### Contexto
A prioridade de produto é reduzir o atrito: o cliente deve abrir um link e fazer o máximo possível sem instalar extensão ou aplicativo. Ao mesmo tempo, o site não pode acessar livremente todas as chaves do sistema operacional ou dispositivos A3.

### Decisão
Priorizar a experiência web-first, por modalidades:

1. Assinatura eletrônica pelo site quando adequada ao documento, com explicação clara de que não é equivalente a uma assinatura qualificada ICP-Brasil.
2. Certificado em nuvem por API/SDK ou fluxo de autorização oficial do provedor, se disponível. SafeID exige confirmação técnica/comercial com a Safeweb.
3. A1: pesquisar e testar assinatura no navegador a partir de arquivo selecionado pelo usuário, mantendo PFX, senha e chave em memória local e nunca enviando-os ao backend. Só liberar se a prova de conceito cumprir requisitos de segurança e PAdES.
4. A3 físico: oferecer bridge de extensão + agente local como modalidade opcional quando necessário, sem obrigar todos os usuários a instalar componentes.

O DocSigner será referência para a bridge local opcional. Não será pressuposto para o fluxo inteiro.

### Consequências
- Menos fricção para os fluxos web e certificados em nuvem que possuam integração oficial.
- A1 puro-web ainda é uma hipótese a validar, não uma capacidade já comprovada.
- A3 físico provavelmente exige integração local; o site deve explicar isso antes do usuário iniciar.
- A chave privada nunca deve ser enviada ao servidor; PIN/senha não podem ser registrados ou enviados pela rede.
- Não anunciar compatibilidade universal sem testes independentes.

## ADR-002 — não alterar main nem publicar automaticamente

**Status:** aprovado.

O trabalho fica na branch `feat/future-assinador-local-prototype`, derivada da branch de landing `feat/future-assinador-landing`. Não fazer merge, alterar a `main` nem implantar em produção nesta fase. Primeiro executar auditoria, prova de conceito e testes.

## ADR-003 — licenças e atribuições

**Status:** pendente de auditoria de dependências.

O DocSigner declara Apache-2.0 e lista avisos adicionais no `NOTICE`, incluindo ativos sob SIL OFL e ISC. Antes de distribuir um produto Future baseado em seus componentes, preservar os avisos aplicáveis e revisar as licenças das dependências transitivas.
