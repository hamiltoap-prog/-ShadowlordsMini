import { useMemo, useState } from 'react'
import { ARMORS, ARMOR_NOTE, GEAR, WEAPONS } from '../data/equipment'
import { Badge, Button, Card, Input, SectionTitle, TabButton } from './ui'

/**
 * Loja da mesa. Fica escondida até o Mestre liberar; quando ele abre, ela
 * aparece com destaque na ficha do jogador — antes era uma tira apertada no pé
 * do inventário, fácil de não notar justo no momento em que passa a valer.
 */

type ShopTab = 'armas' | 'armaduras' | 'equipamento'
export type ShopKind = 'weapon' | 'armor' | 'gear'

interface ShopItem {
  name: string
  custo: number
  extra?: string
  note?: string
}

const TABS: [ShopTab, string][] = [
  ['armas', '⚔️ Armas'],
  ['armaduras', '🛡️ Armaduras'],
  ['equipamento', '🎒 Equipamento'],
]

const KIND_OF: Record<ShopTab, ShopKind> = { armas: 'weapon', armaduras: 'armor', equipamento: 'gear' }

export function ShopPanel({
  open,
  gold,
  onBuy,
}: {
  open: boolean
  gold: number
  onBuy: (kind: ShopKind, itemName: string) => Promise<void> | void
}) {
  const [tab, setTab] = useState<ShopTab>('armas')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')

  const items: ShopItem[] = useMemo(() => {
    if (tab === 'armas') {
      return WEAPONS.map((w) => ({ name: w.name, custo: w.custo, extra: w.dano, note: `${w.habilidade} · ${w.tipo}` }))
    }
    if (tab === 'armaduras') {
      return ARMORS.map((a) => ({ name: a.name, custo: a.custo, extra: `+${a.defesa} Defesa`, note: a.protecao }))
    }
    return GEAR.map((g) => ({ name: g.name, custo: g.custo }))
  }, [tab])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.note?.toLowerCase().includes(q))
  }, [items, search])

  if (!open) {
    return (
      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <SectionTitle>🏪 Loja</SectionTitle>
          <p className="mt-1 text-xs text-purple-300/50">
            Fechada. O Mestre abre quando o grupo chegar a um lugar de comércio.
          </p>
        </div>
        <Badge>fechada</Badge>
      </Card>
    )
  }

  async function buy(name: string) {
    setBusy(name)
    try {
      await onBuy(KIND_OF[tab], name)
    } finally {
      setBusy('')
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-[color:var(--gold)] p-4 shadow-[0_0_24px_-10px_rgba(200,170,110,0.65)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>🏪 Loja aberta</SectionTitle>
        <span className="flex items-center gap-2">
          <Badge tone="good">o Mestre liberou as compras</Badge>
          <span className="text-sm text-[color:var(--gold-bright)]">
            💰 {gold} <span className="text-xs text-purple-300/60">moedas</span>
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--gold-dark)]">
        {TABS.map(([key, label]) => (
          <TabButton key={key} active={tab === key} onClick={() => setTab(key)}>
            {label}
          </TabButton>
        ))}
      </div>

      <Input placeholder="Procurar na loja..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
        {filtered.map((i) => {
          const canAfford = gold >= i.custo
          return (
            <div
              key={i.name}
              className="flex items-center justify-between gap-3 rounded border border-purple-900/30 bg-black/20 px-2 py-1.5"
            >
              <span className="min-w-0">
                <span className="text-sm text-purple-100">
                  {i.name} {i.extra && <span className="text-purple-300/60">({i.extra})</span>}
                </span>
                {i.note && <span className="block truncate text-[11px] text-purple-400/50">{i.note}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`text-sm tabular-nums ${canAfford ? 'text-[color:var(--gold)]' : 'text-red-400/70'}`}>
                  {i.custo}
                </span>
                <Button
                  variant="primary"
                  className="text-xs"
                  disabled={!canAfford || busy === i.name}
                  title={canAfford ? `Comprar por ${i.custo} moedas` : 'Moedas insuficientes'}
                  onClick={() => buy(i.name)}
                >
                  {busy === i.name ? '...' : 'Comprar'}
                </Button>
              </span>
            </div>
          )
        })}
        {filtered.length === 0 && <p className="py-3 text-center text-xs text-purple-400/40">Nada com esse nome.</p>}
      </div>

      {tab === 'armaduras' && <p className="text-[11px] leading-relaxed text-purple-400/50">{ARMOR_NOTE}</p>}
      <p className="text-[11px] text-purple-400/50">
        A compra sai das suas moedas na hora e aparece no registro da sessão. Armas e armaduras já entram equipadas.
      </p>
    </Card>
  )
}
