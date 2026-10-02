export function getAppNavigation(isAdmin: boolean) {
  return [
    { label: "Home", href: "/" },
    { label: "Diagnóstico", href: "/diagnostico" },
    { label: "HR Hunting", href: "/hr-hunting" },
    { label: "B2B Hunting", href: "/mapa-decisores" },
    { label: "Humanship", href: "/humanship" },
    { label: "MKT Scout", href: "/sharetrendintelligence" },
    { label: "Gerador Whats", href: "/gerador-whats" },
    ...(isAdmin ? [{ label: "Admin", href: "/admin" }] : []),
  ];
}
