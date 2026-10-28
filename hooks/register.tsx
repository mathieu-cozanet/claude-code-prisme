import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Live, Segment, Signal, Tone, TurnTone } from '../types'

const PANE = 'prisme'
const TITLE = 'Prisme'
const MAX_SEGMENTS = 120
const MAX_TURNS = 30
const FLUSH_MS = 400
const WIDTH = 360
const MUTED = '#8B95A7'

const EMPTY_TONE: Tone = {
  certitude: 0,
  hesitation: 0,
  vigilance: 0,
  chaleur: 0,
  revision: 0,
  planif: 0,
  curiosite: 0,
}
const IDLE: Live = { kind: 'idle', since: 0, label: 'En attente' }

const SEGMENTS = { plugin: 'prisme', key: 'segments' } as const
const LIVE = { plugin: 'prisme', key: 'live' } as const
const TONE = { plugin: 'prisme', key: 'tone' } as const
const TURNS = { plugin: 'prisme', key: 'turns' } as const

// Appends retry on a version miss: parallel tool calls finish together.
async function pushSegment($: EngineInterface, seg: Segment) {
  for (let i = 0; i < 5; i++) {
    const { value = [], version } = await $.state.get(SEGMENTS)
    const next = [...value, seg].slice(-MAX_SEGMENTS)
    if ((await $.state.set(SEGMENTS, next, { ifVersion: version })).isSet) return
  }
}

async function pushTurn($: EngineInterface, turn: TurnTone) {
  for (let i = 0; i < 5; i++) {
    const { value = [], version } = await $.state.get(TURNS)
    const next = [...value, turn].slice(-MAX_TURNS)
    if ((await $.state.set(TURNS, next, { ifVersion: version })).isSet) return
  }
}

const ACTIVITY: Record<Activity | 'idle', { color: string; label: string }> = {
  think: { color: '#8B5CF6', label: 'Réfléchit' },
  write: { color: '#3B82F6', label: 'Écrit' },
  read: { color: '#06B6D4', label: 'Lit' },
  edit: { color: '#F97316', label: 'Modifie' },
  run: { color: '#EAB308', label: 'Exécute' },
  web: { color: '#22C55E', label: 'Navigue' },
  agent: { color: '#EC4899', label: 'Délègue' },
  other: { color: '#94A3B8', label: 'Outil' },
  idle: { color: '#64748B', label: 'En attente' },
}

// Word lists, French and English, matched on whole words.
const SIGNALS: { id: Signal; label: string; color: string; words: string[] }[] = [
  {
    id: 'certitude',
    label: 'Certitude',
    color: '#2563EB',
    words: ['clairement', 'évidemment', 'certainement', 'certain', 'exactement', 'confirmé', 'vérifié', 'forcément', 'clearly', 'definitely', 'certainly', 'confirmed', 'verified', 'exactly', 'obviously', 'indeed'],
  },
  {
    id: 'hesitation',
    label: 'Hésitation',
    color: '#A78BFA',
    words: ['peut-être', 'probablement', 'sans doute', 'il semble', 'semble', 'je pense', 'je crois', 'pas sûr', 'hypothèse', 'possible', 'plausible', 'maybe', 'perhaps', 'probably', 'might', 'seems', 'i think', 'not sure', 'unclear', 'likely', 'guess'],
  },
  {
    id: 'vigilance',
    label: 'Vigilance',
    color: '#EF4444',
    words: ['attention', 'risque', 'risqué', 'danger', 'dangereux', 'prudence', 'prudent', 'erreur', 'bug', 'cassé', 'casse', 'échec', 'échoue', 'piège', 'inquiet', 'inquiète', 'inquiétude', 'careful', 'risk', 'risky', 'error', 'fail', 'fails', 'failed', 'broken', 'warning', 'pitfall', 'concern', 'worry', 'avoid'],
  },
  {
    id: 'chaleur',
    label: 'Chaleur',
    color: '#10B981',
    words: ['merci', 'parfait', 'super', 'génial', 'excellent', 'bravo', 'content', 'plaisir', 'ravi', 'chouette', 'good', 'great', 'nice', 'perfect', 'thanks', 'glad', 'happy', 'love'],
  },
  {
    id: 'revision',
    label: 'Remise en question',
    color: '#F59E0B',
    words: ['en fait', 'attends', 'hmm', 'oups', 'plutôt', 'finalement', 'je me suis trompé', 'actually', 'wait', 'oops', 'instead', 'rather', 'on second thought', 'mistake', 'wrong'],
  },
  {
    id: 'planif',
    label: 'Planification',
    color: '#14B8A6',
    words: ["d'abord", 'ensuite', 'puis', 'étape', 'plan', 'je vais', 'on va', 'first', 'then', 'next', 'let me', 'step', "i'll", 'going to', 'finally'],
  },
  {
    id: 'curiosite',
    label: 'Curiosité',
    color: '#D946EF',
    words: ['intéressant', 'curieux', 'pourquoi', 'étonnant', 'surprenant', 'interesting', 'curious', 'why', 'wonder', 'surprising', 'how come'],
  },
]

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PATTERNS = SIGNALS.map(s => ({
  id: s.id,
  re: new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${s.words.map(escapeRegex).join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  ),
}))

