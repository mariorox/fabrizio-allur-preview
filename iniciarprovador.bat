@echo off
setlocal EnableDelayedExpansion
title Provador Digital - App + Cloudflare Tunnel
pushd "%~dp0"

REM ============================================================
REM  Provador Digital - inicializador
REM
REM  IMPORTANTE - por que este script nao usa o "npm run dev" puro:
REM  o better-sqlite3 e um modulo NATIVO, compilado para uma versao
REM  especifica do Node (ABI 127 = Node 22). O Node instalado nesta
REM  maquina e mais novo (ABI diferente), entao o banco nao carrega,
REM  a rota /api/ateliers responde 500 e a home aparece VAZIA.
REM  Por isso rodamos o app com um Node 22 dedicado.
REM ============================================================

set "PORT=3000"
set "CF=%~dp0cloudflared.exe"
set "NODEVER=v22.23.2"
set "NODEROOT=%LOCALAPPDATA%\provador-node22"
set "NODEHOME=%NODEROOT%\node-%NODEVER%-win-x64"
set "NODE22=%NODEHOME%\node.exe"
set "NPMCLI=%NODEHOME%\node_modules\npm\bin\npm-cli.js"

echo ============================================================
echo   Provador Digital  -  App + Cloudflare Tunnel
echo ============================================================
echo.

REM ---------- 1. cloudflared ----------
if not exist "%CF%" (
    echo [setup] cloudflared nao encontrado. Baixando...
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CF%' -UseBasicParsing } catch { exit 1 }"
    if errorlevel 1 (
        echo [erro] Falha ao baixar o cloudflared. Verifique a internet.
        pause
        exit /b 1
    )
)

REM ---------- 2. escolher o Node correto (ABI 127) ----------
set "NODEBIN="
set "USESYS="
for /f "delims=" %%i in ('node -p "process.versions.modules" 2^>nul') do set "SYSABI=%%i"
if "!SYSABI!"=="127" (
    echo [node] Node do sistema e compativel ^(ABI 127^). Usando ele.
    set "NODEBIN=node"
    set "USESYS=1"
) else (
    if defined SYSABI (
        echo [node] Node do sistema tem ABI !SYSABI! - incompativel com o better-sqlite3.
    ) else (
        echo [node] Node do sistema nao encontrado.
    )
    if not exist "%NODE22%" (
        echo [setup] Baixando Node %NODEVER% dedicado ^(uma unica vez, ~35 MB^)...
        powershell -NoProfile -Command "try { New-Item -ItemType Directory -Force -Path '%NODEROOT%' | Out-Null; Invoke-WebRequest -Uri 'https://nodejs.org/dist/%NODEVER%/node-%NODEVER%-win-x64.zip' -OutFile '%TEMP%\node22.zip' -UseBasicParsing; Expand-Archive -Path '%TEMP%\node22.zip' -DestinationPath '%NODEROOT%' -Force } catch { exit 1 }"
        if errorlevel 1 (
            echo [erro] Falha ao baixar o Node. Verifique a internet.
            pause
            exit /b 1
        )
    )
    echo [node] Usando Node %NODEVER% dedicado.
    set "NODEBIN=%NODE22%"
)

REM ---------- 3. dependencias ----------
if not exist "%~dp0node_modules" (
    echo [setup] Instalando dependencias - npm install...
    if defined USESYS (
        call npm install
    ) else (
        "%NODEBIN%" "%NPMCLI%" install
    )
)

REM ---------- 4. checar o modulo nativo do banco ----------
echo [check] Verificando o banco ^(better-sqlite3^)...
"%NODEBIN%" -e "require('better-sqlite3')" >nul 2>&1
if errorlevel 1 (
    echo [fix] Modulo nativo incompativel. Recompilando...
    if defined USESYS (
        call npm rebuild better-sqlite3
    ) else (
        "%NODEBIN%" "%NPMCLI%" rebuild better-sqlite3
    )
    "%NODEBIN%" -e "require('better-sqlite3')" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [erro] O better-sqlite3 continua sem carregar.
        echo        Sem ele a home fica VAZIA ^(a API responde 500^).
        echo        Rode:  npm install  ^(ou peca ajuda^) antes de mostrar ao cliente.
        pause
        exit /b 1
    )
)
echo [check] Banco OK.

REM ---------- 5. liberar a porta ----------
set "BUSY="
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess" 2^>nul') do set "BUSY=%%i"
if defined BUSY (
    echo.
    echo [aviso] A porta %PORT% ja esta em uso pelo processo !BUSY!.
    choice /C SN /N /M "Encerrar esse processo e continuar? [S/N]: "
    if errorlevel 2 (
        echo [fim] Cancelado. Nada foi alterado.
        popd
        pause
        exit /b 1
    )
    powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
    powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cloudflared.exe' -and $_.CommandLine -like '*localhost:%PORT%*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    REM ping em vez de timeout: o timeout quebra quando a entrada esta redirecionada
    ping -n 3 127.0.0.1 >nul
)

