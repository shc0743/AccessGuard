#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <emscripten.h>
#include "../c/sha256.h"

int check_difficulty(const uint8_t* hash, int difficulty) {
    int zero_bytes = difficulty / 8;
    int remaining_bits = difficulty % 8;
    
    for (int i = 0; i < zero_bytes; i++) {
        if (hash[i] != 0) {
            return 0;
        }
    }
    
    if (remaining_bits > 0 && zero_bytes < 32) {
        uint8_t mask = (0xFF << (8 - remaining_bits)) & 0xFF;
        if ((hash[zero_bytes] & mask) != 0) {
            return 0;
        }
    }
    
    return 1;
}

// 将整数转换为字符串，返回写入的字符数
static int ulltoa(unsigned long long value, char *str) {
    char *ptr = str;
    char tmp;
    int len = 0;

    // 处理0的情况
    if (value == 0) {
        *ptr++ = '0';
        *ptr = '\0';
        return 1;
    }

    // 将数字转换为字符串（逆序）
    while (value) {
        *ptr++ = '0' + (value % 10);
        value /= 10;
        len++;
    }

    // 反转字符串
    for (int i = 0; i < len / 2; i++) {
        tmp = str[i];
        str[i] = str[len - i - 1];
        str[len - i - 1] = tmp;
    }

    str[len] = '\0';
    return len;
}

EMSCRIPTEN_KEEPALIVE
int64_t pow_calculate(const char* challenge, int64_t start_nonce, int64_t batch_size, int difficulty) {
    struct sha256_buff ctx;
    uint8_t hash[32];
    
    // 预计算挑战字符串的长度
    int challenge_len = strlen(challenge);
    
    // 用于存储nonce字符串的缓冲区
    char nonce_str[21]; // 最多20位数字 + 1个空字符

    for (int64_t nonce = start_nonce; nonce < start_nonce + batch_size; nonce++) {
        // 初始化SHA256上下文
        sha256_init(&ctx);
        
        // 更新挑战字符串部分
        sha256_update(&ctx, challenge, challenge_len);
        
        // 转换nonce为字符串
        int nonce_len = ulltoa(nonce, nonce_str);
        
        // 更新nonce部分
        sha256_update(&ctx, nonce_str, nonce_len);
        
        // 完成哈希计算
        sha256_finalize(&ctx);
        
        // 读取哈希值
        sha256_read(&ctx, hash);
        
        if (check_difficulty(hash, difficulty)) {
            return nonce;
        }
    }
    
    return -1;
}
