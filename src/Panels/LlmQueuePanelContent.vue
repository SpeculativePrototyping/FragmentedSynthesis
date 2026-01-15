<script setup lang="ts">
import { ref } from 'vue'
import { llmBusy, llmQueueSize } from '@/api/llmQueue'
import { discardPendingLlmJobs } from '@/api/llmQueue'

</script>

<template>
  <div class="llm-panel-content" >
    <div class="top-row">
      <div class="status">
        ⚙️ LLM is working…
      </div>

      <button
          class="discard-btn"
          :disabled="llmQueueSize === 0"
          @click="discardPendingLlmJobs"
          title="Clear LLM Queue"
      >
        🧹
      </button>
    </div>

    <div class="queue-info">
      Jobs in queue:
      <strong>{{ llmQueueSize }}</strong>
    </div>

    <div class="progress-bar">
      <div class="progress-indicator" />
    </div>
  </div>
</template>



<style scoped>
.llm-panel-content {
  display: flex;
  flex-direction: column;
  gap: 6px;

  padding: 8px 10px;
  width: 220px;
  height: 70px;
  color: white;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status {
  font-size: 0.85rem;
  font-weight: 600;
}

.queue-info {
  font-size: 0.75rem;
  opacity: 0.85;
}


.discard-btn {
  align-items: center;
  background-color: white;
  color: black;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  display: inline-flex;
  height: 40px;
  justify-content: center;
  padding: 0.25rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  font-size: larger;
}

.discard-btn:hover {
  background-color: rgba(95, 95, 95, 0.08);
  box-shadow: 0 2px 4px rgba(29, 31, 33, 0.12);
}


.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.15);
  border-radius: 4px;
  overflow: hidden;
}

.progress-indicator {
  height: 100%;
  width: 40%;
  background: linear-gradient(90deg, #38bdf8, #0ea5e9);
  animation: slide 1.2s linear infinite;
}

@keyframes slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}

</style>
