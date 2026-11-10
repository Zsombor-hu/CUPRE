import AdminShell from "@/components/admin/admin-shell";

// A belépést igénylő admin oldalak közös kerete (menü, kilépés, munkamenet-ellenőrzés)
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
