# Login POC

Rota de login: `/login-poc`. Visitantes sem sessão que acessam `/` são encaminhados a essa tela. Após o login Google, o callback retorna a `/`, que mantém o Nexus para usuários autenticados. A configuração de autenticação e as permissões existentes permanecem inalteradas.

## Branding

A tela usa a imagem original enviada pelo usuário, já disponível em `/brand/share-nexus-logo.png`, nos dois espaços de marca. O arquivo é idêntico ao original, com proporção 6226 × 2189 preservada e `object-fit: contain`. A identificação provisória de POC foi removida da interface e do título da página.

O Google G foi obtido de https://developers.google.com/static/identity/images/g-logo.png, vinculado nas diretrizes oficiais: https://developers.google.com/identity/branding-guidelines.

## Login

O botão chama `signIn("google", { callbackUrl: "/" })` do NextAuth existente. Nenhum provider, callback, permissão ou rota global foi alterado. Os chips são uma lista visual, sem links ou ações.

Para OAuth real local, use as credenciais Google já configuradas para o projeto em um `.env.local` ignorado pelo Git, um `NEXTAUTH_SECRET` e `NEXTAUTH_URL` correspondente à origem local. Essa origem precisa ter seu `/api/auth/callback/google` autorizado no cliente Google. Nunca inclua segredos neste documento ou em commits.

## Execução

`pnpm dev --webpack --port 3120` e abrir http://localhost:3120/login-poc.

CSS Modules limita o estilo à POC. `NexusBackground` e `NexusCore` são reutilizados sem edição. A animação respeita a preferência de movimento reduzido.

Não publicar nem mesclar sem aprovação após a revisão visual e funcional.

Neste checkout isolado, as dependências locais são reutilizadas por um vínculo entre diretórios. Por isso o servidor usa Webpack: Turbopack rejeita vínculos fora da raiz. Em uma instalação independente via pnpm, esse vínculo não é necessário. Nenhuma configuração global do projeto foi alterada.
