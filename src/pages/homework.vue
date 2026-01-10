<!-- src/pages/homework.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import HomeworkCell from '@/components/HomeworkCell.vue'

interface CounterCell {
  baseCurrent: number
  baseMax: number
  extraCurrent: number
  extraMax: number
}

interface HomeworkRow {
  id: string
  name: string
}

interface CharacterColumn {
  id: string
  name: string
}

interface HomeworkState {
  rows: HomeworkRow[]
  columns: CharacterColumn[]
  cells: Record<string, CounterCell>
  lastAutoUpdate: string
}

const STORAGE_KEY = 'aion2-homework-state-v1'

// 기본 행/열
const defaultRows: HomeworkRow[] = [
  { id: 'row-expedition', name: '원정 정복' },
  { id: 'row-ode',        name: '오드' },
  { id: 'row-chowol',     name: '초월' },
  { id: 'row-daily',      name: '일일던전' },
  { id: 'row-awaken',     name: '각성전' },
  { id: 'row-boss',       name: '토벌전' },
  { id: 'row-shugo',      name: '슈고' },
]

const defaultColumns: CharacterColumn[] = [
  { id: 'char-1', name: '캐릭터명1' },
]

// 🔹 행별 최대치 설정
// extraMax 가 0 이면 "제한 없음"
const rowMaxConfig: Record<string, { baseMax: number; extraMax: number }> = {
  'row-shugo': {
    baseMax: 14,  // 슈고 기본
    extraMax: 30, // 슈고 추가
  },
  'row-expedition': {
    baseMax: 21,  // 원정 기본
    extraMax: 0,  // 제한 없음
  },
  'row-ode': {
    baseMax: 840, // 오드 기본
    extraMax: 2000, // 오드 추가
  },
  'row-chowol': {
    baseMax: 14, // 초월 기본
    extraMax: 0, // 제한 없음
  },
  'row-daily': {
    baseMax: 7,  // 일일던전 기본
    extraMax: 30, // 일일던전 추가
  },
  'row-awaken': {
    baseMax: 3,  // 각성전 기본
    extraMax: 30, // 각성전 추가
  },
  'row-boss': {
    baseMax: 3,  // 토벌전 기본
    extraMax: 30, // 토벌전 추가
  },
}

// 셀 템플릿 (최대치는 행별 설정으로 덮어씀)
const defaultCell: CounterCell = {
  baseCurrent: 0,
  baseMax: 0,
  extraCurrent: 0,
  extraMax: 0,
}

// 초기 상태 로드 (localStorage → 없으면 기본값)
function loadInitialState(): HomeworkState {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as HomeworkState
        if (parsed && parsed.rows && parsed.columns && parsed.cells) {
          // 예전 저장본에도 최대치 새로 적용
          applyMaxConfig(parsed)
          return parsed
        }
      } catch {
        // 무시하고 기본값으로
      }
    }
  }

  const cells: Record<string, CounterCell> = {}
  const base: HomeworkState = {
    rows: defaultRows,
    columns: defaultColumns,
    cells,
    lastAutoUpdate: new Date().toISOString(),
  }

  for (const row of defaultRows) {
    for (const col of defaultColumns) {
      const key = cellKey(row.id, col.id)
      base.cells[key] = { ...defaultCell }
    }
  }

  applyMaxConfig(base)
  return base
}

const state = ref<HomeworkState>(loadInitialState())

const rows = computed(() => state.value.rows)
const columns = computed(() => state.value.columns)

// cell key helpers
function cellKey(rowId: string, colId: string) {
  return `${rowId}__${colId}`
}

// 행별 최대치 적용 + 현재값 보정
function applyMaxConfig(target: HomeworkState) {
  for (const row of target.rows) {
    const config = rowMaxConfig[row.id]
    for (const col of target.columns) {
      const key = cellKey(row.id, col.id)
      const cell =
        target.cells[key] ?? (target.cells[key] = { ...defaultCell })

      if (config) {
        cell.baseMax = config.baseMax
        cell.extraMax = config.extraMax
      }

      // 범위 보정
      if (cell.baseCurrent < 0) cell.baseCurrent = 0
      if (cell.extraCurrent < 0) cell.extraCurrent = 0
      if (cell.baseMax > 0 && cell.baseCurrent > cell.baseMax) {
        cell.baseCurrent = cell.baseMax
      }
      if (cell.extraMax > 0 && cell.extraCurrent > cell.extraMax) {
        cell.extraCurrent = cell.extraMax
      }
    }
  }
}

function getCell(rowId: string, colId: string): CounterCell {
  const key = cellKey(rowId, colId)
  const cells = state.value.cells

  if (!cells[key]) {
    const config = rowMaxConfig[rowId]
    cells[key] = {
      baseCurrent: 0,
      extraCurrent: 0,
      baseMax: config ? config.baseMax : 0,
      extraMax: config ? config.extraMax : 0,
    }
  } else {
    // 혹시 저장된 데이터에 max가 0으로 남아있으면 행 설정으로 덮어준다
    const config = rowMaxConfig[rowId]
    if (config) {
      cells[key].baseMax = config.baseMax
      cells[key].extraMax = config.extraMax
    }
  }

  return cells[key]
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min
  if (value > max) return max
  return value
}

