// app/dashboard/scrape/page.tsx
// Scrape trigger page — Server Component
import { TriggerScrapeForm } from '@/components/leads/TriggerScrapeForm'

export default function ScrapePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Scraping</h1>
        <p className="page-subtitle">Wybierz kategorie i miasta do przeszukania na OLX. Scraper automatycznie zbierze kontakty sprzedawców.</p>
      </div>
      <TriggerScrapeForm />
    </div>
  )
}
