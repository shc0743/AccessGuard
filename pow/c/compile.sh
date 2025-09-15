#!/usr/bin/env bash
gcc -static -o pow pow.c sha256.c
mv pow bin/
