#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "sha256.h"

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

int main(int argc, char *argv[]) {
    if (argc < 3) {
        printf("Usage: %s <challenge> <difficulty>\n\nNote that difficulty is binary mode. To convert from a hex-mode, just `*=4`.\n", argv[0]);
        return -1;
    }

    const char *challenge = argv[1];
    int difficulty = 0;
    if (argc >= 3) {
        difficulty = atoi(argv[2]);
        if (difficulty <= 0 || difficulty > 256) {
            printf("Error: Difficulty must be between 1 and 256.\n");
            return -1;
        }
    }

    // 预计算挑战字符串的长度
    size_t challenge_len = strlen(challenge);
    
    // 创建SHA256上下文
    struct sha256_buff ctx;
    uint8_t hash[32];
    unsigned long long nonce = 0;
    
    // 用于存储nonce字符串的缓冲区
    char nonce_str[21]; // 最多20位数字 + 1个空字符

    printf("Calculating PoW for challenge: %s\n", challenge);
    printf("Difficulty: %d\n", difficulty);

    while (1) {
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
            printf("Valid nonce found: %llu\n", nonce);
            printf("Hash: ");
            for (int i = 0; i < 32; i++) {
                printf("%02x", hash[i]);
            }
            printf("\n");
            printf("{{%llu}}\n", nonce);
            return 0;
        }

        nonce++;
        
        // 每100万次迭代打印进度（可选）
        if (nonce % 1000000 == 0) {
            printf("Tried %llu nonces...\n", nonce);
        }
    }

    return 0;
}