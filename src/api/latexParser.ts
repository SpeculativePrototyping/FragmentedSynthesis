// api/latexParser.ts
import type { Node, Edge } from '@vue-flow/core'
import type { Ref } from 'vue'
import {inject, ref} from "vue";

interface ZipFileEntry {
    path: string
    type: 'tex' | 'bib' | 'image' | 'other'
    content: string | ArrayBuffer
}

interface BibEntry {
    id: string
    type: string
    fields: Record<string, string>
    raw?: string
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
        // Kommentare entfernen
        .replace(/%.*/g, '')
        // Präambel und Header-Befehle entfernen (\documentclass, \usepackage, \title, \author, \date)
        .replace(/\\(documentclass|usepackage|title|author|date)\{[^}]*\}/g, '')
        .replace(/\\begin\{document\}/g, '')
        .replace(/\\end\{document\}/g, '')
        // Kapitel & Section-Befehle beibehalten, andere Formatierungen entfernen
        .replace(/\\(textbf|textit|emph|underline)\{([^}]*)\}/g, '$2')
        // Listen vereinfachen
        .replace(/\\begin\{(itemize|enumerate)\}/g, '')
        .replace(/\\end\{(itemize|enumerate)\}/g, '')
        .replace(/\\item\s*/g, '- ')
        // Labels / Refs / Pagerefs entfernen
        .replace(/\\(label|ref|pageref)\{[^}]*\}/g, '')
        // Glossar / Akronyme entfernen
        .replace(/\\(gls|acrshort|acrfull|newacronym|newglossaryentry)\{[^}]*\}/g, '')
        // Mehrfach-Leerzeilen zusammenführen
        .replace(/\n\s*\n/g, '\n')
        .trim();
}


export function parseLatexToNodesAndEdges(
    files: ZipFileEntry[],
    mainTexPath: string,
    updateBibliography: (newBib: BibEntry[]) => void
): { nodes: Node[], edges: Edge[] } {

    const texMap = buildTexMap(files)
    let latex = flattenLatex(mainTexPath, texMap)
    latex = cleanLatex(latex)

    console.log('=== FLATTENED LATEX ===')
    console.log(latex)
    console.log('======================')

    const nodes: Node[] = []
    const edges: Edge[] = []

    // Regex für Sections/Subsections/Subsubsections
    const sectionRegex = /\\(chapter|section|subsection|subsubsection)\{([^}]*)\}/g

    let idCounter = 0
    const levelMap: Record<string, number> = {
        chapter: 1,
        section: 1,
        subsection: 2,
        subsubsection: 3
    }

    const composeNodes: Node[] = []
    const sections: { start: number, type: string, title: string }[] = []

    // Alle Sections finden und speichern
    let match: RegExpExecArray | null
    while ((match = sectionRegex.exec(latex)) !== null) {
        const [full, type, title] = match
        sections.push({ start: match.index, type, title })

        const node: Node = {
            id: `compose-${idCounter++}`,
            type: 'compose',
            position: { x: 0, y: 0 },
            data: {
                label: 'Compose Node',
                title,
                level: levelMap[type] || 1,
                json: '',
                value: ''
            },
            dragHandle: '.doc-node__header'
        }
        composeNodes.push(node)
        nodes.push(node)
    }

    // DocOutputNode als Root am Ende erstellen
    const docNode: Node = {
        id: 'doc-output',
        type: 'docOutput',
        position: { x: 0, y: 0 },
        data: { label: 'Document Output Node' },
        dragHandle: '.doc-node__header'
    }
    nodes.push(docNode)

    // ComposeNodes mit DocOutput verbinden
    composeNodes.forEach((composeNode, index) => {
        edges.push({
            id: `e-${composeNode.id}-${docNode.id}`,
            source: composeNode.id,
            target: docNode.id,
            targetHandle: `doc-${index}`
        })
    })

    // === Textarea- und Figure-Nodes zwischen Sections erzeugen ===
    const figureRegex = /\\begin\{figure\}[\s\S]*?\\includegraphics.*?\{([^}]+)\}[\s\S]*?\\caption\{((?:[^{}]|\{[^}]*\})*)\}[\s\S]*?\\end\{figure\}/g

    for (let i = 0; i < sections.length; i++) {
        const start = sections[i].start + (`\\${sections[i].type}{${sections[i].title}}`).length
        const end = i + 1 < sections.length ? sections[i + 1].start : latex.length
        let textBlock = latex.slice(start, end).trim()

        if (!textBlock) continue

        let lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = figureRegex.exec(textBlock)) !== null) {
            // Text vor der Figur
            const preText = textBlock.slice(lastIndex, match.index).trim()
            if (preText) {
                const node: Node = {
                    id: `textArea-${idCounter++}`,
                    type: 'textArea',
                    position: { x: 0, y: 0 },
                    data: {
                        value: preText,
                        label: 'Text Input Node',
                        placeholder: 'Text between sections',
                        citations: [],
                        status: 'idle',
                        error: null
                    },
                    dragHandle: '.doc-node__header'
                }
                nodes.push(node)
                edges.push({
                    id: `e-${composeNodes[i].id}-${node.id}`,
                    source: node.id,
                    target: composeNodes[i].id
                })
            }

            // Figure-Node
            const imagePath = match[1]
            const caption = (match[2] ?? '').trim()
            const imgFile = files.find(f => f.path === imagePath && f.type === 'image')
            const fileName = imgFile.path.split(/[/\\]/).pop() ?? imgFile.path
            if (imgFile && typeof imgFile.content === 'string') {
                const figNode: Node = {
                    id: `figure-${idCounter++}`,
                    type: 'figure',
                    position: { x: 0, y: 0 },
                    data: {
                        image: imgFile.content,
                        imageName: fileName,
                        latexLabel: caption,
                        citations: []
                    },
                    label: 'Figure Node',
                    category: 'text',
                    dragHandle: '.doc-node__header'
                }
                nodes.push(figNode)
                edges.push({
                    id: `e-${composeNodes[i].id}-${figNode.id}`,
                    source: figNode.id,
                    target: composeNodes[i].id
                })
            }

            lastIndex = match.index + match[0].length
        }

        // Text nach der letzten Figur
        const postText = textBlock.slice(lastIndex).trim()
        if (postText) {
            const node: Node = {
                id: `textArea-${idCounter++}`,
                type: 'textArea',
                position: { x: 0, y: 0 },
                data: {
                    value: postText,
                    label: 'Text Input Node',
                    placeholder: 'Text between sections',
                    citations: [],
                    status: 'idle',
                    error: null
                },
                dragHandle: '.doc-node__header'
            }
            nodes.push(node)
            edges.push({
                id: `e-${composeNodes[i].id}-${node.id}`,
                source: node.id,
                target: composeNodes[i].id
            })
        }
    }

    // === Bibliographie einfügen ===
    const bibFiles = files.filter(f => f.type === 'bib')
    for (const bibFile of bibFiles) {
        if (typeof bibFile.content === 'string') {
            const newEntries = parseBibtex(bibFile.content)
            if (newEntries.length) updateBibliography(newEntries)
        }
    }

    return { nodes, edges }
}




