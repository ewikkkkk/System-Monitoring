#requires -Version 7.0
# Local testing only. No login flow or credential file is added to the module.
param(
  [string]$ChatId,
  [string]$ChatName,
  [ValidateRange(1,65535)][int]$Port = 5173
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nodePath = (Get-Command node -CommandType Application).Source
$targetFile = Join-Path $taskRoot '.local/teams-test-target.json'
if (Test-Path -LiteralPath $targetFile) {
  $savedTarget = Get-Content -LiteralPath $targetFile -Raw | ConvertFrom-Json
  if (-not $ChatId) { $ChatId = [string]$savedTarget.chatId }
  if (-not $ChatName) { $ChatName = [string]$savedTarget.name }
}
if (-not $ChatId) { $ChatId = Read-Host 'Paste the Teams test group-chat link or chat ID' }
$decodedLink = [Uri]::UnescapeDataString($ChatId.Trim())
# Chat IDs are opaque. Accept the supplied link format without guessing its type from its suffix.
$chatMatch = [regex]::Match($decodedLink, '(?:^|/chat/)(19:[^/?#&\s]+)(?:$|/)')
if (-not $chatMatch.Success) { throw 'No chat ID was found. Paste the Teams chat conversation link or its complete chat ID.' }
$ChatId = $chatMatch.Groups[1].Value
if (-not $ChatName) { $ChatName = Read-Host 'Enter the test group display name' }
$ChatName = $ChatName.Trim()
if (-not $ChatName -or $ChatName.Length -gt 200) { throw 'Enter a group name of 1 to 200 characters.' }

Write-Host 'Sign in to Microsoft Graph Explorer with your work account.'
Write-Host 'For this test, approve Chat.ReadBasic and ChatMessage.Send, then copy its Access token.'
Write-Host 'Paste the token into the hidden prompt below. It is not written to a file or command line.'
$secureToken = Read-Host 'Microsoft Graph delegated access token (hidden)' -AsSecureString
$tokenPointer = [IntPtr]::Zero
$startInfo = $null
try {
  $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  $accessToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer).Trim()
  if (-not $accessToken -or $accessToken -match '\s') { throw 'Enter the raw access token without a Bearer prefix or whitespace.' }

  $serverProcessIds = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($serverProcessId in $serverProcessIds) {
    $running = Get-CimInstance Win32_Process -Filter "ProcessId=$serverProcessId"
    if (-not $running -or $running.Name -ne 'node.exe' -or $running.CommandLine -notmatch 'server[/\\]dev-server\.js' -or $running.CommandLine -notmatch '--demo') {
      throw 'Another application is using the requested port. Close it or choose a different -Port.'
    }
    Stop-Process -Id $running.ProcessId
    Wait-Process -Id $running.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
  }

  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $nodePath
  $startInfo.WorkingDirectory = $taskRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.ArgumentList.Add('server/dev-server.js')
  $startInfo.ArgumentList.Add('--demo')
  $startInfo.Environment['PORT'] = [string]$Port
  $startInfo.Environment['TEAMS_CHAT_ID'] = $ChatId
  $startInfo.Environment['TEAMS_CHAT_NAME'] = $ChatName
  $startInfo.Environment['TEAMS_GRAPH_ACCESS_TOKEN'] = $accessToken
  $started = [Diagnostics.Process]::Start($startInfo)
} finally {
  if ($startInfo) { [void]$startInfo.Environment.Remove('TEAMS_GRAPH_ACCESS_TOKEN') }
  $accessToken = $null
  if ($tokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
  $secureToken.Dispose()
}

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  if ($started.HasExited) { throw 'The demo server exited during startup. Check that dependencies are installed and the port is available.' }
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2 -UseBasicParsing
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { throw 'The demo server did not respond in time. Check the local server before starting another copy.' }
Write-Host "Local test server: http://127.0.0.1:$Port/"
Write-Host "Configured group: $ChatName"
Write-Host 'Open Daily reports > a saved report > Send to Teams > Prepare mentions.'
Write-Host 'Prepare mentions verifies Microsoft access and the actual group. This launcher does not send a message.'
Write-Host 'The token remains only in the running server process environment and expires. Rerun this launcher with a fresh token when necessary.'
