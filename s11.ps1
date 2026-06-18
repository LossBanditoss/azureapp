param(
  [ValidateSet('Help','Check','InstallDeps','StartServer','Health','Extract','Listen','Batch')]
  [string]$Step = 'Help',

  [string]$ApiBase = 'http://localhost:3000',
  [string]$DocxPath = '',
  [string]$CallbackUrl = 'http://127.0.0.1:3001/',
  [int]$CallbackPort = 3001,
  [string]$OutputPdfPath = "$env:USERPROFILE\Desktop\output.pdf",
  [string]$BasicUser = 'testuser',
  [string]$BasicPass = 'test1234',
  [string]$CallbackAuthHeader = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "=== $Title ==="
}

function Get-BasicAuthHeader {
  param(
    [string]$User,
    [string]$Pass
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes("$User`:$Pass")
  return "Basic $([Convert]::ToBase64String($bytes))"
}

function Get-FileBase64 {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "File not found: $Path"
  }

  $resolved = (Resolve-Path $Path).Path
  $bytes = [System.IO.File]::ReadAllBytes($resolved)
  return [Convert]::ToBase64String($bytes)
}

function Resolve-DocxPath {
  param([string]$Path)

  if ($Path) {
    if (-not (Test-Path $Path)) {
      throw "File not found: $Path"
    }

    return (Resolve-Path $Path).Path
  }

  $candidate = Get-ChildItem -Path (Get-Location) -Filter *.docx -File | Select-Object -First 1
  if ($candidate) {
    Write-Host "Using DOCX file: $($candidate.FullName)"
    return $candidate.FullName
  }

  throw 'No DOCX file found in the current folder. Pass -DocxPath .\your-file.docx.'
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body
  )

  $json = $Body | ConvertTo-Json -Depth 12
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType 'application/json' -Body $json
}

function Start-CallbackListener {
  param(
    [int]$Port,
    [string]$SavePath
  )

  $listener = [System.Net.HttpListener]::new()
  $prefix = "http://127.0.0.1:$Port/"
  $listener.Prefixes.Add($prefix)
  $listener.Start()

  Write-Section 'Callback listener'
  Write-Host "Listening on $prefix"
  Write-Host "Saving PDF to $SavePath"
  Write-Host 'Press Ctrl+C to stop.'

  try {
    while ($listener.IsListening) {
      $context = $listener.GetContext()
      try {
        $reader = [System.IO.StreamReader]::new($context.Request.InputStream, $context.Request.ContentEncoding)
        $body = $reader.ReadToEnd()
        $reader.Close()

        Write-Host ''
        Write-Host 'Received callback payload.'

        if ($body) {
          $payload = $body | ConvertFrom-Json
          if ($null -ne $payload.pdfBase64 -and $payload.pdfBase64) {
            $pdfBytes = [Convert]::FromBase64String([string]$payload.pdfBase64)
            [System.IO.File]::WriteAllBytes($SavePath, $pdfBytes)
            Write-Host "Saved PDF to $SavePath"
            Write-Host "JobId: $($payload.jobId) | Index: $($payload.index) / $($payload.total)"
          } else {
            Write-Host 'No pdfBase64 field found in callback payload.'
          }
        } else {
          Write-Host 'Empty callback body received.'
        }

        $responseBytes = [System.Text.Encoding]::UTF8.GetBytes('ok')
        $context.Response.StatusCode = 200
        $context.Response.ContentType = 'text/plain'
        $context.Response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
      } catch {
        Write-Host "Listener error: $($_.Exception.Message)"
        try {
          $context.Response.StatusCode = 500
        } catch {
        }
      } finally {
        try {
          $context.Response.OutputStream.Close()
        } catch {
        }
        try {
          $context.Response.Close()
        } catch {
        }
      }
    }
  } finally {
    $listener.Stop()
    $listener.Close()
  }
}

