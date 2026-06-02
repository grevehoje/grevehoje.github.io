import { useEffect, useState } from 'react'
import './App.css'

interface StrikeEvent {
  startDate: string
  endDate?: string
  isConfirmed: boolean
  description: string
  sourceUrl?: string
  operator?: string
}

interface StrikeInfo {
  operator: string
  status: 'red' | 'green' | 'yellow'
  message: string
  lastChecked: string
  sourceUrl?: string
  upcomingEvents: StrikeEvent[]
}

interface StrikeStatus {
  hasStrikes: boolean
  lastUpdate: string
  operators: StrikeInfo[]
}

function App() {
  const [data, setData] = useState<StrikeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      if (saved) return saved as 'light' | 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true)
      setError(null)
      try {
        const apiBase = import.meta.env.VITE_API_URL || ''
        const url = apiBase ? `${apiBase}/api/status` : '/data/status.json'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Falha ao obter dados')
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  const upcomingEvents = data?.operators.flatMap(op => 
    op.upcomingEvents.map(event => ({ ...event, operator: op.operator }))
  ).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) || []

  return (
    <div className="container">
      <header>
        <div className="logo">Greve<span>Hoje</span></div>
        <div className="header-actions">
          <button className="icon-btn" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="hero">
        {loading && !data ? (
          <div className="loading-spinner">A carregar...</div>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : data ? (
          <>
            <div className={`status-badge status-${data.hasStrikes ? 'red' : 'green'}`}>
              {data.hasStrikes ? 'HÁ GREVES HOJE' : 'SEM GREVES HOJE'}
            </div>
            <h1>Transportes em Portugal</h1>
            <p className="subtext">
              Última atualização: {new Date(data.lastUpdate).toLocaleTimeString('pt-PT')}
            </p>
          </>
        ) : null}
      </main>

      <section className="section">
        <h2 className="section-title">Estado Atual</h2>
        <div className="operators">
          {data?.operators.map(op => {
            const Tag = op.sourceUrl ? 'a' : 'div'
            return (
              <Tag
                key={op.operator}
                href={op.sourceUrl}
                target={op.sourceUrl ? '_blank' : undefined}
                rel={op.sourceUrl ? 'noopener noreferrer' : undefined}
                className={`card ${op.sourceUrl ? 'clickable' : ''}`}
              >
                <div className="card-info">
                  <h3>{op.operator}</h3>
                  <p>{op.message}</p>
                  <span className="last-checked">
                    Verificado às {new Date(op.lastChecked).toLocaleTimeString('pt-PT')}
                  </span>
                </div>
                <div className="card-right">
                  <div className={`indicator indicator-${op.status}`}></div>
                  {op.sourceUrl && <span className="source-link">Info oficial ↗</span>}
                </div>
              </Tag>
            )
          })}
        </div>
      </section>

      {upcomingEvents.length > 0 && (
        <section className="section">
          <h2 className="section-title">Próximas Greves</h2>
          <div className="upcoming-list">
            {upcomingEvents.map((event, idx) => (
              <a 
                key={idx} 
                href={event.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`upcoming-card ${event.sourceUrl ? 'clickable' : ''}`}
              >
                <div className="upcoming-date">
                  {new Date(event.startDate).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                </div>
                <div className="upcoming-info">
                  <strong>{event.operator}</strong>
                  <p>{event.description}</p>
                </div>
                {event.sourceUrl && <div className="arrow-right">›</div>}
              </a>
            ))}
          </div>
        </section>
      )}

      <footer className="site-footer">
        &copy; 2026 GreveHoje.pt • Dados informativos de fontes públicas.
      </footer>

      <div className="sticky-anchor">
        <div className="ad-content">ESPAÇO PUBLICITÁRIO (STICKY)</div>
      </div>
    </div>
  )
}

export default App
