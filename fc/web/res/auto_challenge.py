#!/usr/bin/env python3
"""
GPL-3.0 License.
Do not use this script for illegal purposes.
"""
import requests
import json
import hashlib
import time
import sys
import os
import platform
import subprocess
import urllib.parse
from typing import Optional, Tuple

if sys.platform != 'win32':
    try:
        import readline
    except BaseException:
        pass

class PowChallengeSolver:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'AutoChallenger v1.0'
        })
        self.pow_executable = self._find_pow_executable()
    
    def _find_pow_executable(self) -> Optional[str]:
        candidates = []
        normalized_path = os.path.normpath('../c/bin/')
        current_path = os.environ.get('PATH', '')
        if normalized_path not in current_path.split(os.pathsep):
            os.environ['PATH'] = f"{normalized_path}{os.pathsep}{current_path}"
            
        system = platform.system().lower()
        machine = platform.machine().lower()
        
        if os.path.exists('/system/bin/getprop') or os.path.exists('/system/build.prop'):
            return 'pow_android'
        if system == 'windows':
            candidates = ['pow.exe', 'pow']
        elif machine == 'arm64' or machine == 'aarch64':
            candidates = ['pow_arm64', 'pow']
        else:
            candidates = ['pow']
        
        for candidate in candidates:
            if os.path.exists(candidate) and os.access(candidate, os.X_OK):
                return candidate
        
        return None

    def solve_pow_challenge_external(self, challenge: str, difficulty: int) -> Optional[str]:
        if not self.pow_executable:
            return None
        try:
            cmd = [self.pow_executable, challenge, str(difficulty)]
            
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, universal_newlines=True)
            
            output_lines = []
            while True:
                line = process.stdout.readline()
                if not line and process.poll() is not None:
                    break
                if line:
                    print(line, end='')
                    output_lines.append(line)
            
            returncode = process.wait()
            
            output = ''.join(output_lines)
            if returncode == 0:
                import re
                match = re.search(r'\{\{(\d+)\}\}', output)
                if match:
                    nonce = match.group(1)
                    return nonce
                print(f"Unexpected output format from external PoW calculator: {output}")
            else:
                print(f"External PoW calculator failed with return code {returncode}")
                
        except subprocess.TimeoutExpired:
            print("External PoW calculator timed out after 60 minutes")
        except FileNotFoundError:
            print(f"External PoW calculator not found: {self.pow_executable}")
            self.pow_executable = None
        except Exception as e:
            print(f"Error running external PoW calculator: {e}")
            self.pow_executable = None
        return None
        
    def solve_pow_challenge(self, challenge: str, difficulty: int) -> Optional[str]:
        print(f"Solving PoW challenge with difficulty {difficulty} (binary bits)...")
        start_time = time.time()
        eres = self.solve_pow_challenge_external(challenge, difficulty)
        if eres is not None:
            elapsed = time.time() - start_time
            print(f"\nFound solution after {elapsed:.2f} seconds and {eres} attempts")
            return str(eres)
        print('Warning: External PoW Calculator module not found, falling back to Python implementation (maybe slow)...')
        
        zero_bytes = difficulty // 8
        remaining_bits = difficulty % 8
        
        if remaining_bits > 0:
            mask = (0xFF << (8 - remaining_bits)) & 0xFF
        else:
            mask = 0
            
        nonce = 0
        max_nonce = 2**64
        
        while nonce < max_nonce:
            input_str = challenge + str(nonce)
            hash_bytes = hashlib.sha256(input_str.encode()).digest()
            
            valid = True
            for i in range(zero_bytes):
                if hash_bytes[i] != 0:
                    valid = False
                    break
            
            if valid and remaining_bits > 0 and zero_bytes < len(hash_bytes):
                if (hash_bytes[zero_bytes] & mask) != 0:
                    valid = False
            
            if valid:
                elapsed = time.time() - start_time
                hash_hex = hashlib.sha256(input_str.encode()).hexdigest()
                print(f"\nFound solution after {elapsed:.2f} seconds and {nonce} attempts")
                print(f"Hash: {hash_hex}")
                return str(nonce)
            
            nonce += 1
            
            if nonce % 100000 == 0:
                print(f"Attempted {nonce} nonces...", end="\r")
        
        print("Failed to find solution within reasonable attempts")
        return None
    
    def process_url(self, url: str) -> Optional[str]:
        print(f"Requesting challenge from {url}")
        try:
            response = self.session.get(url, timeout=30)

            if response.status_code == 401:
                try:
                    challenge_data = response.json()
                    challenge_token = challenge_data['challenge']
                    difficulty = challenge_data['difficulty']

                    nonce = self.solve_pow_challenge(challenge_token, difficulty)

                    if nonce:
                        payload = {
                            'challenge': challenge_token,
                            'nonce': nonce
                        }

                        print("Submitting solution...")
                        post_response = self.session.post(
                            url,
                            json=payload,
                            headers={'Content-Type': 'application/json'},
                            timeout=30
                        )

                        if post_response.status_code == 200:
                            try:
                                result = post_response.json()
                                file_url = result.get('url')
                                if file_url:
                                    print(f"Success! File URL: {file_url}")
                                    return file_url
                                else:
                                    print(f"No 'url' field in response: {result}")
                            except Exception as e:
                                print(f"Error parsing JSON response: {e}\nRaw response: {post_response.text}")
                        else:
                            print(f"Failed to submit solution: {post_response.status_code}")
                            print(f"Response: {post_response.text}")
                    else:
                        print("Failed to solve the challenge")
                except Exception as e:
                    print(f"Error processing challenge: {e}")
            else:
                print(f"Unexpected response: {response.status_code}")
                print(f"Response: {response.text}")
        except requests.exceptions.Timeout:
            print("Request timed out")
        except requests.exceptions.RequestException as e:
            print(f"Request error: {e}")

        return None
    
    def download_file(self, url: str, filename: Optional[str] = None) -> bool:

        try:
            response = self.session.get(url, stream=True, timeout=60)
            
            if response.status_code == 200:
                if not filename:
                    content_disposition = response.headers.get('content-disposition')
                    if content_disposition and 'filename=' in content_disposition:
                        filename = content_disposition.split('filename=')[1].strip('"')
                    else:
                        filename = urllib.parse.unquote(url.split('/')[-1].split('?')[0])
                
                with open(filename, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                print(f"File downloaded as: {filename}")
                return True
            else:
                print(f"Failed to download file: {response.status_code}")
                return False
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False

def main():
    solver = PowChallengeSolver()
    
    url = input("Enter the URL: ").strip()
    choice = input("Do you want to download the file? (y/n): ").strip().lower()
    
    file_url = solver.process_url(url)
    
    if file_url:
        if choice in ['y', 'yes']:
            solver.download_file(file_url)
    else:
        print("Failed to get file URL")

if __name__ == "__main__":
    main()
    