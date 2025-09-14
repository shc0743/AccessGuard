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

int main(int argc, char *argv[]) {
    if (argc < 3) {
        printf("Usage: %s <challenge> <difficulty>\n\nNote that difficulty is binary mode. To convert from a hex-mode, just `*=4`.\n", argv[0]);
        return -1;
    }

    const char *challenge = argv[1];
    int difficulty = 0; // 默认难度
    if (argc >= 3) {
        difficulty = atoi(argv[2]);
        if (difficulty <= 0 || difficulty > 256) {
            printf("Error: Difficulty must be between 1 and 256.\n");
            return -1;
        }
    }

    char test_string[4096];
    uint8_t hash[32];
    int64_t nonce = 0;

    printf("Calculating PoW for challenge: %s\n", challenge);
    printf("Difficulty: %d\n", difficulty);

    while (1) {
        int written = snprintf(test_string, sizeof(test_string), "%s%lld", challenge, (long long)nonce);
        if (written >= sizeof(test_string)) {
            printf("Error: Test string too long.\n");
            return 1;
        }
        
        sha256(test_string, written, hash);
        
        if (check_difficulty(hash, difficulty)) {
            printf("Valid nonce found: %lld\n", (long long)nonce);
            printf("Hash: ");
            for (int i = 0; i < 32; i++) {
                printf("%02x", hash[i]);
            }
            printf("\n");
            printf("{{%lld}}\n", (long long)nonce);
            return 0;
        }

        nonce++;
    }

    return 0;
}