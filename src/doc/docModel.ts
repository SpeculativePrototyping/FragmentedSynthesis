export enum DocElement {
  Section = 'section',
  Subsection = 'subsection',
  Subsubsection = 'subsubsection',
  Paragraph = 'paragraph',
  Itemize = 'itemize',
  Enumerate = 'enumerate',
  Quote = 'quote',
  Figure = 'figure',
  Table = 'table',
  Par = 'par',
  Newline = 'newline',
  MathInline = 'math_inline',
  MathBlock = 'math_block',
}

export interface DocPart {
  render(sb: string[]): void;
}

export class DocText implements DocPart {
  text: string;
  constructor(text: string) {
    this.text = text ?? '';
  }
  render(sb: string[]): void {
    sb.push(latexEscape(this.text), '\n');
  }
}

export class DocBlock implements DocPart {
  element: DocElement;
  arg: string;
  readonly children: DocPart[] = [];

  constructor(element: DocElement, arg = '') {
    this.element = element;
    this.arg = arg ?? '';
  }

  add(...parts: Array<DocPart | null | undefined>): this {
    parts.forEach((part) => {
      if (part) this.children.push(part);
    });
    return this;
  }

  render(sb: string[]): void {
    const spec = LatexElements[this.element];
    if (!spec) {
      sb.push(this.arg);
      this.children.forEach((child) => child.render(sb));
      return;
    }

    switch (spec.kind) {
      case LatexKind.CommandWithArg:
        sb.push(renderCommand(spec.key, this.arg));
        this.children.forEach((child) => child.render(sb));
        break;
      case LatexKind.Environment:
        {
          const inner: string[] = [];
          this.children.forEach((child) => child.render(inner));
          sb.push(renderEnvironment(spec.key, inner.join('')));
        }
        break;
      case LatexKind.Raw:
      default:
        sb.push(renderRaw(spec.key, this.arg));
        this.children.forEach((child) => child.render(sb));
        break;
    }
  }
}

export class DocComposite implements DocPart {
  readonly parts: DocPart[];
  constructor(parts: DocPart[] = []) {
    this.parts = parts;
  }
  add(part: DocPart | null | undefined): this {
    if (part) this.parts.push(part);
    return this;
  }
  render(sb: string[]): void {
    this.parts.forEach((part) => part.render(sb));
  }
}

export type DocFragment = DocPart | DocComposite;

export function paragraphFromString(text: string): DocBlock {
  const paragraph = new DocBlock(DocElement.Paragraph);
  paragraph.children.push(new DocText(text ?? ''));
  return paragraph;
}

export function renderDoc(part: DocPart | null | undefined): string {
  const sb: string[] = [];
  if (part) part.render(sb);
  return sb.join('');
}

export function renderMany(parts: Iterable<DocPart | null | undefined>): string {
  const sb: string[] = [];
  for (const part of parts) {
    part?.render(sb);
  }
  return sb.join('');
}

export interface StyleFragment {
  kind: 'style';
  label: string;
  body: string;
}

export interface PromptFragment {
  kind: 'prompt';
  label: string;
  body: string;
}

export type Fragment = StyleFragment | PromptFragment;

export function createStyleFragment(label: string, body: string): StyleFragment {
  return { kind: 'style', label, body };
}

export function createPromptFragment(label: string, body: string): PromptFragment {
  return { kind: 'prompt', label, body };
}

export function mergeFragments(fragments: Fragment[]): { styles: StyleFragment[]; prompts: PromptFragment[] } {
  const styles: StyleFragment[] = [];
  const prompts: PromptFragment[] = [];
  fragments.forEach((fragment) => {
    if (!fragment) return;
    if (fragment.kind === 'style') styles.push(fragment);
    if (fragment.kind === 'prompt') prompts.push(fragment);
  });
  return { styles, prompts };
}

// --- Lightweight LaTeX helpers ---

enum LatexKind {
  CommandWithArg = 'command',
  Environment = 'environment',
  Raw = 'raw',
}

type LatexSpec = { key: string; kind: LatexKind };

const LatexElements: Record<DocElement, LatexSpec> = {
  [DocElement.Section]: { key: 'section', kind: LatexKind.CommandWithArg },
  [DocElement.Subsection]: { key: 'subsection', kind: LatexKind.CommandWithArg },
  [DocElement.Subsubsection]: { key: 'subsubsection', kind: LatexKind.CommandWithArg },
  [DocElement.Paragraph]: { key: 'paragraph', kind: LatexKind.CommandWithArg },
  [DocElement.Itemize]: { key: 'itemize', kind: LatexKind.Environment },
  [DocElement.Enumerate]: { key: 'enumerate', kind: LatexKind.Environment },
  [DocElement.Quote]: { key: 'quote', kind: LatexKind.Environment },
  [DocElement.Figure]: { key: 'figure', kind: LatexKind.Environment },
  [DocElement.Table]: { key: 'table', kind: LatexKind.Environment },
  [DocElement.Par]: { key: 'par', kind: LatexKind.Raw },
  [DocElement.Newline]: { key: 'newline', kind: LatexKind.Raw },
  [DocElement.MathInline]: { key: 'math_inline', kind: LatexKind.Raw },
  [DocElement.MathBlock]: { key: 'math_block', kind: LatexKind.Raw },
};

function renderCommand(cmd: string, argument: string): string {
  return `\\${cmd}{${latexEscape(argument)}}\n`;
}

function renderEnvironment(env: string, inner: string): string {
  return `\\begin{${env}}\n${inner}\\end{${env}}\n`;
}

function renderRaw(key: string, body: string): string {
  switch (key) {
    case 'par':
      return '\n\n';
    case 'newline':
      return '\\\n';
    case 'math_inline':
      return `$${body}$`;
    case 'math_block':
      return `\\[${body}\\]`;
    default:
      return body;
  }
}

function latexEscape(input: string): string {
  return (input || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([#%&_{}])/g, '\\$1')
    .replace(/\$/g, '\\$&')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}
