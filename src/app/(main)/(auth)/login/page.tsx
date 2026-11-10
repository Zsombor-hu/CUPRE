"use client"

import type { FormEvent } from "react"
import { Button, Card, Form, Input, Label, Link, TextField } from "@heroui/react"

// Bejelentkezési oldal HeroUI komponensekkel; a beküldés egyelőre nincs bekötve backendre
export default function Login() {
    // Megakadályozza a böngésző alapértelmezett beküldését, mert különben a jelszó a URL-be kerülne (GET)
    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
    }

    return (
        <div className="flex flex-1 items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <Card.Header>
                    <Card.Title>Bejelentkezés</Card.Title>
                    <Card.Description>Add meg az e-mail címed és a jelszavad.</Card.Description>
                </Card.Header>
                <Form onSubmit={handleSubmit}>
                    <Card.Content className="flex flex-col gap-4">
                        <TextField name="email" type="email" isRequired>
                            <Label>E-mail</Label>
                            <Input placeholder="nev@pelda.hu" />
                        </TextField>
                        <TextField name="password" type="password" isRequired>
                            <Label>Jelszó</Label>
                            <Input />
                        </TextField>
                    </Card.Content>
                    <Card.Footer className="flex flex-col gap-3">
                        <Button type="submit" fullWidth>Belépés</Button>
                        <Link href="/register">Nincs még fiókod? Regisztráció</Link>
                    </Card.Footer>
                </Form>
            </Card>
        </div>
    )
}
