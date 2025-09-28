import type { LGraphNode } from 'litegraph.js';
import type { LlmJobOptions, LlmResult } from '../../lib/llmQueue';
import { enqueueLlmJob } from '../../lib/llmQueue';

export interface PendingRequest {
  requestId: number;
  key: string;
  inputHash: string;
}

export interface LlmState {
  requestCounter: number;
  pending: PendingRequest | null;
}

export function initLlmState(node: LGraphNode & { _llm?: LlmState }): LlmState {
  if (!node._llm) {
    node._llm = {
      requestCounter: 0,
      pending: null,
    };
  }
  return node._llm;
}

export function resetLlmState(node: LGraphNode & { _llm?: LlmState }) {
  if (node._llm) {
    node._llm.pending = null;
    node._llm.requestCounter += 1;
  }
}

export function enqueueLlm(
  node: LGraphNode & { _llm?: LlmState;
    properties: Record<string, any>;
    setDirtyCanvas: (bg: boolean, fg: boolean) => void;
  },
  job: LlmJobOptions,
  metadata: { key: string; inputHash: string }
): Promise<LlmResult> {
  const state = initLlmState(node);
  state.requestCounter += 1;
  const requestId = state.requestCounter;
  state.pending = {
    requestId,
    key: metadata.key,
    inputHash: metadata.inputHash,
  } as PendingRequest & { requestId: number };

  return enqueueLlmJob(job)
    .then((result) => {
      if (!state.pending || state.pending.requestId !== requestId) {
        throw new Error('stale-result');
      }
      state.pending = null;
      return result;
    })
    .catch((err) => {
      if (state.pending && state.pending.requestId === requestId) {
        state.pending = null;
      }
      throw err;
    });
}
