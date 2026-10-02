import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DecisionMakerResult, DecisionMakerSearchInput, HuntingCompany, HuntingPerson } from "@/lib/decision-makers/search";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Actor = { id: string; name?: string | null; email?: string | null };

export function b2bQueryHash(input: DecisionMakerSearchInput) {
  const normalized = canonicalize({ ...input, forceRefresh: false });
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function findReusableB2BSearch(input: DecisionMakerSearchInput) {
  const queryHash = b2bQueryHash(input);
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  return getPrisma().b2BWorkspaceSearch.findFirst({
    // Reused snapshots must not renew the age of the external collection.
    where: { queryHash, reusedFromSearchId: null, updatedAt: { gte: cutoff } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function persistB2BWorkspaceSearch(input: {
  actor: Actor;
  searchInput: DecisionMakerSearchInput;
  result: DecisionMakerResult;
  reusedFromSearchId?: string;
}) {
  const actorName = input.actor.name || input.actor.email || "Usuário";
  const queryHash = b2bQueryHash(input.searchInput);
  const title = buildSearchTitle(input.searchInput);
  const resultCount = input.result.mode === "companies" ? input.result.companies.length : input.result.people.length;

  return getPrisma().$transaction(async (tx) => {
    const search = await tx.b2BWorkspaceSearch.create({
      data: {
        ownerId: input.actor.id,
        ownerName: actorName,
        mode: input.result.mode,
        title,
        businessUnitId: input.searchInput.businessUnitId,
        objective: input.searchInput.objective,
        queryHash,
        input: input.searchInput as unknown as Prisma.InputJsonValue,
        resultSnapshot: input.result as unknown as Prisma.InputJsonValue,
        resultCount,
        reusedFromSearchId: input.reusedFromSearchId || null,
      },
    });

    const leadMeta = new Map<string, { id: string; firstSeenByName: string }>();
    const all = input.result.mode === "companies"
      ? input.result.companies.map((item) => ({ kind: "company" as const, item }))
      : input.result.people.map((item) => ({ kind: "person" as const, item }));

    for (const entry of all) {
      const company = entry.kind === "company" ? entry.item as HuntingCompany : null;
      const person = entry.kind === "person" ? entry.item as HuntingPerson : null;
      const key = company ? companyLeadKey(company) : personLeadKey(person!);
      const existing = await tx.b2BLead.findUnique({ where: { leadKey: key } });
      const item = company ?? person!;
      const commonData = {
        name: item.name,
        companyName: person ? person.company : company!.name,
        title: person ? person.title : null,
        linkedinUrl: item.linkedinUrl || null,
        domain: company?.domain || null,
        website: company?.website || null,
        location: item.location || null,
        payload: item as unknown as Prisma.InputJsonValue,
        lastSeenAt: new Date(),
      };

      const lead = existing
        ? await tx.b2BLead.update({
            where: { id: existing.id },
            data: commonData,
          })
        : await tx.b2BLead.create({
            data: {
              leadKey: key,
              kind: entry.kind,
              ...commonData,
              firstSeenById: input.actor.id,
              firstSeenByName: actorName,
              firstSeenSearchId: search.id,
            },
          });

      await tx.b2BSearchLead.upsert({
        where: { searchId_leadId: { searchId: search.id, leadId: lead.id } },
        create: { searchId: search.id, leadId: lead.id },
        update: {},
      });
      leadMeta.set(key, { id: lead.id, firstSeenByName: lead.firstSeenByName });
    }

    const annotated: DecisionMakerResult = {
      ...input.result,
      workspaceSearchId: search.id,
      workspaceOwnerName: actorName,
      persistentCache: Boolean(input.reusedFromSearchId),
      reusedFromSearchId: input.reusedFromSearchId,
      companies: input.result.companies.map((company) => {
        const meta = leadMeta.get(companyLeadKey(company));
        return meta ? { ...company, workspaceLeadId: meta.id, firstSeenByName: meta.firstSeenByName } : company;
      }),
      people: input.result.people.map((person) => {
        const meta = leadMeta.get(personLeadKey(person));
        return meta ? { ...person, workspaceLeadId: meta.id, firstSeenByName: meta.firstSeenByName } : person;
      }),
    };

    await tx.b2BWorkspaceSearch.update({
      where: { id: search.id },
      data: { resultSnapshot: annotated as unknown as Prisma.InputJsonValue },
    });

    return annotated;
  });
}

export async function listB2BWorkspace(actorId: string) {
  const [searches, leads, lists] = await Promise.all([
    getPrisma().b2BWorkspaceSearch.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    getPrisma().b2BLead.findMany({
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    getPrisma().b2BLeadList.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true } } },
      take: 100,
    }),
  ]);

  return {
    searches: searches.map((search) => ({
      id: search.id,
      title: search.title,
      mode: search.mode,
      ownerId: search.ownerId,
      ownerName: search.ownerName,
      mine: search.ownerId === actorId,
      resultCount: search.resultCount,
      reused: Boolean(search.reusedFromSearchId),
      updatedAt: search.updatedAt.toISOString(),
    })),
    leads: leads.map((lead) => ({
      id: lead.id,
      kind: lead.kind,
      name: lead.name,
      companyName: lead.companyName,
      title: lead.title,
      linkedinUrl: lead.linkedinUrl,
      domain: lead.domain,
      website: lead.website,
      location: lead.location,
      firstSeenByName: lead.firstSeenByName,
      mine: lead.firstSeenById === actorId,
      updatedAt: lead.updatedAt.toISOString(),
      payload: lead.payload,
    })),
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      ownerId: list.ownerId,
      ownerName: list.ownerName,
      mine: list.ownerId === actorId,
      shared: list.shared,
      itemCount: list._count.items,
      updatedAt: list.updatedAt.toISOString(),
    })),
  };
}

