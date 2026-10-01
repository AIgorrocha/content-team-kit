@echo off
cd /d "%~dp0..\.."
node scripts\infra\icloud-watch.mjs >> output\icloud-watch.log 2>&1
