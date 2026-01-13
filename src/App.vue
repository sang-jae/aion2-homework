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

<style>
@font-face {
  font-family: 'NanumSquareRound';
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/NanumSquareRound.woff') format('woff');
  font-weight: normal;
  font-display: swap;
}

@font-face {
    font-family: 'SchoolSafeBoardMarker';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2511-1@1.0/HakgyoansimBoadmarkerR.woff2') format('woff2');
    font-weight: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Jeongmeokbawi';
    src: url('https://gcore.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/SangSangRockOTF.woff') format('woff');
    font-weight: normal;
    font-display: swap;
}
</style>