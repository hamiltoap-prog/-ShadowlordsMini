import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes } from 'react'

/** Placa da HUD: canto chanfrado, fio de ouro no topo e fundo de aço escuro. */
export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`hud-chamfer relative border border-[color:var(--gold-dark)] bg-[var(--surface-card)]/90 shadow-[0_2px_18px_-8px_rgba(0,0,0,0.8)] ${className}`}
    >
      <span className="hud-rule pointer-events-none absolute inset-x-0 top-0 h-px opacity-70" />
      {children}
    </div>
  )
}

export function SectionTitle({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <h2
      className={`flex items-center gap-2 font-serif text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--gold)] ${className}`}
    >
      <span className="h-3 w-px shrink-0 bg-[color:var(--gold)]/70" />
      {children}
    </h2>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variantClasses: Record<ButtonVariant, string> = {
  // Ação principal: placa de ouro, como os CTAs do jogo.
  primary:
    'border border-[color:var(--gold)] bg-[color:var(--gold-deep)] text-[color:var(--gold-bright)] hover:bg-[color:var(--gold)] hover:text-[#0a1420] hover:shadow-[0_0_14px_-2px_rgba(200,170,110,0.55)]',
  // Ação comum: contorno de ouro sobre o aço, preenche no hover.
  secondary:
    'border border-[color:var(--gold-deep)] bg-[var(--surface-tab)] text-[color:var(--gold)] hover:border-[color:var(--gold)] hover:bg-[var(--surface-tab-active)] hover:text-[color:var(--gold-bright)]',
  ghost: 'border border-transparent bg-transparent text-purple-200 hover:border-[color:var(--gold-deep)] hover:text-[color:var(--gold-bright)]',
  danger: 'border border-red-800/70 bg-red-950/60 text-red-200 hover:border-red-500 hover:bg-red-900/70 hover:text-red-100',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:shadow-none ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
}

/** Aba da HUD: rótulo em capitulares com um traço de ouro sob a ativa. */
export function TabButton({
  active = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={`whitespace-nowrap border-b-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition ${
        active
          ? 'border-[color:var(--gold)] bg-[var(--surface-tab-active)]/60 text-[color:var(--gold-bright)]'
          : 'border-transparent text-purple-300 hover:border-[color:var(--gold-deep)] hover:text-[color:var(--gold)]'
      } ${className}`}
      {...props}
    />
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-[color:var(--gold-dark)] bg-[var(--surface-well)] px-3 py-1.5 text-sm text-purple-100 outline-none transition placeholder:text-purple-400/50 focus:border-[color:var(--gold)] focus:shadow-[0_0_0_1px_rgba(200,170,110,0.25)] ${props.className ?? ''}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full border border-[color:var(--gold-dark)] bg-[var(--surface-well)] px-3 py-1.5 text-sm text-purple-100 outline-none transition focus:border-[color:var(--gold)] ${props.className ?? ''}`}
    />
  )
}

export function Badge({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'good' | 'bad' }>) {
  const toneClasses = {
    default: 'border-[color:var(--gold-deep)] bg-[var(--surface-tab)] text-[color:var(--gold)]',
    good: 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200',
    bad: 'border-red-800/60 bg-red-950/50 text-red-200',
  }[tone]
  return (
    <span className={`border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${toneClasses}`}>
      {children}
    </span>
  )
}
