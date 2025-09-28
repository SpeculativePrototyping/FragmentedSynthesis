# LiteGraph Playground

A Svelte + TypeScript single-page playground for rapidly wiring together LiteGraph-based AI and document-processing nodes. The app boots with a full-window canvas, toolbar controls for save/load/clear, and an LLM queue that powers summarisation and point-extraction nodes.

## Current Architecture

### Canvas & Bootstrapping
- `src/lib/graph.ts` registers all custom nodes, disables LiteGraph's search box, seeds a demo flow, and exposes `resize`/`seedSample` helpers.
- Canvas auto-resizes via `resize()` and the Svelte shell's `ResizeObserver` wiring.

### Application Shell (`src/App.svelte` / `src/app.css`)
- Full-height layout with a translucent toolbar containing **Save**, **Load**, and **Clear** actions (serialised to `localStorage`).
- Canvas background uses a dark radial gradient; buttons employ subtle elevation and hover feedback.

### Shared Utilities
- `src/nodes/utils/visuals.ts`: draws consistent status/error badges for LLM nodes.
- `src/lib/textBox.ts`: reusable collapsed/expanded text preview with ellipsis and focus styling.
- `src/nodes/widgets/multilineWidget.ts`: registers a `multiline` LiteGraph widget that opens a styled textarea overlay (with optional Grammarly/spellcheck toggles).

### LLM Nodes
- **Summarize** (`src/nodes/summarize.ts`): queued LLM call with length presets, expandable preview, status panel.
- **Extract Points** (`src/nodes/llm/extractPoints.ts`): dynamic point count, JSON-schema response parsing, numbered preview list.
- Both reuse the shared textbox renderer and status panel.

### Document Nodes
- `src/doc/docModel.ts`: TypeScript port of the C# doc model (blocks, text, rendering, `paragraphFromString`).
- **Doc Block** (`src/nodes/doc/composeBlock.ts`): choose Section/Subsection/Subsubsection, manage child inputs, show one-line previews for each child.
- **Doc Text / Doc From String**: convert free-form text or string inputs into paragraph doc parts.
- **Document Root** (`src/nodes/doc/documentNode.ts`): collect sections, output a composite doc part with per-input previews.
- **Doc Render** (`src/nodes/doc/renderNode.ts`): render the assembled document to LaTeX/plain output.

## Engineering Roadmap

1. **Style Infrastructure**
   - Define `style:fragment` & `instruction:fragment` data types; create nodes for style sources and extracted styles.
   - Build a "Style Ground" hub node that can auto-connect style guidance to LLM-capable nodes.
   - Update Summarize/Extract nodes and future LLM nodes to consume optional style/instruction inputs, merging them into prompts.

2. **Prompt Assembly Helpers**
   - Centralise prompt construction utilities to merge base prompts with style + instruction fragments.
   - Provide debug overlays or tooltips showing the final prompt payload.

3. **Instruction Node**
   - Add a dedicated node for multiline instruction editing (reuses `multiline` widget) that outputs `instruction:fragment`.

4. **PDF & LaTeX Inputs**
   - Build a PDF ingest node (using `pdfjs-dist` or a worker) that outputs raw text, paragraph doc parts, and style samples.
   - Create a LaTeX input/parse node to import existing `.tex` documents into doc model blocks or emit raw LaTeX.

5. **Style Extraction Node**
   - LLM-powered node that analyses text (or PDF output) to generate a reusable style fragment.
   - Allow manual overrides and preview of extracted style guidelines.

6. **Auto-Wiring Enhancements**
   - Update node registry to auto-link new LLM nodes to the nearest style hub, while keeping the connections user-adjustable.
   - Extend seed graph to showcase style wiring out of the box.

7. **Documentation & Debugging**
   - Expand this README with node reference tables and troubleshooting tips as features stabilise.
   - Consider adding a toggleable "Inspector" overlay for runtime state (prompt preview, LLM queue status).

## Development

```bash
npm install
npm run dev   # start Vite dev server
npm run build # production build
```

Feel free to iterate on the roadmap: the focus is on a predictable UX (style instructions behave like an electrical ground), consistent data contracts, and concise prompt handling across all LLM-enabled nodes.
