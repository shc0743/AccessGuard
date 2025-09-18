#!/usr/bin/env python3
import subprocess
import time
import os
import sys
import re
import platform
from statistics import mean, median

# 正则匹配 {{nonce}} 格式
NONCE_PATTERN = re.compile(r'\{\{(\d+)}}')

def run_benchmark(executable, challenge, difficulty, runs=3):
    """运行基准测试并返回 (times, nonce) 元组，失败返回 (None, None)"""
    times = []
    nonce = None  # 存储首次成功运行提取的 nonce

    for i in range(runs):
        print(f"  Run {i+1}/{runs}...", end=" ", flush=True)

        start_time = time.time()
        try:
            if platform.system().lower() == 'windows':
                args = ['python.exe', executable, challenge, str(difficulty)]
            else:
                args = [executable, challenge, str(difficulty)]
            result = subprocess.run(args, capture_output=True, text=True, timeout=300)
            end_time = time.time()

            if result.returncode == 0:
                elapsed = end_time - start_time
                times.append(elapsed)

                # 提取 nonce（只在第一次成功时提取）
                if nonce is None:
                    match = NONCE_PATTERN.search(result.stdout)
                    if match:
                        nonce = match.group(1)
                    else:
                        print("Warning: No nonce found in output " + result.stdout, end="")

                print(f"{elapsed:.2f}s (nonce: {nonce})")
            else:
                print(f"Error: {result.stderr.strip()}")
                return None, None

        except subprocess.TimeoutExpired:
            print("Timeout")
            return None, None
        except Exception as e:
            print(f"Error: {e}")
            return None, None

    return times, nonce


def find_c_executable():
    """查找可用的C可执行文件"""
    candidates = ['pow', 'pow.exe', 'pow_arm64', 'pow_android']

    for candidate in candidates:
        path = os.path.join('..', 'c', 'bin', candidate)
        if not os.path.exists(path):
            continue
        try:
            result = subprocess.run(
                [path, "test", "1"],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0:
                return path
        except:
            continue

    return None


def main():
    print("Python PoW Benchmark Tool")
    print("=" * 60)

    # 测试用例
    test_cases = [
        ("canrun", "apple", 1),
        ("beginner", "run", 4),
        ("basic", "test", 8),
        ("robot", "payloadstr", 10),
        ("simple", "world", 12),
        ("easy", "hello", 16),
        ("elementary", "userinputstr", 18),
        ("medium", "Genshin Impact", 20),
        ("intermediate", "Kiana Kaslana", 21),
        ("challenging", "Raiden Mei", 22),
        ("difficult", "Bronya Zaychik", 23),
        ("hard", "Herrscher of Flamescion", 24),
        ("extreme", "Herrscher of Finality", 25),
    ]

    # 查找C可执行文件
    c_executable = find_c_executable()
    if not c_executable:
        print("Error: No working C executable found in ../c/bin/")
        return 1

    print(f"Using C executable: {c_executable}")
    print(f"Using Python script: pow.py")
    print()

    results = {}  # key: "C_easy", value: (times, nonce)

    for name, challenge, difficulty in test_cases:
        print(f"Testing {name} case (difficulty: {difficulty}):")
        print(f"  Challenge: '{challenge}'")

        # 测试 C 版本
        print("  C version:")
        c_times, c_nonce = run_benchmark(c_executable, challenge, difficulty)
        if c_times is not None and c_nonce is not None:
            results[f"C_{name}"] = (c_times, c_nonce)
            print(f"  ✓ C found nonce: {c_nonce}")
        else:
            print("  ✗ C failed")
            results[f"C_{name}"] = (None, None)

        # 测试 Python 版本
        print("  Python version:")
        py_times, py_nonce = run_benchmark("./pow.py", challenge, difficulty)
        if py_times is not None and py_nonce is not None:
            results[f"Python_{name}"] = (py_times, py_nonce)
            print(f"  ✓ Python found nonce: {py_nonce}")
        else:
            print("  ✗ Python failed")
            results[f"Python_{name}"] = (None, None)

        # 比较 nonce 是否一致
        if c_nonce and py_nonce:
            if c_nonce == py_nonce:
                print(f"  ✔️  C and Python produced same nonce: {c_nonce}")
            else:
                print(f"  ❌ Mismatch! C: {c_nonce}, Python: {py_nonce}")
        elif c_nonce or py_nonce:
            print("  ⚠️  One implementation failed to produce nonce")
        else:
            print("  ⚠️  Both implementations failed to produce nonce")

        print()

    # 输出统计结果
    print("Benchmark Results")
    print("=" * 60)

    for key, (times, nonce) in results.items():
        if times is None:
            continue
        lang, case = key.split("_", 1)
        avg_time = mean(times)
        med_time = median(times)
        min_time = min(times)
        max_time = max(times)

        print(f"{lang} {case}:")
        print(f"  Runs: {len(times)}")
        print(f"  Nonce: {nonce}")
        print(f"  Average: {avg_time:.3f}s")
        print(f"  Median: {med_time:.3f}s")
        print(f"  Min: {min_time:.3f}s")
        print(f"  Max: {max_time:.3f}s")
        print(f"  Times: {', '.join(f'{t:.3f}' for t in times)}")
        print()

    # 性能对比（动态找出共有的测试用例）
    print("Performance Comparison (C vs Python)")
    print("=" * 60)

    # 找出所有 C 和 Python 都成功运行的测试
    common_cases = []
    for name, _, _ in test_cases:
        c_key = f"C_{name}"
        py_key = f"Python_{name}"
        if (c_key in results and results[c_key][0] is not None and
            py_key in results and results[py_key][0] is not None):
            common_cases.append(name)

    if not common_cases:
        print("No common test cases completed successfully.")
        return 0

    for case in common_cases:
        c_key = f"C_{case}"
        py_key = f"Python_{case}"
        c_avg = mean(results[c_key][0])
        py_avg = mean(results[py_key][0])
        ratio = py_avg / c_avg
        print(f"{case}: Python is {ratio:.2f}x slower than C (ratio = {ratio:.2f})")

    # 总体平均性能比
    overall_ratio = mean(
        mean(results[f"C_{case}"][0]) / mean(results[f"Python_{case}"][0])
        for case in common_cases
    )
    print(f"\nOverall: Python is {1/overall_ratio:.2f}x slower than C (geometric mean)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
