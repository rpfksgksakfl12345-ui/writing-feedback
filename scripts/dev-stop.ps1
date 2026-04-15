$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[dev:stop] $Message"
}

function Fail {
  param([string]$Message)
  Write-Error "[dev:stop] $Message"
  exit 1
}

function Get-NpmCommand {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npm) {
    return $npm.Source
  }

  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    return $npm.Source
  }

  Fail "npm was not found in PATH. Install Node.js/npm, then run npm run dev:stop again."
}

function Assert-RepoRoot {
  param([string]$RepoRoot)

  $packageJsonPath = Join-Path $RepoRoot "package.json"
  if (-not (Test-Path $packageJsonPath -PathType Leaf)) {
    Fail "package.json was not found. Run this from the writing-feedback repo root."
  }

  try {
    $packageJson = Get-Content -Raw $packageJsonPath | ConvertFrom-Json
  } catch {
    Fail "package.json could not be parsed. Fix package.json, then run npm run dev:stop again."
  }

  if ($packageJson.name -ne "writing-feedback") {
    Fail "This does not look like the writing-feedback repo root. Current package name: $($packageJson.name)"
  }
}

function Get-PortOwnerText {
  param([int]$Port)

  $ownerProcessIds = @()

  try {
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    foreach ($listener in $listeners) {
      $ownerProcessIds += [int]$listener.OwningProcess
    }
  } catch {
    $netstatOutput = & netstat.exe -ano 2>$null
    foreach ($line in $netstatOutput) {
      $match = [regex]::Match($line, "^\s*TCP\s+\S+:(?<port>\d+)\s+\S+\s+LISTENING\s+(?<processId>\d+)\s*$")
      if ($match.Success -and [int]$match.Groups["port"].Value -eq $Port) {
        $ownerProcessIds += [int]$match.Groups["processId"].Value
      }
    }
  }

  $ownerProcessIds = @($ownerProcessIds | Sort-Object -Unique)
  if ($ownerProcessIds.Count -eq 0) {
    return $null
  }

  $owners = @()
  foreach ($processId in $ownerProcessIds) {
    $processName = "unknown"
    $processPath = $null
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      $processName = $process.ProcessName
      $processPath = $process.Path
    } catch {
      $processName = "unknown"
    }

    $pathText = ""
    if (-not [string]::IsNullOrWhiteSpace($processPath)) {
      $pathText = " - $processPath"
    }

    $owners += "$processId ($processName)$pathText"
  }

  return (($owners | Sort-Object -Unique) -join ", ")
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
Assert-RepoRoot $repoRoot

$stateDir = Join-Path $repoRoot ".dev"
$pidFile = Join-Path $stateDir "dev-server.pid"

Write-Step "repo root confirmed: $repoRoot"

if (Test-Path $pidFile -PathType Leaf) {
  $pidText = (Get-Content -Raw $pidFile).Trim()
  $devPid = 0
  if ([int]::TryParse($pidText, [ref]$devPid)) {
    $devProcess = Get-Process -Id $devPid -ErrorAction SilentlyContinue
    if ($devProcess) {
      Write-Step "stopping dev server process tree (PID $devPid)..."
      $taskkillOutput = & taskkill.exe /PID $devPid /T /F 2>&1
      $taskkillExit = $LASTEXITCODE
      $taskkillOutput | ForEach-Object { Write-Host $_ }
      if ($taskkillExit -ne 0) {
        Write-Warning "taskkill could not stop PID $devPid. You may need to close the terminal or stop the process manually."
      } else {
        Write-Step "dev server process stopped"
      }
    } else {
      Write-Step "saved dev server PID is not running"
    }
  } else {
    Write-Warning "dev server PID file exists but does not contain a valid process id"
  }

  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
} else {
  Write-Step "no dev server PID file found"
  Write-Host "If npm run dev is running in a terminal, press Ctrl+C in that terminal."
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Warning "Docker CLI was not found, so db:down was skipped."
} else {
  $dockerInfo = & docker info 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Docker is not ready, so db:down was skipped. Start Docker Desktop and run npm run dev:stop again if Postgres is still running."
  } else {
    $npm = Get-NpmCommand
    Write-Step "DB stopping with existing npm run db:down..."
    & $npm run db:down
    if ($LASTEXITCODE -ne 0) {
      Fail "npm run db:down failed. Check Docker Desktop and docker-compose.yml."
    }
    Write-Step "DB stop command completed"
  }
}

$remainingPorts = @()
foreach ($port in @(3000, 4000)) {
  $ownerText = Get-PortOwnerText $port
  if ($ownerText) {
    $remainingPorts += "port $port is still in use by $ownerText"
  }
}

if ($remainingPorts.Count -gt 0) {
  Write-Warning "Some development ports are still in use."
  foreach ($remainingPort in $remainingPorts) {
    Write-Host "  - $remainingPort"
  }
}

Write-Step "done"
