Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:HovMigrationBoundary = [ordered]@{
  SourceTenantId       = "9530cd32-9e33-47f0-9247-ed964730b580"
  SourceSubscriptionId = "bb4e3882-2079-4bab-8974-611bc0b8bb58"
  SourceResourceGroup  = "nl-prod-hov-rg"
  TargetTenantId       = "5384ef74-e517-4b22-9472-df990f61e8b5"
  TargetSubscriptionId = "8a5dc70a-bafa-4a04-a281-9b4862a70810"
  TargetResourceGroup  = "nex-prod-hov-rg"
  TargetRegion         = "southafricanorth"
}

function Get-HovMigrationBoundary {
  [CmdletBinding()]
  param()

  return $script:HovMigrationBoundary.Clone()
}

function Assert-CommandAvailable {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required executable '$Name' is not available."
  }
}

function Invoke-NativeCommand {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter()][string[]]$ArgumentList = @()
  )

  $output = & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command '$FilePath' failed with exit code $LASTEXITCODE."
  }
  return $output
}

function Assert-AzureBoundary {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateSet("Source", "Target")][string]$Boundary,
    [Parameter(Mandatory)][string]$ResourceGroup,
    [switch]$RequireResourceGroup
  )

  Assert-CommandAvailable -Name "az"
  $expectedTenant = if ($Boundary -eq "Source") {
    $script:HovMigrationBoundary.SourceTenantId
  } else {
    $script:HovMigrationBoundary.TargetTenantId
  }
  $expectedSubscription = if ($Boundary -eq "Source") {
    $script:HovMigrationBoundary.SourceSubscriptionId
  } else {
    $script:HovMigrationBoundary.TargetSubscriptionId
  }
  $expectedResourceGroup = if ($Boundary -eq "Source") {
    $script:HovMigrationBoundary.SourceResourceGroup
  } else {
    $script:HovMigrationBoundary.TargetResourceGroup
  }

  if ($ResourceGroup -cne $expectedResourceGroup) {
    throw "Refusing operation: resource group '$ResourceGroup' is not the exact $Boundary HOV resource group '$expectedResourceGroup'."
  }

  $accountJson = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
    "account", "show", "--output", "json", "--only-show-errors"
  )
  $account = ($accountJson -join [Environment]::NewLine) | ConvertFrom-Json
  if ($account.tenantId -cne $expectedTenant -or $account.id -cne $expectedSubscription) {
    throw "Refusing operation: Azure context does not match the exact $Boundary tenant and subscription."
  }

  if ($RequireResourceGroup) {
    $exists = Invoke-NativeCommand -FilePath "az" -ArgumentList @(
      "group", "exists", "--name", $ResourceGroup, "--subscription", $expectedSubscription,
      "--output", "tsv", "--only-show-errors"
    )
    if (($exists -join "").Trim() -cne "true") {
      throw "Required resource group '$ResourceGroup' does not exist in the asserted subscription."
    }
  }

  return [pscustomobject]@{
    boundary       = $Boundary
    tenantId       = $expectedTenant
    subscriptionId = $expectedSubscription
    resourceGroup  = $expectedResourceGroup
  }
}

function New-SafeDirectory {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Path)

  $fullPath = [IO.Path]::GetFullPath($Path)
  if ($fullPath -match '(?i)(^|[\\/])(?:\.git|secrets?|credentials?)([\\/]|$)') {
    throw "Refusing unsafe evidence path '$fullPath'."
  }
  [IO.Directory]::CreateDirectory($fullPath) | Out-Null
  return $fullPath
}

function Write-SafeJson {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][object]$InputObject,
    [Parameter(Mandatory)][string]$Path,
    [ValidateRange(2, 20)][int]$Depth = 10
  )

  $parent = Split-Path -Parent ([IO.Path]::GetFullPath($Path))
  New-SafeDirectory -Path $parent | Out-Null
  $InputObject | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $Path -Encoding utf8NoBOM
}

function Get-RequiredEnvironmentValue {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Required process environment variable '$Name' is not set."
  }
  return $value
}

