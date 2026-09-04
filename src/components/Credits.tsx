/**
 * Créditos e atribuição da obra original.
 *
 * As três artes vêm do próprio manual (capa e página de licença) e são
 * aplicadas como máscara — o PNG guarda só a cobertura de tinta, e a cor sai
 * de `--art-ink`. Por isso a mesma arte aparece em creme no modo escuro e em
 * marrom no modo claro, como nas versões impressas.
 */
import type { CSSProperties } from 'react'

const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.pt_BR'

const art = (file: string) => ({ '--art-src': `url('/art/${file}')` }) as CSSProperties

export function Credits() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-6 border-t border-[color:var(--gold-dark)]/60 pt-8 pb-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        <span
          role="img"
          aria-label="Shadow Lords"
          className="art-mask h-20 w-52 shrink-0 sm:h-24 sm:w-64"
          style={art('shadowlords-logo.png')}
        />
        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <p className="text-[13px] leading-relaxed text-[color:var(--art-ink)]">
            Shadowlords™ Mini System™ 3ª Edição é um RPG criado por Horos e Rossi.
            <br />
            Compartilhado sob a licença CC-BY-NC-SA 4.0 em Outubro de 2023.
            <br />
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[color:var(--gold-deep)] underline-offset-2 hover:text-[color:var(--gold-bright)]"
            >
              {LICENSE_URL}
            </a>
          </p>
          <a href={LICENSE_URL} target="_blank" rel="noreferrer" aria-label="Licença Creative Commons BY-NC-SA 4.0">
            <span
              className="art-mask block h-9 w-[100px] opacity-90 transition hover:opacity-100"
              style={art('cc-by-nc-sa.png')}
            />
          </a>
        </div>
      </div>

      <span
        role="img"
        aria-label="Ilustração de capa do Shadowlords Mini System"
        className="art-mask h-56 w-full max-w-2xl sm:h-72"
        style={art('shadowlords-creature.png')}
      />

      <p className="px-4 text-center text-[11px] leading-relaxed text-purple-400/70">
        Shadowlords Mesa é um companheiro digital não-oficial, feito por fãs e distribuído sob a mesma licença da obra
        original. As artes acima são do manual de regras.
      </p>
    </footer>
  )
}
