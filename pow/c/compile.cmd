@echo off
cl /Fe:pow.exe pow.c sha256.c /link /MANIFEST:EMBED
