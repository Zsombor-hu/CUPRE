"use client"

import { useEffect, useSyncExternalStore } from "react"
import type { Selection } from "@heroui/react"
import { Button, Dropdown, Label } from "@heroui/react"

type Mode = "light" | "dark" | "system"
type Palette = "default" | "sky" | "lavender" | "mint" | "netflix" | "uber" | "spotify" | "coinbase" | "airbnb" | "discord" | "rabbit"

const MODE_KEY = "theme"
const PALETTE_KEY = "design-theme"

const MODES: { id: Mode, label: string }[] = [
    { id: "light", label: "Világos" },
    { id: "dark", label: "Sötét" },
    { id: "system", label: "Rendszer" },
]

// A HeroUI 11 színtémája; a color a menüben látszó minta (a téma világos módú kiemelő színe)
const PALETTES: { id: Palette, label: string, color: string }[] = [
    { id: "default", label: "Default", color: "oklch(0.6204 0.195 253.83)" },
    { id: "sky", label: "Sky", color: "oklch(82.76% 0.1013 230.34)" },
    { id: "lavender", label: "Lavender", color: "oklch(72.17% 0.1768 305.49)" },
    { id: "mint", label: "Mint", color: "oklch(87.12% 0.1363 154.48)" },
    { id: "netflix", label: "Netflix", color: "oklch(58.14% 0.2348 27.98)" },
    { id: "uber", label: "Uber", color: "oklch(0% 0 0)" },
    { id: "spotify", label: "Spotify", color: "oklch(76.97% 0.2123 148.69)" },
    { id: "coinbase", label: "Coinbase", color: "oklch(50.31% 0.2262 277.63)" },
    { id: "airbnb", label: "Airbnb", color: "oklch(68.92% 0.2004 22.37)" },
    { id: "discord", label: "Discord", color: "oklch(57.74% 0.2092 273.85)" },
    { id: "rabbit", label: "Rabbit", color: "oklch(69.58% 0.2042 43.48)" },
]

// Feliratkozott figyelők: a téma változásakor értesítjük őket (useSyncExternalStore)
const listeners = new Set<() => void>()

// Egy mentett értéket olvas a localStorage-ból; ha nem elérhető vagy érvénytelen, az alapértéket adja
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    // a localStorage elérése hibát dobhat (pl. privát mód), ezért védjük
    try {
        const stored = localStorage.getItem(key)

        // csak érvényes mentett értéket fogadunk el
        if (stored !== null && (allowed as readonly string[]).includes(stored)) {
            return stored as T
        }
    } catch {
        // privát módban a localStorage hibát dobhat, ilyenkor marad az alapérték
    }
    return fallback
}

// Feliratkozás a változásokra (saját mentés és más lapon történt változás)
function subscribe(listener: () => void) {
    listeners.add(listener)
    window.addEventListener("storage", listener)

    // leiratkozás, hogy ne maradjon szivárgó figyelő
    return () => {
        listeners.delete(listener)
        window.removeEventListener("storage", listener)
    }
}

// Elmenti az új értéket és értesíti a feliratkozott komponenseket
function save(key: string, value: string) {
    // a mentés hibája nem állíthatja meg a téma váltását
    try {
        localStorage.setItem(key, value)
    } catch {
        // ha a mentés nem sikerül, a téma csak az aktuális munkamenetre érvényes
    }
    listeners.forEach((listener) => listener())
}

// A világos/sötét módot és a színtémát beállítja a <html>-en (.dark osztály, data-theme, data-design-theme)
function applyTheme(mode: Mode, palette: Palette) {
    const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    const root = document.documentElement

    root.classList.toggle("dark", dark)
    root.dataset.theme = dark ? "dark" : "light"
    root.style.colorScheme = dark ? "dark" : "light"

    // a default témának nincs attribútuma, a többit a heroui-themes.css kezeli
    if (palette === "default") {
        delete root.dataset.designTheme
    } else {
        root.dataset.designTheme = palette
    }
}

