<!-- src/components/MainNav.vue -->
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import AHLogo from '@/assets/AH_square.png'

const route = useRoute()
const router = useRouter()

const items = [
  { title: '홈',        to: '/' },
  { title: '숙제',      to: '/homework' },
  //{ title: '계산기',    to: '/calculator' },
]

function go(to: string) {
  if (route.path !== to) {
    router.push(to)
  }
}
</script>

<template>
  <v-app-bar flat density="comfortable">
    <v-toolbar-title class="d-flex align-center">
      <div class="nav-title-wrap">
				<img :src="AHLogo" alt="AION2 HW Logo" class="nav-logo" />
				<span class="nav-title">AION2 HOMEWORK</span>
			</div>
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


<style scoped>
.nav-title-wrap {
  display: flex;
  align-items: center;   /* 세로 가운데 정렬 */
}

/* 로고 크기 & 위치 */
.nav-logo {
  width: 36px;           /* 조금 더 크게 (원하면 36~40까지도 가능) */
  height: 36px;
  margin-right: 8px;
  object-fit: contain;
  display: block;        /* 이미지 baseline 영향 제거 */
}

/* 텍스트는 그대로, 필요하면 살짝 키워도 됨 */
.nav-title {
  font-family: 'Jeongmeokbawi';
  font-weight: 700;
  font-size: 25px;
}
</style>