REM ---------- 6. subir o app ----------
echo [app] Iniciando o servidor na porta %PORT%...
start "Provador Digital - App" /min cmd /c ""%NODEBIN%" "%~dp0node_modules\next\dist\bin\next" dev --port %PORT%"

echo [app] Aguardando o servidor subir...
set /a TRIES=0
:waitloop
set /a TRIES+=1
if !TRIES! GTR 60 (
    echo [erro] O servidor nao subiu. Veja a janela "Provador Digital - App".
    pause
    exit /b 1
)
ping -n 3 127.0.0.1 >nul
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://localhost:%PORT%' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }"
if errorlevel 1 goto waitloop
echo [app] Servidor no ar em http://localhost:%PORT%

REM ---------- 7. testar a API antes de expor ----------
echo [check] Testando a API de atelies...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/ateliers' -UseBasicParsing -TimeoutSec 20; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
    echo.
    echo [erro] A API /api/ateliers NAO respondeu 200.
    echo        A home vai aparecer VAZIA para o cliente. Nao envie o link.
    pause
    exit /b 1
)
echo [check] API OK - a home vai carregar os atelies.

REM ---------- 8. tunnel ----------
if exist "%~dp0tunnel.log" del /q "%~dp0tunnel.log"
echo [tunnel] Abrindo o tunel Cloudflare...
REM  --protocol http2 (e nao quic): nesta maquina o QUIC/UDP cai em loop de
REM  reconexao ("control stream encountered a failure") e o link morre com
REM  erro 1033. O http2 usa TCP e se mantem estavel.
start "Provador Digital - Tunnel" /min cmd /c ""%CF%" tunnel --no-autoupdate --protocol http2 --url http://localhost:%PORT% > "%~dp0tunnel.log" 2>&1"

set "URL="
set /a TRIES=0
:urlloop
set /a TRIES+=1
if !TRIES! GTR 40 goto urlfail
ping -n 3 127.0.0.1 >nul
for /f "delims=" %%u in ('powershell -NoProfile -Command "$m = Select-String -Path '%~dp0tunnel.log' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue; if ($m) { $m.Matches[0].Value }" 2^>nul') do set "URL=%%u"
if not defined URL goto urlloop

echo.
echo ============================================================
echo   LINK PARA ENVIAR AO CLIENTE:
echo.
echo   !URL!
echo.
echo ============================================================
echo.
powershell -NoProfile -Command "Set-Clipboard -Value '!URL!'" 2>nul && echo   ^(link ja copiado para a area de transferencia^)
echo.

REM ---------- 9. conferir se o link responde ----------
echo [check] Testando o link publico...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '!URL!/api/ateliers' -UseBasicParsing -TimeoutSec 25; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 2 }"
if errorlevel 2 (
    REM  Nao respondeu. Pode ser so o DNS DESTA maquina que ainda nao
    REM  conhece o endereco novo - nesse caso o link funciona para os outros.
    powershell -NoProfile -Command "try { $null = Resolve-DnsName -Name ('!URL!' -replace 'https://','') -Server 1.1.1.1 -Type A -ErrorAction Stop; exit 0 } catch { exit 1 }"
    if errorlevel 1 (
        echo [erro] O link nao respondeu. Aguarde alguns segundos e teste no navegador.
    ) else (
        echo [ok]  O link EXISTE e esta publicado - so o DNS deste PC ainda nao
        echo       reconhece o endereco novo. Para o cliente ele abre normalmente.
        echo       ^(se quiser testar aqui, use outro navegador ou o celular no 4G^)
    )
) else (
    echo [check] Link respondendo 200 - pode enviar.
)
echo.
echo   O link so funciona enquanto:
echo     - este PC estiver ligado e sem dormir
echo     - as janelas "Provador Digital - App" e "- Tunnel" abertas
echo.
echo   Cada vez que voce reiniciar, o endereco MUDA.
echo.
goto endpause

:urlfail
echo.
echo [erro] O tunel nao gerou a URL. Veja o arquivo tunnel.log.
echo.

:endpause
echo ------------------------------------------------------------
pause
echo.
choice /C SN /N /M "Encerrar o app e o tunel agora? [S/N]: "
if errorlevel 2 (
    echo [fim] Deixando tudo rodando. Feche as janelas minimizadas para parar.
) else (
    powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cloudflared.exe' -and $_.CommandLine -like '*localhost:%PORT%*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
    echo [fim] Encerrado.
)
popd
ping -n 4 127.0.0.1 >nul
