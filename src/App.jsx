import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'quiz-scoreboard-v1'

const houseTemplate = () => ({
  yellow: { id: 'yellow', name: 'Yellow House', color: '#facc15', accent: '#f59e0b', score: 0 },
  red: { id: 'red', name: 'Red House', color: '#ef4444', accent: '#dc2626', score: 0 },
  blue: { id: 'blue', name: 'Blue House', color: '#3b82f6', accent: '#2563eb', score: 0 },
  green: { id: 'green', name: 'Green House', color: '#22c55e', accent: '#16a34a', score: 0 },
})

function createDefaultSettings() {
  return {
    competitionTitle: 'QUIZ COMPETITION',
    subtitle: 'HOUSE-WISE SCOREBOARD',
    schoolName: 'Annual Inter-House Quiz Competition',
    roundName: 'Round 1',
    allowNegativeScores: false,
    darkMode: true,
    showRankings: true,
    showLeader: true,
    showHistory: true,
  }
}

function readLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getInitialHouses() {
  const saved = readLocalStorage()
  if (saved && saved.houses) {
    const template = houseTemplate()
    return Object.keys(template).reduce((acc, key) => {
      acc[key] = {
        ...template[key],
        ...saved.houses[key],
      }
      return acc
    }, {})
  }
  return houseTemplate()
}

function getInitialSettings() {
  const saved = readLocalStorage()
  return { ...createDefaultSettings(), ...(saved?.settings || {}) }
}

function getInitialHistory() {
  const saved = readLocalStorage()
  return Array.isArray(saved?.history) ? saved.history : []
}

function getRankedHouseList(houses) {
  const ordered = Object.values(houses).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  let previousScore = null
  let previousRank = 0

  return ordered.map((house, index) => {
    let rank = index + 1

    if (previousScore !== null && house.score === previousScore) {
      rank = previousRank
    } else {
      previousRank = rank
      previousScore = house.score
    }

    return { ...house, rank }
  })
}

