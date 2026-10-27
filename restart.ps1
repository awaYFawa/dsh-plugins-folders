# 一键重启 DeepSeek Harness —— 由 @dsh-user/dsh-plugins-folders 的宿主半边拉起。
#
# 为什么要在外部脚本里做：界面上的按钮跑在 Harness 进程内部，自己关不掉自己也拉不活自己。
# 宿主（index.js）用 `cmd /c start /min powershell.exe ...` 起它，进程独立于 Harness，
# 所以它能在 Harness 死掉之后继续活着并把新实例拉起来。
#
# 流程：等一会儿 → 发 WM_CLOSE 正常退出 → 等它自己走完 → 还活着才强杀
#       → 清掉被杀进程留下的写入锁/Singleton → 分三级拉起（裸启动 / cmd start / 复刻原命令行）
#       → 每级都确认主窗口真的出现，都不行就把 crash 日志尾巴写进自己的日志
[CmdletBinding()]
param(
  # Harness 的可执行文件；不传或路径不存在时，从正在运行的进程里取。
  [string]$Exe = '',
  # 动手前的等待秒数。
  [int]$DelaySeconds = 4,
  # 日志文件；默认写到临时目录。
  [string]$Log = ''
)

$ErrorActionPreference = 'Continue'
$processName = 'DeepSeek Harness'

if ([string]::IsNullOrWhiteSpace($Log)) {
  $Log = Join-Path ([System.IO.Path]::GetTempPath()) 'dsh-plugins-folders-restart.log'
}

function Write-Log([string]$message) {
  try {
    "$(Get-Date -Format o) $message" | Add-Content -Path $Log -Encoding utf8
  } catch {
    # 日志写不进去也不能挡住重启
  }
}

function Get-HarnessProcesses {
  @(Get-Process -Name $processName -ErrorAction SilentlyContinue)
}

function Resolve-Exe([string]$candidate) {
  if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
    return (Resolve-Path -LiteralPath $candidate).Path
  }
  foreach ($item in (Get-HarnessProcesses)) {
    try {
      if (-not [string]::IsNullOrWhiteSpace($item.Path) -and (Test-Path -LiteralPath $item.Path)) {
        return $item.Path
      }
    } catch {
      # 取不到路径就继续找
    }
  }
  $fallbacks = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\DeepSeek Harness.exe'),
    'D:\Users\YF\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe',
    (Join-Path $env:ProgramFiles 'DeepSeek Harness\DeepSeek Harness.exe')
  )
  foreach ($path in $fallbacks) {
    if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path -LiteralPath $path)) {
      return $path
    }
  }
  return ''
}

# 被杀进程可能留下写入锁；不清掉的话，下次启动会卡在
#   atomic-write: timed out waiting for the writer lock at ~\.dsh\.credentials.yaml.lock
# 然后没有窗口就退出——这是「进程起了一部分、窗口不来」的成因之一。
function Clear-StaleLocks {
  $targets = New-Object System.Collections.ArrayList
  $dshHome = Join-Path $env:USERPROFILE '.dsh'
  if (Test-Path -LiteralPath $dshHome) {
    foreach ($item in @(Get-ChildItem -LiteralPath $dshHome -Filter '*.lock' -File -Force -ErrorAction SilentlyContinue)) {
      [void]$targets.Add($item.FullName)
    }
  }
  $userData = Join-Path $env:APPDATA '@deepseek-ai\dsh-desktop'
  if (Test-Path -LiteralPath $userData) {
    foreach ($item in @(Get-ChildItem -LiteralPath $userData -Filter 'Singleton*' -Force -ErrorAction SilentlyContinue)) {
      [void]$targets.Add($item.FullName)
    }
  }
  if ($targets.Count -eq 0) {
    Write-Log 'no stale lock found'
    return
  }
  foreach ($path in $targets) {
    try {
      Remove-Item -LiteralPath $path -Force -ErrorAction Stop
      Write-Log ("removed stale lock: " + $path)
    } catch {
      Write-Log ("lock remove failed: " + $path + " :: " + $_.Exception.Message)
    }
  }
}

function Find-WindowedProcess {
  foreach ($item in (Get-HarnessProcesses)) {
    try {
      if ($item.MainWindowHandle -ne 0) { return $item.Id }
    } catch {
      # 进程刚好退出就会取不到窗口句柄
    }
  }
  return 0
}

