import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getAppEnv } from "@/lib/app-env";

// Az aktuális környezet adatkönyvtára: src/data/development | test | production
export function dataDir(): string {
  return path.join(process.cwd(), "src", "data", getAppEnv());
}

// Fájl teljes útvonala az aktuális környezet adatkönyvtárában
export function dataFile(fileName: string): string {
  return path.join(dataDir(), fileName);
}

// JSON adatfájl szinkron beolvasása (prerenderkor is biztonságos); hiányzó vagy hibás fájlnál beszédes hibát dob
export function readJsonData(fileName: string): unknown {
  const filePath = dataFile(fileName);
  // A JSON hibát a fájl útvonalával együtt jelezzük, hogy azonnal látszódjon, melyik környezet adata rossz
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    throw new Error(`Nem olvasható adatfájl: ${filePath} (${(error as Error).message})`);
  }
}
