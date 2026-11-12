param([string]$Largura = "1366", [string]$Altura = "768", [string]$X = "1440", [string]$Y = "0", [switch]$SemGpu, [string]$Porta = "9444", [switch]$SemJanela)
# Sobe o Edge de testes (perfil novo, porta de depuração) e o deixa rodando. Rode ASSIM, em segundo plano:  Start-Process powershell -ArgumentList '-File','edge-up.ps1'
#   -SemJanela  → Edge "headless": nunca fica oculto, mas NÃO reproduz o custo da placa de vídeo (serve só para a thread principal; use outra porta, ex.: -Porta 9555).
# Sem -SemJanela abre uma janela de verdade (é ela que reproduz a placa de vídeo); NÃO a minimize (minimizada = quadros parados). Use -X/-Y para pô-la num 2º monitor.
$dir = Join-Path $env:TEMP ("edge-bench-" + $Porta)
Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
$args = @("--remote-debugging-port=$Porta", "--user-data-dir=$dir", "--window-size=$Largura,$Altura", "--window-position=$X,$Y",
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync", "--disable-background-networking",
    "--disable-component-update", "--disable-default-apps", "--hide-crash-restore-bubble",
    "--disable-features=msEdgeSidebarV2,Translate,msWebOOUI,msEdgeEnhanceImages,CalculateNativeWinOcclusion",
    "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling")
if ($SemGpu) { $args += "--disable-gpu" }
if ($SemJanela) { $args += "--headless=new" }
$args += "about:blank"
Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList $args
