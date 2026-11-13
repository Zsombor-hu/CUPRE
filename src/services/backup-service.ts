import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getCustomerDb } from "@/services/customer-db";
import { dataDir } from "@/services/data-paths";
import type { BackupFile, BackupStatus } from "@/types/admin-backup";

// A mentések fájlnév-mintája: customers-ÉÉÉÉHHNN-ÓÓPPMM-<auto|manual>.sqlite
const BACKUP_PATTERN = /^customers-\d{8}-\d{6}-(auto|manual)\.sqlite$/;

// Az automatikus mentés gyakorisága órában (BACKUP_INTERVAL_HOURS, alapértelmezés 24)
function intervalHours(): number {
  const value = Number(process.env.BACKUP_INTERVAL_HOURS);
  return Number.isFinite(value) && value >= 1 ? value : 24;
}

// Ennyi automatikus mentést tartunk meg (BACKUP_KEEP, alapértelmezés 14); a kézi mentéseket nem töröljük
function keepCount(): number {
  const value = Number(process.env.BACKUP_KEEP);
  return Number.isInteger(value) && value >= 1 ? value : 14;
}

// A mentések könyvtára (src/data/<környezet>/backups)
function backupDir(): string {
  return path.join(dataDir(), "backups");
}

// Időbélyeg a fájlnévhez (UTC)
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

// A meglévő mentések a legújabb elöl
export function listBackups(): BackupFile[] {
  const dir = backupDir();
  // Még nincs mentés
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => BACKUP_PATTERN.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString(), kind: name.endsWith("-manual.sqlite") ? "manual" : "auto" } as BackupFile;
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

// Konzisztens pillanatkép az adatbázisról (VACUUM INTO: futó írás mellett is ép fájl), majd a régi automatikus mentések törlése
export function createBackup(kind: "auto" | "manual"): BackupFile {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const name = `customers-${stamp(new Date())}-${kind}.sqlite`;
  const target = path.join(dir, name);
  // Ugyanabban a másodpercben készült mentés felülírása helyett az előzőt töröljük
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
  getCustomerDb().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  pruneBackups();
  const stat = fs.statSync(target);
  return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString(), kind };
}

// A megtartási számon felüli automatikus mentések törlése
function pruneBackups(): void {
  const automatic = listBackups().filter((file) => file.kind === "auto");
  // A legújabbak maradnak
  for (const file of automatic.slice(keepCount())) {
    fs.unlinkSync(path.join(backupDir(), file.name));
  }
}

// Időzített futás: ha a legutóbbi mentés régebbi a beállított gyakoriságnál, új automatikus mentés készül
export function runScheduledBackup(): void {
  const latest = listBackups()[0];
  const due = !latest || Date.now() - new Date(latest.createdAt).getTime() >= intervalHours() * 60 * 60 * 1000;
  // Még nem esedékes
  if (!due) {
    return;
  }
  createBackup("auto");
}

// A mentések állapota a Beállítások oldalhoz
export function backupStatus(): BackupStatus {
  const files = listBackups();
  const latest = files[0] ?? null;
  return {
    files,
    lastBackupAt: latest?.createdAt ?? null,
    nextBackupAt: latest ? new Date(new Date(latest.createdAt).getTime() + intervalHours() * 60 * 60 * 1000).toISOString() : null,
    intervalHours: intervalHours(),
    keep: keepCount(),
    totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
  };
}

// Egy mentés tartalma letöltéshez (csak a mintának megfelelő, létező fájl); egyébként null
export function readBackup(name: string): Buffer | null {
  // Útvonal-manipuláció elleni védelem: csak a pontos fájlnévminta fogadható el
  if (!BACKUP_PATTERN.test(name)) {
    return null;
  }
  const filePath = path.join(backupDir(), name);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}
