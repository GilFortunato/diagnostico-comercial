import type { ReactNode } from "react";
import { Document, Font, Link as PdfLink, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BridgeOpportunity, ThemeAlignment } from "@/lib/diagnostics/authority";
import type { AuthorityPlanAction } from "@/lib/diagnostics/authorityPlan";
import { buildAuthorityReportViewModel, type AuthorityReportSnapshot } from "@/lib/reports/authorityReportModel";

const colors = {
  green950: "#003f2e",
  green800: "#006d46",
  green700: "#008a4d",
  lime: "#9cff00",
  mint: "#dff9e5",
  ink: "#08251d",
  muted: "#5f6f68",
  line: "#dfe8dc",
  paper: "#f6f8f3",
  white: "#ffffff",
};

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 62,
    paddingBottom: 54,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.45,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  cover: {
    padding: 54,
    fontFamily: "Helvetica",
    color: colors.white,
    backgroundColor: colors.green950,
  },
  coverWordmark: { fontFamily: "Times-Bold", fontSize: 38, lineHeight: 1, color: colors.white },
  coverAi: { marginLeft: 8, marginBottom: 4, fontSize: 8, fontFamily: "Helvetica-Bold", color: colors.lime },
  coverRule: { marginTop: 28, width: 150, height: 5, backgroundColor: colors.lime },
  coverEyebrow: { marginTop: 102, fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1.4, color: colors.lime },
  coverTitle: { marginTop: 16, maxWidth: 430, fontSize: 31, lineHeight: 1.08, fontFamily: "Helvetica-Bold" },
  coverMeta: { marginTop: 42, paddingTop: 18, borderTopWidth: 1, borderTopColor: "#3a725f" },
  coverMetaLabel: { marginTop: 10, fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 1, color: "#b8d4ca" },
  coverMetaValue: { marginTop: 3, fontSize: 11, color: colors.white },
  coverFooter: { position: "absolute", left: 54, right: 54, bottom: 40, flexDirection: "row", justifyContent: "space-between", color: "#b8d4ca", fontSize: 8 },
  header: { position: "absolute", top: 24, left: 46, right: 46, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerBrand: { flexDirection: "row", alignItems: "flex-end" },
  headerWordmark: { fontFamily: "Times-Bold", fontSize: 17, lineHeight: 1, color: colors.green950 },
  headerAi: { marginLeft: 4, marginBottom: 1, fontSize: 5.5, fontFamily: "Helvetica-Bold", color: colors.green700 },
  headerTitle: { fontSize: 7.5, color: colors.muted },
  footer: { position: "absolute", left: 46, right: 46, bottom: 22, paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: colors.muted },
  eyebrow: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, color: colors.green800 },
  pageTitle: { marginTop: 8, fontSize: 24, lineHeight: 1.1, fontFamily: "Helvetica-Bold", color: colors.green950 },
  pageIntro: { marginTop: 10, maxWidth: 440, fontSize: 10.5, lineHeight: 1.55, color: colors.muted },
  section: { marginTop: 18 },
  sectionTitle: { paddingBottom: 7, borderBottomWidth: 1.5, borderBottomColor: colors.green950, fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1, color: colors.green950 },
  paragraph: { marginTop: 10, fontSize: 10.5, lineHeight: 1.55, color: colors.ink },
  scoreComposition: { marginTop: 25, flexDirection: "row", alignItems: "stretch" },
  mainScore: { width: "46%", paddingRight: 24, borderRightWidth: 1, borderRightColor: colors.line },
  mainScoreValue: { fontSize: 64, lineHeight: 0.9, fontFamily: "Helvetica-Bold", color: colors.green950 },
  mainScoreScale: { marginTop: 5, fontSize: 12, color: colors.muted },
  mainScoreLabel: { marginTop: 17, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.1, color: colors.green800 },
  secondaryScores: { width: "54%", paddingLeft: 24, justifyContent: "space-between" },
  secondaryScore: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  secondaryScoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  secondaryScoreLabel: { width: "74%", fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, color: colors.muted },
  secondaryScoreValue: { fontSize: 20, fontFamily: "Helvetica-Bold", color: colors.green950 },
  scoreTrack: { marginTop: 6, height: 3, backgroundColor: colors.line },
  scoreFill: { height: 3, backgroundColor: colors.green700 },
  signalGrid: { marginTop: 4, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  signal: { width: "48%", marginTop: 14, paddingTop: 9, borderTopWidth: 2, borderTopColor: colors.lime },
  signalLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, color: colors.green800 },
  signalValue: { marginTop: 5, fontSize: 9.5, lineHeight: 1.45 },
  profileRows: { marginTop: 5, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start" },
  profileRow: { width: "48%", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.line },
  profileLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, color: colors.muted },
  profileValue: { marginTop: 2, fontSize: 8, lineHeight: 1.3, color: colors.ink },
  dimensionGrid: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start" },
  dimension: { width: "48%", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.line },
  dimensionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  dimensionLabel: { width: "75%", fontSize: 9, fontFamily: "Helvetica-Bold", color: colors.green950 },
  dimensionScore: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: colors.green800 },
  dimensionRationale: { marginTop: 4, fontSize: 7.5, lineHeight: 1.35, color: colors.muted },
  dimensionEvidence: { marginTop: 3, fontSize: 7, lineHeight: 1.35, color: colors.ink },
  evidenceItem: { marginTop: 15, paddingLeft: 13, borderLeftWidth: 3, borderLeftColor: colors.green700 },
  evidenceHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  evidenceLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: colors.green950 },
  evidenceStatus: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: colors.green800 },
  evidenceFoundLabel: { marginTop: 8, fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, color: colors.muted },
  evidenceValue: { marginTop: 3, fontSize: 9.5, lineHeight: 1.5 },
  evidenceEmpty: { marginTop: 3, fontSize: 9.5, color: colors.muted },
  alignmentHeader: { marginTop: 12, flexDirection: "row", paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: colors.green950 },
  alignmentRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  alignmentTheme: { width: "31%", fontFamily: "Helvetica-Bold" },
  alignmentSignal: { width: "13%", textAlign: "center" },
  alignmentScore: { width: "13%", textAlign: "center", fontFamily: "Helvetica-Bold" },
  alignmentReading: { width: "43%", paddingLeft: 10, color: colors.muted },
  tableHeader: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, color: colors.muted },
  bridgeGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start" },
  bridge: { width: "48%", marginTop: 13, paddingTop: 9, borderTopWidth: 2, borderTopColor: colors.lime },
  bridgeNumber: { fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.green800 },
  bridgeTitle: { marginTop: 3, fontSize: 10.5, lineHeight: 1.2, fontFamily: "Helvetica-Bold", color: colors.green950 },
  bridgeDescription: { marginTop: 4, fontSize: 7.8, lineHeight: 1.35, color: colors.muted },
  bridgeColumns: { marginTop: 6, flexDirection: "row", justifyContent: "space-between" },
  bridgeColumn: { width: "48%" },
  detailLabel: { marginTop: 4, fontSize: 6.2, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, color: colors.green800 },
  detailValue: { marginTop: 1, fontSize: 7.2, lineHeight: 1.3 },
  numberedItem: { marginTop: 8, flexDirection: "row" },
  itemNumber: { width: 27, fontSize: 13, fontFamily: "Helvetica-Bold", color: colors.green700 },
  itemBody: { flex: 1, paddingTop: 1, fontSize: 8.7, lineHeight: 1.4 },
  actionBand: { marginTop: 16, padding: 15, backgroundColor: colors.green950, color: colors.white },
  actionEyebrow: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, color: colors.lime },
  actionTitle: { marginTop: 6, fontSize: 14, lineHeight: 1.2, fontFamily: "Helvetica-Bold" },
  actionText: { marginTop: 5, fontSize: 8.2, lineHeight: 1.4, color: "#d8e6e1" },
  planGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start" },
  week: { width: "48%", marginTop: 10 },
  weekHeading: { paddingBottom: 7, borderBottomWidth: 1.5, borderBottomColor: colors.green950, flexDirection: "row", justifyContent: "space-between" },
  weekTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: colors.green950 },
  weekRange: { fontSize: 6.5, color: colors.muted },
  planAction: { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row" },
  planDay: { width: 32, fontSize: 6.7, fontFamily: "Helvetica-Bold", color: colors.green800 },
  planContent: { flex: 1 },
  planTitle: { fontSize: 7.6, fontFamily: "Helvetica-Bold" },
  planText: { marginTop: 2, fontSize: 6.8, lineHeight: 1.3, color: colors.muted },
  territoryList: { marginTop: 12, flexDirection: "row", flexWrap: "wrap" },
  territory: { marginRight: 7, marginBottom: 7, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: colors.paper, fontSize: 8.5, color: colors.green950 },
  source: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  sourceTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: colors.green950 },
  sourceMeta: { marginTop: 3, fontSize: 7.5, color: colors.green800 },
  sourceNotes: { marginTop: 2, fontSize: 7.6, lineHeight: 1.3, color: colors.muted },
  methodology: { marginTop: 14, padding: 12, backgroundColor: colors.paper },
  closing: { marginTop: 10, paddingTop: 9, borderTopWidth: 3, borderTopColor: colors.lime },
  closingTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: colors.green950 },
  closingText: { marginTop: 5, fontSize: 8.5, lineHeight: 1.35, color: colors.ink },
  closingBrand: { marginTop: 8, fontFamily: "Times-Bold", fontSize: 17, color: colors.green950 },
  closingTagline: { marginTop: 2, maxWidth: 310, fontSize: 7.5, lineHeight: 1.3, color: colors.muted },
});

