import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { writeAppAuditLog } from "@/lib/audit/appAudit";
import { getCurrentHumanshipRestrictions, saveHumanshipRestrictions } from "@/lib/humanship/restrictionConfig";

const schema = z.object({
  companyGroups: z.array(z.object({
    reference: z.string().trim().min(1).max(180),
    category: z.string().trim().min(1).max(220),
    companies: z.array(z.string().trim().min(1).max(180)).min(1).max(120),
  })).max(120),
  roleReferences: z.array(z.string().trim().min(1).max(180)).min(1).max(240),
});

export async function GET() {
  const access = await authorizeModule("humanship.r1ship");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  return NextResponse.json({ restrictions: await getCurrentHumanshipRestrictions() });
}

export async function PUT(request: Request) {
  const access = await authorizeModule("humanship.admin");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revise as empresas restritas e os cargos de referência." }, { status: 400 });
  }

  const restrictions = await saveHumanshipRestrictions({
    ...parsed.data,
    updatedByName: access.user.name || access.user.email || "ADM Humanship",
  });

  await writeAppAuditLog({
    actor: access.user,
    moduleKey: "humanship",
    action: "restrictions.updated",
    entityType: "humanship-restrictions",
    entityId: restrictions.version,
    severity: "security",
    retentionDays: 30,
    metadata: {
      version: restrictions.version,
      companyGroups: restrictions.companyGroups.length,
      roleReferences: restrictions.roleReferences.length,
    },
  });

  return NextResponse.json({ restrictions });
}
