# One command from the dev machine to production:
#   npm run ship -- "Mô tả thay đổi"   commit everything, push, then follow GitHub until the VPS runs it
#   npm run ship                       push commits already made, then follow GitHub
# GitHub Actions checks, builds and deploys (.github/workflows/deploy.yml); this script only reports.
param([string]$Message)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8

function Fail([string]$text) {
  Write-Host "❌ $text" -ForegroundColor Red
  exit 1
}

Set-Location (Split-Path $PSScriptRoot)
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Fail 'Chưa cài GitHub CLI. Chạy: winget install GitHub.cli, mở lại terminal, rồi gh auth login'
}
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') { Fail "Đang ở nhánh $branch. Chỉ ship từ main." }

if (git status --porcelain) {
  if (-not $Message) { Fail 'Có thay đổi chưa commit. Chạy: npm run ship -- "Mô tả thay đổi"' }
  git add -A
  git commit -q -m $Message
  if ($LASTEXITCODE -ne 0) { Fail 'Commit không thành công' }
}

git push -q origin main
if ($LASTEXITCODE -ne 0) { Fail 'Push lên GitHub không thành công (thử git pull trước?)' }
$sha = git rev-parse HEAD
$title = git log -1 --format='%h %s'
Write-Host "⬆️  Đã push $title. GitHub đang kiểm tra, build và deploy..." -ForegroundColor Cyan

# The run shows up a few seconds after the push
$id = $null
for ($i = 0; $i -lt 30 -and -not $id; $i++) {
  Start-Sleep -Seconds 2
  $id = gh run list --workflow deploy.yml --commit $sha --limit 1 --json databaseId --jq '.[0].databaseId'
}
if (-not $id) { Fail "Không thấy lần chạy GitHub Actions cho $($sha.Substring(0, 7))" }

gh run watch $id --exit-status --interval 5
if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Đã lên production: $title" -ForegroundColor Green
  exit 0
}
gh run view $id --log-failed | Select-Object -Last 40
Fail "Chưa lên production, site vẫn chạy bản cũ. Xem chi tiết: gh run view $id --web"
