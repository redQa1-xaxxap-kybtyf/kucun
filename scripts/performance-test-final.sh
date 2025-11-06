#!/bin/bash

# 分类管理系统性能测试脚本 - 最终版本
# 使用性能测试专用API端点

BASE_URL="http://localhost:3000/api/performance"
RESULTS_DIR="./test-results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$RESULTS_DIR/category-performance-$TIMESTAMP.csv"

# 创建结果目录
mkdir -p $RESULTS_DIR

# 初始化CSV文件
echo "TestType,Endpoint,Method,Iteration,ResponseTime,StatusCode,Success,Timestamp,AdditionalInfo" > $RESULTS_FILE

# 记录测试结果
log_result() {
    local test_type="$1"
    local endpoint="$2"
    local method="$3"
    local iteration="$4"
    local response_time="$5"
    local status_code="$6"
    local success="$7"
    local additional_info="$8"

    echo "$test_type,$endpoint,$method,$iteration,$response_time,$status_code,$success,$(date +%s),$additional_info" >> $RESULTS_FILE
}

# 测试单个API端点
test_endpoint() {
    local test_name="$1"
    local endpoint="$2"
    local method="$3"
    local data="$4"
    local iterations=${5:-10}
    local test_type="$6"

    echo "🔄 测试 $test_name ($method $endpoint)..."

    for i in $(seq 1 $iterations); do
        start_time=$(($(date +%s%N)/1000000))

        if [ "$method" = "POST" ] && [ -n "$data" ]; then
            response=$(curl -s -w "%{http_code}" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "%{http_code}" \
                "$BASE_URL$endpoint")
        fi

        end_time=$(($(date +%s%N)/1000000))
        response_time=$((end_time - start_time))

        # 提取状态码
        status_code=$(echo "$response" | tail -c 3)

        # 判断成功状态
        success=0
        if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
            success=1
        fi

        log_result "$test_type" "$endpoint" "$method" "$i" "$response_time" "$status_code" "$success" ""

        # 显示进度
        if [ $((i % 5)) -eq 0 ] || [ $i -eq $iterations ]; then
            echo -n "  进度: $i/$iterations"
            if [ $success -eq 1 ]; then
                echo " - 响应时间: ${response_time}ms ✅"
            else
                echo " - HTTP $status_code ❌"
            fi
        fi

        # 短暂延迟
        sleep 0.05
    done
}

# 并发测试
test_concurrency() {
    local test_name="$1"
    local endpoint="$2"
    local concurrency="$3"
    local method="$4"
    local data="$5"

    echo "⚡ 并发测试 $test_name (并发数: $concurrency)..."

    start_time=$(date +%s%3N)  # 毫秒级时间戳

    # 启动并发请求
    for i in $(seq 1 $concurrency); do
        {
            req_start=$(($(date +%s%N)/1000000))

            if [ "$method" = "POST" ] && [ -n "$data" ]; then
                status=$(curl -s -w "%{http_code}" \
                    -H "Content-Type: application/json" \
                    -d "$data" \
                    -o /dev/null \
                    "$BASE_URL$endpoint")
            else
                status=$(curl -s -w "%{http_code}" \
                    -o /dev/null \
                    "$BASE_URL$endpoint")
            fi

            req_end=$(($(date +%s%N)/1000000))
            req_time=$((req_end - req_start))

            success=0
            if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
                success=1
            fi

            echo "$status,$req_time,$success" >> "$RESULTS_DIR/concurrent_${test_name}_${concurrency}.tmp"
        } &
    done

    # 等待所有请求完成
    wait
    end_time=$(date +%s%3N)

    total_time=$((end_time - start_time))

    # 分析并发结果
    if [ -f "$RESULTS_DIR/concurrent_${test_name}_${concurrency}.tmp" ]; then
        success_count=$(grep ",1$" "$RESULTS_DIR/concurrent_${test_name}_${concurrency}.tmp" | wc -l)
        error_count=$(grep ",0$" "$RESULTS_DIR/concurrent_${test_name}_${concurrency}.tmp" | wc -l)
        avg_response_time=$(awk -F',' '{sum+=$2} END {if(NR>0) print sum/NR; else print 0}' "$RESULTS_DIR/concurrent_${test_name}_${concurrency}.tmp")

        success_rate=$(echo "scale=2; $success_count * 100 / $concurrency" | bc -l)

        echo "  总时间: ${total_time}ms"
        echo "  成功率: ${success_rate}% ($success_count/$concurrency)"
        echo "  平均响应时间: ${avg_response_time}ms"

        log_result "concurrent" "$endpoint" "$method" "$concurrency" "$total_time" "200" "$success_count" "concurrency:$concurrency,success_rate:$success_rate,avg_time:$avg_response_time"

        # 清理临时文件
        rm -f "$RESULTS_DIR/concurrent_${test_name}_${concurrency}.tmp"
    fi
}