function Send-ExtractRequest {
  param(
    [string]$BaseUrl,
    [string]$Path,
    [string]$AuthHeader,
    [string]$User,
    [string]$Pass
  )

  $resolvedPath = Resolve-DocxPath -Path $Path
  $fileBase64 = Get-FileBase64 -Path $resolvedPath
  $headers = @{ Authorization = (Get-BasicAuthHeader -User $User -Pass $Pass) }
  $payload = @{
    conversionId = [guid]::NewGuid().ToString()
    recordSysId = 'demo-record-sys-id'
    attachmentSysId = 'demo-attachment-sys-id'
    fileName = (Split-Path $resolvedPath -Leaf)
    encodedWord = $fileBase64
  }

  if ($AuthHeader) {
    $headers.Authorization = $AuthHeader
  }

  return Invoke-JsonRequest -Method 'Post' -Uri "$BaseUrl/api/template/extract-variables" -Headers $headers -Body $payload
}

function Send-BatchRequest {
  param(
    [string]$BaseUrl,
    [string]$Path,
    [string]$Callback,
    [string]$AuthHeader,
    [string]$User,
    [string]$Pass,
    [string]$CallbackHeader
  )

  $resolvedPath = Resolve-DocxPath -Path $Path
  $fileBase64 = Get-FileBase64 -Path $resolvedPath
  $headers = @{ Authorization = (Get-BasicAuthHeader -User $User -Pass $Pass) }

  if ($AuthHeader) {
    $headers.Authorization = $AuthHeader
  }

  $payload = @{
    file = $fileBase64
    data = @(
      @{ name = 'Jan Novak'; invoiceNumber = 'INV-001' }
      @{ name = 'Eva Svobodova'; invoiceNumber = 'INV-002' }
    )
    callbackUrl = $Callback
  }

  if ($CallbackHeader) {
    $payload.callbackHeaders = @{ Authorization = $CallbackHeader }
  }

  return Invoke-JsonRequest -Method 'Post' -Uri "$BaseUrl/generate-pdf-batch" -Headers $headers -Body $payload
}

switch ($Step) {
  'Help' {
    Write-Section 'Usage'
    Write-Host '.\s11.ps1 -Step Check'
    Write-Host '.\s11.ps1 -Step InstallDeps'
    Write-Host '.\s11.ps1 -Step StartServer'
    Write-Host '.\s11.ps1 -Step Health'
    Write-Host '.\s11.ps1 -Step Extract -DocxPath .\your-template.docx'
    Write-Host '.\s11.ps1 -Step Listen -CallbackPort 3001 -OutputPdfPath $env:USERPROFILE\Desktop\output.pdf'
    Write-Host '.\s11.ps1 -Step Batch -DocxPath .\your-template.docx -CallbackUrl http://127.0.0.1:3001/'
    Write-Host '.\s11.ps1 -Step Batch -CallbackUrl http://127.0.0.1:3001/'
  }

  'Check' {
    Write-Section 'Environment check'
    node -v
    npm -v
    Write-Host "Current folder: $((Get-Location).Path)"
  }

  'InstallDeps' {
    Write-Section 'Install dependencies'
    npm install
  }

  'StartServer' {
    Write-Section 'Start server'
    npm start
  }

  'Health' {
    Write-Section 'Health check'
    Invoke-RestMethod -Method Get -Uri "$ApiBase/health" | ConvertTo-Json -Depth 5
  }

  'Extract' {
    Write-Section 'Extract variables'
    $response = Send-ExtractRequest -BaseUrl $ApiBase -Path $DocxPath -AuthHeader '' -User $BasicUser -Pass $BasicPass
    $response | ConvertTo-Json -Depth 8
  }

  'Listen' {
    Start-CallbackListener -Port $CallbackPort -SavePath $OutputPdfPath
  }

  'Batch' {
    Write-Section 'Send batch request'
    $response = Send-BatchRequest -BaseUrl $ApiBase -Path $DocxPath -Callback $CallbackUrl -AuthHeader '' -User $BasicUser -Pass $BasicPass -CallbackHeader $CallbackAuthHeader
    $response | ConvertTo-Json -Depth 8
  }
}
