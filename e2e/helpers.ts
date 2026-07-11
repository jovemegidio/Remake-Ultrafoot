import { Page } from "@playwright/test"

export const SAVE_KEY = "ultrafoot:save"
export const ENGINE_KEY = "ultrafoot-game-engine"

export async function injectTeamState(page: Page, teamShort = "FLA") {
  // addInitScript runs before React, ensuring sessionStorage is set before useState reads it
  await page.addInitScript(() => {
    sessionStorage.setItem("ultrafoot:session-active", "true")
  })

  await page.goto("/splash")
  await page.evaluate(
    ({ key, teamShort }) => {
      // version: 3 is required by safeParse — without it the save is rejected
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 3,
          selectedTeamShort: teamShort, // "FLA" = Flamengo (valid curto in teams-data.ts)
          week: 0,
          season: 2026,
          managerName: "Técnico Teste",
          language: "pt-BR",
          controllerType: "xbox",
          selectedUniform: "home",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          multiplayerEnabled: false,
          managers: [],
          activeManagerId: null,
          controllerBindings: {},
          coachSkills: [],
          coachXP: 0,
          coachCrisisCount: 0,
          coachWinStreak: 0,
          coachTotalTitles: 0,
          coachLegacy: { totalSeasons: 0, totalTitles: 0, careerRecords: [], legacySkills: [], reputationLevel: 0, legacyXP: 0 },
        })
      )
    },
    { key: SAVE_KEY, teamShort }
  )
}

export async function injectMatchedState(page: Page, teamShort = "FLM", week = 1) {
  await injectTeamState(page, teamShort)
  await page.evaluate(
    ({ week }) => {
      const save = JSON.parse(localStorage.getItem("ultrafoot:save") || "{}")
      save.week = week
      localStorage.setItem("ultrafoot:save", JSON.stringify(save))
    },
    { week }
  )
}
