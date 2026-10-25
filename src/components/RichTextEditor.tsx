import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import type { ReactNode } from 'react'

/**
 * Editor de texto com formatação — negrito, itálico, títulos, listas, lista de
 * tarefas, citação — usado nas notas do personagem.
 *
 * O texto é guardado em HTML, mas o que entra no editor passa sempre pelo
 * esquema dele: só as marcações que ele conhece sobrevivem (nada de script,
 * estilo ou atributo estranho). Por isso as notas são sempre mostradas por
 * aqui, nunca jogadas direto na página.
 *
 * Atalhos do próprio editor: Ctrl+B, Ctrl+I, Ctrl+U, "- " começa uma lista,
 * "1. " uma lista numerada, "## " um título, "[] " uma tarefa.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva aqui...',
  autoFocus = false,
}: {
  value: string
  onChange: (html: string, text: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'rich-text min-h-[12rem] px-3 py-2 outline-none', 'data-rich-text': '' } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML(), e.getText({ blockSeparator: '\n' }).trim()),
  })

  return (
    <div className="flex flex-col border border-[color:var(--gold-dark)] bg-[var(--surface-well)] focus-within:border-[color:var(--gold)]">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="text-sm text-purple-50" />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  // Só redesenha a barra quando o estado dos botões muda, não a cada tecla.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const run = () => editor.chain().focus()
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-[color:var(--gold-dark)] bg-black/30 px-1.5 py-1"
      role="toolbar"
      aria-label="Formatação"
      data-rich-toolbar=""
    >
      <Tool label="Negrito (Ctrl+B)" active={s.bold} onClick={() => run().toggleBold().run()}>
        <b>B</b>
      </Tool>
      <Tool label="Itálico (Ctrl+I)" active={s.italic} onClick={() => run().toggleItalic().run()}>
        <i className="font-serif">I</i>
      </Tool>
      <Tool label="Sublinhado (Ctrl+U)" active={s.underline} onClick={() => run().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Tool>
      <Tool label="Riscado" active={s.strike} onClick={() => run().toggleStrike().run()}>
        <span className="line-through">S</span>
      </Tool>
      <Divider />
      <Tool label="Título" active={s.h2} onClick={() => run().toggleHeading({ level: 2 }).run()}>
        T1
      </Tool>
      <Tool label="Subtítulo" active={s.h3} onClick={() => run().toggleHeading({ level: 3 }).run()}>
        T2
      </Tool>
      <Divider />
      <Tool label="Lista com marcadores" active={s.bullet} onClick={() => run().toggleBulletList().run()}>
        • lista
      </Tool>
      <Tool label="Lista numerada" active={s.ordered} onClick={() => run().toggleOrderedList().run()}>
        1. lista
      </Tool>
      <Tool label="Lista de tarefas (com caixinha)" active={s.task} onClick={() => run().toggleTaskList().run()}>
        ☑ tarefas
      </Tool>
      <Divider />
      <Tool label="Citação" active={s.quote} onClick={() => run().toggleBlockquote().run()}>
        ❝
      </Tool>
      <Tool label="Linha divisória" onClick={() => run().setHorizontalRule().run()}>
        ―
      </Tool>
      <Divider />
      <Tool label="Desfazer (Ctrl+Z)" disabled={!s.canUndo} onClick={() => run().undo().run()}>
        ↶
      </Tool>
      <Tool label="Refazer (Ctrl+Y)" disabled={!s.canRedo} onClick={() => run().redo().run()}>
        ↷
      </Tool>
    </div>
  )
}

function Tool({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // mousedown sem foco: clicar no botão não tira a seleção do texto.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-8 px-1.5 py-1 text-xs transition disabled:opacity-30 ${
        active ? 'bg-[color:var(--gold-deep)] text-[color:var(--gold-bright)]' : 'text-purple-200 hover:bg-white/5 hover:text-[color:var(--gold-bright)]'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-[color:var(--gold-dark)]" />
}
