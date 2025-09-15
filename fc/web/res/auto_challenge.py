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
    
    def solve_pow_challenge(self, challenge: str, difficulty: int) -> Optional[str]:
        """
        解决 PoW 挑战：找到满足条件的 nonce
        """
        print(f"Solving PoW challenge with difficulty {difficulty}...")
        start_time = time.time()
        
        # 尝试不同 nonce 值直到找到满足条件的
        nonce = 0
        target_prefix = '0' * difficulty
        
        while True:
            # 构建输入字符串
            input_str = challenge + str(nonce)
            # 计算 SHA-256 哈希
            hash_result = hashlib.sha256(input_str.encode()).hexdigest()
            
            # 检查是否满足难度要求
            if hash_result.startswith(target_prefix):
                elapsed = time.time() - start_time
                print(f"\nFound solution after {elapsed:.2f} seconds and {nonce} attempts")
                print(f"Hash: {hash_result}")
                return str(nonce)
            
            nonce += 1
            
            # 每 100000 次尝试显示进度
            if nonce % 100000 == 0:
                print(f"Attempted {nonce} nonces...", end="\r")
    
    def process_url(self, url: str) -> Optional[str]:
        """
        处理整个流程：获取挑战、解决挑战、获取文件 URL
        """
        print(f"Requesting challenge from {url}")
        response = self.session.get(url)

        if response.status_code == 401:
            # 解析挑战信息
            try:
                challenge_data = response.json()
                challenge_token = challenge_data['challenge']
                difficulty = challenge_data['difficulty']

                # 解决 PoW 挑战
                nonce = self.solve_pow_challenge(challenge_token, difficulty)

                if nonce:
                    # 提交解决方案
                    payload = {
                        'challenge': challenge_token,
                        'nonce': nonce
                    }

                    print("Submitting solution...")
                    post_response = self.session.post(
                        url,
                        json=payload,
                        headers={'Content-Type': 'application/json'}
                    )

                    if post_response.status_code == 200:
                        # 服务器返回 JSON 格式，需解析 url 字段
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

        return None
    
    def download_file(self, url: str, filename: Optional[str] = None) -> bool:
        """
        下载文件到当前目录
        """
        try:
            response = self.session.get(url, stream=True)
            
            if response.status_code == 200:
                # 从 URL 提取文件名（如果没有提供）
                if not filename:
                    content_disposition = response.headers.get('content-disposition')
                    if content_disposition and 'filename=' in content_disposition:
                        filename = content_disposition.split('filename=')[1].strip('"')
                    else:
                        filename = urllib.parse.unquote(url.split('/')[-1].split('?')[0])
                
                # 写入文件
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
    
    # 获取用户输入的 URL
    url = input("Enter the URL: ").strip()
    choice = input("Do you want to download the file? (y/n): ").strip().lower()
    
    # 处理 URL 并获取文件 URL
    file_url = solver.process_url(url)
    
    if file_url:
        # 询问用户是否要下载文件
        if choice in ['y', 'yes']:
            solver.download_file(file_url)
    else:
        print("Failed to get file URL")

if __name__ == "__main__":
    main()