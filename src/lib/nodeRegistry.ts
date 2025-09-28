import { LiteGraph as LG } from 'litegraph.js';
import { registerMultilineWidget } from '../nodes/widgets/multilineWidget';

type LiteGraphStatic = typeof LG;
type NodeModule = { default?: (lg: LiteGraphStatic) => void; register?: (lg: LiteGraphStatic) => void };

const modules = import.meta.glob('../nodes/**/*.ts', { eager: true }) as Record<string, NodeModule>;

function resetRegistry(lg: any) {
  if (lg?.registered_node_types) {
    Object.keys(lg.registered_node_types).forEach((key) => delete lg.registered_node_types[key]);
  }
  if (lg?.registered_node_types_by_title) {
    Object.keys(lg.registered_node_types_by_title).forEach((key) => delete lg.registered_node_types_by_title[key]);
  }
  if (lg?.node_types_by_category) {
    Object.keys(lg.node_types_by_category).forEach((key) => delete lg.node_types_by_category[key]);
  }
}

export function registerAllNodes(lg: LiteGraphStatic = LG) {
  registerMultilineWidget(lg);
  resetRegistry(lg);
  Object.values(modules).forEach((mod) => {
    const register = mod.default || mod.register;
    if (typeof register === 'function') {
      register(lg);
    }
  });
}
