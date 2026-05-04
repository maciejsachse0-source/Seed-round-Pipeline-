// app/api/generate-template/route.ts
// AI-powered email template generation using Claude API.
// Generates subject + body based on selected vibe and optional brand style.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const VIBE_INSTRUCTIONS: Record<string, string> = {
  professional:
    'Pisz konkretnym, biznesowym tonem. Krótkie zdania, fakty, zero emocji. Brzmij jak partner biznesowy, nie sprzedawca.',
  friendly:
    'Pisz ciepłym, wspierającym tonem. Doceniaj kunszt artysty, brzmij jak znajomy z branży, który chce pomóc.',
  exciting:
    'Pisz dynamicznie i z energią. Podkreślaj okazję (0% prowizji!), używaj krótkich, mocnych zdań. Buduj poczucie, że to szansa, której nie można przegapić.',
  minimalist:
    'Pisz ultra-krótko. Maksymalnie 3-4 zdania. Zero ozdobników, czysta propozycja wartości.',
}

const SYSTEM_PROMPT = `Jesteś copywriterem piszącym cold maile dla nowego marketplace'u handmade.

KONTEKST:
- Marketplace oferuje 0% prowizji od sprzedaży (to główny USP)
- Piszesz do sprzedawców/twórców handmade, których profile znaleźliśmy online
- Celem jest zainteresowanie ich platformą, NIE natychmiastowa rejestracja

ZASADY:
1. NIGDY nie zaczynaj od "Mamy zaszczyt zaprosić" ani podobnych korporacyjnych formułek. Zacznij personalnie, np.: "Cześć {name}, widziałem Twoje prace na {website} – robisz świetne rzeczy w kategorii {category}!"
2. Przedstaw 0% prowizji jako PARTNERSTWO, nie sprzedaż: "Chcemy pomóc Ci zarabiać więcej, dlatego u nas zostawiasz 100% zysku dla siebie – prowizja to okrągłe 0%"
3. Call to Action: NIE proś o rejestrację. Zamiast tego zapytaj: "Czy masz wolną chwilę w tym tygodniu, żeby krótko o tym pogadać?" lub "Mogę podesłać Ci więcej szczegółów?"
4. Zwracaj się na "Ty"
5. Bądź autentyczny — pisz jak człowiek, nie jak automat

TOKENY do wykorzystania w tekście (MUSZĄ zostać jako tokeny, nie podmieniaj ich):
- {name} — imię sprzedawcy
- {city} — miasto sprzedawcy
- {category} — kategoria produktów
- {website} — strona/profil sprzedawcy

WAŻNE: Zachowaj tokeny w klamrach — np. {name}, nie "Anna". Te tokeny zostaną później podmienione na prawdziwe dane.

FORMAT ODPOWIEDZI:
Odpowiedz TYLKO w formacie JSON (bez markdown, bez code blocks):
{"subject": "temat maila z tokenami", "body": "treść maila z tokenami"}`

export async function POST(request: Request) {
  try {
    const { vibe, brandStyle } = await request.json()

    if (!vibe || !VIBE_INSTRUCTIONS[vibe]) {
      return NextResponse.json(
        { error: `Nieznany ton: "${vibe}". Dostępne: ${Object.keys(VIBE_INSTRUCTIONS).join(', ')}` },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Brak klucza ANTHROPIC_API_KEY w zmiennych środowiskowych' },
        { status: 500 }
      )
    }

    const client = new Anthropic({ apiKey })

    let userPrompt = `TON KOMUNIKACJI: ${VIBE_INSTRUCTIONS[vibe]}\n\n`

    if (brandStyle?.trim()) {
      userPrompt += `STYL MARKI (dodatkowe wytyczne od użytkownika):\n${brandStyle.trim()}\n\n`
    }

    userPrompt += 'Napisz temat i treść cold maila zgodnie z powyższymi zasadami. Odpowiedz TYLKO w formacie JSON.'

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Brak odpowiedzi tekstowej od AI' }, { status: 500 })
    }

    const parsed = JSON.parse(textBlock.text)

    if (!parsed.subject || !parsed.body) {
      return NextResponse.json({ error: 'AI nie zwróciło wymaganego formatu' }, { status: 500 })
    }

    return NextResponse.json({ subject: parsed.subject, body: parsed.body })
  } catch (err) {
    console.error('[generate-template] Error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
