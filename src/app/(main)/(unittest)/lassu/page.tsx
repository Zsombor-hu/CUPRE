import { connection } from "next/server"
import { Card } from "@heroui/react"

// Teszt oldal: szándékosan blokkol, ezért kikapcsoljuk a dev módú "instant navigation" figyelmeztetést
export const instant = false

// Kipróbáláshoz: 3 másodpercig tölt, ezalatt a src/app/loading.tsx látszik
export default async function Lassu() {
    await connection() // csak egy valódi kérés (request) beérkezésekor futhat le, tehát buildkor nem szabad előre kiértékelni.
    await new Promise((resolve) => setTimeout(resolve, 3000))

    return (
        <div className="flex flex-1 items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <Card.Header>
                    <Card.Title>Betöltött a lassú oldal</Card.Title>
                    <Card.Description>Az oldal 3 másodperc késleltetés után jelent meg.</Card.Description>
                </Card.Header>
            </Card>
        </div>
    )
}
