import { Card, Link } from "@heroui/react"

// 404-es oldal HeroUI komponensekkel: tájékoztató kártya a főoldalra mutató linkkel
export default function NotFound() {
    return (
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
    )
}
