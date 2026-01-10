<!-- src/components/MainNav.vue -->
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const items = [
  { title: '홈',        to: '/' },
  { title: '숙제',      to: '/homework' },
  { title: '계산기',    to: '/calcurator' }, // 요청하신 대로 철자 그대로
]

function go(to: string) {
  if (route.path !== to) {
    router.push(to)
  }
}
</script>

<template>
  <v-app-bar flat density="comfortable">
    <v-toolbar-title class="font-weight-bold">
      AION2 HOMEWORK
    </v-toolbar-title>

    <v-spacer />

    <v-btn
      v-for="item in items"
      :key="item.to"
      variant="text"
      :color="route.path === item.to ? 'primary' : undefined"
      @click="go(item.to)"
    >
      {{ item.title }}
    </v-btn>
  </v-app-bar>
</template>