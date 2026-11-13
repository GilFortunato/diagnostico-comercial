import "server-only";
import { Prisma } from "@prisma/client";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { CrmError } from "./service";

export const authorizeCrm = () => authorizeModule("humanship.crm");
export const crmError = (message: string, status: number) => Response.json({ error: message }, { status });

export function handleCrmError(error: unknown) {
  if (error instanceof CrmError) return crmError(error.message, error.status);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return crmError("Já existe um cadastro com esses dados. Use o registro existente.", 409);
  }
  console.error("[crm]", error instanceof Error ? error.name : "UnknownError");
  return crmError("O CRM está temporariamente indisponível.", 503);
}
