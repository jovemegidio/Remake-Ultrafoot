import { LEAGUE_COMPETITIONS } from "../lib/country-competitions"
for (const [d,c] of Object.entries(LEAGUE_COMPETITIONS)) if (/EUA|Estados/.test(c.country)) console.log(d, "=>", JSON.stringify(c.country))
