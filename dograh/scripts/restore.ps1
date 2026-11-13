<#
.SYNOPSIS
  Restores a backup made by backup.ps1 into FluentAI's Dograh stack. This REPLACES all current
  Dograh data (workflows, runs, credentials, embed tokens, recordings).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File dograh/scripts/restore.ps1 -BackupDir dograh/backups/20261110-120000 -Force
.NOTES
  The API and UI are stopped during the restore so no connection holds the database open.
#>
param(
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$compose = (Resolve-Path (Join-Path $PSScriptRoot "..\docker-compose.yml")).Path
$minioVolume = "fluentai-dograh_minio"
$helperImage = "pgvector/pgvector:pg17"

function Invoke-Docker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') failed with exit code $LASTEXITCODE" }
}

$BackupDir = (Resolve-Path $BackupDir).Path
$dump = Join-Path $BackupDir "dograh-postgres.dump"
$archive = Join-Path $BackupDir "dograh-minio.tgz"
if (-not (Test-Path $dump) -or -not (Test-Path $archive)) {
  throw "Expected dograh-postgres.dump and dograh-minio.tgz in $BackupDir"
}
if (-not $Force) {
  throw "Restore replaces ALL Dograh data in the fluentai-dograh stack. Re-run with -Force to continue."
}

Write-Host "Stopping the Dograh API and UI..."
Invoke-Docker compose -f $compose stop dograh-ui dograh-api
Invoke-Docker compose -f $compose up -d --wait dograh-postgres

Write-Host "Restoring Postgres..."
Invoke-Docker compose -f $compose cp $dump "dograh-postgres:/tmp/fluentai-dograh.dump"
Invoke-Docker compose -f $compose exec -T dograh-postgres pg_restore -U postgres -d postgres --clean --if-exists --no-owner /tmp/fluentai-dograh.dump
Invoke-Docker compose -f $compose exec -T dograh-postgres rm -f /tmp/fluentai-dograh.dump

Write-Host "Restoring the MinIO volume ($minioVolume)..."
Invoke-Docker compose -f $compose stop dograh-minio
Invoke-Docker run --rm -v "${minioVolume}:/data" -v "${BackupDir}:/backup:ro" $helperImage sh -c "find /data -mindepth 1 -delete && tar xzf /backup/dograh-minio.tgz -C /data"

Write-Host "Starting the stack..."
Invoke-Docker compose -f $compose up -d --wait
Write-Host "Restore complete."
