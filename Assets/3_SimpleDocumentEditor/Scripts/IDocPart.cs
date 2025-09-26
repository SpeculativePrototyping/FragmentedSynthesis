// DocumentModel.cs
using System.Collections.Generic;
using System.Text;
using LatexUtils;

namespace DocModel
{
    // 1) Fixed palette (compile-time). Maps to your LatexUtils.Latex.Elements keys.
    public enum DocElement {
        Section, Subsection, Subsubsection, Paragraph,
        Itemize, Enumerate, Quote, Figure, Table,
        Par, Newline, MathInline, MathBlock
    }

    internal static class Map {
        public static readonly Dictionary<DocElement, string> Key = new() {
            [DocElement.Section] = "section",
            [DocElement.Subsection] = "subsection",
            [DocElement.Subsubsection] = "subsubsection",
            [DocElement.Paragraph] = "paragraph",
            [DocElement.Itemize] = "itemize",
            [DocElement.Enumerate] = "enumerate",
            [DocElement.Quote] = "quote",
            [DocElement.Figure] = "figure",
            [DocElement.Table] = "table",
            [DocElement.Par] = "par",
            [DocElement.Newline] = "newline",
            [DocElement.MathInline] = "math_inline",
            [DocElement.MathBlock] = "math_block",
        };
    }

    // 2) Contract: anything renderable to LaTeX.
    public interface IDocPart { void RenderTo(StringBuilder sb); }

    // 3a) Plain text leaf; no wrapper. (Use Paragraph/Par explicitly when needed.)
    public sealed class DocText : IDocPart
    {
        public string Text;
        public DocText(string text) { Text = text ?? string.Empty; }
        public void RenderTo(StringBuilder sb) => sb.AppendLine(Latex.LatexEscape(Text));
    }

    // 3b) Structured block: section/env/raw with optional argument + children.
    public sealed class DocBlock : IDocPart
    {
        public DocElement Element;
        public string Arg;                    // e.g., section title or raw/math body
        public readonly List<IDocPart> Children = new();

        public DocBlock(DocElement el, string arg = "") { Element = el; Arg = arg ?? ""; }

        public void RenderTo( StringBuilder sb )
        {
            var key = Map.Key[Element];
            var spec = Latex.Elements[key];   // reuse your existing spec

            if (spec.Kind == LatexKind.CommandWithArg) {
                // \section{Arg} then render children as normal flow
                sb.Append(Latex.Render(key, Arg));
                foreach (var ch in Children) ch?.RenderTo(sb);
            }
            else if (spec.Kind == LatexKind.Environment) {
                // Wrap rendered children inside the environment
                var inner = new StringBuilder();
                foreach (var ch in Children) ch?.RenderTo(inner);
                sb.Append(Latex.Render(key, inner.ToString()));
            }
            else { // Raw
                // Render raw (Arg) first, then children
                sb.Append(Latex.Render(key, Arg));
                foreach (var ch in Children) ch?.RenderTo(sb);
            }
        }
    }

    // 4) Helpers
    public static class DocRenderer
    {
        public static string Render(IDocPart root) {
            var sb = new StringBuilder(1024);
            root?.RenderTo(sb);
            return sb.ToString();
        }
        public static string RenderMany(IEnumerable<IDocPart> parts) {
            var sb = new StringBuilder(1024);
            foreach (var p in parts) p?.RenderTo(sb);
            return sb.ToString();
        }
    }
}
