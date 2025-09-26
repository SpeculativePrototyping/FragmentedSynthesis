// Convention for each node file in src/nodes:
// export default Component
// export const meta = { type: 'minimal', label: 'Minimal', initialData?: {} }

const modules = import.meta.glob('./nodes/**/*.{jsx,tsx,js,ts}', { eager: true });

export function buildRegistry() {
  const nodeTypes = {};
  const palette = []; // {type, label, initialData}

  for (const path in modules) {
    const mod = modules[path];
    const Comp = mod.default;
    const m = mod.meta ?? {};
    const type = m.type ?? path.split('/').pop().replace(/\.(t|j)sx?$/, '');
    const label = m.label ?? type;

    if (!Comp) continue; // skip files without default export

    nodeTypes[type] = Comp;
    palette.push({ type, label, initialData: m.initialData ?? {} });
  }

  // Sort alphabetically for a stable menu
  palette.sort((a, b) => a.label.localeCompare(b.label));
  return { nodeTypes, palette };
}
