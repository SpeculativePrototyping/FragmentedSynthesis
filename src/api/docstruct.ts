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
  imageName: string;       // referenziert globalen Cache
  latexLabel: string;      // Caption für LaTeX
  label?: string;        // interner eindeutiger LaTeX-Label
  citations?: string[];    // optional
  refLabel?: string;
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
    imageName = '',
    latexLabel = '',
    init: Partial<BaseElement> = {},
): FigureElement => ({
  kind: 'figure',
  id,
  imageName,
  latexLabel,
  citations: [],
  title: init.title,
  body: init.body,
  children: [], // Figures haben keine Kinder
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
  return s.replace(/~\\(cite|autoref)\{[^}]+\}|([#$%&_{}])/g, (match, group1) => {
    // cite/autoref bleiben unescaped
    if (match.startsWith("~\\cite{") || match.startsWith("~\\autoref{")) {
      return match;
    }
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
      parts.push(`\\paragraph{}${escLaTeXPreserveCites(paragraph.body ?? '')}`);
      return parts.join("\n\n");
    },
    figure(figure: FigureElement) {
      const lines: string[] = ["\\begin{figure}[h]", "  \\centering"];
      if (figure.imageName) {
        const path = `images/${escLaTeX(figure.imageName)}`;
        lines.push(`  \\includegraphics[width=\\linewidth,keepaspectratio]{${path}}`);
      }      if (figure.latexLabel) lines.push(`  \\caption{${escLaTeXPreserveCites(figure.latexLabel)}}`);
      if (figure.refLabel) lines.push(`  \\label{${figure.refLabel}}`);
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
    "\\usepackage{hyperref}",
    "\\begin{document}",
    body,
    bibBlock,
    "\\end{document}"
  ].filter(Boolean).join("\n\n");
}





