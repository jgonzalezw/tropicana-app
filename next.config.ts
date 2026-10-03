import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Probar desde el celular en la misma red: sin esto Next bloquea los recursos
  // de desarrollo pedidos desde una IP que no es localhost (solo afecta a `next dev`).
  allowedDevOrigins: ["192.168.0.2"],
};

export default nextConfig;
