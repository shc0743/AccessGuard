@del /f /q pow_calculator.js 2>nul
@del /f /q pow_calculator.wasm 2>nul
@cmd /c emcc -O3 -s WASM=1 -s EXPORTED_FUNCTIONS="['_pow_calculate', '_malloc', '_free']" -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']" -s ALLOW_MEMORY_GROWTH=1 -sMODULARIZE -sEXPORT_NAME=PoW_Calculator -o pow_calculator.js pow_calculator.c ../c/sha256.c
@copy /y pow_calculator.js ..\..\fc\web\ >nul
@copy /y pow_calculator.wasm ..\..\fc\web\ >nul
@echo Pow calculator compiled.
@timeout 2