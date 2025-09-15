#!/bin/bash

# 清理旧文件
rm -f pow_calculator.js pow_calculator.wasm 2>/dev/null

# 编译 WASM 版本
emcc -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_pow_calculate", "_malloc", "_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE \
    -s EXPORT_NAME=PoW_Calculator \
    -o pow_calculator.js \
    pow_calculator.c ../c/sha256.c

# 复制到目标目录
cp pow_calculator.js ../../fc/web/
cp pow_calculator.wasm ../../fc/web/

echo "Pow calculator compiled."
sleep 2
