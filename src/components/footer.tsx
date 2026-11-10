import { Link, Separator } from "@heroui/react"

// Oldal alja: a HeroUI v3-ban nincs Footer komponens, ezért <footer> keretet,
// HeroUI Separator elválasztót és Link elemeket használunk
export default function Footer() {
    return (
        <footer className="flex flex-col gap-3 px-6 py-4">
            <Separator />
            <div className="flex items-center justify-between text-sm">
                <span>© Merkit</span>
                <Link href="/">Főoldal</Link>
            </div>
        </footer>
    )
}
