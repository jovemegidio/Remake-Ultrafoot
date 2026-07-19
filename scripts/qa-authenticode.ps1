param([string[]]$ArtifactPaths = @())
$ErrorActionPreference = "Stop"
if ($ArtifactPaths.Count -eq 0) {
    $version = (Get-Content "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json).version
    $ArtifactPaths = @("src-tauri\target\release\ultrafoot.exe")
    $ArtifactPaths += Get-ChildItem "src-tauri\target\release\bundle" -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in @(".exe", ".msi") -and $_.Name -like "*$version*" } | Select-Object -ExpandProperty FullName
}
$ArtifactPaths = $ArtifactPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -Unique
if ($ArtifactPaths.Count -eq 0) { throw "Nenhum artefato Windows encontrado." }
$invalid = foreach ($artifact in $ArtifactPaths) {
    $signature = Get-AuthenticodeSignature -LiteralPath $artifact
    if ($signature.Status -ne "Valid") { [PSCustomObject]@{ Artifact = $artifact; Status = $signature.Status; Message = $signature.StatusMessage } }
}
if ($invalid) { $invalid | Format-Table -AutoSize; throw "Release bloqueado: artefatos sem Authenticode valido." }
Write-Host "OK Authenticode: $($ArtifactPaths.Count) artefato(s)." -ForegroundColor Green