export async function getB2BWorkspaceSearch(id: string) {
  const search = await getPrisma().b2BWorkspaceSearch.findUnique({ where: { id } });
  if (!search) return null;
  return {
    id: search.id,
    title: search.title,
    ownerId: search.ownerId,
    ownerName: search.ownerName,
    input: search.input as unknown as DecisionMakerSearchInput,
    result: search.resultSnapshot as unknown as DecisionMakerResult,
  };
}

export async function deleteOwnedB2BSearch(id: string, ownerId: string) {
  const found = await getPrisma().b2BWorkspaceSearch.findFirst({ where: { id, ownerId }, select: { id: true, title: true } });
  if (!found) return null;
  await getPrisma().b2BWorkspaceSearch.delete({ where: { id } });
  return found;
}

export async function createB2BLeadList(input: { actor: Actor; name: string }) {
  return getPrisma().b2BLeadList.create({
    data: {
      name: input.name.trim(),
      ownerId: input.actor.id,
      ownerName: input.actor.name || input.actor.email || "Usuário",
      shared: true,
    },
  });
}

export async function addB2BLeadToList(input: { actor: Actor; listId: string; leadId: string }) {
  const list = await getPrisma().b2BLeadList.findUnique({ where: { id: input.listId } });
  if (!list || !list.shared) return null;
  const lead = await getPrisma().b2BLead.findUnique({ where: { id: input.leadId } });
  if (!lead) return null;

  return getPrisma().b2BLeadListItem.upsert({
    where: { listId_leadId: { listId: input.listId, leadId: input.leadId } },
    create: {
      listId: input.listId,
      leadId: input.leadId,
      addedById: input.actor.id,
      addedByName: input.actor.name || input.actor.email || "Usuário",
    },
    update: {},
  });
}

export async function getB2BLeadList(id: string) {
  const list = await getPrisma().b2BLeadList.findUnique({
    where: { id },
    include: { items: { include: { lead: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!list) return null;
  return {
    id: list.id,
    name: list.name,
    ownerId: list.ownerId,
    ownerName: list.ownerName,
    items: list.items.map((item) => ({
      id: item.id,
      addedByName: item.addedByName,
      createdAt: item.createdAt.toISOString(),
      lead: {
        id: item.lead.id,
        kind: item.lead.kind,
        name: item.lead.name,
        companyName: item.lead.companyName,
        title: item.lead.title,
        linkedinUrl: item.lead.linkedinUrl,
        domain: item.lead.domain,
        website: item.lead.website,
        location: item.lead.location,
        firstSeenByName: item.lead.firstSeenByName,
        payload: item.lead.payload,
      },
    })),
  };
}

function buildSearchTitle(input: DecisionMakerSearchInput) {
  if (input.mode === "companies") {
    const target = [...input.filters.industries, ...input.filters.keywords, ...input.filters.domains].slice(0, 2).join(" · ");
    const region = [...input.filters.states, ...input.filters.cityPostalCodes].slice(0, 2).join(", ");
    return [target || "Busca de empresas", region].filter(Boolean).join(" | ");
  }
  const companies = input.filters.companyNames.slice(0, 2).join(", ");
  const roles = input.filters.roles.slice(0, 2).join(", ");
  return [companies || "Busca de decisores", roles].filter(Boolean).join(" | ");
}

function companyLeadKey(company: HuntingCompany) {
  return `company:${normalize(company.linkedinUrl || company.domain || company.name)}`;
}

function personLeadKey(person: HuntingPerson) {
  return `person:${normalize(person.linkedinUrl || [person.name, person.company, person.title].join("|"))}`;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").replace(/\/$/, "").trim();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const next = value.map(canonicalize);
    return next.every((item) => typeof item === "string") ? [...next].sort() : next;
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
}
