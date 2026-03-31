<#
.SYNOPSIS
    Full build, test, and optional export workflow for IT Helpdesk Docker images.

.DESCRIPTION
    Runs the complete release pipeline in one script:

        STEP 1  Take a live DB backup from the existing Docker data volume
                (or fall back to the latest .bak in Data_Backup/).
        STEP 2  Copy the backup into docker/db/seed/ as the new baseline.
        STEP 3  Build helpdesk-db, helpdesk-backend, helpdesk-frontend images.
        STEP 4  Start the test environment (docker-compose.test.yml).
        STEP 5  Wait for the backend /health endpoint to return success.
        STEP 6  Tear down the test environment (or leave it running).
        STEP 7  [Optional] Run export-release.ps1 to package the production
                release into production-release/images/*.tar.

.PARAMETER SkipLiveBackup
    Skip spinning up a temp SQL Server container for a live backup.
    Instead use the most recent .bak already in Data_Backup/.

.PARAMETER SkipDbBuild
    Do not rebuild helpdesk-db. Use whatever helpdesk-db:latest is already
    tagged (safe only when db schema and seed data have NOT changed).

.PARAMETER SkipAppBuild
    Do not rebuild helpdesk-backend or helpdesk-frontend.

.PARAMETER SkipTest
    Skip starting the test environment entirely (build only).

.PARAMETER KeepTestRunning
    Leave test containers up after health-check passes so you can browse the
    app manually. You must clean up yourself:
        docker compose -f docker\docker-compose.test.yml -p helpdesktest down -v

.PARAMETER Export
    After a successful test, run export-release.ps1 -SkipBuild to package
    all images into production-release/images/ ready for transfer.

.PARAMETER SkipOllamaExport
    When -Export is used, skip re-building the Ollama image (speeds up export
    when the LLM models have not changed).

.EXAMPLE
    # Full workflow: live backup → build all → test → export
    .\docker\build-and-test.ps1 -Export

    # Build and test only; keep containers running for manual QA
    .\docker\build-and-test.ps1 -KeepTestRunning

    # Skip live backup (use latest .bak), skip Ollama during export
    .\docker\build-and-test.ps1 -SkipLiveBackup -Export -SkipOllamaExport

    # Rebuild app images only (db schema unchanged), then export
    .\docker\build-and-test.ps1 -SkipDbBuild -Export
#>
param(
    [switch]$SkipLiveBackup,
    [switch]$SkipDbBuild,
    [switch]$SkipAppBuild,
    [switch]$SkipTest,
    [switch]$KeepTestRunning,
    [switch]$Export,
    [switch]$SkipOllamaExport
)

$ErrorActionPreference = "Stop"

# ── Paths ──────────────────────────────────────────────────────────────────
$ROOT         = Split-Path -Parent $PSScriptRoot          # D:\Project\it-helpdesk
$DOCKER_DIR   = $PSScriptRoot                             # D:\Project\it-helpdesk\docker
$DB_DIR       = Join-Path $DOCKER_DIR "db"
$SEED_DIR     = Join-Path $DB_DIR "seed"
$BASELINE_BAK = Join-Path $SEED_DIR "ITHelpdesk-baseline.bak"
$BACKUP_DIR   = Join-Path $ROOT "Data_Backup"
$TEST_COMPOSE = Join-Path $DOCKER_DIR "docker-compose.test.yml"

# ── Constants ──────────────────────────────────────────────────────────────
$SA_PASSWORD    = "ItHelpdeskDb@2026!"
$VOLUME_NAME    = "ithelpdesk_sqlserver_data"
$TEST_PROJECT   = "helpdesktest"
$TEMP_CONTAINER = "helpdesk-db-backup-temp"

# ── Helpers ────────────────────────────────────────────────────────────────
function Write-Step { param([string]$n, [string]$msg)
    Write-Host ("`n" + ("-" * 60)) -ForegroundColor DarkGray
    Write-Host "  STEP $n : $msg" -ForegroundColor Cyan
    Write-Host ("-" * 60) -ForegroundColor DarkGray
}
function Write-OK   { Write-Host "  [OK]   $args" -ForegroundColor Green }
function Write-Warn { Write-Host "  [WARN] $args" -ForegroundColor Yellow }
function Write-Fail { Write-Host "  [FAIL] $args" -ForegroundColor Red }

$scriptStart = Get-Date
Write-Host ""
Write-Host "  IT Helpdesk - Build, Test & Export" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1 - Take DB backup from live Docker volume
# ═══════════════════════════════════════════════════════════════════════════
Write-Step 1 "Database Backup"

function Use-LatestBakFallback {
    $latest = Get-ChildItem $BACKUP_DIR -Filter "*.bak" -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Fail "No .bak files found in $BACKUP_DIR  - cannot continue."
        exit 1
    }
    Write-Warn "Using latest backup from Data_Backup/: $($latest.Name)  ($([math]::Round($latest.Length/1MB,1)) MB)"
    Copy-Item $latest.FullName $BASELINE_BAK -Force
    Write-OK "Baseline updated: $(Split-Path $BASELINE_BAK -Leaf)"
}

if ($SkipLiveBackup) {
    Write-Warn "-SkipLiveBackup set. Skipping live backup."
    Use-LatestBakFallback
} else {
    # Check volume exists
    $volumes = @(docker volume ls --format "{{.Name}}" 2>&1)
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker volume ls failed - is Docker running?"; exit 1 }

    if ($volumes -notcontains $VOLUME_NAME) {
        Write-Warn "Volume '$VOLUME_NAME' not found. Falling back to latest .bak."
        Use-LatestBakFallback
    } else {
        Write-Host "  Found volume: $VOLUME_NAME"

        # Remove any leftover temp container from a prior failed run
        # Note: | Out-Null without 2>&1 - avoids PS5.1 error-record termination
        docker rm -f $TEMP_CONTAINER | Out-Null

        Write-Host "  Starting temporary SQL Server container (read-only access to existing data)..."
        docker run -d `
            --name $TEMP_CONTAINER `
            -e ACCEPT_EULA=Y `
            -e "MSSQL_SA_PASSWORD=$SA_PASSWORD" `
            -v "${VOLUME_NAME}:/var/opt/mssql" `
            -v "${BACKUP_DIR}:/host-backup" `
            mcr.microsoft.com/mssql/server:2022-latest | Out-Null

        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Failed to start temporary SQL Server container"
            exit 1
        }

        # Wait for SQL Server to accept connections (up to 90 s)
        Write-Host "  Waiting for SQL Server to be ready (up to 90 s)..."
        $ready = $false
        for ($i = 1; $i -le 45; $i++) {
            Start-Sleep -Seconds 2
            docker exec $TEMP_CONTAINER `
                /opt/mssql-tools18/bin/sqlcmd -C -S "localhost,1433" `
                -U sa -P "$SA_PASSWORD" -Q "SELECT 1" | Out-Null
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
            if ($i % 5 -eq 0) { Write-Host "  Still waiting... ($($i * 2) s)" }
        }

        if (-not $ready) {
            docker rm -f $TEMP_CONTAINER | Out-Null
            Write-Fail "SQL Server did not become ready within 90 seconds."
            exit 1
        }
        Write-OK "SQL Server is ready"

        # Take a compressed backup
        $ts = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupFileName  = "DOCKER_BASELINE_${ts}.bak"
        $containerPath   = "/host-backup/$backupFileName"   # inside container
        $hostPath        = Join-Path $BACKUP_DIR $backupFileName

        Write-Host "  Backing up [ITHelpdesk] → $backupFileName ..."
        docker exec $TEMP_CONTAINER `
            /opt/mssql-tools18/bin/sqlcmd -C -S "localhost,1433" `
            -U sa -P "$SA_PASSWORD" `
            -Q "BACKUP DATABASE [ITHelpdesk] TO DISK = N'$containerPath' WITH FORMAT, INIT, COMPRESSION, STATS = 10;" `
            2>&1

        $backupExitCode = $LASTEXITCODE

        # Always stop and remove the temp container
        docker stop $TEMP_CONTAINER | Out-Null
        docker rm   $TEMP_CONTAINER | Out-Null
        Write-OK "Temp container stopped and removed"

        if ($backupExitCode -ne 0) {
            Write-Fail "BACKUP DATABASE command failed (exit $backupExitCode)"
            exit 1
        }

        if (-not (Test-Path $hostPath)) {
            Write-Fail "Backup file not found at expected host path: $hostPath"
            exit 1
        }

        $sizeMB = [math]::Round((Get-Item $hostPath).Length / 1MB, 1)
        Write-OK "Backup complete: $backupFileName  ($sizeMB MB)"

        # Copy to seed directory
        Write-Host "  Updating docker/db/seed/ITHelpdesk-baseline.bak ..."
        Copy-Item $hostPath $BASELINE_BAK -Force
        Write-OK "Baseline updated: $(Split-Path $BASELINE_BAK -Leaf)  ($sizeMB MB)"
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2 - Build Docker Images
# ═══════════════════════════════════════════════════════════════════════════
Write-Step 2 "Build Docker Images"

$buildStart = Get-Date

if (-not $SkipDbBuild) {
    # ── DB Image Strategy: commit a live container ─────────────────────────
    # Goal:  produce helpdesk-db:latest that already contains the fully-
    #        restored database.  When run in production, SQL Server starts
    #        straight away with all schema/data present - no restore step,
    #        no backup file, no SA password needed in the compose file.
    #
    # How it works:
    #   1. Build helpdesk-db:restore-stage  (Dockerfile or .patch) which
    #      contains the .bak and the restore entrypoint.
    #   2. Run it WITHOUT any volume mount so SQL Server data files go into
    #      the container's own writable layer.
    #   3. Wait until the DB is fully restored and all migrations are done.
    #   4. Shut SQL Server down cleanly (consistent data files).
    #   5. docker commit the stopped container, overriding the ENTRYPOINT
    #      to plain sqlservr - no restore logic, no env-var dependencies.
    #   6. Tag the result as helpdesk-db:latest and delete the temp container.
    # ───────────────────────────────────────────────────────────────────────

    $COMMIT_CONTAINER = "helpdesk-db-commit-stage"

    # Step 1: build the intermediate restore-stage image
    $existingImages = @(docker images --format "{{.Repository}}:{{.Tag}}" 2>&1)
    $dockerfileName = if ($existingImages -contains "helpdesk-db:latest") {
        Write-Host "  Existing helpdesk-db:latest found - using Dockerfile.patch for restore-stage"
        "Dockerfile.patch"
    } else {
        Write-Host "  No existing helpdesk-db image - using full Dockerfile for restore-stage"
        "Dockerfile"
    }
    Write-Host "  Building helpdesk-db:restore-stage ..."
    docker build -f (Join-Path $DB_DIR $dockerfileName) -t helpdesk-db:restore-stage $DB_DIR
    if ($LASTEXITCODE -ne 0) { Write-Fail "helpdesk-db restore-stage build failed"; exit 1 }
    Write-OK "helpdesk-db:restore-stage built"

    # Step 2: run the restore-stage container WITHOUT a volume mount
    # (data files go directly into the container's writable layer)
    docker rm -f $COMMIT_CONTAINER | Out-Null
    Write-Host "  Starting restore container (no volume - data goes into container layer) ..."
    docker run -d `
        --name $COMMIT_CONTAINER `
        -e ACCEPT_EULA=Y `
        helpdesk-db:restore-stage
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to start restore container"; exit 1 }

    # Step 3: wait for DB to be fully restored and all migrations applied
    Write-Host "  Waiting for database restore + migrations (up to 5 minutes) ..."
    $dbReady = $false
    for ($i = 1; $i -le 60; $i++) {
        Start-Sleep -Seconds 5
        docker exec $COMMIT_CONTAINER `
            /opt/mssql-tools18/bin/sqlcmd -C -S "localhost,1433" `
            -U sa -P "$SA_PASSWORD" -Q "SELECT 1" | Out-Null
        if ($LASTEXITCODE -eq 0) { $dbReady = $true; break }
        if ($i % 6 -eq 0) { Write-Host "  Still waiting... ($($i * 5) s)" }
    }
    if (-not $dbReady) {
        Write-Host "  Logs from restore container:"
        docker logs $COMMIT_CONTAINER --tail 40
        docker rm -f $COMMIT_CONTAINER | Out-Null
        Write-Fail "Database did not become ready within 5 minutes."
        exit 1
    }
    Write-OK "Database restored and ready"

    # Extra wait: let the entrypoint finish running all migration .sql files
    # (the healthcheck above only confirms SQL Server is answering, not that
    #  all idempotent migrations have finished executing).
    Write-Host "  Waiting 10 s for migrations to complete ..."
    Start-Sleep -Seconds 10

    # Step 4: shut SQL Server down cleanly so data files are consistent
    Write-Host "  Shutting down SQL Server cleanly ..."
    docker exec $COMMIT_CONTAINER `
        /opt/mssql-tools18/bin/sqlcmd -C -S "localhost,1433" `
        -U sa -P "$SA_PASSWORD" -Q "SHUTDOWN WITH NOWAIT" | Out-Null

    # Wait for the container to stop (max 30 s)
    $stopped = $false
    for ($j = 1; $j -le 15; $j++) {
        Start-Sleep -Seconds 2
        $state = docker inspect $COMMIT_CONTAINER --format "{{.State.Running}}" 2>$null
        if ($state -eq "false") { $stopped = $true; break }
    }
    if (-not $stopped) {
        Write-Warn "Container did not stop cleanly; forcing stop before commit."
        docker stop $COMMIT_CONTAINER | Out-Null
    }
    Write-OK "SQL Server stopped cleanly"

    # Step 5: commit the stopped container as helpdesk-db:latest
    # Override the ENTRYPOINT so the committed image ONLY runs sqlservr
    # (no restore logic, no MSSQL_SA_PASSWORD dependency at runtime).
    Write-Host "  Committing container as helpdesk-db:latest ..."
    docker commit `
        --change 'ENTRYPOINT [\"/opt/mssql/bin/sqlservr\"]' `
        --change 'CMD []' `
        $COMMIT_CONTAINER helpdesk-db:latest
    if ($LASTEXITCODE -ne 0) {
        docker rm -f $COMMIT_CONTAINER | Out-Null
        Write-Fail "docker commit failed"
        exit 1
    }
    Write-OK "helpdesk-db:latest committed (DB data baked in, restore-free)"

    # Step 6: clean up
    docker rm $COMMIT_CONTAINER | Out-Null
    Write-OK "Commit container removed"
} else {
    Write-Warn "Skipping DB image rebuild (-SkipDbBuild)"
}

if (-not $SkipAppBuild) {
    Write-Host "  Building helpdesk-backend:latest ..."
    docker build -f (Join-Path $ROOT "backend\Dockerfile") -t helpdesk-backend:latest (Join-Path $ROOT "backend")
    if ($LASTEXITCODE -ne 0) { Write-Fail "helpdesk-backend build failed"; exit 1 }
    Write-OK "helpdesk-backend:latest built"

    Write-Host "  Building helpdesk-frontend:latest ..."
    docker build -f (Join-Path $ROOT "frontend\Dockerfile") -t helpdesk-frontend:latest (Join-Path $ROOT "frontend")
    if ($LASTEXITCODE -ne 0) { Write-Fail "helpdesk-frontend build failed"; exit 1 }
    Write-OK "helpdesk-frontend:latest built"
} else {
    Write-Warn "Skipping backend/frontend rebuild (-SkipAppBuild)"
}

$buildElapsed = [math]::Round(((Get-Date) - $buildStart).TotalSeconds)
Write-OK "All images built in ${buildElapsed}s"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3 - Start Test Environment
# ═══════════════════════════════════════════════════════════════════════════
if ($SkipTest) {
    Write-Step 3 "Test Environment - SKIPPED (-SkipTest)"
} else {
    Write-Step 3 "Start Test Environment"

    # Tear down any leftover test containers/volumes from a previous run
    docker compose -f $TEST_COMPOSE -p $TEST_PROJECT down -v | Out-Null

    Write-Host "  Starting db, backend, frontend (project: $TEST_PROJECT) ..."
    docker compose -f $TEST_COMPOSE -p $TEST_PROJECT up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "docker compose up failed"
        exit 1
    }

    Write-Host ""
    Write-Host "  Test access URLs:" -ForegroundColor Yellow
    Write-Host "    Frontend   → http://localhost:8081  (admin / Admin@123)" -ForegroundColor White
    Write-Host "    Backend    → http://localhost:5001/health" -ForegroundColor White
    Write-Host "    SQL Server → localhost,1434  (sa / $SA_PASSWORD)" -ForegroundColor White
    Write-Host ""

    # ── STEP 4: Health check ───────────────────────────────────────────────
    Write-Step 4 "Health Check"
    Write-Host "  Waiting for backend /health (up to 3 minutes) ..."

    $healthy = $false
    for ($i = 1; $i -le 36; $i++) {
        Start-Sleep -Seconds 5
        try {
            $resp = Invoke-RestMethod "http://localhost:5001/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
            if ($resp.success -eq $true) { $healthy = $true; break }
        } catch { }
        if ($i % 6 -eq 0) { Write-Host "  Still waiting... ($($i * 5) s elapsed)" }
    }

    if (-not $healthy) {
        Write-Fail "Backend health check failed after 3 minutes."
        Write-Host ""
        Write-Host "  ── Backend logs (last 50 lines) ──" -ForegroundColor DarkYellow
        docker compose -f $TEST_COMPOSE -p $TEST_PROJECT logs backend --tail 50
        Write-Host ""
        Write-Host "  ── DB logs (last 30 lines) ──" -ForegroundColor DarkYellow
        docker compose -f $TEST_COMPOSE -p $TEST_PROJECT logs db --tail 30
        if (-not $KeepTestRunning) {
            docker compose -f $TEST_COMPOSE -p $TEST_PROJECT down -v | Out-Null
        }
        exit 1
    }
    Write-OK "Backend /health → success"

    # Quick frontend reachability check
    try {
        $fResp = Invoke-WebRequest "http://localhost:8081" -Method Get -TimeoutSec 10 -ErrorAction Stop
        if ($fResp.StatusCode -eq 200) { Write-OK "Frontend is serving HTTP 200" }
        else { Write-Warn "Frontend returned HTTP $($fResp.StatusCode)" }
    } catch {
        Write-Warn "Frontend reachability check failed: $_"
    }

    # ── STEP 5: Teardown (or keep running) ────────────────────────────────
    if ($KeepTestRunning) {
        Write-Step 5 "Teardown - SKIPPED (-KeepTestRunning)"
        Write-Host ""
        Write-Host "  Test environment is still running." -ForegroundColor Yellow
        Write-Host "  Browse to: http://localhost:8081  (admin / Admin@123)" -ForegroundColor Cyan
        Write-Host "  When done, run:" -ForegroundColor DarkGray
        Write-Host "    docker compose -f docker\docker-compose.test.yml -p helpdesktest down -v" -ForegroundColor DarkGray
    } else {
        Write-Step 5 "Teardown Test Environment"
        docker compose -f $TEST_COMPOSE -p $TEST_PROJECT down -v | Out-Null
        Write-OK "Test containers and volumes removed"
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6 - Export Production Release (optional)
# ═══════════════════════════════════════════════════════════════════════════
if ($Export) {
    Write-Step 6 "Export Production Release"

    $exportScript = Join-Path $DOCKER_DIR "export-release.ps1"
    if (-not (Test-Path $exportScript)) {
        Write-Fail "export-release.ps1 not found at: $exportScript"
        exit 1
    }

    # Images were already built in Step 2 - pass -SkipBuild so export-release
    # just packages the images we already built and tested.
    # Use hashtable splatting so switches are passed correctly as named params
    # (array splatting treats "-SkipBuild" as a positional string value).
    $exportArgsHash = @{ SkipBuild = $true }
    if ($SkipOllamaExport) { $exportArgsHash['SkipOllamaBuild'] = $true }

    & $exportScript @exportArgsHash
    if ($LASTEXITCODE -ne 0) { Write-Fail "export-release.ps1 failed"; exit 1 }
    Write-OK "Production release exported to docker/production-release/"
}

# ═══════════════════════════════════════════════════════════════════════════
# Done
# ═══════════════════════════════════════════════════════════════════════════
$totalElapsed = [math]::Round(((Get-Date) - $scriptStart).TotalSeconds)
Write-Host ""
Write-Host ("-" * 60) -ForegroundColor DarkGray
Write-Host "  Done in ${totalElapsed}s" -ForegroundColor Green
Write-Host ("-" * 60) -ForegroundColor DarkGray
Write-Host ""
