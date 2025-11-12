import type {BibEntry} from "@/App.vue";

export type NodeID = string;


export interface BaseElement {
  id: NodeID;
  title?: string;
  body?: string;
  children: DocElement[];
}
export type SectionElement = BaseElement & {
  kind: "section";
  level: 1 | 2 | 3 | 4 | 5 | 6;
};
export type ParagraphElement = BaseElement & {
  kind: "paragraph"
  sourceNodeId?: string;
  citations?: string[];
};
export type FigureElement = BaseElement & {
  kind: "figure";
  src: string;
  caption?: string;
};
export type DocElement = SectionElement | ParagraphElement | FigureElement;


//Thi is not 100 correct but it is a start. A paragraph can have a paragraph as a child. while for sections we need to ensure only lower level dependencies like heading 2 can be a child of heading 1
const PARENT_TO_CHILD: Record<string, string[]> = {
  section: ['section', 'paragraph', 'figure'],
  paragraph: ['paragraph','figure'], // paragraphs cannot have children
  figure: [],    // figures cannot have children
};


/** Builders keep node creation uniform and JSON-safe. */
export const mkSection = (
  id: NodeID,
  level: SectionElement['level'],
  init: Partial<BaseElement> = {},
): SectionElement => ({
  kind: 'section',
  id,
  level,
  title: init.title,
  body: init.body,
  children: init.children ?? [],
});

export const mkParagraph = (id: NodeID, init: Partial<BaseElement> = {}): ParagraphElement => ({
  kind: 'paragraph',
  id,
  title: init.title,
  body: init.body,
  children: init.children ?? [],
});

export const mkFigure = (
  id: NodeID,
  src = '',
  caption = '',
  init: Partial<BaseElement> = {},
): FigureElement => ({
  kind: 'figure',
  id,
  src,
  caption,
  title: init.title,
  body: init.body,
  children: [], // figures don’t have children in this model
});



type Render = (n: DocElement, ctx: Ctx) => string;
interface Ctx {
  render: Render;
} // gives recursion without importing global state

type Renderer = {
  section(n: SectionElement, ctx: Ctx): string;
  paragraph(n: ParagraphElement, ctx: Ctx): string;
  figure(n: FigureElement, ctx: Ctx): string;
};

export function render(n: DocElement, r: Renderer): string {
  const ctx: Ctx = { render: (m) => render(m, r) };
  switch (n.kind) {
    case "section":
      return r.section(n, ctx);
    case "paragraph":
      return r.paragraph(n, ctx);
    case "figure":
      return r.figure(n, ctx);
    default: {
      const _x: never = n;
      return _x;
    }
  }
}

const escLaTeX = (s = "") =>
  s
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");

const SECTION_COMMAND_BY_LEVEL: Record<number, string> = {
  1: "section",
  2: "subsection",
  3: "subsubsection",
  4: "paragraph",
  5: "subparagraph",
};

const escLaTeXPreserveCites = (s = "") => {
  return s.replace(/~\\cite\{[^}]+\}|([#$%&_{}])/g, (match, group1) => {
    // Wenn es ein \cite ist, nicht escapen
    if (match.startsWith("~\\cite{")) return match;
    return "\\" + group1;
  });
};

export interface LatexRenderOptions {
  includeDocument?: boolean;
  bibliography?: BibEntry[];
}


export interface LatexRenderOptions {
  includeDocument?: boolean;
  bibliography?: BibEntry[];
  bibFilename?: string; // optional: Name der .bib-Datei
}

export function renderToLatex(
    doc: DocElement | DocElement[],
    options: LatexRenderOptions = {}
): string {
  const nodes = Array.isArray(doc) ? doc : [doc];

  const renderer: Renderer = {
    section(section: SectionElement, ctx: Ctx) {
      const heading = section.title ? escLaTeX(section.title) : "Untitled section";
      const command = SECTION_COMMAND_BY_LEVEL[section.level] ?? SECTION_COMMAND_BY_LEVEL[4];
      const self = [`\\${command}{${heading}}`];

      if (section.body) self.push(escLaTeX(section.body));

      if (section.children.length) {
        const rendered = section.children.map((child) => ctx.render(child, ctx)).filter(Boolean);
        if (rendered.length) self.push(rendered.join("\n\n"));
      }

      return self.join("\n\n");
    },
    paragraph(paragraph: ParagraphElement) {
      const parts: string[] = [];
      if (paragraph.title) parts.push(`\\textbf{${escLaTeX(paragraph.title)}}`);
      if (paragraph.body) parts.push(escLaTeXPreserveCites(paragraph.body));
      return parts.join("\n\n");
    },
    figure(figure: FigureElement) {
      const lines: string[] = ["\\begin{figure}", "  \\centering"];
      if (figure.src) lines.push(`  \\includegraphics{${escLaTeX(figure.src)}}`);
      if (figure.caption) lines.push(`  \\caption{${escLaTeX(figure.caption)}}`);
      lines.push("\\end{figure}");
      return lines.join("\n");
    },
  };

  const body = nodes.map((node) => render(node, renderer)).filter(Boolean).join("\n\n");

  // Bibliographie nur noch als Verweis auf externe .bib-Datei
  let bibBlock = '';
  if (options.bibliography?.length && options.bibFilename) {
    const bibFileWithoutExt = options.bibFilename.replace(/\.bib$/, '');
    bibBlock = `\\bibliographystyle{plain}\n\\bibliography{${bibFileWithoutExt}}`;
  }

  if (!options.includeDocument) {
    return [body, bibBlock].filter(Boolean).join("\n\n");
  }

  return [
    "\\documentclass{article}",
    "\\usepackage{graphicx}",
    "\\begin{document}",
    body,
    bibBlock,
    "\\end{document}"
  ].filter(Boolean).join("\n\n");
}





