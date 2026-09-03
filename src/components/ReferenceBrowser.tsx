import { type ReactNode, useState } from 'react'
import { BESTIARY } from '../data/bestiary'
import { ARMORS, ARMOR_NOTE, GEAR, WEAPONS } from '../data/equipment'
import { OCCUPATIONS } from '../data/occupations'
import { ORIGINS } from '../data/origins'
import { SKILLS } from '../data/skills'
import { CURSES, SPELLS } from '../data/spells'
import {
  ACHADOS,
  ERMOS_AVISTAMENTOS,
  ERMOS_CLIMA,
  ERMOS_CONDICAO,
  ERMOS_MARCOS,
  ERMOS_SITUACAO_COMPLEMENTAR,
  ERMOS_SITUACAO_PRINCIPAL,
  ERMOS_TIPO,
  ERMOS_VESTIGIOS,
  ORACLE_YES_NO,
  TESOURO_ARTEFATOS,
  TESOURO_GEMAS,
  TESOURO_JOIAS,
  TESOURO_MOEDAS,
  TESOURO_OBJETOS_MAGICOS,
  TESOURO_PERGAMINHOS,
  TESOURO_TIPO,
  type RollTable,
} from '../data/tables'
import { d66ToIndex36, roll1d66, roll1d6 } from '../lib/dice'
import { addLogEntry } from '../lib/store'
import type { GameTable } from '../types'
import { Badge, Button, Card, SectionTitle } from './ui'
import { InfoButton } from './InfoButton'

function rollTableResult(t: RollTable): { text: string; rolled: string; dice: number[] } {
  if (t.dice === '1d66') {
    const r = roll1d66()
    return { text: t.entries[d66ToIndex36(r.value)] ?? '?', rolled: `1d66=${r.value}`, dice: [r.tens, r.units] }
  }
  const r = roll1d6()
  return { text: t.entries[r - 1] ?? '?', rolled: `1d6=${r}`, dice: [r] }
}

function RollTableButton({ table, tableDef, actorName }: { table: GameTable; tableDef: RollTable; actorName: string }) {
  const [last, setLast] = useState<string | null>(null)
  async function go() {
    const res = rollTableResult(tableDef)
    setLast(res.text)
    await addLogEntry(table.id, {
      actorName,
      actorType: 'gm',
      kind: 'random_table',
      summary: `${tableDef.title} (${res.rolled}): ${res.text}`,
      rolls: res.dice,
      dice: res.dice,
      diceLabel: tableDef.title,
    })
  }
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-purple-900/30 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-purple-200">{tableDef.title}</span>
        <Button onClick={go}>🔮 Rolar</Button>
      </div>
      {last && <p className="text-xs text-purple-300/70">→ {last}</p>}
    </div>
  )
}

function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="p-3">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <SectionTitle>{title}</SectionTitle>
        <span className="text-purple-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </Card>
  )
}

