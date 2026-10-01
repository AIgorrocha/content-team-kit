@echo off
REM Roda o pipeline semanal de inteligencia social da marca ativa (.workspace).
REM Agendar: Agendador de Tarefas do Windows, domingo de manha, acao = este arquivo.
REM O codigo de saida volta para o Agendador: resultado diferente de 0 = o pipeline falhou.
cd /d "%~dp0..\.."
echo ==== run %DATE% %TIME% >> social-intel-local.log
node scripts\infra\social-intel-local.mjs >> social-intel-local.log 2>&1
set RC=%ERRORLEVEL%
echo ==== exit %RC% >> social-intel-local.log
exit /b %RC%
