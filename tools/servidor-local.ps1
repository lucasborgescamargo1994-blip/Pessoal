# Servidor local simples — serve a pasta do projeto em http://localhost:8080 (igual ao GitHub Pages).
# Uso: dê dois cliques em tools\servidor-local.bat  (ou: powershell -File tools\servidor-local.ps1 -Porta 8080)
# Não precisa instalar nada. Feche a janela (ou Ctrl+C) para parar.
# Observação: o sistema também funciona abrindo index.html direto do disco (duplo clique), sem servidor e sem erro de CORS.
param([int]$Porta = 8080, [switch]$SemNavegador)   # -SemNavegador: não abre o navegador sozinho

$raiz = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tipos = @{
    '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
    '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.ico' = 'image/x-icon'
    '.webp' = 'image/webp'; '.woff2' = 'font/woff2'; '.woff' = 'font/woff'; '.map' = 'application/json'
    '.sql' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
}

$ouvinte = New-Object System.Net.HttpListener
$ouvinte.Prefixes.Add("http://localhost:$Porta/")
try { $ouvinte.Start() }
catch {
    Write-Host "Não consegui abrir a porta $Porta (talvez já esteja em uso). Tente outra: tools\servidor-local.bat 8090" -ForegroundColor Red
    exit 1
}
Write-Host "Servindo  $raiz" -ForegroundColor Cyan
Write-Host "Abra:     http://localhost:$Porta/index.html   (painel: http://localhost:$Porta/admin/index.html)" -ForegroundColor Green
Write-Host "Para parar: feche esta janela ou pressione Ctrl+C." -ForegroundColor DarkGray
if (-not $SemNavegador) { try { Start-Process "http://localhost:$Porta/index.html" } catch { } }

try {
    while ($ouvinte.IsListening) {
        $ctx = $ouvinte.GetContext()
        $resp = $ctx.Response
        try {
            $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
            if ($rel -eq '') { $rel = 'index.html' }
            $caminho = [IO.Path]::GetFullPath((Join-Path $raiz $rel))
            if ((Test-Path -LiteralPath $caminho -PathType Container)) { $caminho = Join-Path $caminho 'index.html' }
            $bloqueado = (-not $caminho.StartsWith($raiz, [StringComparison]::OrdinalIgnoreCase)) -or ($caminho -match '[\\/]\.(git|claude)([\\/]|$)')
            if ($bloqueado) { $resp.StatusCode = 403; $corpo = [Text.Encoding]::UTF8.GetBytes('403') }
            elseif (Test-Path -LiteralPath $caminho -PathType Leaf) {
                $ext = [IO.Path]::GetExtension($caminho).ToLowerInvariant()
                $resp.ContentType = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { 'application/octet-stream' }
                $resp.Headers.Add('Cache-Control', 'no-store')   # sempre a versão mais nova do arquivo, ótimo para testar
                $corpo = [IO.File]::ReadAllBytes($caminho)
            }
            else { $resp.StatusCode = 404; $resp.ContentType = 'text/plain; charset=utf-8'; $corpo = [Text.Encoding]::UTF8.GetBytes("404 - não encontrado: $rel") }
            $resp.ContentLength64 = $corpo.Length
            $resp.OutputStream.Write($corpo, 0, $corpo.Length)
            Write-Host ("{0} {1} {2}" -f $resp.StatusCode, $ctx.Request.HttpMethod, $ctx.Request.Url.AbsolutePath) -ForegroundColor DarkGray
        }
        catch { Write-Host ("erro: " + $_.Exception.Message) -ForegroundColor Yellow }
        finally { try { $resp.OutputStream.Close() } catch { } }
    }
}
finally { $ouvinte.Stop(); $ouvinte.Close() }
