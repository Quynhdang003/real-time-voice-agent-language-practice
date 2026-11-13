<#
.SYNOPSIS
  Backs up FluentAI's Dograh stack: Postgres (workflows, runs, credentials, embed tokens, API keys)
  and the MinIO volume (transcripts and recordings).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File dograh/scripts/backup.ps1
  # -> dograh/backups/<yyyyMMdd-HHmmss>/{dograh-postgres.dump, dograh-minio.tgz}
.NOTES
  The stack must be running. The dump is written inside the container and copied out with
  `docker compose cp`, because PowerShell 5.1 redirection (>) corrupts binary output.
  Also export the workflows (npm run dograh:export) so they can be re-imported without a dump.
#>
param([string]$OutDir = (Join-Path $PSScriptRoot "..\backups"))

$ErrorActionPreference = "Stop"
$compose = (Resolve-Path (Join-Path $PSScriptRoot "..\docker-compose.yml")).Path
$minioVolume = "fluentai-dograh_minio"
# Already pulled for the stack and ships GNU tar; avoids pulling another image.
$helperImage = "pgvector/pgvector:pg17"

function Invoke-Docker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') failed with exit code $LASTEXITCODE" }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$target = Join-Path (Resolve-Path $OutDir).Path (Get-Date -Format "yyyyMMdd-HHmmss")
New-Item -ItemType Directory -Force -Path $target | Out-Null

Write-Host "Dumping the Dograh Postgres database..."
Invoke-Docker compose -f $compose exec -T dograh-postgres pg_dump -U postgres -Fc -f /tmp/fluentai-dograh.dump postgres
Invoke-Docker compose -f $compose cp "dograh-postgres:/tmp/fluentai-dograh.dump" (Join-Path $target "dograh-postgres.dump")
Invoke-Docker compose -f $compose exec -T dograh-postgres rm -f /tmp/fluentai-dograh.dump

Write-Host "Archiving the MinIO volume ($minioVolume)..."
Invoke-Docker run --rm -v "${minioVolume}:/data:ro" -v "${target}:/backup" $helperImage tar czf /backup/dograh-minio.tgz -C /data .

Write-Host "Backup written to $target"
