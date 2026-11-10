import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Renderelés előtt beállítja a mentett (vagy rendszer) témát a <html>-en, hogy ne legyen villanás;
// a logikának egyeznie kell a src/components/theme-switcher.tsx-ben lévő applyTheme-mal
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
  title: "Merkit Next.js",
  description: "Next.js 16 és HeroUI alapú példaprojekt",
};

// Gyökér layout: a HeroUI v3-hoz nem kell Provider, elég a HeroUI témaváltozókat használó
// bg-background/text-foreground a body-n, fent a Navbar, lent a Footer
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hu"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Navbar />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
