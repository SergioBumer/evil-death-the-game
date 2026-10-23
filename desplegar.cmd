@echo off
REM Publica La Gira Maldita en https://evil-death-gira-maldita.vercel.app
cd /d "%~dp0"
python build.py
call npx --yes vercel@latest deploy --prod
pause
