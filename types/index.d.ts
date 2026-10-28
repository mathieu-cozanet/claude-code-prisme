export type Activity =
  | 'think'
  | 'write'
  | 'read'
  | 'edit'
  | 'run'
  | 'web'
  | 'agent'
  | 'other'

export type Signal =
  | 'certitude'
  | 'hesitation'
  | 'vigilance'
  | 'chaleur'
  | 'revision'
  | 'planif'
  | 'curiosite'

export type Tone = Record<Signal, number>

// One stretch of activity: thinking, writing an answer, or one tool running.
export type Segment = {
  kind: Activity
  start: number
  end: number
  chars: number
  excerpt: string
  tool?: string
}

// What the pane's orb shows right now.
export type Live = {
  kind: Activity | 'idle'
  since: number
  label: string
}

// The tone of one finished turn, for the history row.
export type TurnTone = { id: string; at: number; tone: Tone; chars: number }

declare module 'claude-code' {
  interface PluginState {
    prisme: {
      segments: Segment[]
      live: Live
      tone: Tone
      turns: TurnTone[]
    }
  }
}
