# Fundação da Share AI

Este MVP começa como um monólito modular para Vercel e Next.js App Router.

## Decisões principais

- Next.js + TypeScript sustentam a aplicação, as rotas de API e a orquestração no backend.
- PostgreSQL/Neon é a fonte de registro. `prisma/schema.prisma` define o modelo inicial de dados.
- Login Google e autorização Gemini são conceitos separados. O login usa Auth.js; Gemini é uma credencial de conector pertencente ao usuário ou à organização.
- Os recursos dependem de capacidades, como `ai.generateStructuredAssessment` e `research.publicBusinessProfile`, não de nomes de fornecedores.
- Credenciais são manipuladas apenas no backend e representadas por payloads criptografados.
- A aprovação humana é modelada antes de qualquer ação externa, como publicar, enviar mensagens, atualizar CRM ou acionar automações de terceiros.

## Estado atual do repositório

O repositório inclui uma camada local de demonstração para o fluxo do MVP enquanto as credenciais Neon não estão configuradas. O schema Prisma é o contrato para substituir essa camada por persistência real no banco.

## Primeiro fluxo funcional

O diagnóstico de autoridade avalia autoridade comercial, não empregabilidade. Ele recebe perfil/contexto do LinkedIn, BU, objetivos, temas, evidências e sinais de atividade. Ele retorna:

- pontuação de 0 a 100;
- pontuações por dimensão;
- pontos fortes e lacunas;
- riscos e oportunidades;
- recomendações;
- plano de 30 dias;
- fontes e confiança;
- histórico e comparação de evolução.

## Variáveis de ambiente

Obrigatórias em produção:

- `DATABASE_URL`: string de conexão do Neon/PostgreSQL.
- `NEXTAUTH_SECRET`: segredo de assinatura do Auth.js.
- `GOOGLE_CLIENT_ID`: client ID do Google OAuth.
- `GOOGLE_CLIENT_SECRET`: client secret do Google OAuth.
- `CREDENTIAL_ENCRYPTION_KEY`: chave base64 de 32 bytes para credenciais dos conectores.

Opcional até o Gemini ser conectado:

- `DEFAULT_AI_PROVIDER`: chave do provedor, por exemplo `gemini`.
