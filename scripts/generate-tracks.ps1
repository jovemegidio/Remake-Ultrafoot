# Regenera public/music/tracks.json com todos os arquivos de musica da pasta music/
# Execute apos adicionar/remover faixas para atualizar a lista no player.

$musicFolder = "C:\Users\agencia\Documents\Ultrafoot_\music"
$audioExtensions = @(".mp3", ".webm", ".ogg")
$files = Get-ChildItem -Path $musicFolder -File -ErrorAction SilentlyContinue |
    Where-Object { $audioExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name

$tracks = @()
foreach ($file in $files) {
    $name = $file.BaseName
    $title = $name -replace '^\d+\s*-\s*', ''
    $title = $title.Trim()
    $encodedFileName = [System.Uri]::EscapeDataString($file.Name)

    $tracks += @{
        title    = $title
        artist   = "Ultrafoot Radio"
        cover    = "/stadium-bg.jpg"
        src      = "/music/$encodedFileName"
        duration = 0
    }
}

$json = $tracks | ConvertTo-Json -Depth 3
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText("$musicFolder\tracks.json", $json, $utf8NoBom)
Write-Host "tracks.json atualizado com $($tracks.Count) musicas"
