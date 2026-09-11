export function getAppNavigation(isAdmin: boolean) {
  return [
    { label: "Home", href: "/" },
    { label: "Cockpit", href: "/#diagnostico" },
    { label: "Diagnóstico", href: "/#diagnostico" },
    { label: "HR Hunting", href: "/hr-hunting" },
    { label: "B2B Hunting", href: "/mapa-decisores" },
    { label: "Humanship", href: "/humanship" },
    ...(isAdmin ? [{ label: "Admin", href: "/admin" }] : []),
  ];
}
