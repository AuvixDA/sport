# ============================================================
# autosync.ps1
# Следит за папкой и автоматически коммитит + пушит изменения на GitHub.
# ============================================================

$repoPath = "C:\Users\Lenovo 2.0\Documents\1Vajnoe\sport"
$intervalSeconds = 60

Set-Location $repoPath

Write-Host "Автосинхронизация запущена для: $repoPath"
Write-Host "Проверка каждые $intervalSeconds сек. Окно можно свернуть, не закрывай."

while ($true) {
    Set-Location $repoPath
    git pull --rebase --quiet 2>$null
    git add -A

    $status = git status --porcelain
    if ($status) {
        $msg = "auto sync " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        git commit -m "$msg" | Out-Null
        git push | Out-Null
        Write-Host "$(Get-Date -Format 'HH:mm:ss') — изменения обновлены на GitHub"
    }

    Start-Sleep -Seconds $intervalSeconds
}