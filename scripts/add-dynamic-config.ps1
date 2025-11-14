# 批量为 API Route Handlers 添加 dynamic 配置
# 用法: .\scripts\add-dynamic-config.ps1

$files = Get-ChildItem -Path app\api -Recurse -Include route.ts
$modified = 0
$skipped = 0
$errors = 0

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -ErrorAction Stop
        
        # 检查是否已经有 dynamic 配置
        if ($content -match 'export const dynamic') {
            Write-Host "跳过（已有配置）: $($file.FullName.Replace((Get-Location).Path + '\', ''))" -ForegroundColor Yellow
            $skipped++
            continue
        }
        
        # 在第一个 import 语句之后添加 dynamic 配置
        # 查找第一个非注释、非空行的 import 语句
        $lines = $content -split "`r?`n"
        $insertIndex = -1
        $inMultiLineComment = $false
        
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i].Trim()
            
            # 跳过多行注释
            if ($line -match '/\*') {
                $inMultiLineComment = $true
            }
            if ($inMultiLineComment) {
                if ($line -match '\*/') {
                    $inMultiLineComment = $false
                }
                continue
            }
            
            # 跳过单行注释和空行
            if ($line -match '^//' -or $line -eq '') {
                continue
            }
            
            # 找到第一个 import 语句后的位置
            if ($line -match '^import\s') {
                # 继续查找，直到找到所有连续的 import 语句结束
                for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                    $nextLine = $lines[$j].Trim()
                    if ($nextLine -eq '' -or $nextLine -match '^//' -or $nextLine -match '/\*') {
                        continue
                    }
                    if ($nextLine -notmatch '^import\s') {
                        $insertIndex = $j
                        break
                    }
                }
                if ($insertIndex -eq -1) {
                    $insertIndex = $lines.Count
                }
                break
            }
        }
        
        if ($insertIndex -eq -1) {
            # 如果没有找到 import 语句，在文件开头添加
            $insertIndex = 0
            # 跳过文件开头的注释
            for ($i = 0; $i -lt $lines.Count; $i++) {
                $line = $lines[$i].Trim()
                if ($line -ne '' -and $line -notmatch '^//' -and $line -notmatch '/\*') {
                    $insertIndex = $i
                    break
                }
            }
        }
        
        # 插入 dynamic 配置
        $newLines = @()
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($i -eq $insertIndex) {
                # 添加空行和 dynamic 配置
                $newLines += ''
                $newLines += 'export const dynamic = ''force-dynamic'';'
            }
            $newLines += $lines[$i]
        }
        
        # 写回文件
        $newContent = $newLines -join "`r`n"
        Set-Content -Path $file.FullName -Value $newContent -NoNewline
        
        Write-Host "已修改: $($file.FullName.Replace((Get-Location).Path + '\', ''))" -ForegroundColor Green
        $modified++
    }
    catch {
        Write-Host "错误: $($file.FullName.Replace((Get-Location).Path + '\', '')) - $_" -ForegroundColor Red
        $errors++
    }
}

Write-Host "`n总结:" -ForegroundColor Cyan
Write-Host "  已修改: $modified" -ForegroundColor Green
Write-Host "  已跳过: $skipped" -ForegroundColor Yellow
Write-Host "  错误: $errors" -ForegroundColor Red
Write-Host "  总计: $($files.Count)" -ForegroundColor Cyan

