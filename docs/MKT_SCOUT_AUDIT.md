# Auditoria MKT Scout — 02/10/2026

## Escopo e evidência

Skill audit oficial da OpenAI aplicada ao fluxo radar → marca → detalhe → conteúdo → direção visual.
Chrome em sessão isolada via agent-browser, viewport desktop 1440×1000 e mobile 390×844.

A interface testada usa os componentes reais e JSX da página. Uma rota temporária local, protegida por NODE_ENV=development, permitiu testar a UI sem banco ou login de produção. Respostas das APIs foram interceptadas apenas no navegador e identificadas como fixtures sintéticas de QA. Elas nunca entram no radar de produção. A rota foi removida antes do build.

Separadamente, os adapters coletaram dados públicos reais e as APIs reais recusaram acesso sem sessão. Assim, os screenshots comprovam comportamento da UI; os testes de backend comprovam cache, contexto e geração estruturada. Não representam teste integrado com OAuth/PostgreSQL/provedores pagos.

## Fluxo capturado

1. Radar desktop: saudável. Título principal, seletor de marca, busca secundária, fontes e coleta identificados. Um módulo visível, MKT Scout.
2. Detalhe com duas fontes de teste: saudável. Evidências e interpretação separadas; métricas ausentes explícitas; nove seções.
3. Geração por clique: saudável. Nenhum POST automático de conteúdo; após clique, a requisição preserva trendId, brandId e opportunityId.
4. Direção visual sem provider: saudável. Conceito, composição, enquadramento, restrições e formato presentes sem tela de erro.
5. Troca para Aché no mobile: saudável. Análise recebe brandId=ache; a geração anterior não permanece como se fosse da nova marca.
6. Conteúdo mobile: saudável. Texto legível, sem overflow horizontal, identificação da marca e fallback editorial.
7. Todas as fontes falham: saudável. Zero cards inventados, explicação e botão de nova tentativa; status por fonte.
8. Fonte responde sem sinais: saudável. Estado vazio distinto de falha.
9. Erro HTTP: saudável. Mensagem recuperável, nova tentativa e ausência de overlay Next.
10. Busca visual vazia/indisponível: saudável. Direção permanece; estado da busca é local à seção.
11. Recuperação de geração: saudável na UI simulada; recuperação real entre instâncias de armazenamento local verificada em teste.
12. Busca manual: saudável. Requisição registrada com brand=share&q=trabalho; retorno ao radar disponível.

## Ajustes feitos durante a auditoria

- Peso do score rotulado como peso aplicado, pois métricas ausentes redistribuem os pesos.
- Origens identificáveis substituem alegação de fontes independentes.
- Datas de tentativa e de coleta distinguem indisponibilidade de atualização bem-sucedida.
- Contagem de buscas do RSS aceita separadores de milhar.
- Evidências preservadas também no texto copiado, incluindo URLs.
- Requisições da interface têm timeout e abort ao trocar contexto.
- Ordem de leitura das nove seções preservada no mobile e no DOM.

## Acessibilidade e limitações

Rótulos de formulário, botões nativos, headings, aria-live, aria-busy, foco no detalhe e retorno ao card revisados em código/DOM.
Sem overflow em 390px. Lista de erros de página do agent-browser vazia. Não houve overlay de erro.
Avisos locais do logo Next/Image e de ausência de NEXTAUTH_SECRET durante teste sem credenciais não bloquearam os fluxos; o build passou.
Não houve certificação WCAG, teste completo com leitor de tela, contraste automatizado ou sessão autenticada de produção.

## Capturas inspecionadas

As capturas ficam em tmp/mkt-scout-qa no worktree, ignoradas pelo Git. Cada arquivo foi aberto e inspecionado.
Elas mostram dados sintéticos explicitamente rotulados para teste.

### 1. Radar desktop

![Radar desktop](../tmp/mkt-scout-qa/01-desktop-radar.png)

### 2. Evidências e contexto

![Detalhe](../tmp/mkt-scout-qa/02-detail.png)

### 3. Conteúdo e 4. direção visual

![Conteúdo](../tmp/mkt-scout-qa/03-content.png)
![Direção visual](../tmp/mkt-scout-qa/04-visual.png)

### 5. Detalhe mobile e 6. conteúdo para Aché

![Detalhe mobile](../tmp/mkt-scout-qa/05-mobile-detail.png)
![Conteúdo mobile](../tmp/mkt-scout-qa/06-mobile-content.png)

### 7. Falha total, 8. vazio e 9. erro HTTP

![Falha das fontes](../tmp/mkt-scout-qa/07-all-failed-mobile.png)
![Vazio](../tmp/mkt-scout-qa/08-empty-mobile.png)
![Erro HTTP](../tmp/mkt-scout-qa/09-http-error-mobile.png)

### 10. Fallback visual, 11. recuperação e 12. busca

![Fallback visual](../tmp/mkt-scout-qa/10-visual-fallback.png)
![Recuperação](../tmp/mkt-scout-qa/11-saved-generation.png)
![Busca manual](../tmp/mkt-scout-qa/12-manual-search.png)
