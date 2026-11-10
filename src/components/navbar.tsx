import { Link } from "@heroui/react"
import ThemeSwitcher from "@/components/theme-switcher"

// Fő navigációs sáv: a HeroUI v3-ban nincs Navbar komponens, ezért <nav> keretet
// és HeroUI Link elemeket használunk a meglévő oldalak eléréséhez
export default function Navbar() {
    return (
        <nav className="flex items-center gap-6 border-b border-foreground/10 px-6 py-3">
            <Link href="/">Főoldal</Link>
            <Link href="/lassu">Lassú oldal</Link>
            <span className="flex-1" />
            <Link href="/login">Bejelentkezés</Link>
            <Link href="/register">Regisztráció</Link>
            <ThemeSwitcher />
        </nav>
    )
}
