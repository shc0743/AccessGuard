#!/usr/bin/env python3
# MIT License
import hashlib
import sys

def check_difficulty(hash_bytes, difficulty):
    zero_bytes = difficulty // 8
    remaining_bits = difficulty % 8
    
    for i in range(zero_bytes):
        if hash_bytes[i] != 0:
            return False
    
    if remaining_bits > 0 and zero_bytes < len(hash_bytes):
        mask = (0xFF << (8 - remaining_bits)) & 0xFF
        if (hash_bytes[zero_bytes] & mask) != 0:
            return False
    
    return True

def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <challenge> <difficulty>")
        print("\nNote that difficulty is binary mode. To convert from a hex-mode, just `*=4`.")
        return -1
    
    challenge = sys.argv[1]
    try:
        difficulty = int(sys.argv[2])
        if difficulty <= 0 or difficulty > 256:
            print("Error: Difficulty must be between 1 and 256.")
            return -1
    except ValueError:
        print("Error: Difficulty must be an integer.")
        return -1
    
    print(f"Calculating PoW for challenge: {challenge}")
    print(f"Difficulty: {difficulty}")
    
    nonce = 0
    
    while True:
        sha256 = hashlib.sha256()
        
        sha256.update(challenge.encode('utf-8'))
        
        nonce_str = str(nonce)
        sha256.update(nonce_str.encode('utf-8'))
        
        hash_result = sha256.digest()
        
        if check_difficulty(hash_result, difficulty):
            print(f"Valid nonce found: {nonce}")
            print(f"Hash: {hash_result.hex()}")
            print("{{" + str(nonce) + "}}")
            return 0
        
        nonce += 1
        
        if nonce % 1000000 == 0:
            print(f"Tried {nonce} nonces...", end="\r")

if __name__ == "__main__":
    sys.exit(main())
