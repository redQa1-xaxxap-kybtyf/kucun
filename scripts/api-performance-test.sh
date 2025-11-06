#!/bin/bash

# 分类管理系统API性能测试脚本
# 使用curl命令测试API性能

BASE_URL="http://localhost:3000"
RESULTS_FILE="./test-results/api-performance-$(date +%Y%m%d-%H%M%S).csv"

# 创建结果目录
mkdir -p test-results

# 初始化CSV文件
echo "Test,Endpoint,Method,ResponseTime,StatusCode,Success,Timestamp" > $RESULTS_FILE

# 获取认证token（如果需要）
get_auth_token() {
    echo "获取认证token..."
    # 这里需要根据实际的认证方式调整
    # TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    #         -H "Content-Type: application/json" \
    #         -d '{"username":"test","password":"test"}' \
    #         | jq -r '.token')
    # echo $TOKEN

    # 暂时使用测试token
    echo "test-token"
}

TOKEN=$(get_auth_token)

# 测试单个API端点
test_endpoint() {
    local test_name="$1"
    local endpoint="$2"
    local method="$3"
    local data="$4"
    local iterations=${5:-10}

    echo "测试 $test_name ($method $endpoint)..."

    for i in $(seq 1 $iterations); do
        start_time=$(($(date +%s%N)/1000000))

        if [ "$method" = "POST" ] && [ -n "$data" ]; then
            response=$(curl -s -w "%{http_code}" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $TOKEN" \
                -d "$data" \
                -o /dev/null \
                "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "%{http_code}" \
                -H "Authorization: Bearer $TOKEN" \
                -o /dev/null \
                "$BASE_URL$endpoint")
        fi

        end_time=$(($(date +%s%N)/1000000))
        response_time=$((end_time - start_time))
        success=0

        if [ "$response" -ge 200 ] && [ "$response" -lt 300 ]; then
            success=1
        fi

        echo "$test_name,$endpoint,$method,$response_time,$response,$success,$(date +%s)" >> $RESULTS_FILE
        echo "  请求$i: HTTP $response, ${response_time}ms"

        sleep 0.1
    done
}

# 并发测试
test_concurrency() {
    local test_name="$1"
    local endpoint="$2"
    local concurrency="$3"
    local method="$4"
    local data="$5"

    echo "并发测试 $test_name (并发数: $concurrency)..."

    start_time=$(date +%s)

    for i in $(seq 1 $concurrency); do
        {
            if [ "$method" = "POST" ] && [ -n "$data" ]; then
                response=$(curl -s -w "%{http_code}" \
                    -H "Content-Type: application/json" \
                    -H "Authorization: Bearer $TOKEN" \
                    -d "$data" \
                    -o /dev/null \
                    "$BASE_URL$endpoint" &>/dev/null &)
            else
                response=$(curl -s -w "%{http_code}" \
                    -H "Authorization: Bearer $TOKEN" \
                    -o /dev/null \
                    "$BASE_URL$endpoint" &>/dev/null &)
            fi
        } &
    done

    wait
    end_time=$(date +%s)
    total_time=$((end_time - start_time))

    echo "  并发测试完成: 总时间 ${total_time}s"
}

echo "开始API性能测试..."
echo "基础URL: $BASE_URL"
echo "结果文件: $RESULTS_FILE"
echo "开始时间: $(date)"

# 1. 基础API响应时间测试
echo -e "\n=== 基础API响应时间测试 ==="

# 测试分类列表查询
test_endpoint "分类列表查询" "/api/categories?limit=20" "GET"
test_endpoint "分类搜索查询" "/api/categories?search=test&limit=20" "GET"
test_endpoint "分类状态筛选" "/api/categories?status=active&limit=20" "GET"
test_endpoint "分类分页查询" "/api/categories?limit=20&page=2" "GET"
test_endpoint "分类排序查询" "/api/categories?sortBy=name&sortOrder=asc&limit=20" "GET"

# 测试创建分类（可能需要认证）
test_category_data='{
    "name": "性能测试分类_'$(date +%s)'",
    "code": "PERF_TEST_'$(date +%s)'",
    "description": "性能测试创建的分类"
}'

# test_endpoint "创建分类" "/api/categories" "POST" "$test_category_data" 5

# 2. 并发测试
echo -e "\n=== 并发测试 ==="

test_concurrency "低并发查询" "/api/categories?limit=20" 10 "GET"
test_concurrency "中并发查询" "/api/categories?search=test" 50 "GET"
test_concurrency "高并发查询" "/api/categories?status=active" 100 "GET"

# 3. 不同数据量的查询性能测试
echo -e "\n=== 数据量性能测试 ==="

test_endpoint "小数据量查询" "/api/categories?limit=10" "GET" "" 5
test_endpoint "中数据量查询" "/api/categories?limit=50" "GET" "" 5
test_endpoint "大数据量查询" "/api/categories?limit=100" "GET" "" 5
test_endpoint "超大数据量查询" "/api/categories?limit=500" "GET" "" 3

# 4. 复杂查询性能测试
echo -e "\n=== 复杂查询性能测试 ==="

test_endpoint "多条件筛选" "/api/categories?search=test&status=active&limit=20" "GET" "" 5
test_endpoint "排序+分页" "/api/categories?sortBy=createdAt&sortOrder=desc&limit=20&page=5" "GET" "" 5
test_endpoint "父子关系查询" "/api/categories?parentId=null&limit=20" "GET" "" 5

echo -e "\n性能测试完成!"
echo "结果文件: $RESULTS_FILE"

# 生成简单报告
generate_report() {
    echo -e "\n=== 性能测试报告 ==="

    echo "测试时间: $(date)"
    echo "基础URL: $BASE_URL"
    echo ""

    # 计算每个测试的平均响应时间
    echo "平均响应时间统计:"
    tail -n +2 $RESULTS_FILE | cut -d',' -f1,4 | awk -F',' '
    {
        if (!seen[$1]++) {
            sum[$1] = $2;
            count[$1] = 1;
        } else {
            sum[$1] += $2;
            count[$1]++;
        }
    }
    END {
        for (test in sum) {
            printf "%-20s: %.2fms (%d 请求)\n", test, sum[test]/count[test], count[test];
        }
    }'

    echo ""
    echo "成功率统计:"
    tail -n +2 $RESULTS_FILE | cut -d',' -f1,6 | awk -F',' '
    {
        if (!seen[$1]++) {
            success[$1] = $2;
            total[$1] = 1;
        } else {
            success[$1] += $2;
            total[$1]++;
        }
    }
    END {
        for (test in success) {
            printf "%-20s: %.1f%% (%d/%d)\n", test, (success[test]/total[test])*100, success[test], total[test];
        }
    }'
}

generate_report

echo -e "\n详细数据请查看: $RESULTS_FILE"