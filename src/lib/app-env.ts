// A három futtatási környezet; az adatfájlok ezek szerint külön alkönyvtárban vannak (src/data/<környezet>)
export type AppEnv = "production" | "test" | "development";

// Aktuális környezet az APP_ENV alapján (a package.json scriptjei állítják be), alapértelmezés a fejlesztői
export function getAppEnv(): AppEnv {
  const value = process.env.APP_ENV;
  // Csak a két ismert értéket fogadjuk el, minden más (pl. `pnpm dev`) fejlesztői környezet
  if (value === "production" || value === "test") {
    return value;
  }
  return "development";
}
