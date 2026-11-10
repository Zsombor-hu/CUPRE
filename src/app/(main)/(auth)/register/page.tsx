"use client"

import type { FormEvent } from "react"
import { Button, Card, Form, Input, Label, Link, TextField } from "@heroui/react"

// Regisztrációs oldal HeroUI komponensekkel; a beküldés egyelőre nincs bekötve backendre
export default function Register() {
    // Megakadályozza a böngésző alapértelmezett beküldését, mert különben a jelszó a URL-be kerülne (GET)
    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
    }

    return (
        <div className="flex flex-1 items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <Card.Header>
                    <Card.Title>Regisztráció</Card.Title>
                    <Card.Description>Hozz létre új fiókot.</Card.Description>
                </Card.Header>
                <Form onSubmit={handleSubmit}>
                    <Card.Content className="flex flex-col gap-4">
                        <TextField name="name" isRequired>
                            <Label>Név</Label>
                            <Input placeholder="Minta János" />
                        </TextField>
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
                        <Button type="submit" fullWidth>Regisztráció</Button>
                        <Link href="/login">Már van fiókod? Bejelentkezés</Link>
                    </Card.Footer>
                </Form>
            </Card>
        </div>
    )
}
