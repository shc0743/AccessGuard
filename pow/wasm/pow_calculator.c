#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <emscripten.h>
#include "../c/sha256.h"

#if 0
// GPT
int check_difficulty(const uint8_t* hash, int difficulty) {
    if (difficulty <= 0) return 1;
    if (difficulty > 256) return 0;

    for (int bit = 0; bit < difficulty; ++bit) {
        int byte_idx, bit_idx;
        // big-endian
        byte_idx = bit / 8;
        bit_idx  = 7 - (bit % 8);

        if ((hash[byte_idx] >> bit_idx) & 1) {
            return 0; // 不合格
        }
    }
    return 1; // 合格
}
#else
// DeepSeek
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
#endif

EMSCRIPTEN_KEEPALIVE
int64_t pow_calculate(const char* challenge, int64_t start_nonce, int64_t batch_size, int difficulty) {
    char test_string[4096];
    uint8_t hash[32];
    sha256_context ctx;
    
    int challenge_len = strlen(challenge);

    for (int64_t nonce = start_nonce; nonce < start_nonce + batch_size; nonce++) {
        int written = snprintf(test_string, sizeof(test_string), "%s%lld", challenge, (long long)nonce);
        if (written >= sizeof(test_string)) {
            continue;
        }
        
        sha256(test_string, written, hash);
        
        if (check_difficulty(hash, difficulty)) {
            return nonce;
        }
    }
    
    return -1;
}