function formatTime(timestamp) {
  if (!timestamp) return 'Just now'
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function HouseCard({ house, isLeader, isTieLeader, rank, flashDelta }) {
  const statusText = isLeader && isTieLeader ? 'TIE LEAD' : isLeader ? 'LEADING' : `RANK ${rank}`

  return (
    <div className={`house-card ${isLeader ? 'leader' : ''}`} style={{ '--house-color': house.color, '--house-accent': house.accent }}>
      <div className="house-topbar">
        <span className="house-name">{house.name}</span>
        <span className="rank-badge">{statusText}</span>
      </div>

      <div className="score-wrap">
        <div className="score-value" data-animate={flashDelta ? 'true' : 'false'}>
          {house.score}
        </div>
        <div className="score-label">POINTS</div>
        {flashDelta && <span className={`flash ${flashDelta > 0 ? 'positive' : 'negative'}`}>{flashDelta > 0 ? `+${flashDelta}` : flashDelta}</span>}
      </div>

      <div className="house-controls">
        <button type="button" className="score-button positive" onClick={() => 1} aria-label={`Add five points to ${house.name}`}>
          +5
        </button>
        <button type="button" className="score-button positive" onClick={() => 1} aria-label={`Add ten points to ${house.name}`}>
          +10
        </button>
        <button type="button" className="score-button negative" onClick={() => 1} aria-label={`Subtract five points from ${house.name}`}>
          -5
        </button>
        <button type="button" className="score-button negative" onClick={() => 1} aria-label={`Subtract ten points from ${house.name}`}>
          -10
        </button>
      </div>
    </div>
  )
}

function App() {
  const [houses, setHouses] = useState(getInitialHouses)
  const [history, setHistory] = useState(getInitialHistory)
  const [settings, setSettings] = useState(getInitialSettings)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const [flashValue, setFlashValue] = useState({ id: null, delta: 0 })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ houses, history, settings }))
  }, [houses, history, settings])

  useEffect(() => {
    if (!flashValue.id) return undefined
    const timeoutId = window.setTimeout(() => {
      setFlashValue({ id: null, delta: 0 })
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [flashValue])

  const rankedHouses = useMemo(() => getRankedHouseList(houses), [houses])

  const leaderScore = rankedHouses[0]?.score ?? 0
  const leaderNames = rankedHouses.filter((item) => item.score === leaderScore).map((item) => item.name)
  const leaderText = leaderNames.length > 1 ? leaderNames.join(' & ') : leaderNames[0] || 'No leader'

  const applyScore = (houseId, delta) => {
    const house = houses[houseId]
    if (!house) return

    const previousScore = house.score
    const nextScore = settings.allowNegativeScores ? previousScore + delta : Math.max(0, previousScore + delta)

    if (nextScore === previousScore) return

    setHouses((current) => ({
      ...current,
      [houseId]: {
        ...current[houseId],
        score: nextScore,
      },
    }))

    const entry = {
      id: `${Date.now()}-${Math.random()}`,
      houseId,
      houseName: house.name,
      delta,
      previousScore,
      newScore: nextScore,
      timestamp: new Date().toISOString(),
    }

    setHistory((current) => [entry, ...current])
    setFlashValue({ id: houseId, delta })
  }

  const undoLastAction = () => {
    const lastAction = history[0]
    if (!lastAction) return

    setHouses((current) => ({
      ...current,
      [lastAction.houseId]: {
        ...current[lastAction.houseId],
        score: lastAction.previousScore,
      },
    }))

    setHistory((current) => current.slice(1))
    setFlashValue({ id: lastAction.houseId, delta: -lastAction.delta })
  }

  const resetScoreboard = () => {
    setHouses(houseTemplate())
    setHistory([])
    setConfirmReset(false)
    setFlashValue({ id: null, delta: 0 })
  }

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen toggle failed', error)
    }
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      const scoreMap = {
        1: 'yellow',
        2: 'red',
        3: 'blue',
        4: 'green',
        q: 'yellow',
        w: 'red',
        e: 'blue',
        r: 'green',
      }

      if (event.ctrlKey && key === 'z') {
        event.preventDefault()
        undoLastAction()
        return
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        toggleFullscreen()
        return
      }

      if (Object.hasOwn(scoreMap, key)) {
        const houseId = scoreMap[key]
        const delta = event.shiftKey ? -5 : 5
        applyScore(houseId, delta)
      }

      if (key === 'q' && event.shiftKey) {
        applyScore('yellow', -5)
      }

      if (key === 'w' && event.shiftKey) {
        applyScore('red', -5)
      }

      if (key === 'e' && event.shiftKey) {
        applyScore('blue', -5)
      }

      if (key === 'r' && event.shiftKey) {
        applyScore('green', -5)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [history, settings, houses])

  return (
    <div className={`app-shell ${settings.darkMode ? 'theme-dark' : 'theme-light'}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">{settings.schoolName}</p>
          <h1>{settings.competitionTitle}</h1>
          <h2>{settings.subtitle}</h2>
        </div>

        <div className="header-actions">
          <div className="round-pill">Current Round: {settings.roundName}</div>
          <button type="button" className="mini-btn" onClick={() => setPresentationMode((current) => !current)}>
            {presentationMode ? 'Exit Presentation' : 'Presentation'}
          </button>
          <button type="button" className="mini-btn" onClick={toggleFullscreen}>Fullscreen</button>
          <button type="button" className="mini-btn" onClick={() => setShowSettingsPanel(true)}>Settings</button>
        </div>
      </header>

      {presentationMode ? (
        <section className="presentation-board">
          <div className="presentation-header">
            <div>
              <p className="eyebrow">{settings.schoolName}</p>
              <h3>{settings.competitionTitle}</h3>
            </div>
            <div className="presentation-round">{settings.roundName}</div>
          </div>

          <div className="presentation-grid">
            {rankedHouses.map((house, index) => (
              <div key={house.id} className={`presentation-card ${house.score === leaderScore ? 'leader' : ''}`} style={{ '--house-color': house.color }}>
                <span className="presentation-rank">{index + 1}ST</span>
                <p>{house.name}</p>
                <strong>{house.score}</strong>
              </div>
            ))}
          </div>

          <div className="leader-banner">
            <span>🏆 CURRENT LEADER</span>
            <strong>{leaderText}</strong>
            <small>{leaderScore} POINTS</small>
          </div>
        </section>
      ) : (
        <>
          {settings.showLeader && (
            <section className="leader-banner">
              <span>🏆 CURRENT LEADER</span>
              <strong>{leaderText}</strong>
              <small>{leaderScore} POINTS</small>
            </section>
          )}

          <section className="score-grid">
            {rankedHouses.map((house) => {
              const isLeader = house.score === leaderScore
              const tieLeader = leaderNames.length > 1 && isLeader

              return (
                <div key={house.id} className="house-card-wrap">
                  <div className="house-card-header">
                    <span>{house.name}</span>
                    <span className="rank-label">{house.score === leaderScore && leaderNames.length > 1 ? 'TIE' : `RANK ${house.rank}`}</span>
                  </div>

                  <div className="house-panel" style={{ '--house-color': house.color, '--house-accent': house.accent }}>
                    <div className="score-block">
                      <div className="score-number" data-flash={flashValue.id === house.id ? 'true' : 'false'}>
                        {house.score}
                      </div>
                      <div className="score-caption">POINTS</div>
                      {flashValue.id === house.id && (
                        <span className={`number-flash ${flashValue.delta > 0 ? 'positive' : 'negative'}`}>
                          {flashValue.delta > 0 ? `+${flashValue.delta}` : flashValue.delta}
                        </span>
                      )}
                    </div>

                    <div className="card-status-row">
                      <span className={`status-badge ${isLeader ? 'active' : ''}`}>
                        {isLeader ? (tieLeader ? 'TIE LEAD' : 'LEADING') : `RANK ${house.rank}`}
                      </span>
                    </div>

                    <div className="score-buttons">
                      <button type="button" className="score-button positive" onClick={() => applyScore(house.id, 5)} aria-label={`Add five points to ${house.name}`}>
                        +5
                      </button>
                      <button type="button" className="score-button positive" onClick={() => applyScore(house.id, 10)} aria-label={`Add ten points to ${house.name}`}>
                        +10
                      </button>
                      <button type="button" className="score-button negative" onClick={() => applyScore(house.id, -5)} aria-label={`Subtract five points from ${house.name}`}>
                        -5
                      </button>
                      <button type="button" className="score-button negative" onClick={() => applyScore(house.id, -10)} aria-label={`Subtract ten points from ${house.name}`}>
                        -10
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </section>

          <section className="control-bar">
            <button type="button" className="control-btn secondary" onClick={undoLastAction} disabled={history.length === 0}>
              Undo Last Action
            </button>
            <button type="button" className="control-btn secondary" onClick={() => setShowHistoryPanel((current) => !current)}>
              {settings.showHistory ? 'Hide Score History' : 'Show Score History'}
            </button>
            <button type="button" className="control-btn secondary" onClick={() => setShowResults(true)}>
              End Competition
            </button>
            <button type="button" className="control-btn danger" onClick={() => setConfirmReset(true)}>
              Reset Scoreboard
            </button>
          </section>

          {settings.showHistory && showHistoryPanel && (
            <section className="history-panel">
              <div className="panel-header">
                <h3>Score History</h3>
                <button type="button" className="mini-btn" onClick={() => setShowHistoryPanel(false)}>Close</button>
              </div>

              <div className="history-list">
                {history.length === 0 ? (
                  <p className="empty-state">No score changes yet.</p>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="history-item">
                      <div className="history-meta">
                        <strong>{houses[item.houseId]?.name || item.houseName}</strong>
                        <span>{item.delta > 0 ? `+${item.delta}` : item.delta} points</span>
                      </div>
                      <p>
                        {item.previousScore} → {item.newScore}
                      </p>
                      <small>{formatTime(item.timestamp)}</small>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </>
      )}

      {showSettingsPanel && (
        <div className="modal-overlay" onClick={() => setShowSettingsPanel(false)}>
          <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <h3>Competition Settings</h3>
              <button type="button" className="mini-btn" onClick={() => setShowSettingsPanel(false)}>Close</button>
            </div>

            <div className="settings-grid">
              <label>
                Competition Name
                <input value={settings.competitionTitle} onChange={(event) => setSettings((current) => ({ ...current, competitionTitle: event.target.value }))} />
              </label>
              <label>
                School / Event Name
                <input value={settings.schoolName} onChange={(event) => setSettings((current) => ({ ...current, schoolName: event.target.value }))} />
              </label>
              <label>
                Subtitle
                <input value={settings.subtitle} onChange={(event) => setSettings((current) => ({ ...current, subtitle: event.target.value }))} />
              </label>
              <label>
                Current Round
                <input value={settings.roundName} onChange={(event) => setSettings((current) => ({ ...current, roundName: event.target.value }))} />
              </label>

              <label className="checkbox-row">
                <input type="checkbox" checked={settings.allowNegativeScores} onChange={(event) => setSettings((current) => ({ ...current, allowNegativeScores: event.target.checked }))} />
                Allow Negative Scores
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={settings.darkMode} onChange={(event) => setSettings((current) => ({ ...current, darkMode: event.target.checked }))} />
                Dark Mode
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={settings.showLeader} onChange={(event) => setSettings((current) => ({ ...current, showLeader: event.target.checked }))} />
                Show Leader Banner
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={settings.showHistory} onChange={(event) => setSettings((current) => ({ ...current, showHistory: event.target.checked }))} />
                Show Score History
              </label>
            </div>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="modal-overlay" onClick={() => setConfirmReset(false)}>
          <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <h3>Reset Scoreboard?</h3>
            <p>This will reset all house scores to zero and clear the score history.</p>
            <div className="confirm-actions">
              <button type="button" className="control-btn secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="control-btn danger" onClick={resetScoreboard}>Reset</button>
            </div>
          </div>
        </div>
      )}

      {showResults && (
        <div className="modal-overlay" onClick={() => setShowResults(false)}>
          <div className="results-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <h3>Final Results</h3>
              <button type="button" className="mini-btn" onClick={() => setShowResults(false)}>Close</button>
            </div>

            <div className="results-list">
              {rankedHouses.map((house, index) => (
                <div key={house.id} className="result-item" style={{ '--house-color': house.color }}>
                  <span className="result-rank">{index + 1}ST</span>
                  <span className="result-name">{house.name}</span>
                  <span className="result-score">{house.score} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
