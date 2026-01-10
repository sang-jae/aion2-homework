<!-- src/App.vue -->
<script setup lang="ts">
import MainNav from '@/components/MainNav.vue'
</script>

<template>
  <v-app>
    <MainNav />
    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>