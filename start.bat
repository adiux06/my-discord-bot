@echo off
title Discord Bot Launcher
cd /d "%~dp0"

echo ========================================================
echo               Discord Bot Launcher
echo ========================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b
)

:: Check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found!
    echo Please make sure your .env file with DISCORD_TOKEN is present.
    echo.
)

:: Check if node_modules folder exists
if not exist "node_modules\" (
    echo [INFO] Dependencies not found. Installing now...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b
    )
    echo.
)

:: If PM2 background service is running, stop it to prevent duplicate responses
where pm2 >nul 2>nul
if %errorlevel% equ 0 (
    call pm2 stop discord-bot >nul 2>nul
)

echo Starting Discord Bot...
echo (Press Ctrl+C to stop the bot)
echo ========================================================
echo.

node index.js

echo.
echo ========================================================
echo Bot process has stopped.
echo ========================================================
pause
