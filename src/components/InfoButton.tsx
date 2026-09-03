import { useState } from 'react'
import { createPortal } from 'react-dom'
import { SectionTitle } from './ui'

/** Ícone "ⓘ" que abre uma janela com mais informações do manual sobre algo específico.
 * O modal é renderizado num portal (fora da árvore do botão) para nunca ficar
 * aninhado dentro de um <p> ou <button> — o que geraria HTML inválido quando
 * este ícone é usado dentro de um item clicável. */
export function InfoButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="Mais informações"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-purple-600/60 text-[10px] leading-none text-purple-300 hover:border-purple-400 hover:text-purple-100"
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          >
            <div
              className="max-w-md rounded-xl border border-purple-700/50 bg-[var(--surface-card)] p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <SectionTitle>{title}</SectionTitle>
                <button onClick={() => setOpen(false)} className="shrink-0 text-purple-400 hover:text-purple-100">
                  ✕
                </button>
              </div>
              <p className="text-sm leading-relaxed text-purple-200">{text}</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
