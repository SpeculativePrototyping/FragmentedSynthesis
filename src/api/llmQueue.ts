import {ref} from 'vue'



const API_URL = import.meta.env.VITE_LLM_API_URL || '/api/llm';
const API_KEY = import.meta.env.VITE_LLM_API_KEY || '';
const DEFAULT_MODEL = import.meta.env.VITE_LLM_MODEL || 'deepseek/deepseek-r1-0528-qwen3-8b';
const DEFAULT_TEMPERATURE = Number(import.meta.env.VITE_LLM_TEMPERATURE ?? 0.2);

export const llmQueueSize = ref(0)
export const llmBusy = ref(false)

export interface LlmJobOptions {
  user: string;
  sys: string;
  responseFormat?: unknown;
  model?: string;
  temperature?: number;
  onStart?: () => void;
}

export interface LlmResult {
  message: string;
  raw: string;
  response?: any;
}

interface InternalJob {
  options: LlmJobOptions;
  resolve: (value: LlmResult) => void;
  reject: (reason: Error) => void;
}

const queue: InternalJob[] = [];
let busy = false;

export function discardPendingLlmJobs() {
  queue.length = 0
  llmQueueSize.value = 0
}

export function enqueueLlmJob(options: LlmJobOptions): Promise<LlmResult> {
  return new Promise((resolve, reject) => {
    // Park the job so calls are handled in order.
    queue.push({ options, resolve, reject });
    // Kick the worker loop in case it is idle.
    llmQueueSize.value = queue.length
    processQueue();
  });
}

async function processQueue() {
  if (busy) return;
  busy = true;
  llmBusy.value = true
  try {
    while (queue.length) {
      llmQueueSize.value = queue.length
      const job = queue.shift()!;
      // Let callers update their UI the moment we start.
      job.options.onStart?.();
      try {
        // Run the outbound request and deliver the result to the caller.
        const result = await runJob(job.options);
        job.resolve(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        job.reject(error);
      }
    }
  } finally {
    busy = false;
    llmBusy.value = false
    llmQueueSize.value = 0
  }
}

async function runJob(options: LlmJobOptions): Promise<LlmResult> {
  const body: Record<string, unknown> = {
    model: options.model || DEFAULT_MODEL,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    messages: [
      { role: 'system', content: options.sys },
      { role: 'user', content: options.user }
    ]
  };
  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  // Dispatch the request to the LLM backend.
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const raw = await resp.text();
  let parsed: any;
  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!resp.ok) {
    const message = parsed?.error?.message || resp.statusText || 'LLM request failed';
    throw new Error(message);
  }

  const content = parsed?.choices?.[0]?.message?.content;
  const message = normaliseMessage(content, raw);

  // Give back both the clean string and the raw payload for debugging.
  return {
    message,
    raw,
    response: parsed
  };
}

function normaliseMessage(content: any, fallbackRaw: string): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    // Some providers return an array of parts, so stitch them together.
    return content
      .map((part) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  if (content && typeof content === 'object') {
    if (typeof content?.text === 'string') {
      return content.text;
    }
    if (typeof content?.content === 'string') {
      return content.content;
    }
    try {
      // Last resort: surface the object as JSON.
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  return fallbackRaw || '';
}
