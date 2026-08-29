# Guia editorial da Share AI

## Padrão principal

A Share AI escreve em português brasileiro, com acentuação, concordância, regência e pontuação impecáveis. Texto ruim é tratado como bug de produto.

## Voz

A voz deve ser profissional, consultiva, direta, contemporânea e natural. A plataforma deve soar como uma especialista em estratégia comercial, não como uma biblioteca de prompts.

Evite frases genéricas como “em um cenário cada vez mais dinâmico” ou “potencializar resultados”. Prefira observações específicas, com impacto e recomendação.

## Glossário

- **Unidade de Negócio** ou **BU**: contexto estratégico configurável da Share AI.
- **Pontuação de autoridade comercial**: leitura de 0 a 100 sobre a força do perfil para gerar confiança comercial.
- **Fonte**: origem da informação usada na análise.
- **Confiança**: grau de segurança sobre a fonte ou inferência.
- **Rapport**: preparação de contexto para uma conversa comercial relevante.
- **AIDA**: estrutura de abordagem comercial. Pode aparecer quando o fluxo estiver contextualizado.

## Termos evitados para usuário final

- Actor
- Provider
- SkillRun
- API endpoint
- Scraper
- Cron
- Adapter

Use linguagem de produto:

- “Fonte conectada”
- “Pesquisa conectada”
- “Informações obtidas em fonte pública”
- “Análise da IA”
- “Recurso”

## Confiança das fontes

- `confirmed`: Confirmado
- `likely`: Provável
- `inference`: Inferência
- `unverified`: Não verificado

## Prompts de IA

Todo prompt que gerar conteúdo em português deve conter:

“Escreva em português brasileiro (pt-BR), com ortografia, acentuação, concordância, regência e pontuação impecáveis.”

Também deve conter:

“Antes de devolver a resposta, faça uma revisão editorial silenciosa do próprio texto.”

## Saídas geradas

Antes de exibir respostas longas, aplicar o fluxo:

1. Geração
2. Revisão editorial
3. Resposta final

A revisão pode melhorar português, clareza, fluidez e consistência. Não pode inventar fatos, alterar pontuações, mudar nomes ou modificar fontes.
