// Sustituye a local-client.ts en la compilación de producción (Cloudflare Workers),
// para que PGlite no entre en el paquete del Worker.
export function getLocalDatabase(): never {
  throw new Error("La base local no está disponible en producción. Configura DATABASE_URL y NAKAMA_ALLOW_REMOTE_DB=1.");
}

export async function closeLocalDatabase() {}
