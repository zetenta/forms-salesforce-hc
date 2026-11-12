<script setup lang="ts">
// Top-level layout shared by every page. Mirrors `src/app/layout.tsx` from
// the legacy Next.js implementation: sticky theme switcher header + page
// content slot.
// Las páginas con `definePageMeta({ embed: true })` (p. ej. /donar, que se
// muestra dentro de un iframe en WordPress) van sin el header.
const route = useRoute();
</script>

<template>
  <div class="flex min-h-full flex-col">
    <header v-if="!route.meta.embed" class="sticky top-0 z-10 flex justify-end px-4 py-3">
      <ThemeSwitcher />
    </header>
    <div class="flex-1">
      <NuxtPage />
    </div>
  </div>
</template>
