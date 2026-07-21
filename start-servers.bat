@echo off
title IDEpro Servers

echo [IDEpro] Starting Sync Server (port 3000)...
start /MIN "IDEpro-SyncServer" cmd /k "node web_controller\server\server.mjs"
ping 127.0.0.1 -n 3 > nul

echo [IDEpro] Starting Login Portal (port 5173)...
start /MIN "IDEpro-LoginPortal" cmd /k "cd /d web && npm run dev"
ping 127.0.0.1 -n 3 > nul

echo [IDEpro] Starting Admin Panel (port 5174)...
start /MIN "IDEpro-AdminPanel" cmd /k "cd /d web_controller\admin-panel && npm run dev -- --port 5174"
ping 127.0.0.1 -n 4 > nul

echo [IDEpro] All servers started.
echo [IDEpro] Sync Server  : http://localhost:3000
echo [IDEpro] Login Portal : http://localhost:5173
echo [IDEpro] Admin Panel  : http://localhost:5174
