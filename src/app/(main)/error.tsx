"use client"

import { Button, Card } from "@heroui/react"

// Hibakezelő oldal HeroUI komponensekkel: tájékoztató kártya újrapróbálás gombbal
export default function Error({ retry }: { error: Error & { digest?: string }, retry: () => void }) {
    return (
        <div className="flex flex-1 items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <Card.Header>
                    <Card.Title>Hiba történt</Card.Title>
                    <Card.Description>Valami nem sikerült. Próbáld meg újra.</Card.Description>
                </Card.Header>
                <Card.Footer>
                    <Button onPress={() => retry()}>Újrapróbálás</Button>
                </Card.Footer>
            </Card>
        </div>
    )
}
