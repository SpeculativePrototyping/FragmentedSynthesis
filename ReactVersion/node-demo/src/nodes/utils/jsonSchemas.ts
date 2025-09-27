export function buildKeyPointsSchema(count: number, exact = true) {
  const n = Math.max(1, Math.floor(count));
  const properties: Record<string, unknown> = {};

  for (let i = 1; i <= n; i += 1) {
    properties[`point_${i}`] = { type: 'string' };
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: exact ? `key_points_${n}` : 'key_points',
      schema: {
        type: 'object',
        properties,
        required: exact ? Object.keys(properties) : undefined,
        additionalProperties: false
      }
    }
  };
}
