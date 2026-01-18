export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // VPS Management API (Port 8081 - App updates only)
  VPS_MANAGEMENT_URL: process.env.VPS_MANAGEMENT_URL ?? "http://37.60.228.5:8081",
  VPS_MANAGEMENT_API_KEY: process.env.VPS_MANAGEMENT_API_KEY ?? "",
  // Legacy VPS API (Port 8080 - RADIUS/VPN/DHCP status)
  VPS_LEGACY_URL: process.env.VPS_MANAGEMENT_URL ?? "http://37.60.228.5:8080",
  VPS_LEGACY_SECRET: process.env.VPS_MANAGEMENT_SECRET ?? "radius_api_key_2024_secure",
};
