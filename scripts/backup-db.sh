#!/bin/bash

###############################################################################
# 数据库备份脚本
# 用途: 备份生产环境 MySQL 数据库
# 使用: ./scripts/backup-db.sh
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30  # 保留 30 天的备份

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 加载环境变量
if [ ! -f ".env.production" ]; then
    log_error ".env.production 文件不存在!"
    exit 1
fi

source .env.production

# 解析数据库连接字符串
# 格式: mysql://username:password@host:port/database
if [[ $DATABASE_URL =~ mysql://([^:]+):([^@]+)@([^:]+):([^/]+)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    log_error "无法解析 DATABASE_URL"
    log_info "格式应为: mysql://username:password@host:port/database"
    exit 1
fi

log_info "开始备份数据库: $DB_NAME"
log_info "备份时间: $DATE"

# 备份文件名
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql"
BACKUP_FILE_GZ="$BACKUP_FILE.gz"

# 执行备份
log_info "正在备份..."
if mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
    
    log_success "数据库备份成功: $BACKUP_FILE"
    
    # 压缩备份文件
    log_info "正在压缩备份文件..."
    gzip "$BACKUP_FILE"
    log_success "备份文件已压缩: $BACKUP_FILE_GZ"
    
    # 显示备份文件大小
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    log_info "备份文件大小: $BACKUP_SIZE"
    
else
    log_error "数据库备份失败!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# 清理旧备份
log_info "清理 $RETENTION_DAYS 天前的旧备份..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete
DELETED_COUNT=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS | wc -l)
if [ $DELETED_COUNT -gt 0 ]; then
    log_success "已删除 $DELETED_COUNT 个旧备份"
else
    log_info "没有需要删除的旧备份"
fi

# 显示当前所有备份
log_info "当前备份列表:"
ls -lh "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null || log_info "  (无备份文件)"

log_success "备份完成!"

# 可选: 上传到远程存储 (如 S3, OSS 等)
# 取消注释以下代码并配置相应的上传命令
# log_info "上传备份到远程存储..."
# aws s3 cp "$BACKUP_FILE_GZ" s3://your-bucket/backups/
# log_success "备份已上传到远程存储"

