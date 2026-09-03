import type { NextConfig } from "next";

const noStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/", headers: noStoreHeaders },
      { source: "/hr-hunting/:path*", headers: noStoreHeaders },
      { source: "/mapa-decisores/:path*", headers: noStoreHeaders },
      { source: "/perfil/:path*", headers: noStoreHeaders },
      { source: "/conteudo/:path*", headers: noStoreHeaders },
      { source: "/conectores/:path*", headers: noStoreHeaders },
      { source: "/admin/:path*", headers: noStoreHeaders },
      { source: "/api/:path*", headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
