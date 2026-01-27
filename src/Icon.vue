<script setup lang ="ts">
defineProps(['name'])
</script>

<template>
  <svg v-if="name === 'save'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M21 7v12q0 .825-.587 1.413T19 21H5q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h12zm-9 11q1.25 0 2.125-.875T15 15t-.875-2.125T12 12t-2.125.875T9 15t.875 2.125T12 18m-6-8h9V6H6z"
    />
  </svg>

  <svg v-else-if="name === 'restore'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="m12 17l4-4l-1.4-1.4l-1.6 1.55V9h-2v4.15L9.4 11.6L8 13zm-6 5q-.825 0-1.412-.587T4 20V8l6-6h8q.825 0 1.413.588T20 4v16q0 .825-.587 1.413T18 22zm0-2h12V4h-7.15L6 8.85zm0 0h12z"
    />
  </svg>

  <svg v-else-if="name === 'add'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path fill="currentColor" d="M11 13H5v-2h6V5h2v6h6v2h-6v6h-2z" />
  </svg>

  <svg v-else-if="name === 'folder'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
        fill="currentColor"
        d="M10 4l2 2h8q.825 0 1.413.588T22 8v10q0 .825-.587 1.413T20 20H4q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h6z"
    />
  </svg>

  <svg v-else-if="name === 'upload'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
        fill="currentColor"
        d="M5 20q-.825 0-1.412-.587T3 18v-3h2v3h14v-3h2v3q0 .825-.587 1.413T19 20zM12 4l4 4l-1.4 1.4l-1.6-1.55V15h-2V7.85L9.4 9.4L8 8z"
    />
  </svg>

  <svg v-else-if="name === 'trash'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path fill="currentColor" d="M6 19q0 .825.588 1.413T8 21h8q.825 0 1.412-.587T18 19V7H6v12zm3-10h2v8H9v-8zm4 0h2v8h-2v-8zM5 5h14v2H5V5z"/>
  </svg>

  <svg v-else-if="name === 'wand'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
    <!-- Zauberstab -->
    <line x1="5" y1="25" x2="25" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>

    <!-- Funken weiter entfernt und größer verteilt -->
    <circle cx="15" cy="5" r="2" fill="currentColor"/>
    <circle cx="20" cy="2" r="2" fill="currentColor"/>
    <circle cx="25" cy="2" r="2" fill="currentColor"/>
    <circle cx="28" cy="5" r="2" fill="currentColor"/>
    <circle cx="28" cy="10" r="2" fill="currentColor"/>
  </svg>


  <svg v-else-if="name === 'undo'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
        fill="currentColor"
        d="M12 5q3.3 0 5.65 2.35T20 13q0 3.3-2.35 5.65T12 21q-2.9 0-5.125-1.825T4 15h2q.725 2.125 2.463 3.563T12 20q2.5 0 4.25-1.75T18 13q0-2.5-1.75-4.25T12 7q-1.65 0-3.05.875T6.35 11H10v2H4V7h2v2.1q1.05-1.25 2.5-1.975T12 5z"
    />
  </svg>

  <svg v-else-if="name === 'redo'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path
        fill="currentColor"
        d="M12 5q2.05 0 3.8.975t2.75 2.725V7h2v6h-6v-2h3.4q-.8-1.5-2.225-2.375T12 8q-2.5 0-4.25 1.75T6 14q0 2.5 1.75 4.25T12 20q1.9 0 3.425-1.025T18 17h2q-.8 2.5-2.95 4.25T12 23q-3.3 0-5.65-2.35T4 15q0-3.3 2.35-5.65T12 5z"
    />
  </svg>



</template>
