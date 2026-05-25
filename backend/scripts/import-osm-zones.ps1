param(
  [string]$ApiUrl = "http://127.0.0.1:8000",
  [string]$InputFile = "data\osm_ouaga_places.json",
  [switch]$DryRun,
  [switch]$RepairEncoding
)

$raw = Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8
$data = $raw | ConvertFrom-Json

function Normalize-Name([string]$value) {
  return (($value.Trim().ToLower()) -replace "\s+", " ")
}

$regions = Invoke-RestMethod -Uri "$ApiUrl/regions/?limit=100" -Method GET
$region = $regions | Where-Object { (Normalize-Name $_.name) -eq "ouagadougou" } | Select-Object -First 1

if (-not $region) {
  if ($DryRun) {
    $region = [pscustomobject]@{ id = "dry-run-ouagadougou"; name = "Ouagadougou" }
  } else {
    $region = Invoke-RestMethod `
      -Uri "$ApiUrl/regions/" `
      -Method POST `
      -ContentType "application/json" `
      -Body (@{
        name = "Ouagadougou"
        country = "Burkina Faso"
        geometry = $null
      } | ConvertTo-Json -Depth 10)
  }
}

$unique = @{}

foreach ($element in $data.elements) {
  if (-not $element.tags) { continue }

  $name = $element.tags.name
  if (-not $name) { $name = $element.tags.'name:fr' }

  $place = $element.tags.place
  if (-not $name -or -not $place -or -not $element.lat -or -not $element.lon) { continue }

  $key = "$(Normalize-Name $name)::$place"
  if ($unique.ContainsKey($key)) { continue }

  $unique[$key] = @{
    region_id = $region.id
    name = $name.Trim()
    place = $place
    sector_number = $null
    color_code = $null
    geometry = @{
      type = "Point"
      coordinates = @([double]$element.lon, [double]$element.lat)
    }
  }
}

$payload = @($unique.Values | Sort-Object name)

if ($RepairEncoding) {
  $existingZones = Invoke-RestMethod -Uri "$ApiUrl/zones/?limit=500" -Method GET
  $repaired = @()

  foreach ($candidate in $payload) {
    $candidateLon = [double]$candidate.geometry.coordinates[0]
    $candidateLat = [double]$candidate.geometry.coordinates[1]

    $match = $existingZones | Where-Object {
      $_.geometry -and
      $_.geometry.type -eq "Point" -and
      [Math]::Abs(([double]$_.geometry.coordinates[0]) - $candidateLon) -lt 0.0000001 -and
      [Math]::Abs(([double]$_.geometry.coordinates[1]) - $candidateLat) -lt 0.0000001
    } | Select-Object -First 1

    if ($match -and ($match.name -ne $candidate.name -or $match.place -ne $candidate.place)) {
      $json = @{
        name = $candidate.name
        place = $candidate.place
      } | ConvertTo-Json -Depth 10

      $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
      Invoke-RestMethod `
        -Uri "$ApiUrl/zones/$($match.id)" `
        -Method PATCH `
        -ContentType "application/json; charset=utf-8" `
        -Body $bytes | Out-Null

      $repaired += $candidate.name
    }
  }

  [pscustomobject]@{
    repaired = $repaired.Count
    repaired_names = $repaired
  } | ConvertTo-Json -Depth 10
  exit 0
}

if ($DryRun) {
  [pscustomobject]@{
    overpass_elements = @($data.elements).Count
    unique_places = $payload.Count
    sample_names = @($payload | Select-Object -First 30 | ForEach-Object { $_.name })
  } | ConvertTo-Json -Depth 10
  exit 0
}

$bulkJson = $payload | ConvertTo-Json -Depth 20
$bulkBytes = [System.Text.Encoding]::UTF8.GetBytes($bulkJson)

$result = Invoke-RestMethod `
  -Uri "$ApiUrl/zones/bulk-import" `
  -Method POST `
  -ContentType "application/json; charset=utf-8" `
  -Body $bulkBytes

$result | ConvertTo-Json -Depth 20
