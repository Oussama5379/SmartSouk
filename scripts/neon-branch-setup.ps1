param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [string]$BranchName,
  [string]$ParentBranch = "main",
  [switch]$Pooled
)

$resolvedBranchName = if ($BranchName) {
  $BranchName.Trim()
} else {
  $currentGitBranch = (git rev-parse --abbrev-ref HEAD).Trim()
  if (-not $currentGitBranch) {
    throw "Unable to resolve git branch name. Pass -BranchName explicitly."
  }
  $currentGitBranch
}

if (-not $resolvedBranchName) {
  throw "Branch name cannot be empty."
}

Write-Host "Creating Neon branch '$resolvedBranchName' from parent '$ParentBranch' in project '$ProjectId'..."
& neon branches create --project-id $ProjectId --name $resolvedBranchName --parent $ParentBranch

$connectionArgs = @($resolvedBranchName, "--project-id", $ProjectId)
if ($Pooled.IsPresent) {
  $connectionArgs += "--pooled"
}

$connectionString = (& neon connection-string @connectionArgs).Trim()
if (-not $connectionString) {
  throw "Failed to resolve Neon connection string."
}

Write-Host ""
Write-Host "DATABASE_URL for branch '$resolvedBranchName':"
Write-Host $connectionString
Write-Host ""
Write-Host "Use this in your current PowerShell session:"
Write-Host "`$env:DATABASE_URL = '$connectionString'"
Write-Host ""
Write-Host "Then run:"
Write-Host "pnpm auth:migrate"
