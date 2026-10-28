# Auditoria inicial do DocSigner para o Future Assinador

Data da inspeção: 28/10/2026. Referência: https://github.com/resilient-tech/docsigner (branch develop).

## Resultado executivo

O DocSigner é uma referência relevante para arquitetura extensão + Native Messaging + host local + motor PAdES. Não devemos copiar e publicar o projeto inteiro sem uma auditoria aprofundada de código, dependências, licença e compatibilidade ICP-Brasil.

## Evidências e limites

- O README declara licença Apache-2.0; o arquivo NOTICE pede preservar atribuições de ativos Lucide, fontes sob SIL OFL e avisos de terceiros pertinentes.
- A extensão usa Manifest V3 e Native Messaging; a instalação do host é separada e depende do ID autorizado da extensão.
- O host documentado conversa com tokens por PKCS#11 e também tenta usar o repositório de certificados do sistema operacional (Keychain no macOS e store MY no Windows).
- A documentação do host identifica a implementação Windows como não verificada em hardware real e aponta chamadas CNG como área de maior risco. Não podemos anunciar suporte equivalente em Windows e macOS sem nossos próprios builds e testes.
- Suporte a PKCS#11 não comprova compatibilidade com todos os tokens, middleware, algoritmos ou certificados ICP-Brasil.
- Um arquivo A1 PKCS#12, certificado importado no repositório do sistema, A3 em token e SafeID em nuvem são cenários diferentes. Cada caminho precisa de testes separados.
- A listagem pública da Chrome Web Store existe, mas isso não equivale a auditoria de segurança independente nem comprova adequação ao nosso produto.

## Decisão para o Future

Criar uma ponte Future pequena e com origens explicitamente permitidas, mantendo o motor de assinatura e o host isolados até terminar a auditoria. Reaproveitamento de código do DocSigner continua condicionado a revisão arquivo a arquivo, dependências transitivas, avisos de licença e inventário de software (SBOM).

## Bloqueadores antes de assinatura real

1. Implementar e auditar o agente nativo.
2. Adicionar consentimento nativo por origem e confirmação de assinatura; nunca confiar apenas no pedido da página.
3. Testar certificados de laboratório, PDF de teste e validação independente da assinatura PAdES.
4. Testar Windows e macOS com drivers suportados e registrar limitações.
5. Definir armazenamento, retenção, expiração e controle de acesso do PDF final.
6. Tratar SafeID por adaptador oficial próprio; não inferir que um certificado em nuvem será detectável localmente.

## Fontes

- Repositório e arquitetura: https://github.com/resilient-tech/docsigner
- Contratos do projeto: https://github.com/resilient-tech/docsigner/blob/develop/CONTRACTS.md
- Documentação do host: https://github.com/resilient-tech/docsigner/blob/develop/docs/host.md
- Documentação da extensão: https://github.com/resilient-tech/docsigner/blob/develop/extension/README.md
- Licença e atribuições: https://github.com/resilient-tech/docsigner/blob/develop/LICENSE e https://github.com/resilient-tech/docsigner/blob/develop/NOTICE
