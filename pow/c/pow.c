#include <stdint.h>
#include <stdio.h>
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
    if (argc < 2) {
        printf("Usage: pow <challenge>\n");
        return 1;
    }
    const char *challenge = argv[1];
    // TODO
    return 0;
}