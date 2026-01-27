import type { Node, Edge } from '@vue-flow/core'
import type { BibEntry } from '@/App.vue'

interface ZipFileEntry {
    path: string
    type: 'tex' | 'bib' | 'image' | 'other'
    content: string | ArrayBuffer
}



function randomFigureKey(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `Figure-${result}`
}


function parseBibtex(input: string): BibEntry[] {
    const entries: BibEntry[] = []
    const blocks = input.split('@').map(b => b.trim()).filter(b => b)
    for (const block of blocks) {
        const match = block.match(/^(\w+)\s*\{\s*([^,]+)\s*,([\s\S]*?)\}\s*$/)
        if (!match) continue
        const [, type, id, body] = match
        const fields: Record<string,string> = {}
        body.split('\n').forEach(line => {
            const fieldMatch = line.match(/(\w+)\s*=\s*[\{"]([^"}]+)[\}"]/)
            if (fieldMatch) fields[fieldMatch[1]] = fieldMatch[2]
        })
        entries.push({ id, type, fields, raw: `@${block}` })
    }
    return entries
}


function buildTexMap(files: ZipFileEntry[]): Map<string, string> {
    const map = new Map<string, string>()

    for (const f of files) {
        if (f.type === 'tex' && typeof f.content === 'string') {
            map.set(f.path, f.content)
        }
    }

    return map
}

function resolveTexPath(ref: string, currentPath: string): string {
    if (!ref.endsWith('.tex')) ref += '.tex'

    // Wenn ref bereits relativ zum Projektroot ist
    if (ref.startsWith('/')) return ref.slice(1)

    const base = currentPath.split('/').slice(0, -1).join('/')
    if (!base) return ref
    if (ref.startsWith(base)) return ref // schon relativ
    return `${base}/${ref}`
}


function flattenLatex(
    entryPath: string,
    texMap: Map<string, string>,
    visited = new Set<string>()
): string {

    if (visited.has(entryPath)) {
        console.warn('Circular input detected:', entryPath)
        return ''
    }

    const content = texMap.get(entryPath)
    if (!content) {
        console.warn('Missing TeX file:', entryPath)
        return ''
    }

    visited.add(entryPath)

    const lines = content.split('\n')
    let result = ''

    const inputRegex = /\\(input|include)\{([^}]+)\}/

    for (const line of lines) {
        const match = line.match(inputRegex)

        if (match) {
            const [, , ref] = match
            const resolved = resolveTexPath(ref, entryPath)
            result += flattenLatex(resolved, texMap, visited)
        } else {
            result += line + '\n'
        }
    }

    return result
}

function cleanLatex(latex: string): string {
    // Alles bis zur ersten Chapter/Section entfernen
    const firstSectionMatch = latex.match(/\\(chapter|section)\{/)
    if (firstSectionMatch) {
        latex = latex.slice(firstSectionMatch.index)
    }

    return latex
        // Kommentare entfernen aber % behalten
        .replace(/(?<!\\)%.*/g, '')  // echte Kommentare
        // Präambel und Header-Befehle entfernen (\documentclass, \usepackage, \title, \author, \date)
        .replace(/\\(documentclass|usepackage|title|author|date)\{[^}]*\}/g, '')
        .replace(/\\begin\{document\}/g, '')
        .replace(/\\end\{document\}/g, '')
        // Kapitel & Section-Befehle beibehalten, andere Formatierungen entfernen
        .replace(/\\(textbf|textit|emph|underline)\{([^}]*)\}/g, '$2')
        // Labels / Refs / Pagerefs entfernen
        .replace(/\\(label|ref|pageref)\{[^}]*\}/g, '')
        // Glossar / Akronyme entfernen
        .replace(/\\(gls|acrshort|acrfull|newacronym|newglossaryentry)\{[^}]*\}/g, '')
        // Mehrfach-Leerzeilen zusammenführen
        .trim();
}


function resolveImageFile(
    files: ZipFileEntry[],
    imagePath: string
): ZipFileEntry | undefined {

    const exts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'pdf']
    const base = imagePath.replace(/\.(png|jpe?g|gif|svg|pdf)$/i, '')

    return files.find(f => {
        if (f.type !== 'image') return false
        const fileBase = f.path.replace(/\.(png|jpe?g|gif|svg|pdf)$/i, '')
        return fileBase.endsWith(base)
    })
}

// =======================================================
// BLOCK TYPES
// =======================================================

type LatexBlock =
    | { type: 'figure'; imagePath: string; caption: string }
    | { type: 'raw'; latex: string; }


// =======================================================
// BLOCK PARSING
// =======================================================


function parseFigure(latex: string): LatexBlock | null {
    const img = latex.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/)
    if (!img) return null

    let caption = 'Unnamed Figure'

    const capIndex = latex.indexOf('\\caption')
    if (capIndex !== -1) {
        const braceStart = latex.indexOf('{', capIndex)
        if (braceStart !== -1) {
            let depth = 0
            for (let i = braceStart; i < latex.length; i++) {
                const char = latex[i]
                if (char === '{') depth++
                else if (char === '}') depth--

                if (depth === 0) {
                    // Inhalt OHNE äußere Klammern
                    caption = latex.slice(braceStart + 1, i).trim()
                    break
                }
            }
        }
    }

    return {
        type: 'figure',
        imagePath: img[1],
        caption
    }
}



