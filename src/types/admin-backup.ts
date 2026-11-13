// Egy adatbázis-mentés fájlja
export type BackupFile = {
  name: string;
  sizeBytes: number;
  createdAt: string;
  // auto: időzített, manual: az adminból kért mentés
  kind: "auto" | "manual";
};

// A mentések állapota (Beállítások oldal)
export type BackupStatus = {
  files: BackupFile[];
  lastBackupAt: string | null;
  // A következő automatikus mentés legkorábbi ideje (null: még nincs mentés, hamarosan készül)
  nextBackupAt: string | null;
  intervalHours: number;
  keep: number;
  totalBytes: number;
};
