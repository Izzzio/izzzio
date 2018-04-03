@echo off

cd %~dp0
if errorlevel 1 goto error

if exist BitCoenWallet-x64.msi del BitCoenWallet-x64.msi
if exist BitCoenWallet-x64.wixpdb del BitCoenWallet-x64.wixpdb
if exist Win64.wixobj del Win64.wixobj

setlocal
set PATH=C:\Program Files (x86)\WiX Toolset v3.11\bin;C:\Python27;C:\Python27amd64;%PATH%

python genfiles.py

candle -nologo -arch x64 Win64.wxs
if errorlevel 1 goto error

light -nologo -ext WixUIExtension -cultures:en-us -loc Win64.wxl -o BitCoenWallet-x64.msi Win64.wixobj
if errorlevel 1 goto error

:end
exit /B 0
:error
exit /B 1
