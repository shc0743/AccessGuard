@echo off
cl /Fe:pow.exe pow.c sha256.c /link /MANIFEST:EMBED
del /f /q bin\pow.exe 2>nul
move pow.exe bin\
