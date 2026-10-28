# Future Assinador — A1 no navegador, sem instalador

**Estado atual da branch:** prova de conceito implementada na landing, aguardando build e validação criptográfica real antes de habilitar em produção. URL alvo: `https://crm.futuresolucoes.com.br/assinar`.

## Fluxo implementado na prova

1. Selecionar o PDF (até 20 MB).
2. Selecionar localmente o arquivo de certificado A1 `.pfx` ou `.p12`.
3. Informar a senha do arquivo.
4. Gerar uma assinatura PDF PAdES com a política `pades-icp-brasil`, posicionada automaticamente no canto inferior direito da última página.
5. Verificar localmente a integridade criptográfica da assinatura e baixar uma nova cópia `-assinado.pdf`.

A assinatura e a verificação são chamadas no navegador. O PDF original não é sobrescrito e o certificado/senha não são enviados ao Supabase, ao CRM ou ao formulário de captação de leads.

## Limites importantes

- Este fluxo **não lê automaticamente** os certificados do repositório do Windows. A1 instalado em `certmgr.msc` não significa que o navegador tenha acesso ao arquivo PKCS#12 ou à chave privada.
- O cliente precisa ter o arquivo `.pfx/.p12` e sua senha. Não orientar exportação da chave privada sem avaliação de risco e proteção adequada.
- A3, token/cartão, SafeID e certificados em nuvem não fazem parte desta prova.
- O posicionamento é automático nesta primeira versão; escolha manual de página/retângulo ainda não está implementada.
- A verificação local de integridade não significa que a cadeia, revogação ou confiança foi validada. O PDF deve ser testado em leitor compatível e no serviço oficial VALIDAR do ITI.
- A biblioteca e sua cadeia de dependências precisam de revisão antes de uso em produção. Não registrar PDFs, PFX/P12, senhas ou bytes de chave em logs, analytics ou armazenamento persistente.

## Critérios antes de produção

- [ ] Build de produção aprovado com lockfile reproduzível.
- [ ] Teste com certificados A1 autorizados, senha correta/incorreta e arquivos inválidos.
- [ ] Verificação independente no VALIDAR do ITI e em leitor PDF compatível.
- [ ] Confirmar no navegador que nenhum PDF/PFX/senha é enviado pela rede.
- [ ] Rever dependências, política ICP-Brasil aplicável, acessibilidade e posicionamento visual.
- [ ] Confirmar avisos legais e UX para que o usuário entenda o risco de manusear arquivos A1.
