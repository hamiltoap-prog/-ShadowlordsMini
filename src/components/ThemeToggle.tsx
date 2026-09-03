import { useTheme } from '../hooks/useTheme'

/** Botão flutuante para alternar entre modo claro e escuro, disponível em qualquer tela. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="fixed bottom-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-purple-700/50 bg-[var(--surface-card)] text-lg shadow-lg transition hover:border-purple-500"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
