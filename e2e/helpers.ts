import { Page } from "@playwright/test"

export const SAVE_KEY = "ultrafoot:save"
export const ENGINE_KEY = "ultrafoot-game-engine"

export async function injectTeamState(page: Page, teamShort = "FLM") {
  await page.goto("/")
  await page.evaluate(
    ({ key, teamShort }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          selectedTeamShort: teamShort,
          week: 0,
          season: 2026,
          coachName: "Técnico Teste",
          coachAvatar: "avatar1",
          difficulty: "normal",
          language: "pt-BR",
          controllerType: "xbox",
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
