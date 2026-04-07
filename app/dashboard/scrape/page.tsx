// app/dashboard/scrape/page.tsx
// Scrape trigger page — Server Component
import { TriggerScrapeForm } from '@/components/leads/TriggerScrapeForm'

export default function ScrapePage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Uruchom scraping</h1>
      <p className="text-sm text-gray-600 mb-6">
        Wybierz kategorie i miasta do przeszukania na OLX. Scraper automatycznie zbierze kontakty sprzedawców.
      </p>
      <TriggerScrapeForm />
    </div>
  )
}
