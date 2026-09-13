import type { ReactNode } from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { buildAuthorityReportViewModel, type AuthorityReportSnapshot } from "@/lib/reports/authorityReportModel";

const colors = {
  green950: "#003f2e",
  green800: "#006d46",
  lime: "#9cff00",
  paper: "#f6f8f3",
  line: "#dfe8dc",
  ink: "#08251d",
  muted: "#5f6f68",
  white: "#ffffff",
};

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 48, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.2, lineHeight: 1.42, color: colors.ink, backgroundColor: colors.white },
  cover: { padding: 52, fontFamily: "Helvetica", color: colors.white, backgroundColor: colors.green950 },
  brand: { fontFamily: "Times-Bold", fontSize: 34, color: colors.white },
  brandAi: { marginLeft: 6, marginBottom: 4, fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.lime },
  coverRule: { marginTop: 24, width: 150, height: 5, backgroundColor: colors.lime },
  coverEyebrow: { marginTop: 100, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, color: colors.lime },
  coverTitle: { marginTop: 14, maxWidth: 440, fontSize: 29, lineHeight: 1.08, fontFamily: "Helvetica-Bold" },
  coverMeta: { marginTop: 36, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#3a725f" },
  coverMetaLabel: { marginTop: 9, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#b8d4ca" },
  coverMetaValue: { marginTop: 2, fontSize: 10.5 },
  header: { position: "absolute", top: 22, left: 44, right: 44, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", justifyContent: "space-between" },
  headerBrand: { fontFamily: "Times-Bold", fontSize: 15, color: colors.green950 },
  headerText: { fontSize: 7, color: colors.muted },
  footer: { position: "absolute", left: 44, right: 44, bottom: 20, paddingTop: 6, borderTopWidth: 1, borderBottomColor: colors.line, flexDirection: "row", justifyContent: "space-between", fontSize: 6.8, color: colors.muted },
  eyebrow: { fontSize: 7.2, fontFamily: "Helvetica-Bold", letterSpacing: 1.1, color: colors.green800 },
  title: { marginTop: 7, fontSize: 23, lineHeight: 1.1, fontFamily: "Helvetica-Bold", color: colors.green950 },
  intro: { marginTop: 9, maxWidth: 450, fontSize: 10, lineHeight: 1.5, color: colors.muted },
  section: { marginTop: 18 },
  sectionTitle: { paddingBottom: 7, borderBottomWidth: 1.5, borderBottomColor: colors.green950, fontSize: 8.3, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, color: colors.green950 },
  paragraph: { marginTop: 9, fontSize: 9.6, lineHeight: 1.5 },
  scoreRow: { marginTop: 22, flexDirection: "row", alignItems: "stretch" },
  mainScore: { width: "42%", paddingRight: 20, borderRightWidth: 1, borderRightColor: colors.line },
  scoreValue: { fontSize: 58, lineHeight: 0.95, fontFamily: "Helvetica-Bold", color: colors.green950 },
  scoreLabel: { marginTop: 12, fontSize: 7.2, fontFamily: "Helvetica-Bold", color: colors.green800 },
  sideScores: { width: "58%", paddingLeft: 20 },
  sideCard: { marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  sideTop: { flexDirection: "row", justifyContent: "space-between" },
  sideLabel: { fontSize: 7.2, fontFamily: "Helvetica-Bold", color: colors.muted },
  sideValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: colors.green950 },
  band: { marginTop: 15, padding: 13, backgroundColor: colors.green950, color: colors.white },
  bandEyebrow: { fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.lime },
  bandTitle: { marginTop: 4, fontSize: 13, fontFamily: "Helvetica-Bold" },
  bandText: { marginTop: 4, fontSize: 8, lineHeight: 1.35, color: "#d8e6e1" },
  grid: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start" },
  card: { width: "48%", marginTop: 10, padding: 10, backgroundColor: colors.paper, borderTopWidth: 2, borderTopColor: colors.lime },
  cardLabel: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: colors.green800 },
  cardTitle: { marginTop: 3, fontSize: 10, fontFamily: "Helvetica-Bold", color: colors.green950 },
  cardText: { marginTop: 4, fontSize: 7.8, lineHeight: 1.4, color: colors.muted },
  pillar: { width: "48%", marginTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  pillarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  pillarTitle: { width: "74%", fontSize: 9, fontFamily: "Helvetica-Bold", color: colors.green950 },
  pillarScore: { fontSize: 10, fontFamily: "Helvetica-Bold", color: colors.green800 },
  pillarText: { marginTop: 4, fontSize: 7.5, lineHeight: 1.35, color: colors.muted },
  evidence: { marginTop: 3, fontSize: 7, lineHeight: 1.35 },
  item: { marginTop: 11, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  itemHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  itemTitle: { width: "76%", fontSize: 9.5, fontFamily: "Helvetica-Bold", color: colors.green950 },
  itemMeta: { fontSize: 6.8, fontFamily: "Helvetica-Bold", color: colors.green800 },
  itemText: { marginTop: 4, fontSize: 7.8, lineHeight: 1.4, color: colors.muted },
  tagWrap: { marginTop: 10, flexDirection: "row", flexWrap: "wrap" },
  tag: { marginRight: 6, marginBottom: 6, paddingVertical: 4, paddingHorizontal: 7, backgroundColor: colors.paper, fontSize: 7.5, color: colors.green950 },
  methodology: { marginTop: 14, padding: 12, backgroundColor: colors.paper },
  headlineBox: { marginTop: 9, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.lime, backgroundColor: colors.paper },
  headlineLabel: { fontSize: 6.7, fontFamily: "Helvetica-Bold", color: colors.green800 },
  headlineText: { marginTop: 3, fontSize: 8.6, lineHeight: 1.4, color: colors.green950 },
  aboutBox: { marginTop: 10, padding: 12, backgroundColor: colors.paper },
  aboutText: { fontSize: 8.1, lineHeight: 1.45, color: colors.ink },
});

export function AuthorityReportDocumentV2({ snapshot }: { snapshot: AuthorityReportSnapshot }) {
  const report = buildAuthorityReportViewModel(snapshot);
  const signaling = report.authoritySignaling;
  const kit = report.implementationKit;
  return (
    <Document title={`Diagnóstico LinkedIn V2 - ${report.subjectName}`} author="Share AI" subject="Diagnóstico de posicionamento e autoridade no LinkedIn">
      <Page size="A4" style={styles.cover}>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}><Text style={styles.brand}>share</Text><Text style={styles.brandAi}>AI</Text></View>
        <View style={styles.coverRule} />
        <Text style={styles.coverEyebrow}>RELATÓRIO EXECUTIVO · LINKEDIN-FIRST V2</Text>
        <Text style={styles.coverTitle}>Diagnóstico de Posicionamento e Autoridade no LinkedIn</Text>
        <View style={styles.coverMeta}>
          <CoverMeta label="PERFIL ANALISADO" value={report.subjectName} />
          <CoverMeta label="BUSINESS UNIT" value={report.businessUnitName} />
          <CoverMeta label="OBJETIVO" value={report.objective} />
          <CoverMeta label="DATA" value={formatDate(report.createdAt)} />
        </View>
      </Page>

      <ReportPage title="Resumo executivo" intro="A pontuação é apresentada junto da cobertura e da confiança da análise; dados ausentes permanecem não avaliados.">
        <View style={styles.scoreRow}>
          <View style={styles.mainScore}><Text style={styles.scoreValue}>{score(report.scores.authority)}</Text><Text style={styles.scoreLabel}>AUTORIDADE LINKEDIN</Text></View>
          <View style={styles.sideScores}>
            <SideScore label="BUYER ALIGNMENT" value={report.scores.businessUnitAffinity} />
            <SideScore label="POTENCIAL DE ATIVAÇÃO" value={report.scores.activationPotential} />
            <SideScore label="COBERTURA DA ANÁLISE" value={report.scoreCoverage} suffix="%" />
          </View>
        </View>
        <View style={styles.band}>
          <Text style={styles.bandEyebrow}>CLASSIFICAÇÃO · CONFIANÇA {report.scoreConfidence.toUpperCase()}</Text>
          <Text style={styles.bandTitle}>{report.classification ?? "Sem classificação"}</Text>
          {report.scoreExplanations?.authority ? <Text style={styles.bandText}>{report.scoreExplanations.authority}</Text> : null}
        </View>
        {report.executiveOpinion ? <Section title="Parecer executivo"><Text style={styles.paragraph}>{report.executiveOpinion}</Text></Section> : null}
        {report.executiveSignals.length ? <Section title="Sinais principais"><View style={styles.grid}>{report.executiveSignals.map((item) => <Card key={item.label} label={item.label} title={item.value} />)}</View></Section> : null}
      </ReportPage>

      <ReportPage title="Seis pilares da análise" intro="Os pilares abaixo substituem a fragmentação excessiva de indicadores e mostram somente o que pode ser sustentado pelos dados disponíveis.">
        <View style={styles.grid}>
          {report.dimensions.map((dimension) => (
            <View key={dimension.key} style={styles.pillar} wrap={false}>
              <View style={styles.pillarTop}><Text style={styles.pillarTitle}>{dimension.label}</Text><Text style={styles.pillarScore}>{dimension.score === null ? "Não avaliado" : `${dimension.score}/100`}</Text></View>
              <Text style={styles.pillarText}>{dimension.rationale}</Text>
              {dimension.evidence[0] ? <Text style={styles.evidence}>Evidência: {dimension.evidence[0]}</Text> : null}
            </View>
          ))}
        </View>
        <View style={styles.methodology}><Text style={styles.cardLabel}>{report.methodology.title.toUpperCase()}</Text><Text style={styles.cardText}>{report.methodology.summary}</Text></View>
      </ReportPage>

      {signaling ? (
        <ReportPage title="Autoridade construída × sinalizada" intro="Sinalização mede o que o LinkedIn torna visível. Não é tratada como percepção comprovada da audiência.">
          <View style={styles.grid}>
            <Card label="Autoridade construída" title={signaling.builtLevel} text={signaling.builtAuthority} />
            <Card label="Autoridade sinalizada" title={signaling.perceivedLevel} text={signaling.perceivedAuthority} />
            <Card label="Gap de expressão" title="Prioridade" text={signaling.expressionGap} />
          </View>
          {report.authorityMap.length ? <Section title="Territórios de autoridade">{report.authorityMap.slice(0, 5).map((item) => <View key={item.territory} style={styles.item}><View style={styles.itemHeading}><Text style={styles.itemTitle}>{item.territory}</Text><Text style={styles.itemMeta}>VISIBILIDADE {item.publicVisibility.toUpperCase()}</Text></View><Text style={styles.itemText}>{item.evidence[0] ?? "Dados insuficientes para confirmar este território."}</Text></View>)}</Section> : null}
        </ReportPage>
      ) : null}

      {report.profileEvidence.length ? (
        <ReportPage title="Evidências do perfil" intro="Cada afirmação é acompanhada da fonte e do status disponível no snapshot do LinkedIn.">
          {report.profileEvidence.map((item) => <View key={item.label} style={styles.item} wrap={false}><View style={styles.itemHeading}><Text style={styles.itemTitle}>{item.label}</Text><Text style={styles.itemMeta}>{item.status.toUpperCase()}</Text></View><Text style={styles.itemText}>{item.value ?? "Não avaliado"}</Text><Text style={styles.evidence}>Fonte: {item.source}</Text></View>)}
        </ReportPage>
      ) : null}

      {report.bridges.length || report.strategicGaps.length ? (
        <ReportPage title="Buyer Alignment e gaps" intro="A conexão com a Business Unit funciona como contexto comercial e não substitui a autoridade pessoal.">
          {report.bridges.length ? <Section title="Pontes com o buyer">{report.bridges.map((bridge) => <View key={bridge.id} style={styles.item}><View style={styles.itemHeading}><Text style={styles.itemTitle}>{bridge.title}</Text><Text style={styles.itemMeta}>{bridge.persona}</Text></View><Text style={styles.itemText}>{bridge.legitimacy}</Text><Text style={styles.evidence}>Melhor ativação: {bridge.bestActivation}</Text></View>)}</Section> : null}
          {report.strategicGaps.length ? <Section title="Gaps prioritários">{report.strategicGaps.slice(0, 5).map((gap) => <View key={gap.title} style={styles.item}><View style={styles.itemHeading}><Text style={styles.itemTitle}>{gap.title}</Text><Text style={styles.itemMeta}>{gap.priority.toUpperCase()}</Text></View><Text style={styles.itemText}>{gap.expertReading}</Text><Text style={styles.evidence}>Ação: {gap.recommendation}</Text></View>)}</Section> : null}
        </ReportPage>
      ) : null}

      <ReportPage title="Kit de implementação" intro="O diagnóstico não termina na nota: abaixo estão rascunhos e prioridades construídos a partir do LinkedIn analisado e do contexto comercial informado.">
        <Section title="Headlines testáveis">
          {kit.headlineVariants.map((item) => <View key={item.label} style={styles.headlineBox} wrap={false}><Text style={styles.headlineLabel}>{item.label.toUpperCase()}</Text><Text style={styles.headlineText}>{item.text}</Text></View>)}
        </Section>
        <Section title="Rascunho do Sobre"><View style={styles.aboutBox}><Text style={styles.aboutText}>{kit.aboutDraft}</Text></View></Section>
      </ReportPage>

      <ReportPage title="Kit de implementação · conteúdo e prova" intro="Sugestões práticas para transformar gaps em sinais de autoridade no próprio LinkedIn.">
        <Section title="Featured recomendado">{kit.featuredRecommendations.map((item, index) => <Text key={`${index}-${item}`} style={styles.itemText}>• {item}</Text>)}</Section>
        {kit.caseCandidates.length ? <Section title="Cases a desenvolver">{kit.caseCandidates.map((item, index) => <Text key={`${index}-${item}`} style={styles.itemText}>• {item}</Text>)}</Section> : null}
        <Section title="5 ideias de conteúdo">{kit.contentIdeas.map((item, index) => <Text key={`${index}-${item}`} style={styles.itemText}>• {item}</Text>)}</Section>
        <Section title="Teses de thought leadership">{kit.thoughtLeadershipTheses.map((item, index) => <Text key={`${index}-${item}`} style={styles.itemText}>• {item}</Text>)}</Section>
        {kit.priorityKeywords.length ? <Section title="Palavras-chave prioritárias"><View style={styles.tagWrap}>{kit.priorityKeywords.map((item) => <Text key={item} style={styles.tag}>{item}</Text>)}</View></Section> : null}
      </ReportPage>

      {report.plan?.actions?.length ? (
        <ReportPage title="Plano estratégico · 30 dias" intro={report.plan.summary}>
          <View style={styles.grid}>
            <Card label="Objetivo" title="Direção" text={report.plan.objective ?? report.plan.summary} />
            <Card label="Estado atual" title="Ponto de partida" text={report.plan.currentState ?? "Estado registrado no diagnóstico."} />
            <Card label="Estado desejado" title="Evolução" text={report.plan.desiredState ?? "Autoridade mais clara e conversas com contexto."} />
            <Card label="Por que agora" title="Momento" text={report.plan.whyNow ?? report.plan.summary} />
          </View>
          {report.plan.weeks?.length ? <Section title="Ciclos semanais">{report.plan.weeks.map((week) => <View key={week.week} style={styles.item}><View style={styles.itemHeading}><Text style={styles.itemTitle}>Semana {week.week} · {week.title}</Text><Text style={styles.itemMeta}>DIAS {week.dayRange[0]}–{week.dayRange[1]}</Text></View><Text style={styles.itemText}>{week.objective}</Text><Text style={styles.evidence}>{week.outcomes.join(" · ")}</Text></View>)}</Section> : null}
          {report.plan.indicators?.length ? <Section title="Indicadores"><Text style={styles.paragraph}>{report.plan.indicators.slice(0, 6).join(" · ")}</Text></Section> : null}
        </ReportPage>
      ) : null}

      <ReportPage title="Metodologia e fontes" intro="A V2 separa evidência, inferência e ausência de dados para reduzir falsa precisão.">
        <Section title="Como ler os scores"><Text style={styles.paragraph}>{report.methodology.summary}</Text>{report.methodology.pillars.map((item) => <Text key={item} style={styles.evidence}>• {item}</Text>)}</Section>
        {report.territories.length || report.themes.length ? <Section title="Territórios"><View style={styles.tagWrap}>{[...new Set([...report.territories, ...report.themes])].slice(0, 12).map((item) => <Text key={item} style={styles.tag}>{item}</Text>)}</View></Section> : null}
        {report.sources.length ? <Section title="Fontes consideradas">{report.sources.map((source, index) => <View key={`${source.title}-${index}`} style={styles.item}><View style={styles.itemHeading}><Text style={styles.itemTitle}>{source.title}</Text><Text style={styles.itemMeta}>{source.status}</Text></View>{source.notes ? <Text style={styles.itemText}>{source.notes}</Text> : null}</View>)}</Section> : null}
        <View style={styles.band}><Text style={styles.bandEyebrow}>PRÓXIMO MOVIMENTO</Text><Text style={styles.bandTitle}>{report.nextBestAction?.priority ?? "Transformar leitura em ação."}</Text>{report.nextBestAction?.why ? <Text style={styles.bandText}>{report.nextBestAction.why}</Text> : null}</View>
      </ReportPage>
    </Document>
  );
}

function ReportPage({ title, intro, children }: { title: string; intro?: string | null; children: ReactNode }) {
  return <Page size="A4" style={styles.page} wrap><View style={styles.header} fixed><Text style={styles.headerBrand}>share</Text><Text style={styles.headerText}>Diagnóstico LinkedIn V2</Text></View><Text style={styles.eyebrow}>SHARE AI · AVALIAÇÃO EXECUTIVA</Text><Text style={styles.title}>{title}</Text>{intro ? <Text style={styles.intro}>{intro}</Text> : null}{children}<View style={styles.footer} fixed><Text>Share AI</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View></Page>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section} minPresenceAhead={55}><Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>{children}</View>;
}

function CoverMeta({ label, value }: { label: string; value: string }) {
  return <View><Text style={styles.coverMetaLabel}>{label}</Text><Text style={styles.coverMetaValue}>{value}</Text></View>;
}

function Card({ label, title, text }: { label: string; title: string; text?: string }) {
  return <View style={styles.card} minPresenceAhead={55}><Text style={styles.cardLabel}>{label.toUpperCase()}</Text><Text style={styles.cardTitle}>{title}</Text>{text ? <Text style={styles.cardText}>{text}</Text> : null}</View>;
}

function SideScore({ label, value, suffix = "" }: { label: string; value: number | null; suffix?: string }) {
  return <View style={styles.sideCard}><View style={styles.sideTop}><Text style={styles.sideLabel}>{label}</Text><Text style={styles.sideValue}>{value === null ? "Não avaliado" : `${value}${suffix}`}</Text></View></View>;
}

function score(value: number | null) {
  return value === null ? "—" : String(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(date);
}
