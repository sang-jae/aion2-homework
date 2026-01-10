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
  // 페이지 진입 시, 지난 시간 동안의 자동 증가 먼저 반영
  handleAutoIncrease()
  // 이후 1분마다 체크
  timerId = window.setInterval(handleAutoIncrease, 60_000)
})

onBeforeUnmount(() => {
  if (timerId) {
    window.clearInterval(timerId)
  }
})

const draggingColumnId = ref<string | null>(null)
const dropPreview = ref<{ targetId: string; position: 'before' | 'after' } | null>(null)

function onColumnDragStart(colId: string, event: DragEvent) {
  draggingColumnId.value = colId
  dropPreview.value = null

  event.dataTransfer?.setData('text/plain', colId)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onColumnDragOver(colId: string, event: DragEvent) {
  // 드롭 가능하게 하려면 필수
  event.preventDefault()
  if (!draggingColumnId.value || draggingColumnId.value === colId) {
    dropPreview.value = null
    return
  }

  const target = event.currentTarget as HTMLElement | null
  let position: 'before' | 'after' = 'after'

  if (target) {
    const rect = target.getBoundingClientRect()
    const x = event.clientX - rect.left
    position = x < rect.width / 2 ? 'before' : 'after'
  }

  dropPreview.value = { targetId: colId, position }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onColumnDrop(colId: string, event: DragEvent) {
  event.preventDefault()

  const fromId = draggingColumnId.value
  const preview = dropPreview.value
  draggingColumnId.value = null
  dropPreview.value = null

  if (!fromId) return

  const cols = state.value.columns
  const fromIndex = cols.findIndex((c) => c.id === fromId)
  let toIndex = cols.findIndex((c) => c.id === colId)

  if (fromIndex === -1 || toIndex === -1) return
  if (fromIndex === toIndex && !preview) return

  // before/after 위치 보정
  if (preview && preview.targetId === colId) {
    if (preview.position === 'after') {
      toIndex += 1
    }
  } else {
    // preview 없으면 현재 컬럼 위치로 이동
    // (기본 after 느낌)
    toIndex += 1
  }

  // 원소를 뺀 뒤 삽입할 때 인덱스 보정
  const [moved] = cols.splice(fromIndex, 1)
  if (fromIndex < toIndex) {
    toIndex -= 1
  }
  cols.splice(toIndex, 0, moved)
}

function onColumnDragEnd() {
  draggingColumnId.value = null
  dropPreview.value = null
}


const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

function makeAnchorAtHour(hour: number) {
  const d = new Date(0)
  d.setHours(hour, 0, 0, 0) // 로컬시간 기준 hour 시
  return d
}

// 5시 기준 앵커 (원정, 오드, 초월, 슈고 등)
const ANCHOR_5 = makeAnchorAtHour(5)

// 수요일 오전 5시 앵커 (일일던전, 각성전, 토벌전)
const ANCHOR_WED_5 = (() => {
  const d = makeAnchorAtHour(5)
  // 1970-01-01 의 getDay() 기준으로 수요일(3)이 될 때까지 진행
  while (d.getDay() !== 3) {
    d.setDate(d.getDate() + 1)
  }
  return d
})()

/**
 * last ~ now 사이에, anchor + n * periodMs 에 해당하는 이벤트가
 * 몇 번 있었는지 계산 (last < t <= now)
 */
function countPeriodicEvents(
  last: Date,
  now: Date,
  anchor: Date,
  periodMs: number
): number {
  const lastMs = last.getTime()
  const nowMs = now.getTime()
  if (nowMs <= lastMs) return 0

  const baseMs = anchor.getTime()
  const fromIndex = Math.floor((lastMs - baseMs) / periodMs)
  const toIndex = Math.floor((nowMs - baseMs) / periodMs)

  return Math.max(0, toIndex - fromIndex)
}

function addBaseToRow(rowId: string, amount: number) {
  if (amount <= 0) return
  for (const col of state.value.columns) {
    const cell = getCell(rowId, col.id)
    const max = cell.baseMax
    if (max > 0) {
      cell.baseCurrent = Math.min(max, cell.baseCurrent + amount)
    } else {
      cell.baseCurrent += amount
    }
  }
}

function setBaseToMax(rowId: string) {
  for (const col of state.value.columns) {
    const cell = getCell(rowId, col.id)
    const max = cell.baseMax
    if (max > 0) {
      cell.baseCurrent = max
    }
  }
}

function handleAutoIncrease() {
  const now = new Date()

  let last = new Date(state.value.lastAutoUpdate || now.toISOString())
  if (isNaN(last.getTime())) {
    last = now
  }

  // 미래로 꼬여 있으면 리셋
  if (now.getTime() <= last.getTime()) {
    state.value.lastAutoUpdate = now.toISOString()
    return
  }

  // --- 원정 정복 : 매일 5시/13시/21시 +1 (8시간 주기, 5시 시작) ---
  const expeditionEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    8 * HOUR_MS
  )
  if (expeditionEvents > 0) {
    addBaseToRow('row-expedition', expeditionEvents * 1)
  }

  // --- 오드 : 매일 5시부터 3시간 단위로 +15 ---
  const odeEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    3 * HOUR_MS
  )
  if (odeEvents > 0) {
    addBaseToRow('row-ode', odeEvents * 15)
  }

  // --- 초월 : 매일 5시 / 17시마다 +1 (12시간 주기, 5시 시작) ---
  const chowolEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    12 * HOUR_MS
  )
  if (chowolEvents > 0) {
    addBaseToRow('row-chowol', chowolEvents * 1)
  }

  // --- 슈고 : 매일 5시에 +2 (24시간 주기, 5시 시작) ---
  const shugoEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_5,
    DAY_MS
  )
  if (shugoEvents > 0) {
    addBaseToRow('row-shugo', shugoEvents * 2)
  }

  // --- 일일던전 / 각성전 / 토벌전 : 매주 수요일 5시 ---
  const weeklyEvents = countPeriodicEvents(
    last,
    now,
    ANCHOR_WED_5,
    WEEK_MS
  )

  if (weeklyEvents > 0) {
    // 일일던전 : +7 -> 최대치 7이라 걍 max로 맞춤
    setBaseToMax('row-daily')   // baseMax = 7

    // 각성전 : +3 -> baseMax 3
    setBaseToMax('row-awaken')  // baseMax = 3

    // 토벌전 : +3 -> baseMax 3
    setBaseToMax('row-boss')    // baseMax = 3
  }

  // 마지막 계산 시각 갱신
  state.value.lastAutoUpdate = now.toISOString()
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
          <!-- <v-btn
            size="small"
            variant="tonal"
            color="secondary"
            @click="addRow"
          >
            + 숙제 추가
          </v-btn> -->
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
									class="text-center hw-col-header"
									@dragover="(e) => onColumnDragOver(col.id, e)"
									@drop="(e) => onColumnDrop(col.id, e)"
									@dragend="onColumnDragEnd"
									:class="{
										'hw-drop-before':
											dropPreview && dropPreview.targetId === col.id && dropPreview.position === 'before',
										'hw-drop-after':
											dropPreview && dropPreview.targetId === col.id && dropPreview.position === 'after',
									}"
								>
									<div class="hw-col-header-inner">
										<!-- 🔼 이 바 전체가 드래그 핸들 + 텍스트 점점점 -->
										<div
											class="hw-col-handle-bar"
											draggable="true"
											@dragstart="(e) => onColumnDragStart(col.id, e)"
										>
											<span class="hw-col-dots">⋯</span>
										</div>

										<v-text-field
											v-model="col.name"
											variant="underlined"
											density="compact"
											hide-details
											class="hw-header-input"
											placeholder="캐릭터명"
										/>
									</div>
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

      <!-- <v-card-actions class="justify-end">
        <v-btn
          size="small"
          variant="text"
          @click="resetAll"
        >
          전체 초기화
        </v-btn>
      </v-card-actions> -->
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

