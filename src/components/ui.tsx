import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, SelectHTMLAttributes } from 'react'

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`rounded-xl border border-purple-900/40 bg-[#151220]/80 shadow-[0_0_0_1px_rgba(170,59,255,0.03)] ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <h2 className={`font-serif text-sm font-semibold uppercase tracking-widest text-purple-300/80 ${className}`}>
      {children}
    </h2>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-purple-700 hover:bg-purple-600 text-white shadow-purple-900/40 shadow-md',
  secondary: 'bg-[#241f33] hover:bg-[#302a45] text-purple-100 border border-purple-800/50',
  ghost: 'bg-transparent hover:bg-white/5 text-purple-200',
  danger: 'bg-red-900/70 hover:bg-red-800 text-red-100',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-purple-900/50 bg-[#0f0d16] px-3 py-1.5 text-sm text-purple-50 outline-none placeholder:text-purple-400/40 focus:border-purple-500 ${props.className ?? ''}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-purple-900/50 bg-[#0f0d16] px-3 py-1.5 text-sm text-purple-50 outline-none focus:border-purple-500 ${props.className ?? ''}`}
    />
  )
}

export function Badge({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'good' | 'bad' }>) {
  const toneClasses = {
    default: 'bg-purple-900/40 text-purple-200 border-purple-700/50',
    good: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50',
    bad: 'bg-red-900/40 text-red-200 border-red-700/50',
  }[tone]
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClasses}`}>{children}</span>
}