// 버튼 동작들
function changeBase(rowId: string, colId: string, delta: number) {
  const cell = getCell(rowId, colId)
  const next = cell.baseCurrent + delta
  cell.baseCurrent = clamp(next, 0, cell.baseMax)
}

function changeExtra(rowId: string, colId: string, delta: number) {
  const cell = getCell(rowId, colId)
  const next = cell.extraCurrent + delta
  cell.extraCurrent = clamp(next, 0, cell.extraMax)
}

// 행 추가
function addRow() {
  const name = window.prompt('추가할 숙제 이름을 입력하세요.')
  if (!name) return
  const trimmed = name.trim()
  if (!trimmed) return

  const id = `row-${Date.now()}`
  state.value.rows.push({ id, name: trimmed })

  for (const col of state.value.columns) {
    getCell(id, col.id) // 생성 + 최대치 세팅
  }
}

// 열(캐릭터) 추가용 다이얼로그
const addColumnDialog = ref(false)
const newCharacterName = ref('')

function openAddColumn() {
  newCharacterName.value = ''
  addColumnDialog.value = true
}

// 열(캐릭터) 추가
function confirmAddColumn() {
  const name = newCharacterName.value.trim()
  if (!name) return

  const id = `char-${Date.now()}`
  state.value.columns.push({ id, name })

  for (const row of state.value.rows) {
    // 여기서 getCell을 호출하면 위에서 최대치까지 자동 세팅
    getCell(row.id, id)
  }

  addColumnDialog.value = false
}

// localStorage 저장
watch(
  state,
  (val) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    }
  },
  { deep: true }
)

// 자동 증가용 타이머 골격 (지금은 구조만 잡아둠)
let timerId: number | undefined

onMounted(() => {
  timerId = window.setInterval(handleAutoIncrease, 60_000) // 1분 간격
})

onBeforeUnmount(() => {
  if (timerId) {
    window.clearInterval(timerId)
  }
})

function handleAutoIncrease() {
  // TODO:
  // 각 행(콘텐츠)별로 +1 / +2 되는 시간대를 코드/설정으로 넣으면
  // 여기서 state.value.lastAutoUpdate 기준으로
  // 지나간 만큼 증가시키는 로직을 구현하면 된다.
  //
  // 일단 지금은 동작하지 않고, 타이머 구조만 잡아둔 상태.
}
</script>

<template>
  <v-container class="py-8" fluid>
    <h1 class="text-h4 mb-2 font-weight-bold">숙제표 체크리스트</h1>
    <p class="text-body-2 mb-6 opacity-70">
      캐릭터별 숙제 현황을 기록하는 표입니다. 값은 브라우저에 저장되며 새로고침해도 유지됩니다.
    </p>

    <v-card class="hw-card" elevation="3">
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="text-subtitle-1 font-weight-medium">
          일일 / 주간 숙제 관리
        </div>
        <div class="d-flex hw-actions">
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            @click="openAddColumn"
          >
            + 캐릭터 추가
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            color="secondary"
            @click="addRow"
          >
            + 숙제 추가
          </v-btn>
        </div>
      </v-card-title>

      <v-divider />

      <v-card-text class="pa-0">
        <div class="hw-table-wrapper">
          <v-table class="hw-table" density="comfortable">
            <thead>
              <tr>
                <th class="hw-first-col text-left text-caption text-uppercase">
                  컨텐츠
                </th>

                <th
                  v-for="col in columns"
                  :key="col.id"
                  class="text-center"
                >
                  <v-text-field
                    v-model="col.name"
                    variant="underlined"
                    density="compact"
                    hide-details
                    class="hw-header-input"
                    placeholder="캐릭터명"
                  />
                </th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td class="hw-first-col">
                  <v-text-field
                    v-model="row.name"
                    variant="plain"
                    density="compact"
                    hide-details
                    class="hw-row-input"
                  />
                </td>

                <td
                  v-for="col in columns"
                  :key="col.id"
                  class="pa-2"
                >
                  <HomeworkCell :cell="getCell(row.id, col.id)" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>

      <v-card-actions class="justify-end">
        <v-btn
          size="small"
          variant="text"
          @click="resetAll"
        >
          전체 초기화
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- 캐릭터 추가 다이얼로그 -->
    <v-dialog v-model="addColumnDialog" max-width="400">
      <v-card>
        <v-card-title>캐릭터 추가</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newCharacterName"
            label="캐릭터명"
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="addColumnDialog = false">
            취소
          </v-btn>
          <v-btn color="primary" @click="confirmAddColumn">
            확인
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.hw-card {
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hw-table-wrapper {
  overflow-x: auto;
}

.hw-table :deep(th),
.hw-table :deep(td) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.hw-table :deep(thead tr) {
  background-color: rgba(255, 255, 255, 0.03);
}

.hw-first-col {
  min-width: 150px;
}

.hw-header-input :deep(input) {
  text-align: center;
  font-size: 13px;
}

.hw-row-input :deep(input) {
  font-weight: 600;
  font-size: 13px;
}

.opacity-70 {
  opacity: 0.7;
}

/* Vuetify gap 유틸 대신 */
.hw-actions > * + * {
  margin-left: 8px;
}
</style>