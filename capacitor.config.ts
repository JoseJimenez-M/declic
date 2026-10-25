import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.t3noc.declic",
  appName: "Déclic",
  webDir: "dist",
  // Pin the WebView origin: IndexedDB is stored per origin, so a changed Capacitor default would orphan the data.
  server: { androidScheme: "https", hostname: "localhost" },
};

export default config;