// A váltó feliratai (alapértelmezetten magyar; az admin a választott nyelven adja át)
export type ThemeSwitcherLabels = {
    paletteLabel: string
    modeLabel: string
    modes: Record<Mode, string>
}

const DEFAULT_LABELS: ThemeSwitcherLabels = {
    paletteLabel: "Szín téma váltása",
    modeLabel: "Világos vagy sötét mód váltása",
    modes: { light: "Világos", dark: "Sötét", system: "Rendszer" },
}

// Téma beállítása kívülről (pl. az admin felhasználó mentett beállításából): elmenti, alkalmazza és értesíti a váltókat
export function setTheme(mode: Mode, palette: Palette) {
    save(MODE_KEY, mode)
    save(PALETTE_KEY, palette)
    applyTheme(mode, palette)
}

// A színtémák listája (azonosító, név, mintaszín) – az admin beállítások oldal is ezt mutatja
export const THEME_PALETTE_OPTIONS = PALETTES

// Téma váltó: két legördülő menü, a Mód (Világos/Sötét/Rendszer) és a Szín (a HeroUI 11 témája)
export default function ThemeSwitcher({ labels = DEFAULT_LABELS }: { labels?: ThemeSwitcherLabels }) {
    const mode = useSyncExternalStore(
        subscribe,
        () => readStored(MODE_KEY, MODES.map((item) => item.id), "system"),
        () => "system" as Mode,
    )
    const palette = useSyncExternalStore(
        subscribe,
        () => readStored(PALETTE_KEY, PALETTES.map((item) => item.id), "default"),
        () => "default" as Palette,
    )

    // Téma alkalmazása; rendszer módnál a böngésző beállításának változását is követjük
    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)")
        const update = () => applyTheme(mode, palette)

        update()
        media.addEventListener("change", update)

        // eltávolítjuk a figyelőt, ha a téma vagy a komponens megváltozik
        return () => media.removeEventListener("change", update)
    }, [mode, palette])

    // A menüből kiválasztott elem elmentése a megadott kulcs alatt
    function handleSelectionChange(key: string, keys: Selection) {
        const [selected] = Array.from(keys)

        // "all" kijelölés vagy üres halmaz esetén nem változtatunk
        if (typeof selected === "string") {
            save(key, selected)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Dropdown>
                <Button aria-label={labels.paletteLabel} variant="secondary" size="sm">
                    <span
                        className="size-3 rounded-full border border-foreground/20"
                        style={{ backgroundColor: PALETTES.find((item) => item.id === palette)?.color }}
                    />
                    {PALETTES.find((item) => item.id === palette)?.label}
                </Button>
                <Dropdown.Popover>
                    <Dropdown.Menu
                        selectedKeys={new Set([palette])}
                        selectionMode="single"
                        onSelectionChange={(keys) => handleSelectionChange(PALETTE_KEY, keys)}
                    >
                        {PALETTES.map((item) => (
                            <Dropdown.Item key={item.id} id={item.id} textValue={item.label}>
                                <Dropdown.ItemIndicator />
                                <span
                                    className="size-3 rounded-full border border-foreground/20"
                                    style={{ backgroundColor: item.color }}
                                />
                                <Label>{item.label}</Label>
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
            <Dropdown>
                <Button aria-label={labels.modeLabel} variant="secondary" size="sm">
                    {labels.modes[mode]}
                </Button>
                <Dropdown.Popover>
                    <Dropdown.Menu
                        selectedKeys={new Set([mode])}
                        selectionMode="single"
                        onSelectionChange={(keys) => handleSelectionChange(MODE_KEY, keys)}
                    >
                        {MODES.map((item) => (
                            <Dropdown.Item key={item.id} id={item.id} textValue={labels.modes[item.id]}>
                                <Dropdown.ItemIndicator />
                                <Label>{labels.modes[item.id]}</Label>
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
        </div>
    )
}