export function AuthorityReportDocument({ snapshot }: { snapshot: AuthorityReportSnapshot }) {
  const report = buildAuthorityReportViewModel(snapshot);
  const dateLabel = formatDate(report.createdAt);
  const profileRows = [
    report.subjectName ? { label: "Nome", value: report.subjectName } : null,
    report.headline ? { label: "Headline", value: report.headline } : null,
    report.profileUrl ? { label: "LinkedIn", value: report.profileUrl, link: true } : null,
    { label: "Business Unit", value: report.businessUnitName },
    report.objective ? { label: "Objetivo comercial", value: report.objective } : null,
    { label: "Data da análise", value: dateLabel },
  ].filter((row): row is { label: string; value: string; link?: boolean } => Boolean(row));

  return (
    <Document title={`Relatório executivo de autoridade - ${report.subjectName ?? report.businessUnitName}`} author="Share AI" subject="Diagnóstico de posicionamento e autoridade no LinkedIn">
      <Page size="A4" style={styles.cover}>
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={styles.coverWordmark}>share</Text>
          <Text style={styles.coverAi}>AI</Text>
        </View>
        <View style={styles.coverRule} />
        <Text style={styles.coverEyebrow}>RELATÓRIO EXECUTIVO</Text>
        <Text style={styles.coverTitle}>Diagnóstico de Posicionamento e Autoridade no LinkedIn</Text>
        <View style={styles.coverMeta}>
          {report.subjectName ? <CoverMeta label="PERFIL ANALISADO" value={report.subjectName} /> : null}
          <CoverMeta label="BUSINESS UNIT" value={report.businessUnitName} />
          <CoverMeta label="DATA" value={dateLabel} />
        </View>
        <View style={styles.coverFooter}>
          <Text>Share AI</Text>
          <Text>Authority Selling Assessment</Text>
        </View>
      </Page>

      <ReportPage title="Resumo executivo" intro="Uma leitura direta dos indicadores e das prioridades registradas no diagnóstico.">
        <View style={styles.scoreComposition}>
          <View style={styles.mainScore}>
            <Text style={styles.mainScoreValue}>{report.scores.authority}</Text>
            <Text style={styles.mainScoreScale}>/100</Text>
            <Text style={styles.mainScoreLabel}>AUTHORITY SELLING SCORE</Text>
          </View>
          <View style={styles.secondaryScores}>
            <SecondaryScore label="ADERÊNCIA À BU" value={report.scores.businessUnitAffinity} />
            <SecondaryScore label="POTENCIAL DE ATIVAÇÃO" value={report.scores.activationPotential} />
          </View>
        </View>
        {report.executiveOpinion ? (
          <Section title="Parecer executivo">
            <Text style={styles.paragraph}>{report.executiveOpinion}</Text>
          </Section>
        ) : null}
        {report.executiveSignals.length ? (
          <Section title="O que este diagnóstico indica">
            <View style={styles.signalGrid}>
              {report.executiveSignals.map((signal) => (
                <View key={signal.label} style={styles.signal} wrap={false}>
                  <Text style={styles.signalLabel}>{signal.label.toUpperCase()}</Text>
                  <Text style={styles.signalValue}>{signal.value}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}
        <Section title="Perfil analisado">
          <View style={styles.profileRows}>
            {profileRows.map((row) => (
              <View key={row.label} style={styles.profileRow} wrap={false}>
                <Text style={styles.profileLabel}>{row.label.toUpperCase()}</Text>
                {row.link ? <PdfLink src={row.value} style={styles.profileValue}>{row.value}</PdfLink> : <Text style={styles.profileValue}>{row.value}</Text>}
              </View>
            ))}
          </View>
        </Section>
      </ReportPage>

      {report.dimensions.length ? (
        <ReportPage title="Dimensões de autoridade" intro="Os scores abaixo reproduzem exatamente as dimensões registradas no diagnóstico, sem recálculo na exportação.">
          <View style={styles.dimensionGrid}>
            {report.dimensions.map((dimension) => (
              <View key={dimension.label} style={styles.dimension} wrap={false}>
                <View style={styles.dimensionTop}>
                  <Text style={styles.dimensionLabel}>{dimension.label}</Text>
                  <Text style={styles.dimensionScore}>{dimension.score}/100</Text>
                </View>
                <View style={styles.scoreTrack}><View style={[styles.scoreFill, { width: `${dimension.score}%` }]} /></View>
                <Text style={styles.dimensionRationale}>{dimension.rationale}</Text>
                {dimension.evidence[0] ? <Text style={styles.dimensionEvidence}>Evidência principal: {dimension.evidence[0]}</Text> : null}
              </View>
            ))}
          </View>
        </ReportPage>
      ) : null}

      {report.profileEvidence.length ? (
        <ReportPage title="O que encontramos no perfil" intro="Evidências disponíveis no momento da análise. Ausência de dados é apresentada como não avaliada, nunca como avaliação negativa.">
          <View style={styles.section}>
            {report.profileEvidence.map((item) => (
              <View key={item.label} style={styles.evidenceItem} wrap={false}>
                <View style={styles.evidenceHeading}>
                  <Text style={styles.evidenceLabel}>{item.label}</Text>
                  <Text style={styles.evidenceStatus}>{item.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.evidenceFoundLabel}>ENCONTRADO</Text>
                <Text style={item.value ? styles.evidenceValue : styles.evidenceEmpty}>{item.value ?? "Dados insuficientes para esta leitura."}</Text>
                <Text style={styles.sourceMeta}>Fonte considerada: {item.source}</Text>
              </View>
            ))}
          </View>
        </ReportPage>
      ) : null}

      {report.themeAlignment.length || report.bridges.length ? (
        <ReportPage title={`Você × ${report.businessUnitName}`} intro="A conexão com a Business Unit é tratada como contexto comercial, sem substituir a autoridade pessoal.">
          {report.themeAlignment.length ? <ThemeAlignmentTable items={report.themeAlignment} /> : null}
          {report.bridges.length ? (
            <Section title="Pontes de autoridade">
              <View style={styles.bridgeGrid}>
                {report.bridges.map((bridge, index) => <Bridge key={bridge.id} bridge={bridge} index={index} />)}
              </View>
            </Section>
          ) : null}
        </ReportPage>
      ) : null}

      {report.strengths.length || report.gaps.length || report.nextBestAction ? (
        <ReportPage title="Prioridades de evolução" intro="Forças, lacunas e ações já registradas no diagnóstico, organizadas para decisão executiva.">
          {report.strengths.length ? <NumberedSection title="Principais forças" items={report.strengths} /> : null}
          {report.gaps.length ? <NumberedSection title="Oportunidades de evolução" items={report.gaps} /> : null}
          {report.nextBestAction ? (
            <View style={styles.actionBand} wrap={false}>
              <Text style={styles.actionEyebrow}>PRÓXIMA MELHOR AÇÃO</Text>
              <Text style={styles.actionTitle}>{report.nextBestAction.priority}</Text>
              {report.nextBestAction.why ? <Text style={styles.actionText}>Por quê: {report.nextBestAction.why}</Text> : null}
              {report.nextBestAction.actions.map((action) => <Text key={action} style={styles.actionText}>• {action}</Text>)}
            </View>
          ) : null}
          {report.recommendations.length ? <NumberedSection title="Recomendações registradas" items={report.recommendations} /> : null}
        </ReportPage>
      ) : null}

      {report.plan?.actions?.length ? (
        <ReportPage title="Plano de evolução - 30 dias" intro={report.plan.summary}>
          <View style={styles.planGrid}>
            {groupPlanActions(report.plan.actions).map((week, index) => (
              <View key={week.label} style={styles.week}>
                <View style={styles.weekHeading} wrap={false}>
                  <Text style={styles.weekTitle}>SEMANA {index + 1} · {week.label}</Text>
                  <Text style={styles.weekRange}>{week.range}</Text>
                </View>
                {week.actions.map((action) => <PlanAction key={action.day} action={action} />)}
              </View>
            ))}
          </View>
        </ReportPage>
      ) : null}

      <ReportPage title="Direção e fontes" intro="Territórios, referências e limites considerados na leitura deste momento.">
        {report.territories.length || report.themes.length ? (
          <Section title="Territórios de autoridade">
            <View style={styles.territoryList}>
              {[...new Set([...report.territories, ...report.themes])].slice(0, 12).map((territory) => <Text key={territory} style={styles.territory}>{territory}</Text>)}
            </View>
          </Section>
        ) : null}
        {report.sources.length ? (
          <Section title="Fontes consideradas">
            {report.sources.map((source, index) => (
              <View key={`${source.title}-${index}`} style={styles.source} wrap={false}>
                <Text style={styles.sourceTitle}>{source.title}</Text>
                <Text style={styles.sourceMeta}>{source.status}</Text>
                {source.notes ? <Text style={styles.sourceNotes}>{source.notes}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}
        <View style={styles.methodology} wrap={false}>
          <Text style={styles.sectionTitle}>SOBRE ESTE DIAGNÓSTICO</Text>
          <Text style={styles.paragraph}>Este diagnóstico considera informações disponíveis no perfil analisado, contexto comercial informado e metodologia de autoridade e ativação da Share AI.</Text>
          <Text style={styles.paragraph}>As recomendações representam uma leitura estratégica do momento analisado e devem ser consideradas em conjunto com contexto profissional, objetivos e evolução do perfil.</Text>
        </View>
        <View style={styles.closing} wrap={false}>
          <Text style={styles.eyebrow}>PRÓXIMO MOVIMENTO</Text>
          <Text style={styles.closingTitle}>Transformar leitura em ação.</Text>
          {report.nextBestAction ? <Text style={styles.closingText}>{report.nextBestAction.priority}</Text> : null}
          <Text style={styles.closingBrand}>share</Text>
          <Text style={styles.closingTagline}>Inteligência aplicada a posicionamento, relacionamento e Social Selling.</Text>
        </View>
      </ReportPage>
    </Document>
  );
}

function ReportPage({ title, intro, children }: { title: string; intro?: string | null; children: ReactNode }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <ReportHeader />
      <Text style={styles.eyebrow}>SHARE AI · EXECUTIVE ASSESSMENT</Text>
      <Text style={styles.pageTitle}>{title}</Text>
      {intro ? <Text style={styles.pageIntro}>{intro}</Text> : null}
      {children}
      <ReportFooter />
    </Page>
  );
}

function ReportHeader() {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerBrand}>
        <Text style={styles.headerWordmark}>share</Text>
        <Text style={styles.headerAi}>AI</Text>
      </View>
      <Text style={styles.headerTitle}>Diagnóstico de Autoridade</Text>
    </View>
  );
}

function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>Share AI</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function CoverMeta({ label, value }: { label: string; value: string }) {
  return <View wrap={false}><Text style={styles.coverMetaLabel}>{label}</Text><Text style={styles.coverMetaValue}>{value}</Text></View>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section} minPresenceAhead={60}><Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>{children}</View>;
}

function SecondaryScore({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.secondaryScore} wrap={false}>
      <View style={styles.secondaryScoreRow}><Text style={styles.secondaryScoreLabel}>{label}</Text><Text style={styles.secondaryScoreValue}>{value}</Text></View>
      <View style={styles.scoreTrack}><View style={[styles.scoreFill, { width: `${value}%` }]} /></View>
    </View>
  );
}

function ThemeAlignmentTable({ items }: { items: ThemeAlignment[] }) {
  return (
    <Section title="Leitura de aderência">
      <View style={styles.alignmentHeader} fixed>
        <Text style={[styles.alignmentTheme, styles.tableHeader]}>TEMA</Text>
        <Text style={[styles.alignmentSignal, styles.tableHeader]}>VOCÊ</Text>
        <Text style={[styles.alignmentSignal, styles.tableHeader]}>BU</Text>
        <Text style={[styles.alignmentScore, styles.tableHeader]}>SCORE</Text>
        <Text style={[styles.alignmentReading, styles.tableHeader]}>LEITURA</Text>
      </View>
      {items.map((item) => (
        <View key={item.theme} style={styles.alignmentRow} wrap={false}>
          <Text style={styles.alignmentTheme}>{item.theme}</Text>
          <Text style={styles.alignmentSignal}>{item.personSignal}</Text>
          <Text style={styles.alignmentSignal}>{item.businessUnitSignal}</Text>
          <Text style={styles.alignmentScore}>{item.affinity}</Text>
          <Text style={styles.alignmentReading}>{item.gap}</Text>
        </View>
      ))}
    </Section>
  );
}

function Bridge({ bridge, index }: { bridge: BridgeOpportunity; index: number }) {
  return (
    <View style={styles.bridge} wrap={false}>
      <Text style={styles.bridgeNumber}>{String(index + 1).padStart(2, "0")}</Text>
      <Text style={styles.bridgeTitle}>{bridge.title}</Text>
      <Text style={styles.bridgeDescription}>{bridge.description}</Text>
      <View style={styles.bridgeColumns}>
        <View style={styles.bridgeColumn}>
          <Detail label="Sua autoridade" value={bridge.whyItWorks.personalAuthority} />
          <Detail label="Conexão com a BU" value={bridge.whyItWorks.businessUnitConnection} />
          <Detail label="Persona" value={bridge.whyItWorks.personaInterest} />
        </View>
        <View style={styles.bridgeColumn}>
          <Detail label="Potencial" value={`${bridge.conversationPotential} · aderência pessoal ${bridge.personAffinity}/100`} />
          <Detail label="Risco de parecer publicidade" value={`${bridge.advertisingRisk} · ${bridge.whyItWorks.risk}`} />
          {bridge.nextActions[0] ? <Detail label="Próxima ação" value={bridge.nextActions[0]} /> : null}
        </View>
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View><Text style={styles.detailLabel}>{label.toUpperCase()}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function NumberedSection({ title, items }: { title: string; items: string[] }) {
  return (
    <Section title={title}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.numberedItem} wrap={false}>
          <Text style={styles.itemNumber}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={styles.itemBody}>{item}</Text>
        </View>
      ))}
    </Section>
  );
}

function PlanAction({ action }: { action: AuthorityPlanAction }) {
  return (
    <View style={styles.planAction} wrap={false}>
      <Text style={styles.planDay}>DIA {action.day}</Text>
      <View style={styles.planContent}>
        <Text style={styles.planTitle}>{action.title}</Text>
        <Text style={styles.planText}>{action.action}</Text>
      </View>
    </View>
  );
}

function groupPlanActions(actions: AuthorityPlanAction[]) {
  const weeks = [
    { label: "Fundação", range: "Dias 1-7", actions: actions.filter((item) => item.day <= 7) },
    { label: "Autoridade", range: "Dias 8-14", actions: actions.filter((item) => item.day >= 8 && item.day <= 14) },
    { label: "Relacionamento", range: "Dias 15-21", actions: actions.filter((item) => item.day >= 15 && item.day <= 21) },
    { label: "Ativação", range: "Dias 22-30", actions: actions.filter((item) => item.day >= 22) },
  ];
  return weeks.filter((week) => week.actions.length > 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(date);
}
