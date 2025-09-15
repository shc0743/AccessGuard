#!/bin/bash

# 计时脚本

# 检查参数
if [ $# -ne 2 ]; then
    echo "用法: $0 <挑战字符串> <难度值>"
    echo "示例: $0 \"abc123\" 20"
    exit 1
fi

CHALLENGE=$1
DIFFICULTY=$2

echo "=== 开始性能测试 ==="
echo "挑战字符串: $CHALLENGE"
echo "难度值: $DIFFICULTY"
echo

# 测试第一个命令 (qemu-x86_64)
echo "1. 测试 qemu-x86_64 版本:"
START_TIME=$(date +%s.%N)
qemu-x86_64 ./pow "$CHALLENGE" "$DIFFICULTY"
END_TIME=$(date +%s.%N)
ELAPSED_TIME1=$(echo "$END_TIME - $START_TIME" | bc)
echo "执行时间: ${ELAPSED_TIME1} 秒"
echo

# 测试第二个命令 (原生 Android 版本)
echo "2. 测试 Android 原生版本:"
START_TIME=$(date +%s.%N)
./pow_android "$CHALLENGE" "$DIFFICULTY"
END_TIME=$(date +%s.%N)
ELAPSED_TIME2=$(echo "$END_TIME - $START_TIME" | bc)
echo "执行时间: ${ELAPSED_TIME2} 秒"
echo

# 显示结果对比
echo "=== 性能对比结果 ==="
echo "qemu-x86_64 版本: ${ELAPSED_TIME1} 秒"
echo "Android 原生版本: ${ELAPSED_TIME2} 秒"

# 计算性能差异
if (( $(echo "$ELAPSED_TIME1 > $ELAPSED_TIME2" | bc -l) )); then
    RATIO=$(echo "$ELAPSED_TIME1 / $ELAPSED_TIME2" | bc -l)
    echo "Android 原生版本快 ${RATIO} 倍"
else
    RATIO=$(echo "$ELAPSED_TIME2 / $ELAPSED_TIME1" | bc -l)
    echo "qemu-x86_64 版本快 ${RATIO} 倍"
fi
