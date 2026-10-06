# Confere o projeto antes de subir no GitHub:
#   • todo arquivo citado em <script src>, <link href> e <a href> relativo dos HTMLs existe?
#   • há arquivos de código "soltos" (que nenhuma página carrega)?
#   • os arquivos de configuração definem as variáveis esperadas?
# Uso: powershell -File tools\verificar-projeto.ps1
$raiz = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$utf8 = New-Object System.Text.UTF8Encoding($false)
$paginas = 'index.html', 'admin\index.html', 'admin\senha.html'
$citados = @{}
$faltando = 0

foreach ($rel in $paginas) {
    $arq = Join-Path $raiz $rel
    if (-not (Test-Path -LiteralPath $arq)) { Write-Host "FALTA a página $rel" -ForegroundColor Red; $faltando++; continue }
    $pasta = Split-Path -Parent $arq
    $html = [IO.File]::ReadAllText($arq, $utf8)
    foreach ($m in [regex]::Matches($html, '(?:src|href)\s*=\s*"([^"]+)"')) {
        $url = $m.Groups[1].Value
        if ($url -match '^(https?:|data:|#|mailto:|//|javascript:)') { continue }
        $limpo = ($url -split '[?#]')[0]
        if ($limpo -eq '') { continue }
        try { $destino = [IO.Path]::GetFullPath((Join-Path $pasta $limpo)) } catch { Write-Host ("IGNORADO (não é um caminho de arquivo): {0}  (em {1})" -f $url.Substring(0, [Math]::Min(70, $url.Length)), $rel) -ForegroundColor DarkGray; continue }
        $citados[$destino.ToLowerInvariant()] = $true
        if (-not (Test-Path -LiteralPath $destino)) { Write-Host ("FALTA  {0}  (citado em {1})" -f $limpo, $rel) -ForegroundColor Red; $faltando++ }
    }
}

$soltos = @()
foreach ($pasta in 'js', 'css', 'admin', 'config') {
    $dir = Join-Path $raiz $pasta
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -Recurse -File | Where-Object { $_.Extension -in '.js', '.css' } | ForEach-Object {
        if (-not $citados.ContainsKey($_.FullName.ToLowerInvariant())) { $soltos += $_.FullName.Substring($raiz.Length + 1) }
    }
}
if ($soltos.Count) { Write-Host "`nArquivos que nenhuma página carrega (confira se são lixo):" -ForegroundColor Yellow; $soltos | ForEach-Object { Write-Host "  $_" } }

foreach ($par in @(@('config\app-config.js', 'window.BSOFT_CONFIG'), @('config\mcp-config.js', 'window.BSOFT_MCP_CONFIG'), @('config\admin-config.js', 'window.BSOFT_ADMIN'))) {
    $f = Join-Path $raiz $par[0]
    if (-not (Test-Path -LiteralPath $f)) { Write-Host ("FALTA  {0}" -f $par[0]) -ForegroundColor Red; $faltando++; continue }
    if (-not ([IO.File]::ReadAllText($f, $utf8)).Contains($par[1])) { Write-Host ("PROBLEMA  {0} não define {1}" -f $par[0], $par[1]) -ForegroundColor Red; $faltando++ }
}

foreach ($tmp in '_qa', '_corpo-original.html') { if (Test-Path -LiteralPath (Join-Path $raiz $tmp)) { Write-Host "Atenção: sobrou '$tmp' (arquivo temporário — não suba no GitHub)" -ForegroundColor Yellow } }

if ($faltando) { Write-Host "`n$faltando problema(s) encontrado(s)." -ForegroundColor Red; exit 1 }
Write-Host "`nTudo certo: todos os arquivos citados existem." -ForegroundColor Green