export function ReferenceBrowser({ table, actorName }: { table: GameTable; actorName: string }) {
  async function rollOracle() {
    const r = roll1d6()
    const text = ORACLE_YES_NO[r - 1]
    await addLogEntry(table.id, {
      actorName,
      actorType: 'gm',
      kind: 'random_table',
      summary: `Oráculo (1d6=${r}): ${text}`,
      rolls: [r],
      dice: [r],
      diceLabel: 'Oráculo',
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Tabelas Aleatórias</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={rollOracle}>
            🔮 Consultar Oráculo (Sim/Não)
          </Button>
        </div>
        <p className="mt-1 text-xs uppercase text-purple-400/60">Tesouros</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[TESOURO_TIPO, TESOURO_MOEDAS, TESOURO_GEMAS, TESOURO_JOIAS, TESOURO_PERGAMINHOS, TESOURO_OBJETOS_MAGICOS, TESOURO_ARTEFATOS].map((t) => (
            <RollTableButton key={t.title} table={table} tableDef={t} actorName={actorName} />
          ))}
        </div>
        <p className="mt-1 text-xs uppercase text-purple-400/60">Achados</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <RollTableButton table={table} tableDef={ACHADOS} actorName={actorName} />
        </div>
        <p className="mt-1 text-xs uppercase text-purple-400/60">Exploração de Ermos</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[ERMOS_TIPO, ERMOS_CLIMA, ERMOS_CONDICAO, ERMOS_AVISTAMENTOS, ERMOS_SITUACAO_PRINCIPAL, ERMOS_VESTIGIOS, ERMOS_MARCOS, ERMOS_SITUACAO_COMPLEMENTAR].map(
            (t) => (
              <RollTableButton key={t.title} table={table} tableDef={t} actorName={actorName} />
            ),
          )}
        </div>
      </Card>

      <Collapsible title="Grimório (Feitiços)">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {SPELLS.map((s) => (
            <div key={s.name} className="rounded border border-purple-900/30 bg-black/20 p-2 text-sm">
              <p className="text-purple-100">
                {s.name} <Badge>{s.custo} PV</Badge>
              </p>
              <p className="text-xs text-purple-300/60">{s.efeito}</p>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Maldição (falha em Feitiçaria)">
        <div className="flex flex-col gap-1">
          {CURSES.map((c) => (
            <p key={c.d66} className="text-sm text-purple-200">
              <span className="text-purple-400">{c.d66}</span> — {c.effect}
            </p>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Armas">
        <div className="grid gap-1 sm:grid-cols-2">
          {WEAPONS.map((w) => (
            <p key={w.name} className="text-sm text-purple-200">
              {w.name} — {w.dano} · {w.habilidade} · {w.tipo} · {w.custo} moedas
            </p>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Armaduras">
        <div className="flex flex-col gap-1">
          {ARMORS.map((a) => (
            <p key={a.name} className="text-sm text-purple-200">
              {a.name} (+{a.defesa} Def) — {a.protecao} · {a.custo} moedas
            </p>
          ))}
          <p className="mt-1 text-xs text-purple-400/60">{ARMOR_NOTE}</p>
        </div>
      </Collapsible>

      <Collapsible title="Equipamentos">
        <div className="grid gap-1 sm:grid-cols-3">
          {GEAR.map((g) => (
            <p key={g.name} className="text-sm text-purple-200">
              {g.name} — {g.custo}
            </p>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Habilidades">
        <div className="grid gap-1 sm:grid-cols-2">
          {SKILLS.map((s) => (
            <p key={s.name} className="text-sm text-purple-200">
              <b className="text-purple-100">{s.name}</b> — {s.description}
            </p>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Ocupações">
        <div className="grid gap-1 sm:grid-cols-2">
          {OCCUPATIONS.map((o) => (
            <p key={o.name} className="text-sm text-purple-200">
              <b className="text-purple-100">{o.name}</b> — {o.arma} · {o.habilidade}
            </p>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Origens">
        <div className="grid gap-1 sm:grid-cols-2">
          {ORIGINS.map((o) => (
            <p key={o.name} className="flex items-center gap-1.5 text-sm text-purple-200">
              <b className="text-purple-100">{o.name}</b>
              <InfoButton title={o.name} text={o.lore} />— {o.habilidades.join(', ')}
            </p>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Bestiário">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {BESTIARY.map((b) => (
            <div key={b.name} className="rounded border border-purple-900/30 bg-black/20 p-2 text-sm">
              <p className="text-purple-100">
                {b.name} <span className="text-xs text-purple-400/60">({b.category})</span>
              </p>
              <p className="text-xs text-purple-300/70">
                Defesa {b.defense} · PV {b.hp} · {b.attacks.map((a) => `${a.name} (${a.dano})`).join(', ')}
              </p>
              {b.special && <p className="text-xs text-purple-400/60">{b.special}</p>}
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  )
}
