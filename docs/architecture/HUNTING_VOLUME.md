# Coleta de leads: meta de 50

## Diagnóstico

Em 30/09/2026, uma busca no site de produção para Grupo Corpus Saneamento e Obras, com URL `https://www.linkedin.com/company/grupo-corpus`, Brasil, os cargos padrão do B2B e quantidade 50 terminou com HTTP 503. Os logs mostraram:

- Company Details: 1 registro.
- Harvest Company Employees: 9 registros.
- Harvest Profile Search: 0 registros.
- Dami Profile Search: HTTP 400.
- Fonte alternativa de funcionários: 0 registros.

Os logs registram contagens, não o conteúdo dos nove registros. Portanto, não comprovam nove leads qualificados nem a causa exata do 503. O código descartava perfis sem cargo mesmo quando nome e URL estavam presentes. A contingência também concatenava todos os cargos no campo `searchQuery`, que aceita no máximo 300 caracteres.

Outros limites encontrados no código em produção:

- B2B fazia uma chamada principal, sem avançar páginas, e podia parar com poucos perfis.
- O corte da lista ocorria antes do ranking.
- HR encerrava a coleta com 60% da quantidade pedida: 30 de 50.
- “Carregar mais” repetia a primeira consulta e só depois removia os perfis existentes.
- A consulta HR podia usar 520 caracteres em um campo que aceita 300.

Pagar o Apify não altera esses limites da aplicação.

## Mudança

- Meta padrão e teto continuam em 50 por busca inicial.
- Coleta percorre páginas, deduplica e procura completar a quantidade. Preserva o último lote inteiro para ordenar antes de selecionar os resultados.
- Limites de tempo, páginas e repetição encerram a coleta com uma explicação. Resultados parciais sobrevivem a falhas posteriores.
- Cargos equivalentes vão em campos estruturados; palavras-chave ajudam a avaliação, sem tornar a descoberta excessivamente restritiva.
- Empresas permanecem delimitadas pelas URLs informadas. A contingência por funcionários pode ampliar cargos; o resultado avisa que é preciso avaliar a aderência.
- Nome e URL reais podem ser preservados mesmo sem cargo; a interface informa a lacuna, sem inventar senioridade.
- HR salva a próxima página e os perfis restantes em `sourceSnapshot`. A continuação usa esse estado e exclui candidatos já salvos.
- A persistência acrescenta novos candidatos e mantém contatos, evidências e shortlist existentes. Não exige migração de banco. Candidatos antigos continuam visíveis caso a busca seja refeita com outros filtros.
- Apify continua como fonte. A referência ao Apollo é o uso de filtros próprios e títulos equivalentes, sem trocar de fornecedor.

## Validação e limites

Testes cobrem lotes curtos, sobreposição, 30 → 50, falha após uma página útil, limite de tempo, páginas repetidas, continuação HR, lote pendente e cargo ausente. O cenário Corpus dos testes usa dados sintéticos; não comprova 50 pessoas reais da Corpus.

A busca real descrita acima foi executada na versão anterior de produção. Ainda é necessário repetir esse caso na versão corrigida, conferir quantidade única, empresa atual, aderência e erros dos conectores. Cinquenta é uma meta de coleta; a cobertura pública e os cargos escolhidos podem produzir menos pessoas relevantes.

## Validação após publicar o PR #25

O commit `d8807e5` foi publicado em produção em 30/09/2026. A mesma busca da Corpus passou a concluir com HTTP 200, mas os Actors retornaram zero para os filtros exatos. A fonte complementar por perfil repetia esses filtros; a alternativa Apt Marble também retornou zero.

O ajuste seguinte mantém a tentativa exata e acrescenta uma consulta Harvest por funcionários vinculada às mesmas URLs corporativas, sem restringir cargo ou localização nessa etapa. Os filtros originais permanecem no ranking e a interface explica essa ampliação. Isso busca cobertura da empresa, sem afirmar que todos os funcionários encontrados são decisores aderentes.

## Referências

- [Apollo: filtros de busca](https://knowledge.apollo.io/hc/en-us/articles/4412665755661-Use-Search-Filters-to-Find-Prospects)
- [Harvest Company Employees: filtros e paginação](https://apify.com/harvestapi/linkedin-company-employees/input-schema)
- [Harvest Profile Search: campos aceitos](https://apify.com/harvestapi/linkedin-profile-search/input-schema)
- [Dami Profile Search: consulta de até 300 caracteres e cargos separados](https://apify.com/dami_studio/linkedin-profile-search-scraper/input-schema)
