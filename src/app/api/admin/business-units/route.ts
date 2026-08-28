import { NextResponse } from "next/server";
import { businessUnitCatalog } from "@/lib/business-units/dna";

export async function GET() {
  return NextResponse.json({
    items: businessUnitCatalog,
    source: "seed-catalog",
    writable: false,
    notes: "Admin write operations require RBAC and database persistence before being enabled.",
  });
}
