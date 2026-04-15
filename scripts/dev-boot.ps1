$ErrorActionPreference = "Stop"

$WebPort = 3000
$ApiPort = 4000
$WebUrl = "http://localhost:$WebPort"
$ApiUrl = "http://localhost:$ApiPort"
$ApiHealthUrl = "$ApiUrl/health"
$RequiredPorts = @($WebPort, $ApiPort)
$PostgresContainer = "writing-feedback-postgres"

function Write-Step {
  param([string]$Message)
  Write-Host "[dev:boot] $Message"
}

function Write-Detail {
  param([string]$Message)
  Write-Host "  - $Message"
}

function Fail {
  param(
    [string]$Stage,
    [string]$Message,
    [string]$Next
  )

  Write-Host "[dev:boot][$Stage] ERROR: $Message" -ForegroundColor Red
  if (-not [string]::IsNullOrWhiteSpace($Next)) {
    Write-Host "Next: $Next"
  }
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

  Fail "preflight" "npm was not found in PATH." "Install Node.js/npm, then run npm run dev:boot again."
}

function Assert-RepoRoot {
  param([string]$RepoRoot)

  $packageJsonPath = Join-Path $RepoRoot "package.json"
  if (-not (Test-Path $packageJsonPath -PathType Leaf)) {
    Fail "preflight" "package.json was not found." "Run this from the writing-feedback repo root."
  }

  try {
    $packageJson = Get-Content -Raw $packageJsonPath | ConvertFrom-Json
  } catch {
    Fail "preflight" "package.json could not be parsed." "Fix package.json, then run npm run dev:boot again."
  }

  if ($packageJson.name -ne "writing-feedback") {
    Fail "preflight" "This does not look like the writing-feedback repo root. Current package name: $($packageJson.name)" "Run this from the writing-feedback repo root."
  }
}

function ConvertTo-OneLine {
  param(
    [AllowNull()][string]$Text,
    [int]$MaxLength = 180
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $value = ($Text -replace "\s+", " ").Trim()
  if ($value.Length -gt $MaxLength) {
    return "$($value.Substring(0, $MaxLength))..."
  }

  return $value
}

function Invoke-NativeCommand {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [int]$TimeoutSeconds = 30
  )

  try {
    $job = Start-Job -ScriptBlock {
      param(
        [string]$NativeFilePath,
        [string[]]$NativeArgumentList,
        [string]$NativeWorkingDirectory
      )

      Set-Location $NativeWorkingDirectory
      $output = & $NativeFilePath @NativeArgumentList 2>&1
      $exitCode = $LASTEXITCODE
      $outputText = (($output | ForEach-Object { "$_" }) -join [Environment]::NewLine)

      [pscustomobject]@{
        ExitCode = $exitCode
        Output = $outputText
      }
    } -ArgumentList $FilePath, $ArgumentList, $repoRoot

    $completedJob = Wait-Job -Job $job -Timeout $TimeoutSeconds
    if (-not $completedJob) {
      Stop-Job -Job $job -ErrorAction SilentlyContinue
      Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
      return [pscustomobject]@{
        ExitCode = 124
        TimedOut = $true
        Output = "Timed out after $TimeoutSeconds seconds."
      }
    }

    $result = Receive-Job -Job $job
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    if (-not $result) {
      return [pscustomobject]@{
        ExitCode = 1
        TimedOut = $false
        Output = "Command produced no result."
      }
    }

    return [pscustomobject]@{
      ExitCode = $result.ExitCode
      TimedOut = $false
      Output = $result.Output
    }
  } catch {
    if ($job) {
      Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }

    return [pscustomobject]@{
      ExitCode = 1
      TimedOut = $false
      Output = $_.Exception.Message
    }
  }
}

function Get-ProcessCommandLine {
  param([int]$ProcessId)

  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    if ($process) {
      return $process.CommandLine
    }
  } catch {
  }

  return $null
}

function Get-ParentProcessId {
  param([int]$ProcessId)

  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    if ($process) {
      return [int]$process.ParentProcessId
    }
  } catch {
  }

  return $null
}