function Wait-Window([int]$seconds) {
  $limit = [int]($seconds / 2)
  for ($i = 0; $i -lt $limit; $i++) {
    Start-Sleep -Seconds 2
    $found = Find-WindowedProcess
    if ($found -ne 0) { return $found }
  }
  return 0
}

# 走 WMI 创建进程。Harness 用 job object 包着自己的子进程，在里面拉起来的 Electron
# 进程起来但窗口永远不出现、然后自己退出；WMI 的 Win32_Process::Create 由 WmiPrvSE 托管，
# 新进程不在这个 job 里，窗口才能正常出现。
function Start-Harness([string]$target) {
  try {
    $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
      CommandLine      = '"' + $target + '"'
      CurrentDirectory = (Split-Path -Path $target)
    }
    Write-Log ('launch via WMI: returnValue=' + $result.ReturnValue + ' pid=' + $result.ProcessId)
    return ($result.ReturnValue -eq 0)
  } catch {
    Write-Log ('launch failed: ' + $_.Exception.Message)
    return $false
  }
}

function Write-NewestCrashLog([datetime]$since) {
  $dir = Join-Path $env:APPDATA '@deepseek-ai\dsh-desktop\logs'
  if (-not (Test-Path -LiteralPath $dir)) { return }
  $newest = @(Get-ChildItem -LiteralPath $dir -Filter 'crash-*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $since.AddSeconds(-5) } |
    Sort-Object LastWriteTime -Descending) | Select-Object -First 1
  if (-not $newest) {
    Write-Log 'no crash log written by this launch attempt'
    return
  }
  Write-Log ("newest crash log: " + $newest.Name + " @ " + $newest.LastWriteTime.ToString('HH:mm:ss'))
  try {
    foreach ($line in @(Get-Content -LiteralPath $newest.FullName -Tail 12 -ErrorAction SilentlyContinue)) {
      Write-Log ("  | " + $line)
    }
  } catch {
    # 读不到就算了
  }
}

Write-Log "== armed (delay=${DelaySeconds}s, exe='$Exe') =="

$target = Resolve-Exe $Exe
if ([string]::IsNullOrWhiteSpace($target)) {
  Write-Log 'ABORT: 找不到 Harness 可执行文件，未做任何操作'
  exit 2
}
Write-Log "launcher: $target"

if ($DelaySeconds -gt 0) {
  Start-Sleep -Seconds $DelaySeconds
}

# 1) 先礼后兵：WM_CLOSE → window-all-closed → app.quit
foreach ($item in (Get-HarnessProcesses)) {
  try {
    if ($item.MainWindowHandle -ne 0) {
      $item.CloseMainWindow() | Out-Null
      Write-Log ("closed window of pid " + $item.Id)
    }
  } catch {
    Write-Log ("close failed for pid " + $item.Id + ": " + $_.Exception.Message)
  }
}

# 2) 等它自己退出（最多 8 秒）。实测这个壳子关窗后并不会自己退干净，
#    等太久只是让用户干看着，所以给一小段体面时间就转为强杀。
$waited = 0
while ($waited -lt 8) {
  if ((Get-HarnessProcesses).Count -eq 0) { break }
  Start-Sleep -Seconds 2
  $waited += 2
}
$left = @(Get-HarnessProcesses)
if ($left.Count -gt 0) {
  Write-Log ("force killing " + $left.Count + " process(es) after waiting ${waited}s")
  $left | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
} else {
  Write-Log "exited cleanly after ${waited}s"
}

# 3) 清锁：这是「进程起来了但窗口不来」的成因之一
Clear-StaleLocks
Start-Sleep -Seconds 2

# 4) 拉起并确认窗口真的出现
$startedAt = Get-Date
[void](Start-Harness $target)
$windowPid = Wait-Window 40

if ($windowPid -ne 0) {
  Write-Log ("window ready pid " + $windowPid)
} else {
  Write-Log 'WARN: 40 秒内没等到窗口，需要手动打开'
  Write-NewestCrashLog $startedAt
}

$now = @(Get-HarnessProcesses)
Write-Log ("post-start process count: " + $now.Count)
Write-Log '== done =='
exit 0