import { normalizeAppHref, toClientRoute } from "../lib/hard-navigation"

const fail = (message: string): never => { throw new Error(message) }

const routes = [
  "/", "/splash", "/novo-jogo", "/elenco", "/elenco/gerenciamento",
  "/mercado", "/calendario", "/partida", "/partida/ao-vivo", "/configuracoes",
]

for (const route of routes) {
  const exported = normalizeAppHref(route)
  const client = toClientRoute(exported)
  const expectedClient = route === "/" ? "/" : route.replace(/\/+$/, "")
  if (client !== expectedClient) fail(`${route}: cliente recebeu ${client}, esperado ${expectedClient}`)
  if (route !== "/" && !exported.endsWith("/")) fail(`${route}: export não recebeu barra final`)
}

if (toClientRoute("/elenco/?tab=reservas#lista") !== "/elenco?tab=reservas#lista") {
  fail("query/hash foram alterados ao converter a rota")
}
if (toClientRoute("https://example.com/a/") !== "https://example.com/a/") {
  fail("URL externa foi alterada")
}

console.log(`OK navegação: ${routes.length} rotas exportadas e rotas do cliente compatíveis`)
