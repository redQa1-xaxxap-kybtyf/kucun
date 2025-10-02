# 快速部署指南

> 本文档提供快速部署到生产环境的步骤

## 📋 前置要求

### 服务器要求
- Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- 至少 2GB RAM
- 至少 20GB 磁盘空间
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+

### 域名要求
- 已注册的域名
- DNS 已指向服务器 IP

---

## 🚀 快速部署 (5 步完成)

### 步骤 1: 克隆代码

```bash
# 克隆仓库
git clone https://github.com/your-repo/kucun.git
cd kucun

# 切换到生产分支 (如果有)
git checkout main  # 或 restore-bb66bd8
```

### 步骤 2: 配置环境

```bash
# 1. 复制配置文件
cp .env.production.example .env.production

# 2. 生成密钥
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo "STORAGE_ENCRYPTION_KEY=$(openssl rand -base64 32)"

# 3. 编辑配置文件
nano .env.production

# 必须修改的配置:
# - DATABASE_URL: 改为 MySQL 连接字符串
# - NEXTAUTH_URL: 改为你的域名 (https://your-domain.com)
# - NEXTAUTH_SECRET: 粘贴上面生成的密钥
# - STORAGE_ENCRYPTION_KEY: 粘贴上面生成的密钥
# - REDIS_URL: 改为 Redis 地址
```

### 步骤 3: 运行检查脚本

```bash
# 给脚本添加执行权限
chmod +x scripts/*.sh

# 运行环境检查
./scripts/check-env.sh

# 如果有错误,按照提示修复
```

### 步骤 4: 部署应用

```bash
# 运行自动部署脚本
./scripts/deploy.sh

# 脚本会自动完成:
# - 安装依赖
# - 数据库迁移
# - 构建应用
# - 启动 PM2
```

### 步骤 5: 配置 Nginx 和 SSL

```bash
# 1. 复制 Nginx 配置
sudo cp nginx.conf.example /etc/nginx/sites-available/kucun

# 2. 编辑配置文件
sudo nano /etc/nginx/sites-available/kucun
# 将 your-domain.com 替换为你的实际域名

# 3. 启用配置
sudo ln -s /etc/nginx/sites-available/kucun /etc/nginx/sites-enabled/

# 4. 测试配置
sudo nginx -t

# 5. 获取 SSL 证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 6. 重启 Nginx
sudo systemctl restart nginx
```

---

## ✅ 验证部署

### 1. 检查应用状态

```bash
# 查看 PM2 状态
pm2 status

# 查看日志
pm2 logs kucun-app

# 应该看到应用状态为 "online"
```

### 2. 检查端口

```bash
# 检查端口监听
sudo netstat -tuln | grep -E ':(3000|3002|80|443)'

# 应该看到:
# - 3000: Next.js 应用
# - 3002: WebSocket 服务
# - 80: HTTP (Nginx)
# - 443: HTTPS (Nginx)
```

### 3. 测试访问

```bash
# 测试本地访问
curl http://localhost:3000

# 测试域名访问
curl https://your-domain.com

# 应该返回 HTML 内容
```

### 4. 测试登录

打开浏览器访问: `https://your-domain.com`

- 应该能看到登录页面
- 尝试登录
- 检查功能是否正常

---

## 📊 常用命令

### PM2 管理

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs kucun-app          # 应用日志
pm2 logs kucun-ws           # WebSocket 日志
pm2 logs --lines 100        # 查看最近 100 行

# 重启应用
pm2 restart kucun-app       # 重启应用
pm2 restart all             # 重启所有

# 停止应用
pm2 stop kucun-app          # 停止应用
pm2 stop all                # 停止所有

# 监控
pm2 monit                   # 实时监控

# 保存配置
pm2 save                    # 保存当前配置
pm2 startup                 # 设置开机自启
```

### 数据库管理

```bash
# 备份数据库
./scripts/backup-db.sh

# 查看备份
ls -lh backups/

# 恢复数据库
gunzip < backups/kucun_prod_20250102_120000.sql.gz | mysql -u user -p database
```

### Nginx 管理

```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx

# 查看日志
sudo tail -f /var/log/nginx/kucun-access.log
sudo tail -f /var/log/nginx/kucun-error.log
```

### 更新代码

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./scripts/deploy.sh
```

---

## 🔧 故障排查

### 应用无法启动

```bash
# 1. 查看日志
pm2 logs kucun-app --lines 50

# 2. 检查环境变量
cat .env.production | grep -E "(DATABASE_URL|NEXTAUTH_SECRET)"

# 3. 检查端口占用
sudo netstat -tuln | grep 3000

# 4. 手动启动测试
npm start
```

### 数据库连接失败

```bash
# 1. 测试数据库连接
mysql -h host -u user -p database

# 2. 检查 DATABASE_URL
echo $DATABASE_URL

# 3. 运行 Prisma 检查
npx prisma db pull
```

### Nginx 502 错误

```bash
# 1. 检查应用是否运行
pm2 status

# 2. 检查端口
curl http://localhost:3000

# 3. 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/kucun-error.log
```

### SSL 证书问题

```bash
# 1. 检查证书
sudo certbot certificates

# 2. 续期证书
sudo certbot renew

# 3. 测试续期
sudo certbot renew --dry-run
```

---

## 📝 定期维护

### 每日任务

```bash
# 查看应用状态
pm2 status

# 查看错误日志
pm2 logs --err --lines 20
```

### 每周任务

```bash
# 备份数据库
./scripts/backup-db.sh

# 检查磁盘空间
df -h

# 检查日志大小
du -sh logs/
```

### 每月任务

```bash
# 更新系统
sudo apt update && sudo apt upgrade

# 更新 Node.js 依赖
npm outdated
npm update

# 清理旧日志
find logs/ -name "*.log" -mtime +30 -delete

# 清理旧备份
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

---

## 🔒 安全建议

### 1. 防火墙配置

```bash
# 安装 UFW
sudo apt install ufw

# 允许必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 2. SSH 安全

```bash
# 禁用 root 登录
sudo nano /etc/ssh/sshd_config
# 设置: PermitRootLogin no

# 使用密钥认证
# 设置: PasswordAuthentication no

# 重启 SSH
sudo systemctl restart sshd
```

### 3. 定期更新

```bash
# 设置自动安全更新
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 📚 相关文档

- [生产环境部署指南.md](./生产环境部署指南.md) - 详细部署步骤
- [生产环境安全检查清单.md](./生产环境安全检查清单.md) - 安全检查项
- [生产环境详细检查报告.md](./生产环境详细检查报告.md) - 详细分析

---

## 🆘 获取帮助

如果遇到问题:

1. 查看日志: `pm2 logs kucun-app`
2. 运行检查: `./scripts/check-env.sh`
3. 查看文档: 参考上面的相关文档
4. 搜索错误信息

---

**祝部署顺利! 🚀**

