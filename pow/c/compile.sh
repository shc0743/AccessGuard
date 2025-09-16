#!/usr/bin/env bash
if getprop ro.build.version.sdk >/dev/null 2>&1; then
gcc -O3 -o pow_android pow.c sha256.c
mv pow_android bin/
else
gcc -static -O3 -o pow pow.c sha256.c
aarch64-linux-gnu-gcc -static -O3 -o pow_arm64 pow.c sha256.c
mv pow bin/
mv pow_arm64 bin/
fi