# Extensão Future Assinador Digital

**Estado: scaffold de desenvolvimento — ainda não é uma extensão pronta para clientes e não assina documentos.**

Esta pasta inicia a ponte Manifest V3 para Chrome/Edge. Ela restringe a execução às origens oficiais da Future e define comandos de protocolo para consultar o agente local. O agente nativo ainda precisa ser implementado, auditado, compilado e registrado antes de qualquer comando poder funcionar.

## Arquitetura

Página Future → content script → service worker → Native Messaging → agente local.

Comandos previstos: PING, LIST_CERTIFICATES e SIGN_HASH. O contrato atual valida o formato dos pedidos no content script e o service worker aplica uma lista de origens permitidas antes de encaminhar mensagens ao agente.

## Instalação local (somente desenvolvimento)

1. Implementar e testar o agente nativo antes de tentar assinar.
2. Gerar ícones oficiais da Future e revisar o manifesto.
3. Carregar esta pasta em chrome://extensions com o modo de desenvolvedor.
4. Registrar o agente nativo com o ID exato da extensão; o arquivo native-host/com.futuresolucoes.assinador.json.template é apenas um modelo e não deve ser instalado sem substituir os valores.
5. Confirmar que o host mostra consentimento explícito antes de qualquer assinatura e que o PIN é solicitado nativamente, nunca em HTML.

## Limites de segurança obrigatórios

- Não instalar nem distribuir este scaffold como produto final.
- Não aceitar mensagens de sites fora da allowlist.
- O agente deve validar novamente todos os campos; validação no navegador não é uma fronteira de segurança.
- O agente deve mostrar confirmação nativa contendo a origem solicitante, o certificado e a ação antes de assinar.
- O PIN nunca pode passar pela página, extensão, rede, Supabase ou logs.
- A chave privada de A3 deve permanecer no token. O suporte a A1 só será declarado após validar um fluxo local seguro.
- O host ainda não existe nesta pasta; sem ele, a extensão deve falhar de forma segura e não alegar que encontrou certificados.

## Próximos passos

1. Implementar o host local multiplataforma, inicialmente com modo de teste sem certificados reais.
2. Adicionar testes automatizados ao protocolo e testes de origem.
3. Validar o fluxo PAdES com PDF/certificado de teste.
4. Integrar a UI /assinar somente depois de o contrato local estar testado.
5. Revisar dependências, licenças, instaladores assinados e segurança antes de distribuição.
