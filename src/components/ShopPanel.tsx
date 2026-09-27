import { useMemo, useState } from 'react'
import { ARMOR_NOTE } from '../data/equipment'
import { formatBonus } from '../lib/gear'
import { RARITY_STYLE, shopEntries } from '../lib/items'
import type { ShopEntry } from '../lib/items'
import { CUSTOM_ITEM_KIND_LABELS, RARITY_LABELS } from '../types'
import type { CustomItem, CustomItemKind } from '../types'
import { Badge, Button, Card, Input, SectionTitle, TabButton } from './ui'

/**
 * Loja da mesa. Fica escondida até o Mestre liberar; quando ele abre, ela
 * aparece com destaque na ficha do jogador — antes era uma tira apertada no pé
 * do inventário, fácil de não notar justo no momento em que passa a valer.
 *
 * A prateleira junta o que está no manual com o que o Mestre forjou (esses vêm
 * primeiro, marcados pela raridade e pelo selo de mágico).
 */

const TABS: [CustomItemKind, string, string][] = [
  ['weapon', '⚔️', 'Armas'],
  ['armor', '🛡️', 'Armaduras'],
  ['gear', '🎒', 'Equipamento'],
]

export function ShopPanel({
  open,
  gold,
  customItems,
  onBuy,
}: {
  open: boolean
  gold: number
  customItems: CustomItem[]
  onBuy: (entry: ShopEntry) => Promise<void> | void
}) {
  const [tab, setTab] = useState<CustomItemKind>('weapon')
  const [search, setSearch] = useState('')
  const [onlyAffordable, setOnlyAffordable] = useState(false)
  const [busy, setBusy] = useState('')
  /** Descrição aberta por inteiro (as outras ficam em até duas linhas). */
  const [expanded, setExpanded] = useState<string | null>(null)

  // Só o que o Mestre marcou como "na loja" vai para a prateleira; o resto do
  // catálogo dele existe para ser entregue à mão (tesouro, recompensa).
  const onShelf = useMemo(() => customItems.filter((i) => i.inShop), [customItems])
  const counts = useMemo(
    () => Object.fromEntries(TABS.map(([k]) => [k, shopEntries(k, onShelf).length])) as Record<CustomItemKind, number>,
    [onShelf],
  )
  const items = useMemo(() => shopEntries(tab, onShelf), [tab, onShelf])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => {
      if (onlyAffordable && i.custo > gold) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        i.note?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      )
    })
  }, [items, search, onlyAffordable, gold])

  if (!open) {
    return (
      <Card className="flex min-w-0 items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <SectionTitle>🏪 Loja</SectionTitle>
          <p className="mt-1 text-xs text-purple-300/50">
            Fechada. O Mestre abre quando o grupo chegar a um lugar de comércio.
          </p>
        </div>
        <Badge>fechada</Badge>
      </Card>
    )
  }

  async function buy(entry: ShopEntry) {
    setBusy(entry.key)
    try {
      await onBuy(entry)
    } finally {
      setBusy('')
    }
  }

  return (
    <Card
      className="flex min-w-0 flex-col gap-3 border-[color:var(--gold)] p-3 shadow-[0_0_24px_-10px_rgba(200,170,110,0.65)] sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <SectionTitle>🏪 Loja aberta</SectionTitle>
          <p className="mt-0.5 text-[11px] text-emerald-300/80">O Mestre liberou as compras.</p>
        </div>
        <span
          className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--gold-dark)] bg-black/30 px-3 py-1 text-sm tabular-nums text-[color:var(--gold-bright)]"
          title="Suas moedas"
        >
          💰 {gold}
        </span>
      </div>

      {/* Abas numa linha só: se não couber, rolam de lado dentro da loja — em
          vez de quebrar em duas linhas ou alargar a página. */}
      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-[color:var(--gold-dark)] px-1" role="tablist">
        {TABS.map(([key, icon, label]) => (
          <TabButton key={key} active={tab === key} onClick={() => setTab(key)} className="shrink-0">
            {/* Ícone e contador ficam para telas maiores: no celular eram eles
                que empurravam a terceira aba para fora. */}
            <span className="mr-1 hidden sm:inline">{icon}</span>
            {label}
            <span className="ml-1 hidden text-[10px] text-purple-400/60 sm:inline">{counts[key]}</span>
          </TabButton>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <Input placeholder="Procurar na loja..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-purple-200">
          <input type="checkbox" checked={onlyAffordable} onChange={(e) => setOnlyAffordable(e.target.checked)} />
          só o que dá para comprar
        </label>
      </div>

      {/* No celular a lista corre com a página (uma caixa rolando dentro de
          outra é ruim de usar no dedo); no computador ela ganha rolagem própria
          para a loja não empurrar o resto da ficha para longe. */}
      <ul className="flex flex-col gap-1.5 lg:max-h-[28rem] lg:overflow-y-auto lg:pr-1">
        {filtered.map((i) => {
          const canAfford = gold >= i.custo
          const forged = i.key.startsWith('custom:')
          const text = i.description || i.note
          const isOpen = expanded === i.key
          return (
            <li
              key={i.key}
              data-shop-item={i.name}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded border px-2.5 py-2 ${
                forged ? 'border-[color:var(--gold-deep)] bg-[color:var(--gold)]/5' : 'border-purple-900/30 bg-black/20'
              }`}
            >
              <div className="min-w-0">
                {/* Nome e números na mesma linha: o que decide a compra (o dado,
                    a Defesa) fica colado no nome, e a lista não vira uma tira
                    sem fim no celular. */}
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-snug">
                  <span className={`min-w-0 break-words ${i.rarity ? RARITY_STYLE[i.rarity] : 'text-purple-100'}`}>
                    {i.icon && <span className="mr-1">{i.icon}</span>}
                    {i.name}
                  </span>
                  {i.extra && (
                    <span className="rounded border border-purple-800/50 bg-black/30 px-1.5 py-px text-[11px] tabular-nums text-purple-100">
                      {i.extra}
                    </span>
                  )}
                  {i.bonuses?.map((b, n) => (
                    <span
                      key={n}
                      title="Entra na ficha sozinho enquanto o item estiver equipado"
                      className="rounded border border-emerald-700/50 bg-emerald-950/30 px-1.5 py-px text-[11px] text-emerald-200"
                    >
                      {formatBonus(b)}
                    </span>
                  ))}
                  {i.magical && <Badge tone="good">mágico</Badge>}
                  {forged && i.rarity && i.rarity !== 'comum' && <Badge>{RARITY_LABELS[i.rarity]}</Badge>}
                </p>
                {text && (
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : i.key)}
                    title={isOpen ? 'Mostrar menos' : 'Ler tudo'}
                    data-shop-desc={isOpen ? 'aberta' : 'curta'}
                    className="mt-0.5 w-full break-words text-left text-[11px] leading-snug text-purple-300/60 hover:text-purple-200"
                  >
                    {/* O corte em duas linhas fica num span próprio: no botão, o
                        `display` dele brigava com o do corte e o texto vinha
                        inteiro. */}
                    <span className={isOpen ? '' : 'line-clamp-2'}>{text}</span>
                  </button>
                )}
              </div>

              <div className="flex w-[5.5rem] flex-col items-stretch gap-1 text-right">
                <span
                  className={`text-sm tabular-nums ${canAfford ? 'text-[color:var(--gold)]' : 'text-red-400/80'}`}
                  data-price=""
                >
                  💰 {i.custo}
                </span>
                <Button
                  variant="primary"
                  className="w-full px-2 text-xs"
                  disabled={!canAfford || busy === i.key}
                  title={canAfford ? `Comprar por ${i.custo} moedas` : `Faltam ${i.custo - gold} moedas`}
                  onClick={() => buy(i)}
                >
                  {busy === i.key ? '...' : 'Comprar'}
                </Button>
                {!canAfford && <span className="text-[10px] leading-tight text-red-300/70">faltam {i.custo - gold}</span>}
              </div>
            </li>
          )
        })}
        {filtered.length === 0 && (
          <li className="py-3 text-center text-xs text-purple-400/50">
            {onlyAffordable && items.length > 0
              ? 'Nada aqui cabe nas suas moedas agora.'
              : `Nada com esse nome em ${CUSTOM_ITEM_KIND_LABELS[tab].toLowerCase()}.`}
          </li>
        )}
      </ul>

      {tab === 'armor' && <p className="text-[11px] leading-relaxed text-purple-400/50">{ARMOR_NOTE}</p>}
      <p className="text-[11px] text-purple-400/50">
        A compra sai das suas moedas na hora e aparece no registro da sessão. Armas e armaduras já entram equipadas.
      </p>
    </Card>
  )
}