.hw-col-header {
  position: relative;
	padding-left: 0 !important;
  padding-right: 0 !important;
}

.hw-col-header-inner {
  display: flex;
  flex-direction: column;
}

/* 드래그 핸들 바 */
.hw-col-handle-bar {
  width: 100%;                    /* ⭐ 전체 가로 꽉 채우기 */
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.15);
  cursor: grab;
  user-select: none;
  border-radius: 0px;
  transition: background-color 0.15s, opacity 0.15s;
  opacity: 0.9;
  box-sizing: border-box;         /* ⭐ padding/테두리 있어도 100% 유지 */
}

.hw-col-handle-bar:hover {
  background-color: rgba(255, 255, 255, 0.25);
  opacity: 1;
}

.hw-col-handle-bar:active {
  cursor: grabbing;
  background-color: rgba(255, 255, 255, 0.32);
}

/* 점점점 표시 */
.hw-col-dots {
  font-size: 16px;
  letter-spacing: 2px;
}

/* 드롭 프리뷰 라인 그대로 */
.hw-col-header.hw-drop-before::before,
.hw-col-header.hw-drop-after::after {
  content: '';
  position: absolute;
  top: 2px;
  bottom: 2px;
  width: 3px;
  border-radius: 999px;
  background-color: rgb(144, 202, 249);
}

.hw-col-header.hw-drop-before::before {
  left: -2px;
}

.hw-col-header.hw-drop-after::after {
  right: -2px;
}
/* 기존 캐릭터 입력 스타일은 그대로 유지 */
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