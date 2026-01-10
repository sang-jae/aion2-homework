// Utilities
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    //
    // 슈고 키
    sugoTicketBase: 0,
    sugoTicketBaseMax: 14,
    sugoTicketPlus: 0,
    sugoTicketPlusMax: 30,
    // 원정 정복 티켓
    conquestTicketBase: 0,
    conquestTicketBaseMax: 21,
    conquestTicketPlus: 0,
    // 오드
    oddBase: 0,
    oddBaseMax: 840,
    oddPlus: 0,
    oddPlusMax: 2000,
    // 초월 티켓
    transcendenceTicketBase: 0,
    transcendenceTicketBaseMax: 14,
    transcendenceTicketPlus: 0,
    // 일일던전 티켓
    dailyDungeonTicketBase: 0,
    dailyDungeonTicketBaseMax: 7,
    dailyDungeonTicketPlus: 0,
    dailyDungeonTicketPlusMax: 30,
    // 각성전 티켓
    awakeningTicketBase: 0,
    awakeningTicketBaseMax: 3,
    awakeningTicketPlus: 0,
    awakeningTicketPlusMax: 30,
    // 토벌전 티켓
    trialTicketBase: 0,
    trialTicketBaseMax: 3,
    trialTicketPlus: 0,
    trialTicketPlusMax: 30,

  }),
})
