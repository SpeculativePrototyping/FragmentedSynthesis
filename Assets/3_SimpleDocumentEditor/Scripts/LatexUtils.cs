using System;
using System.Collections.Generic;

namespace LatexUtils {
   public enum LatexKind {
      CommandWithArg,
      Environment,
      Raw
   }

   public sealed class LatexSpec {
      public LatexKind Kind; // how to render
      public string Name; // \section or environment name
      public bool EscapeArg = true; // escape the {arg}?
      public string Prefix = ""; // extra text before body (for Raw)
      public string Suffix = ""; // extra text after body (for Raw)
   }

// Your “palette” of elements
   public static class Latex {
      public static readonly Dictionary<string, LatexSpec> Elements = new() {
         // Sections (single-argument commands)
         ["section"] = new() { Kind = LatexKind.CommandWithArg, Name = "section" },
         ["subsection"] = new() { Kind = LatexKind.CommandWithArg, Name = "subsection" },
         ["subsubsection"] = new() { Kind = LatexKind.CommandWithArg, Name = "subsubsection" },
         ["paragraph"] = new() { Kind = LatexKind.CommandWithArg, Name = "paragraph" }, // or use Raw with \par

         // Common environments (need \begin...\end)
         ["itemize"] = new() { Kind = LatexKind.Environment, Name = "itemize", EscapeArg = false },
         ["enumerate"] = new() { Kind = LatexKind.Environment, Name = "enumerate", EscapeArg = false },
         ["quote"] = new() { Kind = LatexKind.Environment, Name = "quote", EscapeArg = false },
         ["figure"] = new() { Kind = LatexKind.Environment, Name = "figure", EscapeArg = false },
         ["table"] = new() { Kind = LatexKind.Environment, Name = "table", EscapeArg = false },

         // Math
         ["math_inline"] = new() { Kind = LatexKind.Raw, Prefix = "$", Suffix = "$", EscapeArg = false },
         ["math_block"] = new() { Kind = LatexKind.Raw, Prefix = "$$", Suffix = "$$", EscapeArg = false },

         // Plain paragraph break
         ["par"] = new() { Kind = LatexKind.Raw, Prefix = "\\par\n", Suffix = "", EscapeArg = false },
         ["newline"] = new() { Kind = LatexKind.Raw, Prefix = "\\\\\n", Suffix = "", EscapeArg = false },
      };


      public static string Render(string key, string content) {
         if (!Latex.Elements.TryGetValue(key, out var spec))
            throw new ArgumentException($"Unknown LaTeX element: {key}");

         // optional escaping for command args / raw content
         string esc(string s) => LatexEscape(s);

         return spec.Kind switch {
            LatexKind.CommandWithArg => $"\\{spec.Name}{{{(spec.EscapeArg ? esc(content) : content)}}}\n",
            LatexKind.Environment => $"\\begin{{{spec.Name}}}\n{content}\n\\end{{{spec.Name}}}\n",
            LatexKind.Raw => $"{spec.Prefix}{content}{spec.Suffix}",
            _ => content
         };
      }

      // minimal, safe LaTeX escaping for prose
      public static string LatexEscape(string s) =>
         (s ?? "")
         .Replace(@"\", @"\textbackslash{}")
         .Replace("{", @"\{").Replace("}", @"\}")
         .Replace("#", @"\#").Replace("$", @"\$")
         .Replace("%", @"\%").Replace("&", @"\&")
         .Replace("_", @"\_").Replace("^", @"\^{}")
         .Replace("~", @"\textasciitilde{}");
   }
}