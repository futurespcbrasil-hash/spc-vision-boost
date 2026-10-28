# Decisões técnicas — Assinador Digital Future

## ADR-001 — agente local com fluxo de assinatura interrompida

**Status:** proposta para prova de conceito.

### Contexto
O navegador não deve ter acesso irrestrito a chaves privadas. O CRM precisa funcionar com certificados de diferentes autoridades certificadoras, inclusive A1 local e A3 em dispositivos criptográficos, quando tecnicamente compatíveis.

### Decisão
Avaliar a arquitetura do DocSigner: o servidor prepara o PDF e calcula o hash a assinar; o agente local/token assina esse hash; o servidor ou componente de assinatura finaliza a estrutura PAdES. Para A3, a chave privada deve permanecer no token.

Para A1, não extrair ou enviar a chave ao servidor. A primeira implementação deve usar certificado e chave de teste, e a decisão sobre importação segura de A1 será tomada após revisar o suporte real da biblioteca e o modelo de ameaças.

### Consequências
- Permite separar a interface Future do mecanismo local de certificado.
- Pode suportar vários emissores de certificados locais sem integração individual com cada AC, desde que os drivers e formatos sejam compatíveis.
- Exige distribuir, assinar, atualizar e manter um aplicativo local e, possivelmente, uma extensão.
- Certificados em nuvem, como SafeID, precisam de integração oficial específica; não são automaticamente detectados pelo agente local.

## ADR-002 — não alterar main nem publicar automaticamente

**Status:** aprovado.

O trabalho fica na branch `feat/future-assinador-local-prototype`, derivada da branch de landing `feat/future-assinador-landing`. Não fazer merge, alterar a `main` nem implantar em produção nesta fase. Primeiro executar auditoria, prova de conceito e testes.

## ADR-003 — licenças e atribuições

**Status:** pendente de auditoria de dependências.

O DocSigner declara Apache-2.0 e lista avisos adicionais no `NOTICE`, incluindo ativos sob SIL OFL e ISC. Antes de distribuir um produto Future baseado em seus componentes, preservar os avisos aplicáveis, revisar dependências transitivas e registrar versões/licenças em inventário de software (SBOM). O pyHanko declara MIT, mas suas dependências devem ser avaliadas separadamente.
