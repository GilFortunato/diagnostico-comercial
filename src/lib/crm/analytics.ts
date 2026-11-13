import { isActive, type ActivitySummary, type CrmFilters, type CrmRow } from "./model";

type Bucket = { label: string; value: number; secondary?: number; tertiary?: number; detail?: string };
const unique = (rows: ActivitySummary[]) => new Set(rows.map((row) => row.opportunityId));
const totals = (rows: CrmRow[], key: "proposedValue" | "soldValue") => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
const datePasses = (date: string | null, from: string, to: string) => date !== null && (!from || date >= from) && (!to || date <= to);

function monday(date: string) {
  const day = new Date(date);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function commercialMetrics(rows: CrmRow[], activities: ActivitySummary[], filters: CrmFilters, today: string) {
  const ids = new Set(rows.map((row) => row.id));
  const all = activities.filter((activity) => ids.has(activity.opportunityId) && (!filters.channel || activity.channel === filters.channel || activity.kind === "Mudança de etapa"));
  const period = all.filter((activity) => datePasses(activity.date, filters.from, filters.to));
  const of = (kind: string) => period.filter((activity) => activity.kind === kind);
  const contacts = of("Contato");
  const responses = of("Reação");
  const held = of("Reunião realizada");
  const latestUnlinkedMeetingHeld = new Map<string, string>();
  for (const item of all) {
    if (item.kind !== "Reunião realizada" || item.meetingLinked || !item.date) continue;
    if (item.date > (latestUnlinkedMeetingHeld.get(item.opportunityId) ?? "")) latestUnlinkedMeetingHeld.set(item.opportunityId, item.date);
  }
  const pendingMeetings = of("Reunião agendada").filter((item) =>
    item.date && (item.meetingLinked || item.date > (latestUnlinkedMeetingHeld.get(item.opportunityId) ?? "")));
  const upcoming = pendingMeetings.filter((a) => a.date && a.date >= today);
  const overdueMeetings = pendingMeetings.filter((a) => a.date && a.date < today);
  const active = rows.filter(isActive);
  const won = rows.filter((row) => (row.contractClosed || row.stage === "Fechado" || row.result === "Vendido") &&
    ((!filters.from && !filters.to) || datePasses(row.saleDate, filters.from, filters.to) || period.some((a) => a.opportunityId === row.id && a.stage === "Fechado")));
  const prospects = unique(contacts);
  const reacted = unique(responses);
  const met = unique(held);
  const proposed = unique(period.filter((a) => a.kind === "Proposta enviada" || a.stage === "Proposta enviada"));
  const reachedByStage = new Set(period.filter((a) => a.stage === "Fechado").map((a) => a.opportunityId));
  for (const activity of period) {
    if (activity.stage === "Primeiro contato") prospects.add(activity.opportunityId);
    if (activity.stage === "Reunião realizada") met.add(activity.opportunityId);
  }
  const hasPeriod = Boolean(filters.from || filters.to);
  if (!hasPeriod) for (const a of all) if (a.kind === "Proposta enviada") proposed.add(a.opportunityId);
  const grouped: Record<string, CrmRow[]> = Object.create(null);
  for (const row of rows) (grouped[row.segment ?? "Sem segmento"] ??= []).push(row);
  const segments = Object.entries(grouped).map(([label, items]) => ({
    label, value: items.length, secondary: items.filter((row) => prospects.has(row.id)).length,
    tertiary: items.filter((row) => met.has(row.id)).length,
  })).sort((a, b) => b.value - a.value).slice(0, 12);

  const channels = [...new Set([...contacts, ...responses].map((a) => a.channel ?? "Sem canal"))];
  const byChannel = channels.map((label) => {
    const within = (a: ActivitySummary) => (a.channel ?? "Sem canal") === label;
    const touched = unique(contacts.filter(within));
    const incoming = unique(responses.filter(within));
    const positive = unique(responses.filter((a) => within(a) && a.reaction === "Resposta positiva"));
    const repliedToContact = [...incoming].filter((id) => touched.has(id)).length;
    return { label, value: touched.size, secondary: incoming.size, tertiary: positive.size,
      detail: touched.size ? Math.round(repliedToContact / touched.size * 100) + "% dos contatados reagiram" : "Taxa sem base de contato" };
  }).sort((a, b) => b.value - a.value);

  const weeks = [...new Set([...contacts, ...responses, ...held].flatMap((a) => a.date ? [monday(a.date)] : []))].sort().slice(-16);
  const weekly = weeks.map((week) => {
    const match = (a: ActivitySummary) => Boolean(a.date && monday(a.date) === week);
    return { label: week.slice(8) + "/" + week.slice(5, 7), value: unique(contacts.filter(match)).size, secondary: unique(responses.filter(match)).size, tertiary: held.filter(match).length };
  });

  const eventNames = [...new Set(rows.flatMap((row) => [...row.events, ...(row.project ? [row.project] : [])]))];
  const eventGroups = eventNames.map((label) => {
    const matches = (row: CrmRow) => row.project === label || row.events.includes(label);
    const open = active.filter(matches);
    return { label, value: totals(open.filter((row) => row.stage !== "Negociação"), "proposedValue"), secondary: totals(open.filter((row) => row.stage === "Negociação"), "proposedValue"), tertiary: totals(won.filter(matches), "soldValue") };
  }).filter((event) => event.value || event.secondary || event.tertiary).sort((a, b) => b.value + b.secondary + b.tertiary - a.value - a.secondary - a.tertiary).slice(0, 12);

  const byOwner = [...new Set(active.map((row) => row.owner ?? "Sem responsável"))].map((label) => {
    const items = active.filter((row) => (row.owner ?? "Sem responsável") === label);
    return { label, value: items.filter((row) => row.nextActionDate && row.nextActionDate < today).length,
      secondary: items.filter((row) => row.nextActionDate === today).length, tertiary: items.filter((row) => !row.nextActionDate).length };
  }).sort((a, b) => b.value - a.value);

  const contactedCohort = [...prospects];
  const metAfterContact = contactedCohort.filter((id) => met.has(id));
  const proposedAfterMeeting = metAfterContact.filter((id) => proposed.has(id));
  const wonIds = new Set([...won.map((row) => row.id), ...reachedByStage]);
  const conversion = [
    { label: "Contatadas", value: contactedCohort.length },
    { label: "Com reunião realizada", value: metAfterContact.length },
    { label: "Com proposta enviada", value: proposedAfterMeeting.length },
    { label: "Ganhas", value: proposedAfterMeeting.filter((id) => wonIds.has(id)).length },
  ].map((item, index, items) => {
    const base = items[index - 1]?.value;
    return { ...item, detail: base ? Math.round(item.value / base * 100) + "% da etapa anterior" : undefined };
  });
  const funnel: Bucket[] = [
    { label: hasPeriod ? "Carteira atual" : "No pipeline", value: rows.length },
    { label: "Contatadas", value: prospects.size },
    { label: "Reunião realizada", value: met.size },
    { label: "Proposta enviada", value: proposed.size },
    { label: "Ganhas", value: new Set([...won.map((row) => row.id), ...reachedByStage]).size },
  ];

  return {
    total: rows.length, contacted: prospects.size, reacted: reacted.size, positive: unique(responses.filter((a) => a.reaction === "Resposta positiva")).size,
    upcoming: upcoming.length, held: held.length, proposedValue: totals(active, "proposedValue"), soldValue: totals(won, "soldValue"),
    funnel, conversion, weekly, byChannel, segments, eventGroups, byOwner,
    contactedIds: prospects, reactedIds: reacted,
    upcomingMeetings: upcoming, overdueMeetings, heldMeetings: held, activeCount: active.length,
  };
}
