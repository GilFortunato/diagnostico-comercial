export function getAppNavigation(isAdmin: boolean) {
  return [
    { label: "Home", href: "/" },
    { label: "Cockpit", href: "/#diagnostico" },
    ...(isAdmin ? [{ label: "Admin", href: "/admin" }] : []),
    { label: "Perfil", href: "/perfil" },
  ];
}