function count(text: string): Tone {
  const out: Tone = { ...EMPTY_TONE }
  const low = text.toLowerCase().replace(/’/g, "'")
  for (const p of PATTERNS) out[p.id] = low.match(p.re)?.length ?? 0
  out.curiosite += (low.match(/\?/g) ?? []).length

  return out
}

function addTone(a: Tone, b: Tone): Tone {
  const out: Tone = { ...a }
  for (const s of SIGNALS) out[s.id] += b[s.id]

  return out
}

function kindOfTool(name: string): Activity {
  if (/^(Read|Grep|Glob|LS|NotebookRead)$/.test(name) || /McpResource/.test(name)) return 'read'
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(name)) return 'edit'
  if (/^(Bash|PowerShell|Monitor|TaskStop)$/.test(name)) return 'run'
  if (/^(WebSearch|WebFetch)$/.test(name) || /claude-in-chrome|playwright/.test(name)) return 'web'
  if (/^(Agent|Task|SendMessage)$/.test(name)) return 'agent'

  return 'other'
}

const clip = (s: string, n: number) => {
  const flat = s.replace(/\s+/g, ' ').trim()

  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat
}

function describeCall(e: Record<string, unknown>): string {
  for (const k of ['description', 'command', 'file_path', 'pattern', 'url', 'query', 'prompt', 'skill']) {
    const v = e[k]
    if (typeof v === 'string' && v.trim()) return clip(v, 90)
  }

  return ''
}

// Streaming bookkeeping. Module variables start over on a reload; what the
// pane draws lives in the atoms.
type Open = { kind: Activity; start: number; chars: number; text: string }
let open: Open | null = null
let pending = ''
let turnTone: Tone = { ...EMPTY_TONE }
let turnChars = 0
let lastFlush = 0

function absorb(text: string, isFinal = false) {
  pending += text
  turnChars += text.length
  // Count whole words only: keep the trailing partial word for the next chunk.
  const cut = isFinal ? pending.length : pending.search(/\s\S*$/)
  if (cut <= 0) return
  turnTone = addTone(turnTone, count(pending.slice(0, cut)))
  pending = pending.slice(cut)
}

function closeOpen($: EngineInterface, now: number) {
  if (!open) return
  const seg: Segment = {
    kind: open.kind,
    start: open.start,
    end: now,
    chars: open.chars,
    excerpt: clip(open.text, 160),
  }
  open = null
  void pushSegment($, seg)
}

function feed($: EngineInterface, kind: 'think' | 'write', text: string) {
  const now = Date.now()
  if (!open || open.kind !== kind) {
    closeOpen($, now)
    open = { kind, start: now, chars: 0, text: '' }
    lastFlush = 0
  }
  open.chars += text.length
  if (open.text.length < 240) open.text += text
  absorb(text)
  if (now - lastFlush < FLUSH_MS) return
  lastFlush = now
  const snapshot = { ...turnTone }
  const label = `${ACTIVITY[kind].label} · ${open.chars} caractères`
  const since = open.start
  void $.state.set(LIVE, { kind, since, label })
  void $.state.set(TONE, snapshot)
}

