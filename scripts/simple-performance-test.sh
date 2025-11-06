#!/bin/bash

# 简化版性能测试脚本 - 不依赖bc计算器
BASE_URL="http://localhost:3000/api/performance"
RESULTS_DIR="./test-results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$RESULTS_DIR/simple-performance-$TIMESTAMP.csv"

# 创建结果目录
mkdir -p $RESULTS_DIR

# 初始化CSV文件
echo "TestType,Endpoint,ResponseTime,StatusCode,Success,Timestamp" > $RESULTS_FILE

echo "🎯 分类管理系统性能测试开始"
echo "测试时间: $(date)"
echo "结果文件: $RESULTS_FILE"
echo ""

# 测试函数
test_api() {
    local test_name="$1"
    local endpoint="$2"
    local iterations="$3"

    echo "🔄 测试 $test_name..."

    total_time=0
    success_count=0
    min_time=999999
    max_time=0

    for i in $(seq 1 $iterations); do
        start_time=$(($(date +%s%N)/1000000))

        status=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$endpoint")

        end_time=$(($(date +%s%N)/1000000))
        response_time=$((end_time - start_time))

        success=0
        if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
            success=1
            success_count=$((success_count + 1))
        fi

        echo "$test_name,$endpoint,$response_time,$status,$success,$(date +%s)" >> $RESULTS_FILE

        total_time=$((total_time + response_time))

        if [ $response_time -lt $min_time ]; then
            min_time=$response_time
        fi
        if [ $response_time -gt $max_time ]; then
            max_time=$response_time
        fi

        if [ $((i % 5)) -eq 0 ]; then
            echo -n "  进度: $i/$iterations"
            if [ $success -eq 1 ]; then
                echo " - ${response_time}ms"
            else
                echo " - HTTP $status"
            fi
        fi

        sleep 0.05
    done

    # 计算平均时间
    avg_time=$((total_time / iterations))

    echo "  结果: 平均${avg_time}ms, 最小${min_time}ms, 最大${max_time}ms"
    echo "  成功率: $success_count/$iterations"
    echo ""
}

# 并发测试函数
test_concurrency() {
    local test_name="$1"
    local endpoint="$2"
    local concurrency="$3"

    echo "⚡ 并发测试 $test_name (并发数: $concurrency)..."

    start_time=$(date +%s%3N)

    for i in $(seq 1 $concurrency); do
        curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$endpoint" &
    done

    wait

    end_time=$(date +%s%3N)
    total_time=$((end_time - start_time))

    echo "  总时间: ${total_time}ms"
    echo ""
}

# 缓存测试
test_cache() {
    echo "💾 缓存性能测试..."

    endpoint="/categories?limit=20"

    # 首次请求
    start_time=$(($(date +%s%N)/1000000))
    curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$endpoint"
    end_time=$(($(date +%s%N)/1000000))
    first_time=$((end_time - start_time))

    # 缓存命中测试
    cache_times=()
    for i in $(seq 1 10); do
        start_time=$(($(date +%s%N)/1000000))
        curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$endpoint" > /dev/null
        end_time=$(($(date +%s%N)/1000000))
        cache_time=$((end_time - start_time))
        cache_times+=($cache_time)
        sleep 0.01
    done

    # 计算平均缓存时间
    cache_total=0
    for time in "${cache_times[@]}"; do
        cache_total=$((cache_total + time))
    done
    avg_cache_time=$((cache_total / ${#cache_times[@]}))

    echo "  首次请求: ${first_time}ms"
    echo "  缓存命中平均: ${avg_cache_time}ms"

    # 简单计算提升比例 (使用整数运算)
    improvement=$(( (first_time - avg_cache_time) * 100 / first_time ))
    echo "  性能提升: ${improvement}%"
    echo ""
}

# 执行测试
echo "=== 1. 基础API响应时间测试 ==="
test_api "基础列表查询" "/categories?limit=20" 15
test_api "搜索查询" "/categories?search=test&limit=20" 10
test_api "状态筛选" "/categories?status=active&limit=20" 10
test_api "分页查询" "/categories?limit=20&page=2" 10
test_api "排序查询" "/categories?sortBy=name&sortOrder=asc&limit=20" 10

echo "=== 2. 数据量性能测试 ==="
test_api "小数据量" "/categories?limit=10" 5
test_api "中数据量" "/categories?limit=50" 5
test_api "大数据量" "/categories?limit=100" 5
test_api "超大数据量" "/categories?limit=500" 3

echo "=== 3. 复杂查询测试 ==="
test_api "多条件筛选" "/categories?search=test&status=active&limit=20" 5
test_api "排序+分页" "/categories?sortBy=createdAt&sortOrder=desc&limit=20&page=5" 5
test_api "父子关系" "/categories?parentId=null&limit=20" 5

echo "=== 4. 并发测试 ==="
test_concurrency "低并发查询" "/categories?limit=20" 10
test_concurrency "中并发查询" "/categories?limit=20" 50
test_concurrency "高并发查询" "/categories?limit=20" 100

echo "=== 5. 缓存性能测试 ==="
test_cache

# 生成简单报告
echo "=== 性能测试摘要 ==="
echo "测试时间: $(date)"
echo ""

# 计算各测试类型的统计
echo "📊 平均响应时间统计:"
awk -F',' 'NR>1 && $5=="1" {
    sum[$1] += $3;
    count[$1]++;
    if (min[$1]=="" || $3<min[$1]) min[$1]=$3;
    if (max[$1]=="" || $3>max[$1]) max[$1]=$3;
}
END {
    for (test in sum) {
        avg = sum[test]/count[test];
        printf "%-20s: %dms (%d-%dms) [%d 请求]\n", test, avg, min[test], max[test], count[test];
    }
}' $RESULTS_FILE

echo ""
echo "📈 成功率统计:"
awk -F',' 'NR>1 {
    total[$1]++;
    if ($5=="1") success[$1]++;
}
END {
    for (test in total) {
        rate = (success[test]*100)/total[test];
        printf "%-20s: %.1f%% (%d/%d)\n", test, rate, success[test], total[test];
    }
}' $RESULTS_FILE

echo ""
echo "🎉 性能测试完成!"
echo "📁 详细数据: $RESULTS_FILE"