function Test-StringContainsPath {
  param(
    [AllowNull()][string]$Text,
    [string]$Path
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  return $Text.IndexOf($Path, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Test-IsProjectOwnedProcess {
  param(
    [int]$ProcessId,
    [string]$RepoRoot,
    [int]$RootProcessId
  )

  $seen = @{}
  $currentProcessId = $ProcessId

  for ($i = 0; $i -lt 12 -and $currentProcessId -gt 0; $i++) {
    if ($RootProcessId -gt 0 -and $currentProcessId -eq $RootProcessId) {
      return $true
    }

    $key = [string]$currentProcessId
    if ($seen.ContainsKey($key)) {
      break
    }
    $seen[$key] = $true

    $commandLine = Get-ProcessCommandLine -ProcessId $currentProcessId
    if (Test-StringContainsPath -Text $commandLine -Path $RepoRoot) {
      return $true
    }

    $parentProcessId = Get-ParentProcessId -ProcessId $currentProcessId
    if (-not $parentProcessId -or $parentProcessId -le 0) {
      break
    }

    $currentProcessId = $parentProcessId
  }

  return $false
}

function Get-ProcessSummary {
  param([int]$ProcessId)

  $processName = "unknown"
  $processPath = $null

  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $processName = $process.ProcessName
    $processPath = $process.Path
  } catch {
  }

  return [pscustomobject]@{
    ProcessName = $processName
    Path = $processPath
  }
}

function Get-PortOwners {
  param(
    [int]$Port,
    [int]$RootProcessId
  )

  $ownerProcessIds = @()

  try {
    $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    foreach ($connection in $connections) {
      $ownerProcessIds += [int]$connection.OwningProcess
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

  $owners = @()
  foreach ($ownerProcessId in @($ownerProcessIds | Sort-Object -Unique)) {
    if ($ownerProcessId -le 0) {
      continue
    }

    $summary = Get-ProcessSummary -ProcessId $ownerProcessId
    $owners += [pscustomobject]@{
      Port = $Port
      ProcessId = $ownerProcessId
      ProcessName = $summary.ProcessName
      Path = $summary.Path
      ProjectOwned = (Test-IsProjectOwnedProcess -ProcessId $ownerProcessId -RepoRoot $repoRoot -RootProcessId $RootProcessId)
    }
  }

  return @($owners)
}

function Get-RequiredPortOwners {
  param([int]$RootProcessId)

  $owners = @()
  foreach ($port in $RequiredPorts) {
    $owners += Get-PortOwners -Port $port -RootProcessId $RootProcessId
  }

  return @($owners)
}

function Format-PortOwner {
  param($Owner)

  $projectText = ""
  if ($Owner.ProjectOwned) {
    $projectText = " [writing-feedback]"
  }

  $pathText = ""
  if (-not [string]::IsNullOrWhiteSpace($Owner.Path)) {
    $pathText = " - $($Owner.Path)"
  }

  return "port $($Owner.Port) -> PID $($Owner.ProcessId) ($($Owner.ProcessName))$projectText$pathText"
}

function Write-PortOwners {
  param([object[]]$Owners)

  foreach ($owner in @($Owners | Sort-Object Port, ProcessId)) {
    Write-Detail (Format-PortOwner -Owner $owner)
  }
}

function Test-HttpOk {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
  } catch {
    return $false
  }
}

function Wait-ForDevServers {
  param(
    [int]$ProcessId,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $webReady = $false
  $apiReady = $false

  while ((Get-Date) -lt $deadline) {
    if ($ProcessId -gt 0) {
      $runningProcess = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
      if (-not $runningProcess) {
        return [pscustomobject]@{
          Ready = $false
          WebReady = $webReady
          ApiReady = $apiReady
          Reason = "dev process PID $ProcessId exited"
        }
      }
    }

    if (-not $webReady) {
      $webReady = Test-HttpOk -Url $WebUrl
    }
    if (-not $apiReady) {
      $apiReady = Test-HttpOk -Url $ApiHealthUrl
    }

    if ($webReady -and $apiReady) {
      return [pscustomobject]@{
        Ready = $true
        WebReady = $true
        ApiReady = $true
        Reason = "ready"
      }
    }

    Start-Sleep -Seconds 2
  }

  return [pscustomobject]@{
    Ready = $false
    WebReady = $webReady
    ApiReady = $apiReady
    Reason = "timed out after $TimeoutSeconds seconds"
  }
}

function Show-Endpoints {
  Write-Host "Open: $WebUrl"
  Write-Host "API:  $ApiUrl"
  Write-Host "API health: $ApiHealthUrl"
  Write-Host "Logs: .dev/dev-server.out.log and .dev/dev-server.err.log"
}

function Show-LogTail {
  if (Test-Path $stdoutFile -PathType Leaf) {
    Write-Host "Last stdout lines:"
    Get-Content -Tail 60 $stdoutFile
  }

  if (Test-Path $stderrFile -PathType Leaf) {
    $stderrTail = @(Get-Content -Tail 60 $stderrFile)
    if ($stderrTail.Count -gt 0) {
      Write-Host "Last stderr lines:"
      $stderrTail | ForEach-Object { Write-Host $_ }
    }
  }
}

function Get-SavedDevPid {
  if (-not (Test-Path $pidFile -PathType Leaf)) {
    return 0
  }

  $pidText = (Get-Content -Raw $pidFile).Trim()
  $savedProcessId = 0
  if ([int]::TryParse($pidText, [ref]$savedProcessId)) {
    return $savedProcessId
  }

  Write-Warning "dev server PID file exists but does not contain a valid process id. Removing stale PID file."
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  return 0
}

function Ensure-DockerReady {
  param([string]$DockerPath)

  Write-Step "checking Docker..."
  $dockerInfo = Invoke-NativeCommand -FilePath $DockerPath -ArgumentList @("info", "--format", "{{.ServerVersion}}") -TimeoutSeconds 12
  if ($dockerInfo.ExitCode -eq 0) {
    Write-Step "Docker is ready"
    return
  }

  $dockerOutput = ConvertTo-OneLine -Text $dockerInfo.Output
  if (-not [string]::IsNullOrWhiteSpace($dockerOutput)) {
    Write-Warning "Docker is not ready yet: $dockerOutput"
  } else {
    Write-Warning "Docker is not ready yet."
  }

  $dockerDesktopPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  $dockerDesktop = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
  if (-not $dockerDesktop -and (Test-Path $dockerDesktopPath -PathType Leaf)) {
    Write-Step "Docker Desktop is not running; starting Docker Desktop..."
    try {
      Start-Process -FilePath $dockerDesktopPath | Out-Null
    } catch {
      Write-Warning "Could not start Docker Desktop automatically: $($_.Exception.Message)"
    }
  } else {
    Write-Step "waiting for Docker Desktop to finish starting..."
  }

  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $dockerInfo = Invoke-NativeCommand -FilePath $DockerPath -ArgumentList @("info", "--format", "{{.ServerVersion}}") -TimeoutSeconds 8
    if ($dockerInfo.ExitCode -eq 0) {
      Write-Step "Docker is ready"
      return
    }
  }

  $lastOutput = ConvertTo-OneLine -Text $dockerInfo.Output
  if ([string]::IsNullOrWhiteSpace($lastOutput)) {
    $lastOutput = "Docker API did not become ready."
  }

  Fail "docker" $lastOutput "Start Docker Desktop, wait until it finishes starting, then run npm run dev:boot again. If Docker Desktop is already open, restart it or check Docker Desktop Service."
}

function Ensure-DockerCompose {
  param([string]$DockerPath)

  $composeVersion = Invoke-NativeCommand -FilePath $DockerPath -ArgumentList @("compose", "version") -TimeoutSeconds 20
  if ($composeVersion.ExitCode -ne 0) {
    $output = ConvertTo-OneLine -Text $composeVersion.Output
    Fail "docker" "Docker Compose is not available through 'docker compose'. $output" "Update Docker Desktop, then run npm run dev:boot again."
  }
}

function Wait-ForPostgresReady {
  param([string]$DockerPath)

  Write-Step "waiting for Postgres container health..."
  $deadline = (Get-Date).AddSeconds(75)
  $lastStatus = "unknown"

  while ((Get-Date) -lt $deadline) {
    $inspect = Invoke-NativeCommand `
      -FilePath $DockerPath `
      -ArgumentList @("inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", $PostgresContainer) `
      -TimeoutSeconds 10

    if ($inspect.ExitCode -eq 0) {
      $lastStatus = (ConvertTo-OneLine -Text $inspect.Output)
      if ($lastStatus -eq "healthy" -or $lastStatus -eq "running") {
        Write-Step "Postgres is ready ($lastStatus)"
        return
      }

      if ($lastStatus -eq "unhealthy") {
        Fail "db" "Postgres container is unhealthy." "Run npm run db:logs and inspect the database logs."
      }
    } else {
      $lastStatus = ConvertTo-OneLine -Text $inspect.Output
    }

    Start-Sleep -Seconds 2
  }

  Fail "db" "Postgres did not become ready in time. Last status: $lastStatus" "Run npm run db:logs, then retry npm run dev:boot."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$originalLocation = (Get-Location).Path
Set-Location $repoRoot
Assert-RepoRoot $repoRoot

$stateDir = Join-Path $repoRoot ".dev"
$pidFile = Join-Path $stateDir "dev-server.pid"
$stdoutFile = Join-Path $stateDir "dev-server.out.log"
$stderrFile = Join-Path $stateDir "dev-server.err.log"

if (-not (Test-Path $stateDir -PathType Container)) {
  New-Item -ItemType Directory -Path $stateDir | Out-Null
}

Write-Step "preflight: repo root confirmed: $repoRoot"
if ($originalLocation -ne $repoRoot) {
  Write-Warning "Current directory was $originalLocation. Switched to repo root."
}

$existingProcessId = Get-SavedDevPid
if ($existingProcessId -gt 0) {
  $existingProcess = Get-Process -Id $existingProcessId -ErrorAction SilentlyContinue
  if ($existingProcess) {
    Write-Step "found saved dev process (PID $existingProcessId); checking web/api readiness..."
    $existingReadiness = Wait-ForDevServers -ProcessId $existingProcessId -TimeoutSeconds 45
    if ($existingReadiness.Ready) {
      Write-Step "dev servers are already running"
      Show-Endpoints
      exit 0
    }

    Write-Warning "Saved dev process is running, but readiness checks did not pass: $($existingReadiness.Reason)"
    Write-Detail "web ready: $($existingReadiness.WebReady)"
    Write-Detail "api ready: $($existingReadiness.ApiReady)"
    $owners = @(Get-RequiredPortOwners -RootProcessId $existingProcessId)
    if ($owners.Count -gt 0) {
      Write-Step "current required port owners:"
      Write-PortOwners -Owners $owners
    }
    Show-LogTail
    Fail "existing-dev" "A previous dev process is still running but did not become ready." "Run npm run dev:stop, then run npm run dev:boot again."
  }

  Write-Step "removing stale PID file for non-running process PID $existingProcessId"
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

$envPath = Join-Path $repoRoot "apps\api\.env"
if (-not (Test-Path $envPath -PathType Leaf)) {
  Fail "env" "Missing apps/api/.env." "Create it from apps/api/.env.example, keep your local values, then run npm run dev:boot again."
}
Write-Step "preflight: env file exists: apps/api/.env"

$npm = Get-NpmCommand
Write-Step "preflight: npm found"

$portOwners = @(Get-RequiredPortOwners -RootProcessId 0)
if ($portOwners.Count -gt 0) {
  Write-Warning "Required development ports are already in use."
  Write-PortOwners -Owners $portOwners

  $externalOwners = @($portOwners | Where-Object { -not $_.ProjectOwned })
  $webAlreadyReady = Test-HttpOk -Url $WebUrl
  $apiAlreadyReady = Test-HttpOk -Url $ApiHealthUrl

  if ($externalOwners.Count -eq 0 -and $webAlreadyReady -and $apiAlreadyReady) {
    Write-Step "writing-feedback appears to be already responding; not starting a duplicate dev server"
    Show-Endpoints
    exit 0
  }

  if ($externalOwners.Count -eq 0) {
    Fail "port-check" "Ports are held by writing-feedback processes, but web/api readiness checks failed." "Close the old dev terminal or stop the listed PIDs, then run npm run dev:boot again."
  }

  Fail "port-check" "Port 3000 or 4000 is held by another process." "Stop the listed process or free the port, then run npm run dev:boot again."
}
Write-Step "preflight: ports 3000 and 4000 are free"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Fail "docker" "Docker CLI was not found in PATH." "Install Docker Desktop, start it, then run npm run dev:boot again."
}

Ensure-DockerReady -DockerPath $docker.Source
Ensure-DockerCompose -DockerPath $docker.Source

Write-Step "DB starting with existing npm run db:up..."
& $npm run db:up
if ($LASTEXITCODE -ne 0) {
  Fail "db" "npm run db:up failed." "Check Docker Desktop and docker-compose.yml, then run npm run dev:boot again."
}
Write-Step "DB start command completed"
Wait-ForPostgresReady -DockerPath $docker.Source

Remove-Item -LiteralPath $stdoutFile, $stderrFile -Force -ErrorAction SilentlyContinue

Write-Step "starting web/api dev servers with existing npm run dev..."
$devProcess = Start-Process `
  -FilePath $npm `
  -ArgumentList @("run", "dev") `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $stdoutFile `
  -RedirectStandardError $stderrFile `
  -PassThru

Set-Content -Path $pidFile -Value $devProcess.Id -Encoding ASCII
Write-Step "dev server process started (PID $($devProcess.Id)); waiting for web/api readiness..."

$readiness = Wait-ForDevServers -ProcessId $devProcess.Id -TimeoutSeconds 90
if (-not $readiness.Ready) {
  if ($readiness.Reason -like "*exited*") {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  }

  Write-Warning "Dev servers did not become ready: $($readiness.Reason)"
  Write-Detail "web ready: $($readiness.WebReady)"
  Write-Detail "api ready: $($readiness.ApiReady)"
  Show-LogTail
  Fail "dev-server" "npm run dev started, but readiness checks did not pass." "Check .dev logs. If the process is still running, run npm run dev:stop before retrying."
}

Write-Step "web/api readiness checks passed"
Show-Endpoints
