import type { Metadata } from "next";
import { Card, Link } from "@heroui/react";
import "./(main)/globals.css";

export const metadata: Metadata = {
  title: "404 – Az oldal nem található",
  description: "A keresett oldal nem létezik vagy áthelyezték.",
};

// Globális 404: több root layout miatt egyik layout sem fut, ezért teljes HTML dokumentumot ad vissza
// a (main) csoport stílusaival és ugyanazzal a HeroUI kártyával, mint a (main)/not-found.tsx
export default function GlobalNotFound() {
  return (
    <html lang="hu" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-sm">
            <Card.Header>
              <Card.Title>404 – Az oldal nem található</Card.Title>
              <Card.Description>A keresett oldal nem létezik vagy áthelyezték.</Card.Description>
            </Card.Header>
            <Card.Footer>
              <Link href="/">Vissza a főoldalra</Link>
            </Card.Footer>
          </Card>
        </div>
      </body>
    </html>
  );
}