function splitSectionIntoBlocks(sectionText: string): LatexBlock[] {
    const blocks: LatexBlock[] = []
    let cursor = 0

    const figureRegex =
        /\\begin\{figure\}[\s\S]*?\\end\{figure\}/g

    let match: RegExpExecArray | null

    while ((match = figureRegex.exec(sectionText)) !== null) {
        const before = sectionText.slice(cursor, match.index).trim()
        if (before) {
            blocks.push({ type: 'raw', latex: before })
        }

        const fig = parseFigure(match[0])
        if (fig) {
            blocks.push(fig)
        } else {
            blocks.push({ type: 'raw', latex: match[0] })
        }

        cursor = match.index + match[0].length
    }

    const rest = sectionText.slice(cursor).trim()
    if (rest) {
        blocks.push({ type: 'raw', latex: rest })
    }

    return blocks
}



// =======================================================
// BLOCK → NODE
// =======================================================

function blockToNode(
    block: LatexBlock,
    files: ZipFileEntry[],
    nextId: () => string
): Node | null {

    switch (block.type) {
        case 'figure': {
            const imgFile = resolveImageFile(files, block.imagePath)
            if (!imgFile || typeof imgFile.content !== 'string') return null

            const figKey = randomFigureKey()

            return {
                id: nextId(),
                type: 'figure',
                position: { x: 0, y: 0 },
                data: {
                    label: 'Figure',
                    image: imgFile.content,
                    imageName: figKey,
                    refLabel: figKey,
                    latexLabel: block.caption,
                    citations: []
                },
                dragHandle: '.doc-node__header'
            }
        }

        case 'raw':
            return {
                id: nextId(),
                type: 'magicLatex',
                position: { x: 0, y: 0 },
                data: {
                    label: 'Raw LaTeX',
                    latex: block.latex,
                    prompt: '',
                    status: 'idle',
                    error: null
                },
                dragHandle: '.doc-node__header'
            }
    }
}


export function parseLatexToNodesAndEdges(
    files: ZipFileEntry[],
    mainTexPath: string,
    updateBibliography: (newBib: BibEntry[]) => void
): { nodes: Node[], edges: Edge[] } {

    const texMap = buildTexMap(files)
    let latex = flattenLatex(mainTexPath, texMap)
    latex = cleanLatex(latex)

    const nodes: Node[] = []
    const edges: Edge[] = []

    let idCounter = 0
    const nextId = () => `n-${idCounter++}`

    // =========================
    // SECTIONS
    // =========================

    const sectionRegex = /\\(chapter|section|subsection|subsubsection)\{([^}]*)\}/g

    const sections: {
        start: number
        type: string
        title: string
    }[] = []

    let match: RegExpExecArray | null
    while ((match = sectionRegex.exec(latex)) !== null) {
        sections.push({
            start: match.index,
            type: match[1],
            title: match[2]
        })
    }

    const composeNodes: Node[] = []

    sections.forEach(sec => {
        const node: Node = {
            id: nextId(),
            type: 'compose',
            position: { x: 0, y: 0 },
            data: {
                label: 'Compose',
                title: sec.title,
                level: sec.type === 'chapter' ? 1 :
                    sec.type === 'section' ? 1 :
                        sec.type === 'subsection' ? 2 : 3,
                json: '',
                value: ''
            },
            dragHandle: '.doc-node__header'
        }

        composeNodes.push(node)
        nodes.push(node)
    })

    // =========================
    // SECTION CONTENT → BLOCKS
    // =========================

    for (let i = 0; i < sections.length; i++) {
        const start =
            sections[i].start +
            (`\\${sections[i].type}{${sections[i].title}}`).length

        const end =
            i + 1 < sections.length
                ? sections[i + 1].start
                : latex.length

        const sectionText = latex.slice(start, end).trim()
        if (!sectionText) continue

        const blocks = splitSectionIntoBlocks(sectionText)
        let childIndex = 0

        for (const block of blocks) {
            const node = blockToNode(block, files, nextId)
            if (!node) continue

            nodes.push(node)

            edges.push({
                id: `e-${node.id}-${composeNodes[i].id}`,
                source: node.id,
                target: composeNodes[i].id,
                targetHandle: `child-${childIndex++}`,
                animated: true,
                style: { strokeWidth: 4 },
                markerEnd: {
                    type: 'arrowclosed',
                    color: '#000000',
                    width: 6,
                    height: 6
                }
            })
        }
    }

    // =========================
    // DOC OUTPUT NODE
    // =========================

    const docNode: Node = {
        id: 'doc-output',
        type: 'docOutput',
        position: { x: 0, y: 0 },
        data: { label: 'Document Output' },
        dragHandle: '.doc-node__header'
    }

    nodes.push(docNode)

    composeNodes.forEach((c, i) => {
        edges.push({
            id: `e-${c.id}-doc`,
            source: c.id,
            target: docNode.id,
            targetHandle: `doc-${i}`,
            animated: true,
            style: { strokeWidth: 4 },
            markerEnd: { type: 'arrowclosed', color: '#000000' }
        })
    })

    // =========================
    // BIBLIOGRAPHY
    // =========================

    files
        .filter(f => f.type === 'bib' && typeof f.content === 'string')
        .forEach(f => {
            const entries = parseBibtex(f.content as string)
            if (entries.length) updateBibliography(entries)
        })

    return { nodes, edges }
}




