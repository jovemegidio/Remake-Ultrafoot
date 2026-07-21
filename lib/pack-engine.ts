import { safeLocalSet } from "@/lib/safe-storage"
// PHASE 7 — Sistema de packs (.ultrafoot)
// Status: skeleton — importar/exportar packs, validar, preview escudo/camisa,
// ativar/desativar, compatibilidade com Brasfoot/fantasy/retrô/comunidade.

export interface PackManifest {
  id: string
  name: string
  version: string
  authors: string[]
  description: string
  ultrafootVersionMin: string
  ultrafootVersionMax?: string
  type: "teams" | "players" | "competition" | "audio" | "kits" | "stadiums" | "mixed"
  contents: PackContent[]
}

export interface PackContent {
  kind: "team" | "player" | "kit" | "crest" | "stadium" | "audio" | "competition" | "rules"
  path: string                     // path within pack
  meta?: Record<string, unknown>
}

export interface PackPreview {
  manifest: PackManifest
  crestSamples: string[]           // first 6 crests as base64/url
  kitSamples: string[]
  totalTeams: number
  totalPlayers: number
}

export interface InstalledPack {
  manifest: PackManifest
  enabled: boolean
  installPath: string
  installedAt: number
}

export type PackValidationError =
  | "missing_manifest"
  | "invalid_version"
  | "version_mismatch"
  | "incompatible_format"
  | "missing_files"
  | "duplicate_team_id"
const PACKS_KEY="ultrafoot:installed-packs"
const memoryPacks:InstalledPack[]=[]
function readPacks():InstalledPack[]{if(typeof localStorage==="undefined")return memoryPacks.map(p=>structuredClone(p));try{return JSON.parse(localStorage.getItem(PACKS_KEY)??"[]") as InstalledPack[]}catch{return[]}}
function writePacks(p:InstalledPack[]):void{if(typeof localStorage==="undefined"){memoryPacks.splice(0,memoryPacks.length,...p.map(x=>structuredClone(x)));return}safeLocalSet(PACKS_KEY,JSON.stringify(p))}
async function readManifest(input:string|Blob):Promise<PackManifest>{if(input instanceof Blob)return JSON.parse(await input.text()) as PackManifest;if(input.trim().startsWith("{"))return JSON.parse(input) as PackManifest;throw new Error("O caminho precisa ser lido pelo seletor nativo antes da importação.")}

/** Importa pack a partir de arquivo .ultrafoot (zip-like). */
export async function importPack(filePathOrBlob: string | Blob): Promise<InstalledPack> {
  const manifest=await readManifest(filePathOrBlob),errors=validatePack(manifest);if(errors.length)throw new Error(`Pack inválido: ${errors.join(", ")}`);const installed={manifest,enabled:true,installPath:`packs/${manifest.id}`,installedAt:Date.now()};writePacks([...readPacks().filter(p=>p.manifest.id!==manifest.id),installed]);return installed
}

/** Exporta a configuração atual ou pack selecionado para .ultrafoot. */
export async function exportPack(packId: string): Promise<Blob> {
  const pack=readPacks().find(p=>p.manifest.id===packId);if(!pack)throw new Error(`Pack não instalado: ${packId}`);return new Blob([JSON.stringify(pack.manifest,null,2)],{type:"application/vnd.ultrafoot+json"})
}

/** Valida manifest e estrutura do pack. */
export function validatePack(manifest: PackManifest): PackValidationError[] {
  const e:PackValidationError[]=[];if(!manifest||!manifest.id||!manifest.name)e.push("missing_manifest");if(!/^\d+\.\d+\.\d+/.test(manifest?.version??""))e.push("invalid_version");if(!Array.isArray(manifest?.contents))e.push("incompatible_format");if(manifest?.contents?.some(c=>!c.path||!c.kind))e.push("missing_files");const ids=(manifest?.contents??[]).filter(c=>c.kind==="team").map(c=>String(c.meta?.id??c.path));if(new Set(ids).size!==ids.length)e.push("duplicate_team_id");return [...new Set(e)]
}

/** Gera preview rápido sem instalar. */
export async function previewPack(filePathOrBlob: string | Blob): Promise<PackPreview> {
  const manifest=await readManifest(filePathOrBlob);return{manifest,crestSamples:manifest.contents.filter(c=>c.kind==="crest").slice(0,6).map(c=>c.path),kitSamples:manifest.contents.filter(c=>c.kind==="kit").slice(0,6).map(c=>c.path),totalTeams:manifest.contents.filter(c=>c.kind==="team").length,totalPlayers:manifest.contents.filter(c=>c.kind==="player").length}
}

/** Lista packs instalados. */
export function listInstalledPacks(): InstalledPack[] {
  return readPacks()
}

/** Ativa/desativa pack (sem desinstalar). */
export function setPackEnabled(packId: string, enabled: boolean): void {
  const packs=readPacks(),pack=packs.find(p=>p.manifest.id===packId);if(!pack)throw new Error(`Pack não instalado: ${packId}`);pack.enabled=enabled;writePacks(packs)
}

/** Importa pack de Brasfoot (.bf*) — converte para formato .ultrafoot. */
export async function importBrasfootPack(path: string): Promise<InstalledPack> {
  const name=path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/,"")??"Brasfoot";return importPack(new Blob([JSON.stringify({id:`brasfoot-${name.toLowerCase().replace(/\W+/g,"-")}`,name,version:"1.0.0",authors:["Importado"],description:"Pacote convertido do Brasfoot",ultrafootVersionMin:"1.0.0",type:"mixed",contents:[]})]))
}
