import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./admin.css";
import { AdminI18nProvider } from "@/components/admin/admin-i18n";
import { AdminFeedbackProvider } from "@/components/admin/admin-feedback";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Renderelés előtt beállítja a mentett (vagy rendszer) témát; a logikának egyeznie kell a src/components/theme-switcher.tsx-ben lévő applyTheme-mal
const themeScript = `(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored === "dark" || ((stored === null || stored === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.theme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
    var palette = localStorage.getItem("design-theme");
    if (palette && palette !== "default") {
      root.dataset.designTheme = palette;
    }
  } catch (e) {}
})();`;

export const metadata: Metadata = {
  title: "CUPRÉ admin",
  robots: { index: false, follow: false },
};

// Az admin felület önálló root layoutja: HeroUI v3 + Tailwind, a webshop és a demó oldalak stílusától függetlenül; háromnyelvű (hu/en/de) admin szótárral
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <AdminI18nProvider>
          <AdminFeedbackProvider>{children}</AdminFeedbackProvider>
        </AdminI18nProvider>
      </body>
    </html>
  );
}
