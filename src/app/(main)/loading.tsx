import { Spinner } from "@heroui/react"

// Betöltés közben megjelenő, az egész oldalt takaró réteg HeroUI Spinnerrel
export default function Loading() {
    return (
        <div
            role="status"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-500/50"
        >
            <Spinner size="xl" />
            <span className="text-lg font-medium text-white">Betöltés...</span>
        </div>
    )
}