function blend(t: Tone): string {
  let total = 0
  let r = 0
  let g = 0
  let b = 0
  for (const s of SIGNALS) {
    const n = t[s.id]
    if (!n) continue
    total += n
    r += parseInt(s.color.slice(1, 3), 16) * n
    g += parseInt(s.color.slice(3, 5), 16) * n
    b += parseInt(s.color.slice(5, 7), 16) * n
  }
  if (!total) return ACTIVITY.idle.color
  const hex = (v: number) => Math.round(v / total).toString(16).padStart(2, '0')

  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function dominant(t: Tone, n = 2) {
  return SIGNALS.filter(s => t[s.id] > 0)
    .sort((a, b) => t[b.id] - t[a.id])
    .slice(0, n)
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const seconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)} s`
const clockTime = (at: number) => new Date(at).toTimeString().slice(0, 5)

function drawSvg(segs: Segment[], now: Live, t: Tone, history: TurnTone[]): string {
  const W = WIDTH
  const parts: string[] = []
  const caption = (y: number, text: string) =>
    `<text x="10" y="${y}" font-size="10" letter-spacing="1.2" fill="${MUTED}">${esc(text)}</text>`
  const act = ACTIVITY[now.kind]
  const isActive = now.kind !== 'idle'

  // Orb: core = current activity, ring = share of each tone signal this turn.
  const cx = 52
  const cy = 52
  const r = 38
  const circumference = 2 * Math.PI * r
  const total = SIGNALS.reduce((n, s) => n + t[s.id], 0)
  const ring: string[] = []
  if (total === 0) {
    ring.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${MUTED}" stroke-opacity="0.25" stroke-width="10"/>`)
  } else {
    let offset = 0
    for (const s of SIGNALS) {
      const n = t[s.id]
      if (!n) continue
      const len = (n / total) * circumference
      ring.push(
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="10" stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${-offset}"><title>${esc(`${s.label} : ${n}`)}</title></circle>`,
      )
      offset += len
    }
  }
  const spin =
    now.kind === 'think'
      ? `<animateTransform attributeName="transform" type="rotate" from="-90 ${cx} ${cy}" to="270 ${cx} ${cy}" dur="14s" repeatCount="indefinite"/>`
      : ''
  parts.push(
    `<defs><radialGradient id="core" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/><stop offset="45%" stop-color="${act.color}"/><stop offset="100%" stop-color="${act.color}" stop-opacity="0.75"/></radialGradient></defs>`,
    `<g transform="rotate(-90 ${cx} ${cy})">${ring.join('')}${spin}</g>`,
    `<circle cx="${cx}" cy="${cy}" r="24" fill="url(#core)"><title>${esc(act.label)}</title>${
      isActive ? '<animate attributeName="r" values="21;26;21" dur="1.6s" repeatCount="indefinite"/>' : ''
    }</circle>`,
  )
  const top = dominant(t)
  const mood = top.length ? top.map(s => s.label.toLowerCase()).join(' + ') : 'aucun signal pour l’instant'
  parts.push(
    `<text x="108" y="40" font-size="18" font-weight="600" fill="${act.color}">${esc(act.label)}</text>`,
    `<text x="108" y="62" font-size="12" fill="${MUTED}">${esc(clip(now.label, 34))}</text>`,
    `<text x="108" y="84" font-size="12" fill="${top[0]?.color ?? MUTED}">${esc(`Ton : ${mood}`)}</text>`,
  )

  // Ribbon: the last segments, width weighted by duration and length.
  let y = 122
  parts.push(caption(y, "FIL DE L'ACTIVITÉ"))
  const shown = segs.slice(-40)
  const weights = shown.map(s => 1 + Math.sqrt(Math.max(0, s.end - s.start) / 1000) + s.chars / 600)
  const sum = weights.reduce((a, b) => a + b, 0)
  const inner = W - 20
  let x = 10
  if (shown.length === 0) {
    parts.push(`<rect x="10" y="${y + 8}" width="${inner}" height="22" rx="4" fill="${MUTED}" fill-opacity="0.15"/>`)
  }
  shown.forEach((s, i) => {
    const w = ((weights[i] ?? 1) / sum) * inner
    const tip = [
      `${ACTIVITY[s.kind].label}${s.tool ? ` (${s.tool})` : ''} · ${seconds(s.end - s.start)}`,
      s.chars ? `${s.chars} caractères` : '',
      s.excerpt,
    ]
      .filter(Boolean)
      .join('\n')
    parts.push(
      `<rect x="${x.toFixed(1)}" y="${y + 8}" width="${Math.max(1, w - 1.5).toFixed(1)}" height="22" rx="3" fill="${ACTIVITY[s.kind].color}"><title>${esc(tip)}</title></rect>`,
    )
    x += w
  })
  y += 46
  const legend = (Object.keys(ACTIVITY) as (Activity | 'idle')[]).filter(k => k !== 'idle')
  legend.forEach((k, i) => {
    const lx = 10 + (i % 4) * 87
    const ly = y + Math.floor(i / 4) * 16
    parts.push(
      `<circle cx="${lx + 4}" cy="${ly - 4}" r="4" fill="${ACTIVITY[k].color}"/>`,
      `<text x="${lx + 12}" y="${ly}" font-size="10.5" fill="${MUTED}">${ACTIVITY[k].label}</text>`,
    )
  })

  // Tone bars for the current turn.
  y += 44
  parts.push(caption(y, 'SIGNAUX DE TON · CE TOUR'))
  const max = Math.max(1, ...SIGNALS.map(s => t[s.id]))
  const track = W - 160
  SIGNALS.forEach((s, i) => {
    const ry = y + 18 + i * 20
    const n = t[s.id]
    parts.push(
      `<text x="10" y="${ry + 9}" font-size="12" fill="${s.color}">${esc(s.label)}</text>`,
      `<rect x="128" y="${ry}" width="${track}" height="10" rx="5" fill="${MUTED}" fill-opacity="0.18"/>`,
      n
        ? `<rect x="128" y="${ry}" width="${((n / max) * track).toFixed(1)}" height="10" rx="5" fill="${s.color}"><title>${esc(`${s.label} : ${n} occurrence(s)`)}</title></rect>`
        : '',
      `<text x="${W - 10}" y="${ry + 9}" font-size="11" text-anchor="end" fill="${MUTED}">${n}</text>`,
    )
  })

  // One dot per finished turn, colored by its blended tone.
  y += 18 + SIGNALS.length * 20 + 22
  parts.push(caption(y, 'TEINTE DES DERNIERS TOURS'))
  const past = history.slice(-15)
  if (past.length === 0) {
    parts.push(`<text x="10" y="${y + 22}" font-size="11" fill="${MUTED}">Aucun tour terminé</text>`)
  }
  past.forEach((turn, i) => {
    const desc = dominant(turn.tone, 3)
      .map(s => `${s.label} ${turn.tone[s.id]}`)
      .join(', ')
    parts.push(
      `<circle cx="${18 + i * 22}" cy="${y + 18}" r="8" fill="${blend(turn.tone)}"><title>${esc(`Tour de ${clockTime(turn.at)} · ${turn.chars} caractères\n${desc || 'aucun signal'}`)}</title></circle>`,
    )
  })
  const height = y + 36

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">${parts.join('')}</svg>`
}

