// Checagens das regras de pastas. Rode com `npm run check`.
import {
  allFolders,
  buildTree,
  folderDestination,
  folderToSave,
  isInside,
  normalizePath,
  pathAfterMove,
  showPath,
} from './folders'

function eq(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${what}: esperado ${e}, veio ${a}`)
}

// O que a pessoa digita vira um caminho só, sem pastas gêmeas.
eq(normalizePath('Arco 1 > Masmorra'), 'Arco 1/Masmorra', 'separador >')
eq(normalizePath(' Arco 1 /  Masmorra '), 'Arco 1/Masmorra', 'espaços em volta')
eq(normalizePath('Arco 1 › Masmorra'), 'Arco 1/Masmorra', 'separador ›')
eq(normalizePath('Arco   1//Masmorra/'), 'Arco 1/Masmorra', 'espaço repetido e pedaço vazio')
eq(normalizePath(''), '', 'vazio')
eq(showPath('Arco 1/Masmorra'), 'Arco 1 › Masmorra', 'mostrar caminho')
eq(showPath(undefined), 'Sem pasta', 'sem pasta')

// "Arco 10" não está dentro de "Arco 1".
eq(isInside('Arco 10/Cripta', 'Arco 1'), false, 'prefixo de texto não é pasta')
eq(isInside('Arco 1/Cripta', 'Arco 1'), true, 'subpasta está dentro')
eq(isInside('Arco 1', 'Arco 1'), true, 'a própria pasta')

// Todas as pastas, com as de cima, em ordem de árvore e de número.
eq(allFolders(['Cena 10', 'Cena 2/Porão', undefined, 'Cena 2']), ['Cena 2', 'Cena 2/Porão', 'Cena 10'], 'ordem numérica')

// Árvore: total conta em todas as pastas do caminho.
const tree = buildTree(
  [
    { n: 'a', f: 'Arco 1' },
    { n: 'b', f: 'Arco 1/Masmorra' },
    { n: 'c', f: 'Arco 1/Masmorra' },
    { n: 'd', f: undefined },
  ],
  (i) => i.f,
  (i) => i.n,
)
eq(tree.total, 4, 'total da raiz')
eq(tree.items.map((i) => i.n), ['d'], 'soltos na raiz')
eq(tree.subfolders[0].total, 3, 'Arco 1 conta a subpasta')
eq(tree.subfolders[0].subfolders[0].items.map((i) => i.n), ['b', 'c'], 'itens da subpasta')

// Renomear e mover são a mesma troca de prefixo.
eq(pathAfterMove('Arco 1/Masmorra', 'Arco 1', 'Ato I'), 'Ato I/Masmorra', 'renomear leva a subpasta')
eq(pathAfterMove('Arco 10', 'Arco 1', 'Ato I'), null, 'quem não está na pasta não muda')
eq(pathAfterMove('Arco 1/Masmorra', 'Arco 1/Masmorra', ''), '', 'desfazer a pasta sobe para a raiz')
eq(pathAfterMove('Arco 1', 'Arco 1', 'Arco 1/Sub'), null, 'mover para dentro de si mesma é recusado')
eq(folderDestination('Arco 1/Masmorra', 'Arco 2'), 'Arco 2/Masmorra', 'mover pasta para dentro de outra')
eq(folderDestination('Arco 1/Masmorra', ''), 'Masmorra', 'mover pasta para o primeiro nível')

// Vazio nunca é gravado como "".
eq(folderToSave('  '), undefined, 'vazio sai do documento')
eq(folderToSave('A > B'), 'A/B', 'caminho limpo para gravar')
