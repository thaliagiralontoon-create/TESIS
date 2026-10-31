import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingRoot: resolve(process.cwd()),
  webpack: (config, { dev, webpack }) => {
    // En producción se usa Neon; PGlite solo se conserva si se pide la base local con NAKAMA_LOCAL_DB=1.
    if (!dev && process.env.NAKAMA_LOCAL_DB !== "1") {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/[\\/]db[\\/]local-client$|^\.\/local-client$/, resolve(process.cwd(), "src/db/local-client.stub.ts")));
    }
    return config;
  },
};

export default nextConfig;