function Invoke-WithPostgresEnvironment {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateSet("HOV_SOURCE", "HOV_TARGET")][string]$Prefix,
    [Parameter(Mandatory)][scriptblock]$ScriptBlock
  )

  $mapping = [ordered]@{
    PGHOST     = "${Prefix}_PGHOST"
    PGPORT     = "${Prefix}_PGPORT"
    PGDATABASE = "${Prefix}_PGDATABASE"
    PGUSER     = "${Prefix}_PGUSER"
    PGPASSWORD = "${Prefix}_PGPASSWORD"
    PGSSLMODE  = "${Prefix}_PGSSLMODE"
    PGSSLROOTCERT = "${Prefix}_PGSSLROOTCERT"
  }
  $previous = @{}
  $previousConnectTimeout = [Environment]::GetEnvironmentVariable("PGCONNECT_TIMEOUT", "Process")
  $previousOptions = [Environment]::GetEnvironmentVariable("PGOPTIONS", "Process")
  try {
    foreach ($entry in $mapping.GetEnumerator()) {
      $previous[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
    }
    foreach ($entry in $mapping.GetEnumerator()) {
      $value = if ($entry.Key -eq "PGPORT") {
        [Environment]::GetEnvironmentVariable($entry.Value, "Process") ?? "5432"
      } elseif ($entry.Key -eq "PGSSLMODE") {
        $sslMode = [Environment]::GetEnvironmentVariable($entry.Value, "Process") ?? "verify-full"
        if ($sslMode -cne "verify-full") {
          throw "PostgreSQL migration connections require PGSSLMODE=verify-full."
        }
        $sslMode
      } elseif ($entry.Key -eq "PGSSLROOTCERT") {
        $rootCertificate = [Environment]::GetEnvironmentVariable($entry.Value, "Process") ?? "system"
        if ($rootCertificate -cne "system") {
          throw "PostgreSQL migration connections require PGSSLROOTCERT=system until an immutable CA-bundle approval contract exists."
        }
        $rootCertificate
      } else {
        Get-RequiredEnvironmentValue -Name $entry.Value
      }
      [Environment]::SetEnvironmentVariable($entry.Key, $value, "Process")
    }
    [Environment]::SetEnvironmentVariable("PGCONNECT_TIMEOUT", "10", "Process")
    [Environment]::SetEnvironmentVariable("PGOPTIONS", "-c TimeZone=UTC -c DateStyle=ISO,YMD", "Process")
    return & $ScriptBlock
  } finally {
    foreach ($name in $mapping.Keys) {
      [Environment]::SetEnvironmentVariable($name, $previous[$name], "Process")
    }
    [Environment]::SetEnvironmentVariable("PGCONNECT_TIMEOUT", $previousConnectTimeout, "Process")
    [Environment]::SetEnvironmentVariable("PGOPTIONS", $previousOptions, "Process")
  }
}

function Get-DirectoryTreeDigest {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Path)

  $root = (Resolve-Path -LiteralPath $Path).Path
  $files = @(Get-ChildItem -LiteralPath $root -Recurse -File)
  $digestLines = foreach ($file in $files) {
    $relativePath = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
    "$relativePath|$($file.Length)|$(Get-Sha256 -Path $file.FullName)"
  }
  $joined = (@($digestLines) | Sort-Object) -join "`n"
  $bytes = [Text.Encoding]::UTF8.GetBytes($joined)
  try {
    $aggregate = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
  return [pscustomobject]@{
    fileCount       = $files.Count
    totalBytes      = [long](($files | Measure-Object -Property Length -Sum).Sum ?? 0)
    aggregateDigest = $aggregate
  }
}

function Get-Sha256 {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Path)

  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-PrivateIpAddress {
  [CmdletBinding()]
  param([Parameter(Mandatory)][Net.IPAddress]$Address)

  if ($Address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { return $false }
  $bytes = $Address.GetAddressBytes()
  return (
    $bytes[0] -eq 10 -or
    ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
    ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
  )
}

function Assert-PrivateEndpointReachability {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$HostName,
    [Parameter(Mandatory)][ValidateRange(1, 65535)][int]$Port,
    [ValidateRange(1, 60)][int]$TimeoutSeconds = 10
  )

  $addresses = @([Net.Dns]::GetHostAddresses($HostName))
  $privateAddresses = @($addresses | Where-Object { Test-PrivateIpAddress -Address $_ })
  if ($privateAddresses.Count -eq 0 -or $privateAddresses.Count -ne $addresses.Count) {
    throw "Private-network gate failed: '$HostName' must resolve exclusively to RFC1918 IPv4 addresses. Run this operation from the approved VNet migration runner or use a separately approved temporary-access plan."
  }

  foreach ($address in $privateAddresses) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
      $connect = $client.ConnectAsync($address, $Port)
      try {
        $completed = $connect.Wait([TimeSpan]::FromSeconds($TimeoutSeconds))
      } catch {
        throw "Private-network gate failed: the validated private endpoint was not reachable from this execution host."
      }
      if (-not $completed -or -not $client.Connected) {
        throw "Private-network gate failed: validated address '$address`:$Port' is not reachable from this execution host."
      }
      $remoteAddress = ([Net.IPEndPoint]$client.Client.RemoteEndPoint).Address
      if (-not $remoteAddress.Equals($address) -or -not (Test-PrivateIpAddress -Address $remoteAddress)) {
        throw "Private-network gate failed: the connected remote endpoint was not the validated private address."
      }
    } finally {
      $client.Dispose()
    }
  }
}
