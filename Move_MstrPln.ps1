
# 스크립트 제목: MasterPlan 프로젝트 실행 스크립트 (모든 옵션 새 창 실행)

# =======================================================
# 📌 경로 설정
# =======================================================
# 스크립트 파일이 위치한 디렉토리의 절대 경로를 저장합니다. (스크립트 복귀 위치)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# MasterPlan 프로젝트 경로
$basePath = "D:\NewSoft\masterplan" 
# =======================================================

# 사용자에게 선택 옵션 표시
Write-Host "========================================"
Write-Host "MasterPlan 실행 스크립트"
Write-Host "========================================"
Write-Host "1. Backend: run_api.ps1 실행 (새 창, 복귀)"
Write-Host "2. Frontend: npm run dev 실행 (새 창, 복귀)"
Write-Host "3. Chrome (DevTools 모드) 실행"
Write-Host "4. $basePath 폴더에서 Cursor 실행"
Write-Host "5. 종료"                           
Write-Host "========================================"

$choice = Read-Host "원하는 작업 번호를 입력하세요"


# 입력된 번호에 따라 작업 실행
switch ($choice) {
    1 {
        $targetDir = Join-Path -Path $basePath -ChildPath "backend"
        Write-Host "1. [새 창] Backend 폴더에서 'run_api.ps1'을 실행합니다." -ForegroundColor Green
        
        # 새 창 실행 명령: 폴더 이동 후 run_api.ps1 실행
        Start-Process -FilePath powershell.exe -ArgumentList "-NoExit -Command Set-Location -Path '$targetDir'; & '.\run_api.ps1'" -WorkingDirectory $targetDir
        
        # 원래 위치로 복귀
        Set-Location -Path $ScriptDir
        exit
    }
    2 {
        $targetDir = Join-Path -Path $basePath -ChildPath "frontend"
        Write-Host "2. [새 창] Frontend 폴더에서 'npm run dev'를 실행합니다." -ForegroundColor Green
        
        # 새 창 실행 명령: 폴더 이동 후 npm run dev 실행
        Start-Process -FilePath powershell.exe -ArgumentList "-NoExit -Command Set-Location -Path '$targetDir'; npm run dev" -WorkingDirectory $targetDir
        
        # 원래 위치로 복귀
        Set-Location -Path $ScriptDir
        exit
    }
    3 {
        Write-Host "3. Chrome (DevTools 모드)를 실행합니다." -ForegroundColor Green
        
        # Chrome DevTools 모드 실행 (http://localhost:3000 주소로 열기)
        Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" `
            -ArgumentList '--remote-debugging-port=9222', '--user-data-dir="C:\ChromeDev"', 'http://localhost:3000'
        
        exit
    }
    4 {
        Write-Host "4. $basePath 폴더에서 Cursor를 실행합니다." -ForegroundColor Green
        
        # Cursor를 현재 창과 분리된 프로세스로 실행 (PowerShell 창 표시 없이)
        # -NoNewWindow: Cursor를 실행하는 동안 새 콘솔 창을 띄우지 않습니다.
        Start-Process -FilePath cursor -ArgumentList "$basePath" -NoNewWindow
        
        # Start-Process는 현재 위치에 영향을 주지 않으므로 Set-Location 복귀는 불필요합니다.
        exit
    }
    5 {
        Write-Host "종료합니다." -ForegroundColor Yellow
        exit
    }
    default {
        Write-Host "잘못된 입력입니다. 1~5 사이의 숫자를 입력해주세요." -ForegroundColor Red
    }
}

# 스크립트 실행 후 메인 창의 상태 표시
if ($choice -in "1", "2", "3", "4") {
    Write-Host "`n작업이 새 창에서 실행되었으며, 현재 위치는 스크립트 폴더($ScriptDir)로 복귀했습니다." -ForegroundColor Cyan
    Write-Host "이 창에서 곧바로 다음 작업을 선택하거나 'exit'을 입력하여 종료할 수 있습니다."
}
elseif ($choice -eq "5") {
    Write-Host "`n스크립트 실행이 종료되었습니다." -ForegroundColor Cyan
}