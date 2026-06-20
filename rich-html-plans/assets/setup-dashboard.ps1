<#
.SYNOPSIS
  One-time setup for the optional "Live Plans Dashboard" (rich-html-plans).

.DESCRIPTION
  Enables the opt-in dashboard: creates the central registry, seeds it with any plans
  found under the given roots, registers a per-user logon task so the zero-dependency
  Node server auto-starts and survives reboots, exposes it privately over Tailscale, and
  prints the URL to open on your phone (which must be on the same tailnet).

  Re-running is safe (idempotent): the task is replaced (-Force) and tailscale serve is
  declarative. Nothing here is destructive. Use -Uninstall to remove the task + serve rule.

.PARAMETER Port
  TCP port for the local server (default 7878).

.PARAMETER Root
  One or more folders to scan recursively for existing Plans/*-plan.html to seed the
  registry. Defaults to the current directory.

.PARAMETER Uninstall
  Remove the logon task and the tailscale serve rule for this port. (Leaves the registry.)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File setup-dashboard.ps1 -Root $HOME\Desktop
#>
[CmdletBinding()]
param(
  [int]      $Port = 7878,
  [string[]] $Root = @((Get-Location).Path),
  [switch]   $Uninstall
)

$ErrorActionPreference = 'Stop'
$TaskName   = 'RichHtmlPlansDashboard'
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerPath = Join-Path $ScriptDir 'plans-server.js'
$RegistryJs = Join-Path $ScriptDir 'plans-registry.js'

function Info($m) { Write-Host "  $m" }
function Ok($m)   { Write-Host "OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "!!  $m" -ForegroundColor Yellow }

# Uninstall path
if ($Uninstall) {
  try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Ok "Removed logon task '$TaskName'."
  } catch {
    Warn "No logon task to remove."
  }
  try {
    & tailscale serve --https=443 off 2>$null
    Ok "Cleared tailscale serve (443)."
  } catch {
    Warn "Could not clear tailscale serve (continuing)."
  }
  Write-Host ""
  Write-Host "Uninstalled. The registry at ~/.claude/plans-index.json was left in place."
  return
}

Write-Host ""
Write-Host "=== Live Plans Dashboard - setup ==="
Write-Host ""

# 1. Prerequisites
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw "Node.js not found on PATH. Install Node (https://nodejs.org) and re-run."
}
$nodeVer = & node --version
Ok "Node found: $nodeVer"

if (-not (Test-Path $ServerPath)) {
  throw "plans-server.js not found next to this script."
}

$tsExe = $null
$tsCmd = Get-Command tailscale -ErrorAction SilentlyContinue
if ($tsCmd) {
  $tsExe = $tsCmd.Source
} else {
  $candidate = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
  if (Test-Path $candidate) { $tsExe = $candidate }
}
if ($tsExe) {
  Ok "Tailscale found."
} else {
  Warn "Tailscale CLI not found. The local server will still run, but it won't be"
  Warn "reachable from your phone until Tailscale is installed and you re-run."
}

# 2. Enable + seed the registry
& node $RegistryJs init | ForEach-Object { Info $_ }
$seeded = 0
foreach ($r in $Root) {
  if (-not (Test-Path $r)) {
    Warn "Root not found, skipping: $r"
    continue
  }
  Get-ChildItem -Path $r -Recurse -File -Filter '*-plan.html' -ErrorAction SilentlyContinue |
    Where-Object { $_.DirectoryName -match '[\\/]Plans$' } |
    ForEach-Object {
      & node $RegistryJs add $_.FullName | Out-Null
      $seeded++
    }
}
$rootList = $Root -join ', '
Ok "Registry enabled; seeded $seeded plan(s) from: $rootList"

# 3. Logon auto-start task (per-user; survives reboots)
$nodeExe   = $node.Source
$taskArg   = '"{0}" {1}' -f $ServerPath, $Port
$action    = New-ScheduledTaskAction -Execute $nodeExe -Argument $taskArg
$trigger   = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Ok "Registered logon task '$TaskName' -> node plans-server.js $Port"
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 2
  Ok "Server started (also auto-starts at every logon)."
} catch {
  $msg = $_.Exception.Message
  Warn "Scheduled Task needs admin ($msg). Falling back to a no-admin Startup-folder launcher."
  # No-admin persistence: a tiny .vbs in the per-user Startup folder launches the server
  # hidden at every logon. Survives reboots without elevation.
  $startup = [Environment]::GetFolderPath('Startup')
  $vbsPath = Join-Path $startup 'RichHtmlPlansDashboard.vbs'
  $cmdline = '"{0}" "{1}" {2}' -f $nodeExe, $ServerPath, $Port
  $vbsCmd  = $cmdline -replace '"', '""'
  $vbs     = "Set sh = CreateObject(""WScript.Shell"")`r`nsh.Run ""$vbsCmd"", 0, False`r`n"
  Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII
  Ok "Installed Startup launcher (no admin): $vbsPath"
  Start-Process -WindowStyle Hidden -FilePath $nodeExe -ArgumentList $taskArg
  Ok "Server started (also auto-starts at every logon via Startup folder)."
}

# 4. Expose privately over Tailscale. Verify it actually bound (serve can silently fail
#    with "Serve is not enabled on your tailnet" until HTTPS/Serve is enabled once).
$tsUrl = $null
if ($tsExe) {
  $serveOut    = (& $tsExe serve --bg $Port 2>&1 | Out-String).Trim()
  $serveStatus = (& $tsExe serve status 2>&1 | Out-String)
  if ($serveStatus -match [regex]::Escape("127.0.0.1:$Port")) {
    Ok "tailscale serve active on $Port (tailnet-private; not public funnel)."
    try {
      $statusJson = & $tsExe status --json | ConvertFrom-Json
      $dns = $statusJson.Self.DNSName
      if ($dns) { $tsUrl = 'https://' + $dns.TrimEnd('.') }
    } catch { }
  } else {
    Warn "Tailscale Serve is not active yet. Tailscale said:"
    if ($serveOut) { Write-Host "    $serveOut" }
    Warn "Enable MagicDNS + HTTPS in the admin console, approve Serve, then re-run."
  }
}

# 5. Summary
Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Info "Local:  http://localhost:$Port/"
if ($tsUrl) {
  Write-Host ""
  Write-Host "  Phone (open on a device signed into your tailnet):" -ForegroundColor Cyan
  Write-Host "    $tsUrl/" -ForegroundColor White
} else {
  Warn "No Tailscale URL yet. After 'tailscale up', run: tailscale serve --bg $Port"
}
Write-Host ""
Write-Host "  New plans register automatically. Re-run this script anytime to re-seed."
Write-Host ""
