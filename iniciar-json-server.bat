@echo off
chcp 65001 >nul
title Iniciar JSON Server

echo.
echo Iniciando o json-server...
echo Pasta do projeto: C:\Projetos\Aulas_It lindos\Avaliação Bimestral 01
echo Porta: 3000
echo.

cd /d "C:\Projetos\Aulas_It lindos\Avaliação Bimestral 01"

REM Inicia o json-server usando o arquivo db.json desta pasta
npx json-server --watch db.json --port 3000

echo.
echo O json-server foi encerrado.
pause
