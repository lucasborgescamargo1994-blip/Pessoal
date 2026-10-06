# Atualiza o número de versão do sistema em todos os lugares de uma vez:
#   • o "?v=1.2.3" dos arquivos (faz o navegador baixar de novo CSS/JS depois de um deploy);
#   • "versaoApp" em config\app-config.js.
# Uso:  powershell -File tools\atualizar-versao.ps1 -Versao 28.1.0
param([Parameter(Mandatory = $true)][string]$Versao)

if ($Versao -notmatch '^\d+\.\d+\.\d+$') { Write-Host 'A versão precisa ter o formato 28.1.0 (três números separados por ponto).' -ForegroundColor Red; exit 1 }
$raiz = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$utf8 = New-Object System.Text.UTF8Encoding($false)
$total = 0

foreach ($rel in 'index.html', 'admin\index.html', 'admin\senha.html') {
    $f = Join-Path $raiz $rel
    if (-not (Test-Path -LiteralPath $f)) { continue }
    $t = [IO.File]::ReadAllText($f, $utf8)
    $novo = [regex]::Replace($t, '\?v=\d+\.\d+\.\d+', "?v=$Versao")
    $n = ([regex]::Matches($t, '\?v=\d+\.\d+\.\d+')).Count
    if ($novo -ne $t) { [IO.File]::WriteAllText($f, $novo, $utf8) }
    Write-Host ("{0,-20} {1} referência(s) ?v=" -f $rel, $n)
    $total += $n
}

$cfg = Join-Path $raiz 'config\app-config.js'
if (Test-Path -LiteralPath $cfg) {
    $t = [IO.File]::ReadAllText($cfg, $utf8)
    $novo = [regex]::Replace($t, '("versaoApp"\s*:\s*")[^"]*(")', "`${1}$Versao`${2}")
    if ($novo -ne $t) { [IO.File]::WriteAllText($cfg, $novo, $utf8); Write-Host 'config\app-config.js  versaoApp atualizado' } else { Write-Host 'config\app-config.js  (já estava assim ou campo não encontrado)' }
}
Write-Host "Pronto: versão $Versao ($total referência(s) ?v=). Agora faça o commit e o push." -ForegroundColor Green
