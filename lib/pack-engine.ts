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

/** Importa pack a partir de arquivo .ultrafoot (zip-like). */
export async function importPack(_filePathOrBlob: string | Blob): Promise<InstalledPack> {
  throw new Error("pack-engine.importPack: not implemented")
}

/** Exporta a configuração atual ou pack selecionado para .ultrafoot. */
export async function exportPack(_packId: string): Promise<Blob> {
  throw new Error("pack-engine.exportPack: not implemented")
}

/** Valida manifest e estrutura do pack. */
export function validatePack(_manifest: PackManifest): PackValidationError[] {
  throw new Error("pack-engine.validatePack: not implemented")
}

/** Gera preview rápido sem instalar. */
export async function previewPack(_filePathOrBlob: string | Blob): Promise<PackPreview> {
  throw new Error("pack-engine.previewPack: not implemented")
}

/** Lista packs instalados. */
export function listInstalledPacks(): InstalledPack[] {
  throw new Error("pack-engine.listInstalledPacks: not implemented")
}

/** Ativa/desativa pack (sem desinstalar). */
export function setPackEnabled(_packId: string, _enabled: boolean): void {
  throw new Error("pack-engine.setPackEnabled: not implemented")
}

/** Importa pack de Brasfoot (.bf*) — converte para formato .ultrafoot. */
export async function importBrasfootPack(_path: string): Promise<InstalledPack> {
  throw new Error("pack-engine.importBrasfootPack: not implemented")
}
