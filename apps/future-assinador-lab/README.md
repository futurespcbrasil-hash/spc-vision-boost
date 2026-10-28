# Laboratório isolado de seleção de certificado via TLS

**Estado: configuração de referência; não implantada nem testada.** Este laboratório não altera o domínio principal, não recebe PDFs e não assina documentos.

## O que este teste prova

O endpoint HTTPS solicita um certificado de cliente durante o handshake TLS. Dependendo do navegador, sistema operacional, certificado e políticas locais, isso pode abrir o seletor nativo. O endpoint retorna apenas o resultado mínimo da negociação TLS.

**Isso não lista todos os certificados do computador e não assina PDF.** O mTLS autentica uma conexão; assinatura PAdES é uma operação criptográfica separada.

## Pré-requisitos de infraestrutura

1. Criar um subdomínio exclusivo, por exemplo `cert-check.futuresolucoes.com.br`, apontado para um servidor de laboratório.
2. Emitir um certificado TLS válido para esse subdomínio.
3. Instalar Nginx com suporte a TLS.
4. Obter e revisar um arquivo PEM contendo os certificados de autoridades emissoras que devem ser anunciadas no pedido TLS. O conjunto anunciado influencia quais certificados o navegador oferece. Não assumir que um único bundle cobre todos os certificados ICP-Brasil, tokens A3 ou middleware.
5. Aplicar o bloco de configuração de `nginx.conf.example` e validar a configuração com `nginx -t` antes de recarregar.
6. Manter esse host separado do CRM, da landing pública e de qualquer rota de produção.

Os caminhos de certificados no exemplo são placeholders e devem ser substituídos no servidor. Não colocar chaves privadas, certificados de cliente ou dados pessoais no Git.

## Como testar

- Chrome e Edge no Windows; Safari e Chrome no macOS.
- Começar com certificado de teste e registrar apenas navegador/OS, se o diálogo apareceu, se o usuário cancelou e o código mínimo retornado.
- Repetir com A1 e A3 separadamente; para A3, anotar o middleware/token, sem coletar PIN ou exportar a chave privada.
- Considerar que o navegador pode memorizar a seleção para o site e não exibir o diálogo em toda tentativa.
- Testar ausência de certificado e cancelamento.
- Confirmar que logs de acesso estão desativados e que a resposta não contém assunto, emissor, número de série, CPF/CNPJ ou certificado em PEM.

## Interpretação

- `SUCCESS`: o servidor considerou o certificado de cliente apresentado válido segundo a configuração local.
- `NONE`: nenhum certificado foi apresentado.
- `FAILED:...`: houve falha na verificação/negociação; não registrar detalhes sensíveis em logs públicos.

A configuração de exemplo usa `optional_no_ca` para que a ausência de certificado não impeça a página de teste. Isso **não** é uma configuração de autenticação adequada para proteger recursos reais. Não usar esse endpoint como controle de acesso.

## Próxima etapa após o teste

Mesmo se o seletor aparecer, não reutilizar a assinatura TLS como assinatura de documento. Validar separadamente uma estratégia PAdES para A1, A3 e certificado em nuvem, incluindo verificação independente do PDF final. Não enviar PFX, senha, PIN ou chave privada para servidor, Supabase, logs ou analytics.
