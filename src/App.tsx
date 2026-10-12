import { useState } from 'react'
import {
  createGame,
  GAME_BALANCE,
  performAction,
  type Action,
  type GameState,
  type SkillName,
} from './simulation'
import './App.css'

const numberFormat = new Intl.NumberFormat('fr-CM')

function App() {
  const [game, setGame] = useState<GameState>(() => createGame())
  const [message, setMessage] = useState('')

  function takeAction(action: Action) {
    const result = performAction(game, action)
    setMessage(result.message)
    if (result.ok) setGame(result.state)
  }

  function startOver() {
    setGame(createGame())
    setMessage('A new day in Molyko begins.')
  }

  const skills = Object.entries(game.skills) as [SkillName, number][]

  return (
    <main className="game-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Molyko Nights home">
          <span className="brand-mark">MN</span>
          <span>MOLYKO <strong>NIGHTS</strong></span>
        </a>
        <span className="chapter-label">A LIFE IN BUEA · DAY {game.clock.day}</span>
      </header>

      <section className="intro">
        <p className="eyebrow">YOUR STORY STARTS HERE</p>
        <h1>Make a life of your own.</h1>
        <p className="intro-copy">
          One decision at a time, under the mountain.
        </p>
      </section>

      <section className="dashboard" aria-label="Life simulation">
        <div className="main-column">
          <article className="card profile-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">INDEPENDENT ADULT LIFE</p>
                <h2>{game.player.name}</h2>
              </div>
              <span className="avatar" aria-hidden="true">✦</span>
            </div>
            <div className="profile-details">
              <span>{game.player.age} years old</span>
              <span>{game.education.level} education</span>
              <span>{game.employment.role ?? 'Looking for work'}</span>
            </div>
          </article>

          <article className="card needs-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">HOW YOU’RE DOING</p>
                <h2>Your wellbeing</h2>
              </div>
              <span className="time">{String(Math.floor(game.clock.minuteOfDay / 60)).padStart(2, '0')}:{String(game.clock.minuteOfDay % 60).padStart(2, '0')}</span>
            </div>
            <div className="need-list">
              <Need label="Health" value={game.player.health} tone="green" />
              <Need label="Energy" value={game.player.energy} tone="violet" />
              <Need label="Hunger" value={game.player.hunger} tone="orange" inverse />
              <Need label="Mood" value={game.player.mood} tone="pink" />
            </div>
          </article>

          <article className="card actions-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">WHAT WILL YOU DO?</p>
                <h2>Choose your next step</h2>
              </div>
            </div>
            <div className="action-grid">
              <ActionButton icon="↗" title="Work" detail="Earn FCFA · 4 hours" onClick={() => takeAction({ type: 'work' })} />
              <ActionButton icon="⌁" title="Study" detail="Build a skill · 2 hours" onClick={() => takeAction({ type: 'study', skill: 'business' })} />
              <ActionButton icon="☾" title="Rest" detail="Restore energy · 8 hours" onClick={() => takeAction({ type: 'rest' })} />
              <ActionButton icon="＋" title="Eat" detail="A meal · 30 minutes" onClick={() => takeAction({ type: 'eat' })} />
            </div>
            {message && <p className="action-message" role="status">{message}</p>}
          </article>
        </div>

        <aside className="side-column">
          <article className="card money-card">
            <p className="eyebrow">IN YOUR POCKET</p>
            <p className="balance">{numberFormat.format(game.money.balance)} <span>FCFA</span></p>
            <p className="subtle">Daily living costs: {numberFormat.format(GAME_BALANCE.dailyExpense)} FCFA</p>
          </article>

          <article className="card">
            <div className="card-heading compact">
              <div>
                <p className="eyebrow">GROWING EVERY DAY</p>
                <h2>Your skills</h2>
              </div>
            </div>
            <div className="skill-list">
              {skills.map(([skill, value]) => (
                <div className="skill-row" key={skill}>
                  <span>{skill}</span><strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="subtle education-note">{game.education.studySessionsCompleted} study sessions completed</p>
          </article>

          <article className="card">
            <div className="card-heading compact">
              <div>
                <p className="eyebrow">THE STORY SO FAR</p>
                <h2>Life events</h2>
              </div>
            </div>
            <ol className="event-list" aria-live="polite">
              {[...game.events].reverse().slice(0, 6).map((event) => (
                <li key={event.id}>
                  <span className="event-day">DAY {event.day}</span>
                  <p>{event.description}</p>
                </li>
              ))}
            </ol>
            <button className="reset-button" type="button" onClick={startOver}>Start a new life</button>
          </article>
        </aside>
      </section>
      <footer>FICTIONALIZED MOLYKO, BUEA · YOUR JOURNEY IS YOURS TO SHAPE</footer>
    </main>
  )
}

function Need({ label, value, tone, inverse = false }: {
  label: string
  value: number
  tone: string
  inverse?: boolean
}) {
  const displayValue = inverse ? 100 - value : value
  return (
    <div className="need">
      <div className="need-label"><span>{label}</span><strong>{value}%</strong></div>
      <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span className={`meter-fill ${tone}`} style={{ width: `${displayValue}%` }} />
      </div>
    </div>
  )
}

function ActionButton({ icon, title, detail, onClick }: {
  icon: string
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button className="action-button" type="button" onClick={onClick}>
      <span className="action-icon" aria-hidden="true">{icon}</span>
      <span className="action-copy"><strong>{title}</strong><small>{detail}</small></span>
      <span className="action-arrow" aria-hidden="true">→</span>
    </button>
  )
}

export default App
