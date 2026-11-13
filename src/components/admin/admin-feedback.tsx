"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertDialog, Button, Toast, toast } from "@heroui/react";
import { useAdminI18n } from "@/components/admin/admin-i18n";

// Visszajelzés (toast) egy művelet eredményéről: zöld siker, piros hiba
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.danger(message, { timeout: 7000 }),
  info: (message: string) => toast.info(message),
};

// Megerősítő ablak beállításai
export type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  // Veszélyes (pl. törlés) művelet: piros gomb és ikon
  danger?: boolean;
};

// A megerősítés kérése: a válasz true, ha a felhasználó jóváhagyta
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Az admin felület visszajelző rétege: toast értesítések és a böngésző confirm() helyett saját megerősítő ablak
export function AdminFeedbackProvider({ children }: { children: React.ReactNode }) {
  const { t } = useAdminI18n();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  // Megerősítés kérése: az ablak bezárásakor oldódik fel
  const confirm = useCallback<ConfirmFn>((next) => {
    // Egy korábbi, nyitva maradt kérés elutasítása
    if (resolver.current) {
      resolver.current(false);
    }
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  // Az ablak bezárása a döntéssel
  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Toast.Provider placement="bottom end" />
      <AlertDialog.Root
        isOpen={options !== null}
        onOpenChange={(open) => {
          // Háttérre kattintás vagy Esc: mégsem
          if (!open) {
            close(false);
          }
        }}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status={options?.danger ? "danger" : "accent"} />
                <AlertDialog.Heading>{options?.title}</AlertDialog.Heading>
              </AlertDialog.Header>
              {options?.message ? <AlertDialog.Body className="text-sm">{options.message}</AlertDialog.Body> : null}
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={() => close(false)}>
                  {t.common.cancel}
                </Button>
                <Button variant={options?.danger ? "danger" : "primary"} onPress={() => close(true)}>
                  {options?.confirmLabel ?? t.common.confirm}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

// Megerősítő ablak kérése kliens komponensből (AdminFeedbackProvider-en belül)
export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  // Provider nélküli használat programozási hiba
  if (!context) {
    throw new Error("A useConfirm csak AdminFeedbackProvider-en belül használható.");
  }
  return context;
}

// Másolás ikon (két egymásra tett lap)
function CopyIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

// Kis gomb, amely a megadott szöveget a vágólapra másolja (sikerről toast értesít)
export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t, fmt } = useAdminI18n();

  // Másolás a vágólapra
  async function copy() {
    // A vágólap API nem minden környezetben érhető el (pl. nem biztonságos kapcsolat)
    try {
      await navigator.clipboard.writeText(value);
      notify.success(fmt(t.common.copied, { label }));
    } catch {
      notify.error(t.common.copyFailed);
    }
  }

  return (
    <button
      type="button"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
      aria-label={fmt(t.common.copy, { label })}
      title={fmt(t.common.copy, { label })}
      onClick={() => void copy()}
    >
      <CopyIcon />
    </button>
  );
}