# 大数据量创建测试
test_bulk_creation() {
    local test_name="$1"
    local batch_size="$2"
    local num_batches="$3"

    echo "📊 大数据量创建测试 $test_name (批次: $num_batches, 每批: $batch_size)..."

    for batch in $(seq 1 $num_batches); do
        echo "  批次 $batch/$num_batches..."

        start_time=$(date +%s%3N)

        # 创建一批数据
        for i in $(seq 1 $batch_size); do
            category_data="{
                \"name\": \"批量测试_${batch}_${i}_$(date +%s)\",
                \"code\": \"BULK_${batch}_${i}_${RANDOM}\",
                \"description\": \"大数据量测试，批次: $batch, 索引: $i\"
            }"

            curl -s -H "Content-Type: application/json" \
                 -d "$category_data" \
                 "$BASE_URL/categories" > /dev/null &
        done

        wait
        end_time=$(date +%s%3N)

        batch_time=$((end_time - start_time))
        echo "    批次完成: ${batch_time}ms"

        log_result "bulk_creation" "/categories" "POST" "$batch" "$batch_time" "200" "1" "batch_size:$batch_size,total_created:$((batch * batch_size))"

        # 短暂休息避免系统过载
        sleep 0.5
    done
}

# 缓存性能测试
test_cache_performance() {
    echo "💾 缓存性能测试..."

    endpoint="/categories?limit=20"

    # 首次请求（缓存未命中）
    echo "  首次请求..."
    start_time=$(($(date +%s%N)/1000000))
    status=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$endpoint")
    end_time=$(($(date +%s%N)/1000000))
    first_time=$((end_time - start_time))

    # 重复请求（测试缓存命中）
    echo "  缓存命中测试..."
    cache_times=()
    for i in $(seq 1 20); do
        start_time=$(($(date +%s%N)/1000000))
        curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$endpoint" > /dev/null
        end_time=$(($(date +%s%N)/1000000))
        cache_time=$((end_time - start_time))
        cache_times+=($cache_time)
        sleep 0.01
    done

    # 计算缓存命中平均时间
    avg_cache_time=0
    for time in "${cache_times[@]}"; do
        avg_cache_time=$((avg_cache_time + time))
    done
    avg_cache_time=$((avg_cache_time / ${#cache_times[@]}))

    cache_improvement=$(echo "scale=2; ($first_time - $avg_cache_time) * 100 / $first_time" | bc -l)

    echo "    首次请求: ${first_time}ms"
    echo "    缓存命中平均: ${avg_cache_time}ms"
    echo "    缓存性能提升: ${cache_improvement}%"

    log_result "cache_test" "$endpoint" "GET" "1" "$first_time" "200" "1" "type:first_request"
    log_result "cache_test" "$endpoint" "GET" "20" "$avg_cache_time" "200" "1" "type:cache_hit,improvement:$cache_improvement"
}

# 生成性能报告
generate_report() {
    echo -e "\n📋 生成性能测试报告..."

    report_file="$RESULTS_DIR/performance-report-$TIMESTAMP.txt"

    cat > "$report_file" << EOF
分类管理系统性能测试报告
==========================

测试时间: $(date)
基础URL: $BASE_URL
结果文件: $RESULTS_FILE

1. API响应时间统计
------------------
EOF

    # 计算各测试类型的统计信息
    tail -n +2 $RESULTS_FILE | cut -d',' -f1,5,6,7 | awk -F',' '
    {
        if ($7 == "1") {  # 只统计成功的请求
            sum[$1] += $5;
            count[$1]++;
            if (min[$1] == "" || $5 < min[$1]) min[$1] = $5;
            if (max[$1] == "" || $5 > max[$1]) max[$1] = $5;
        }
    }
    END {
        for (test in sum) {
            if (count[test] > 0) {
                avg = sum[test] / count[test];
                printf "%-25s: 平均 %.2fms, 最小 %dms, 最大 %dms (%d 请求)\n",
                       test, avg, min[test], max[test], count[test];
            }
        }
    }' >> "$report_file"

    echo -e "\n2. 成功率统计\n------------" >> "$report_file"

    tail -n +2 $RESULTS_FILE | cut -d',' -f1,7 | awk -F',' '
    {
        total[$1]++;
        if ($7 == "1") success[$1]++;
    }
    END {
        for (test in total) {
            success_rate = (success[test] / total[test]) * 100;
            printf "%-25s: %.1f%% (%d/%d)\n",
                   test, success_rate, success[test], total[test];
        }
    }' >> "$report_file"

    echo -e "\n3. 性能基准\n--------" >> "$report_file"

    # 性能基准分析
    tail -n +2 $RESULTS_FILE | grep -E "(basic_query|list_query)" | cut -d',' -f5,7 | awk -F',' '
    $2 == "1" { times[++n] = $1 }
    END {
        if (n > 0) {
            asort(times);
            len = n;
            avg = 0;
            for (i = 1; i <= len; i++) avg += times[i];
            avg /= len;
            p95_idx = int(len * 0.95);
            p99_idx = int(len * 0.99);

            printf "基础查询性能:\n";
            printf "- 平均响应时间: %.2fms\n", avg;
            printf "- P95响应时间: %dms\n", times[p95_idx];
            printf "- P99响应时间: %dms\n", times[p99_idx];
            printf "- 总请求数: %d\n", len;
        }
    }' >> "$report_file"

    echo ""
    echo "📊 性能测试报告已生成: $report_file"
    echo "📁 详细数据文件: $RESULTS_FILE"
}

# 主测试流程
main() {
    echo "🎯 分类管理系统性能测试开始"
    echo "测试时间: $(date)"
    echo "结果目录: $RESULTS_DIR"
    echo ""

    # 1. 基础API响应时间测试
    echo "=== 1. 基础API响应时间测试 ==="

    test_endpoint "基础列表查询" "/categories?limit=20" "GET" "" 15 "basic_query"
    test_endpoint "搜索查询" "/categories?search=test&limit=20" "GET" "" 10 "search_query"
    test_endpoint "状态筛选" "/categories?status=active&limit=20" "GET" "" 10 "filter_query"
    test_endpoint "分页查询" "/categories?limit=20&page=2" "GET" "" 10 "pagination_query"
    test_endpoint "排序查询" "/categories?sortBy=name&sortOrder=asc&limit=20" "GET" "" 10 "sort_query"

    # 2. 并发测试
    echo -e "\n=== 2. 并发测试 ==="

    test_concurrency "低并发" "/categories?limit=20" 10 "GET"
    test_concurrency "中并发" "/categories?limit=20" 50 "GET"
    test_concurrency "高并发" "/categories?limit=20" 100 "GET"

    # 3. 数据量性能测试
    echo -e "\n=== 3. 数据量性能测试 ==="

    test_endpoint "小数据量" "/categories?limit=10" "GET" "" 5 "volume_small"
    test_endpoint "中数据量" "/categories?limit=50" "GET" "" 5 "volume_medium"
    test_endpoint "大数据量" "/categories?limit=100" "GET" "" 5 "volume_large"
    test_endpoint "超大数据量" "/categories?limit=500" "GET" "" 3 "volume_xlarge"

    # 4. 复杂查询测试
    echo -e "\n=== 4. 复杂查询测试 ==="

    test_endpoint "多条件筛选" "/categories?search=test&status=active&limit=20" "GET" "" 5 "complex_filter"
    test_endpoint "排序+分页" "/categories?sortBy=createdAt&sortOrder=desc&limit=20&page=5" "GET" "" 5 "complex_sort"
    test_endpoint "父子关系" "/categories?parentId=null&limit=20" "GET" "" 5 "hierarchy_query"

    # 5. 缓存性能测试
    echo -e "\n=== 5. 缓存性能测试 ==="
    test_cache_performance

    # 6. 大数据量创建测试（可选）
    read -p "是否执行大数据量创建测试？(y/N): " execute_bulk
    if [[ $execute_bulk =~ ^[Yy]$ ]]; then
        echo -e "\n=== 6. 大数据量创建测试 ==="
        test_bulk_creation "压力测试" 20 5  # 5批，每批20个
    fi

    # 生成报告
    generate_report

    echo -e "\n🎉 性能测试完成!"
    echo "⏱️  总测试时间: $SECONDS 秒"
}

# 检查工具依赖
check_dependencies() {
    command -v curl >/dev/null 2>&1 || { echo "❌ 需要安装 curl"; exit 1; }
    command -v bc >/dev/null 2>&1 || { echo "❌ 需要安装 bc"; exit 1; }
}

# 执行测试
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    check_dependencies
    main "$@"
fi