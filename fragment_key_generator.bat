@echo off
setlocal EnableDelayedExpansion
title fragment.lol Key Generator
echo.
echo  fragment.lol Key Generator
echo  ==========================
echo  1. GUI keys    FRAGMENTGUI-XXXX-XXX
echo  2. Table keys  FRAGMENT-XXXX-XXX
echo.
set /p TYPE=Choose type (1/2): 
set /p COUNT=How many keys?: 
if "%TYPE%"=="1" (set PREFIX=FRAGMENTGUI) else if "%TYPE%"=="2" (set PREFIX=FRAGMENT) else (echo Invalid choice.&pause&exit /b)
if "%COUNT%"=="" set COUNT=1
>fragment_keys.txt echo.
for /L %%N in (1,1,%COUNT%) do (
  for /f "delims=" %%A in ('powershell -NoProfile -Command "$c='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';$s=-join (1..7 ^| %% { $c[(Get-Random -Maximum $c.Length)] }); Write-Output $s"') do (
    set "K=%%A"
    echo !PREFIX!-!K:~0,4!-!K:~4,3!>>fragment_keys.txt
  )
)
echo.
echo Keys saved to fragment_keys.txt
echo.
type fragment_keys.txt
pause
