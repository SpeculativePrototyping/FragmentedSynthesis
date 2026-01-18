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

export type LatexElement = {
  kind: 'latex';
  id: NodeID;
  latex: string;              // roher LaTeX-Code
  structureType?: string;     // z.B. table, itemize, equation
};


export type DocElement =
    | SectionElement
    | ParagraphElement
    | FigureElement
    | LatexElement;


type Render = (n: DocElement, ctx: Ctx) => string;
interface Ctx {
  render: Render;
} // gives recursion without importing global state

type Renderer = {
  section(n: SectionElement, ctx: Ctx): string;
  paragraph(n: ParagraphElement, ctx: Ctx): string;
  figure(n: FigureElement, ctx: Ctx): string;
  latex(n: LatexElement, ctx: Ctx): string;
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
    case "latex":
      return r.latex(n, ctx);
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
  return s.replace(
      /~\\(?:cite|autoref)\{[^}]+\}|([#\$%&_])/g,
      (match, specialChar, offset, full) => {
        if (match.startsWith("~\\cite{") || match.startsWith("~\\autoref{")) return match;

        // wenn das Zeichen bereits escaped ist, nicht nochmal escapen
        const prev = full[offset - 1];
        if (prev === "\\") return match;

        return "\\" + specialChar;
      }
  );
};


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

      const self: string[] = [];


      if (section.level === 1) {
        self.push("\\newpage");
      }

      self.push(`\\${command}{${heading}}`);
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
    latex(latex: LatexElement) {
      return latex.latex.trim();
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
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage{lmodern}",
    "\\usepackage{graphicx}",
    "\\usepackage{rotating}",
    "\\usepackage{xcolor}",
    "\\usepackage{array}",
    "\\usepackage{booktabs}",
    "\\usepackage{microtype}",
    "\\usepackage{setspace}",
    "\\usepackage{enumitem}",
    "\\usepackage{amsmath}",
    "\\usepackage{amssymb}",
    "\\usepackage{hyperref}",
    "\\begin{document}",
    "\\tableofcontents",

    body,
    bibBlock,
    "\\end{document}"
  ].filter(Boolean).join("\n\n");
}





