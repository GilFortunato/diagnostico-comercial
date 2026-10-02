export type HumanshipAgendaEventStatus = "draft" | "published" | "archived";
export type HumanshipAgendaEventFormat = "presencial" | "online" | "hibrido";

export type HumanshipAgendaEvent = {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  location?: string;
  format: HumanshipAgendaEventFormat;
  eventUrl?: string;
  coverUrl?: string;
  status: HumanshipAgendaEventStatus;
  featured: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};