const DISCLAIMER =
  'Couleurs calculées sur le texte que Claude écrit (réflexion visible et réponses) et sur ses appels d’outils. C’est une lecture du vocabulaire, pas un capteur d’émotions.'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'prisme',
      description: 'Ouvre le Prisme : activité et ton de Claude en couleurs',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'prisme' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Prisme ouvert.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      turnTone = { ...EMPTY_TONE }
      turnChars = 0
      pending = ''
      await $.state.set(TONE, { ...EMPTY_TONE })
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    for await (const c of next(e)) {
      if (c.kind === 'thinking') feed($, 'think', c.text)
      else if (c.kind === 'text') feed($, 'write', c.text)
      else if (c.kind === 'tool') {
        const kind = kindOfTool(c.name)
        closeOpen($, Date.now())
        void $.state.set(LIVE, { kind, since: Date.now(), label: `Prépare ${c.name}` })
      } else if (c.kind === 'stop') {
        closeOpen($, Date.now())
        absorb('', true)
        void $.state.set(TONE, { ...turnTone })
      }
      yield c
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const kind = kindOfTool(e.tool)
    const start = Date.now()
    const what = describeCall(e as unknown as Record<string, unknown>)
    closeOpen($, start)
    void $.state.set(LIVE, { kind, since: start, label: what ? `${e.tool} · ${what}` : e.tool })
    const ran = await next(e)
    const end = Date.now()
    void pushSegment($, { kind, start, end, chars: 0, excerpt: what, tool: e.tool })
    void $.state.set(LIVE, { kind: 'idle', since: end, label: 'Lit le résultat' })

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = Date.now()
      closeOpen($, now)
      absorb('', true)
      const done: TurnTone = { id: e.turnId, at: now, tone: { ...turnTone }, chars: turnChars }
      void $.state.set(TONE, done.tone)
      if (turnChars > 0) void pushTurn($, done)
      void $.state.set(LIVE, { ...IDLE, since: now })
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const [s1, s2, s3, s4] = await Promise.all([
      $.state.get(SEGMENTS),
      $.state.get(LIVE),
      $.state.get(TONE),
      $.state.get(TURNS),
    ])
    const segs = Array.isArray(s1.value) ? s1.value : []
    const now = s2.value ?? IDLE
    const t = { ...EMPTY_TONE, ...s3.value }
    const history = Array.isArray(s4.value) ? s4.value : []
    const reset = async () => {
      await Promise.all([
        $.state.set(SEGMENTS, []),
        $.state.set(TURNS, []),
        $.state.set(TONE, { ...EMPTY_TONE }),
      ])
    }

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      const max = Math.max(1, ...SIGNALS.map(s => t[s.id]))
      const room = Math.max(10, (e.props.bodyColumns ?? 40) - 24)

      return (
        <Box flexDirection="column" gap={1}>
          <Text color={ACTIVITY[now.kind].color} bold>
            ● {ACTIVITY[now.kind].label} <Text dimColor>{now.label}</Text>
          </Text>
          <Text>
            {segs.slice(-room).map(s => (
              <Text color={ACTIVITY[s.kind].color}>█</Text>
            ))}
          </Text>
          <Box flexDirection="column">
            {SIGNALS.map(s => (
              <Text>
                <Text color={s.color}>{s.label.padEnd(19)}</Text>
                <Text color={s.color}>{'█'.repeat(Math.round((t[s.id] / max) * 12))}</Text>
                <Text dimColor> {t[s.id]}</Text>
              </Text>
            ))}
          </Box>
          <Text>
            {history.slice(-room).map(turn => (
              <Text color={blend(turn.tone)}>● </Text>
            ))}
          </Text>
          <Text dimColor>{DISCLAIMER}</Text>
          <Button key="reset" label="Réinitialiser" onPress={reset} />
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const top = dominant(t)

    return (
      <Box flexDirection="column" gap="sm">
        <Svg
          source={drawSvg(segs, now, t, history)}
          alt={`${ACTIVITY[now.kind].label}. Ton dominant : ${top.map(s => s.label).join(', ') || 'aucun'}.`}
          isInteractive
        />
        <Text dimColor size="caption">
          {DISCLAIMER}
        </Text>
        <Box flexDirection="row">
          <Button key="reset" label="Réinitialiser" onPress={reset} />
        </Box>
      </Box>
    )
  })
}
