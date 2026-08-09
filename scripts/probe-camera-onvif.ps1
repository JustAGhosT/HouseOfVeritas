#Requires -Version 7.0

[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$OnvifPort = 8899,

    [ValidateRange(2, 30)]
    [int]$TimeoutSeconds = 8,

    [string]$RtspProbeExecutable,

    [string]$CredentialProvisionExecutable
)

$ErrorActionPreference = 'Stop'

function ConvertTo-TemporaryPlainText {
    param([Parameter(Mandatory)][Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Get-NodeText {
    param(
        [Parameter(Mandatory)][System.Xml.XmlNode]$Node,
        [Parameter(Mandatory)][string]$LocalName
    )

    $match = $Node.SelectSingleNode(".//*[local-name()='$LocalName']")
    if ($null -eq $match) { return $null }
    return $match.InnerText
}

function Get-ShortHash {
    param([Parameter(Mandatory)][string]$Value)

    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    try {
        $hash = [Security.Cryptography.SHA256]::HashData($bytes)
        return ([Convert]::ToHexString($hash)).Substring(0, 12).ToLowerInvariant()
    }
    finally {
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
}

function New-OnvifEnvelope {
    param(
        [Parameter(Mandatory)][string]$Username,
        [Parameter(Mandatory)][string]$Password,
        [Parameter(Mandatory)][string]$Body
    )

    $nonce = [byte[]]::new(16)
    [Security.Cryptography.RandomNumberGenerator]::Fill($nonce)
    $created = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    $createdBytes = [Text.Encoding]::UTF8.GetBytes($created)
    $passwordBytes = [Text.Encoding]::UTF8.GetBytes($Password)
    $digestInput = [byte[]]::new($nonce.Length + $createdBytes.Length + $passwordBytes.Length)

    try {
        [Array]::Copy($nonce, 0, $digestInput, 0, $nonce.Length)
        [Array]::Copy($createdBytes, 0, $digestInput, $nonce.Length, $createdBytes.Length)
        [Array]::Copy($passwordBytes, 0, $digestInput, $nonce.Length + $createdBytes.Length, $passwordBytes.Length)
        $digest = [Convert]::ToBase64String([Security.Cryptography.SHA1]::HashData($digestInput))
        $nonceText = [Convert]::ToBase64String($nonce)
        $escapedUsername = [Security.SecurityElement]::Escape($Username)

        return @"
<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
            xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
            xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Header>
    <wsse:Security s:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>$escapedUsername</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">$digest</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">$nonceText</wsse:Nonce>
        <wsu:Created>$created</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>
  <s:Body>$Body</s:Body>
</s:Envelope>
"@
    }
    finally {
        [Array]::Clear($nonce, 0, $nonce.Length)
        [Array]::Clear($createdBytes, 0, $createdBytes.Length)
        [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
        [Array]::Clear($digestInput, 0, $digestInput.Length)
    }
}

function Invoke-OnvifRequest {
    param(
        [Parameter(Mandatory)][Net.Http.HttpClient]$Client,
        [Parameter(Mandatory)][Uri]$Endpoint,
        [Parameter(Mandatory)][string]$Action,
        [Parameter(Mandatory)][string]$Username,
        [Parameter(Mandatory)][string]$Password,
        [Parameter(Mandatory)][string]$Body
    )

    $envelope = New-OnvifEnvelope -Username $Username -Password $Password -Body $Body
    $content = [Net.Http.StringContent]::new($envelope, [Text.Encoding]::UTF8)
    $content.Headers.ContentType = [Net.Http.Headers.MediaTypeHeaderValue]::Parse(
        "application/soap+xml; charset=utf-8; action=`"$Action`""
    )

    try {
        $response = $Client.PostAsync($Endpoint, $content).GetAwaiter().GetResult()
        try {
            if (-not $response.IsSuccessStatusCode) {
                throw "ONVIF request failed with HTTP $([int]$response.StatusCode). Response body suppressed."
            }

            $responseText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            try {
                return [xml]$responseText
            }
            finally {
                $responseText = $null
            }
        }
        finally {
            $response.Dispose()
        }
    }
    finally {
        $content.Dispose()
        $envelope = $null
    }
}

function Assert-LocalServiceUri {
    param(
        [Parameter(Mandatory)][Uri]$Uri,
        [Parameter(Mandatory)][string]$ExpectedHost
    )

    if ($Uri.Scheme -notin @('http', 'https')) {
        throw 'Camera returned a service address with an unsupported scheme.'
    }
    if (-not [string]::Equals($Uri.DnsSafeHost, $ExpectedHost, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Camera returned a service address for a different host; refusing to follow it.'
    }
}

function Get-Md5Hex {
    param([Parameter(Mandatory)][string]$Value)

    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    try {
        return ([Convert]::ToHexString([Security.Cryptography.MD5]::HashData($bytes))).ToLowerInvariant()
    }
    finally {
        [Array]::Clear($bytes, 0, $bytes.Length)
    }
}

function Read-ExactBytes {
    param(
        [Parameter(Mandatory)][IO.Stream]$Stream,
        [Parameter(Mandatory)][int]$Length
    )

    $buffer = [byte[]]::new($Length)
    $offset = 0
    while ($offset -lt $Length) {
        $read = $Stream.Read($buffer, $offset, $Length - $offset)
        if ($read -le 0) { throw 'RTSP connection closed unexpectedly.' }
        $offset += $read
    }
    return $buffer
}

function Read-RtspResponse {
    param([Parameter(Mandatory)][IO.Stream]$Stream)

    $headerBytes = [Collections.Generic.List[byte]]::new()
    while ($headerBytes.Count -lt 32768) {
        $value = $Stream.ReadByte()
        if ($value -lt 0) { throw 'RTSP connection closed before a response arrived.' }
        $headerBytes.Add([byte]$value)
        $count = $headerBytes.Count
        if ($count -ge 4 -and
            $headerBytes[$count - 4] -eq 13 -and $headerBytes[$count - 3] -eq 10 -and
            $headerBytes[$count - 2] -eq 13 -and $headerBytes[$count - 1] -eq 10) {
            break
        }
    }
    if ($headerBytes.Count -ge 32768) { throw 'RTSP response headers exceeded the safe limit.' }

    $headerText = [Text.Encoding]::ASCII.GetString($headerBytes.ToArray())
    $lines = $headerText -split "`r`n"
    if ($lines[0] -notmatch '^RTSP/\d\.\d\s+(\d{3})') { throw 'Camera returned an invalid RTSP status line.' }
    $statusCode = [int]$Matches[1]
    $headers = @{}
    foreach ($line in $lines | Select-Object -Skip 1) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $separator = $line.IndexOf(':')
        if ($separator -gt 0) {
            $headers[$line.Substring(0, $separator).Trim()] = $line.Substring($separator + 1).Trim()
        }
    }

    $contentLength = 0
    if ($headers.ContainsKey('Content-Length')) {
        $contentLength = [int]$headers['Content-Length']
        if ($contentLength -lt 0 -or $contentLength -gt 1048576) {
            throw 'RTSP response body exceeded the safe limit.'
        }
    }
    $bodyBytes = if ($contentLength -gt 0) { Read-ExactBytes -Stream $Stream -Length $contentLength } else { [byte[]]::new(0) }
    try {
        [pscustomobject]@{
            StatusCode = $statusCode
            Headers = $headers
            Body = [Text.Encoding]::UTF8.GetString($bodyBytes)
        }
    }
    finally {
        if ($bodyBytes.Length -gt 0) { [Array]::Clear($bodyBytes, 0, $bodyBytes.Length) }
    }
}

function Send-RtspRequest {
    param(
        [Parameter(Mandatory)][IO.Stream]$Stream,
        [Parameter(Mandatory)][string]$Method,
        [Parameter(Mandatory)][Uri]$Uri,
        [Parameter(Mandatory)][int]$CSeq,
        [hashtable]$Headers = @{}
    )

    $builder = [Text.StringBuilder]::new()
    [void]$builder.Append("$Method $($Uri.AbsoluteUri) RTSP/1.0`r`n")
    [void]$builder.Append("CSeq: $CSeq`r`n")
    [void]$builder.Append("User-Agent: Deck camera transport proof`r`n")
    foreach ($entry in $Headers.GetEnumerator()) {
        [void]$builder.Append("$($entry.Key): $($entry.Value)`r`n")
    }
    [void]$builder.Append("`r`n")
    $requestBytes = [Text.Encoding]::ASCII.GetBytes($builder.ToString())
    try {
        $Stream.Write($requestBytes, 0, $requestBytes.Length)
        $Stream.Flush()
        return Read-RtspResponse -Stream $Stream
    }
    finally {
        [Array]::Clear($requestBytes, 0, $requestBytes.Length)
        $builder.Clear() | Out-Null
    }
}

function New-RtspDigestState {
    param([Parameter(Mandatory)][string]$Challenge)

    if ($Challenge -notmatch '^Digest\s+') { throw 'RTSP did not require Digest authentication.' }
    $values = @{}
    foreach ($match in [regex]::Matches($Challenge.Substring(7), '(?<key>[A-Za-z]+)=(?:"(?<quoted>[^"]*)"|(?<token>[^,\s]+))')) {
        $value = if ($match.Groups['quoted'].Success) { $match.Groups['quoted'].Value } else { $match.Groups['token'].Value }
        $values[$match.Groups['key'].Value] = $value
    }
    if (-not $values['realm'] -or -not $values['nonce']) { throw 'RTSP Digest challenge was incomplete.' }
    if ($values['algorithm'] -and $values['algorithm'] -ne 'MD5') { throw 'RTSP Digest algorithm is unsupported.' }
    if ($values['qop'] -and ($values['qop'] -split ',' | ForEach-Object Trim) -notcontains 'auth') {
        throw 'RTSP Digest challenge did not offer qop=auth.'
    }

    [pscustomobject]@{
        Realm = $values['realm']
        Nonce = $values['nonce']
        Opaque = $values['opaque']
        Qop = if ($values['qop']) { 'auth' } else { $null }
        NextNonceCount = 1
    }
}

function New-RtspAuthorization {
    param(
        [Parameter(Mandatory)]$Digest,
        [Parameter(Mandatory)][string]$Username,
        [Parameter(Mandatory)][string]$Password,
        [Parameter(Mandatory)][string]$Method,
        [Parameter(Mandatory)][Uri]$Uri
    )

    $nonceCount = $Digest.NextNonceCount.ToString('x8')
    $Digest.NextNonceCount++
    $cnonceBytes = [byte[]]::new(12)
    [Security.Cryptography.RandomNumberGenerator]::Fill($cnonceBytes)
    try {
        $cnonce = [Convert]::ToHexString($cnonceBytes).ToLowerInvariant()
        $digestUri = $Uri.AbsoluteUri
        $ha1 = Get-Md5Hex "$Username`:$($Digest.Realm)`:$Password"
        $ha2 = Get-Md5Hex "$Method`:$digestUri"
        $response = if ($Digest.Qop) {
            Get-Md5Hex "$ha1`:$($Digest.Nonce)`:$nonceCount`:$cnonce`:auth`:$ha2"
        }
        else {
            Get-Md5Hex "$ha1`:$($Digest.Nonce)`:$ha2"
        }

        $parts = @(
            "username=`"$Username`"",
            "realm=`"$($Digest.Realm)`"",
            "nonce=`"$($Digest.Nonce)`"",
            "uri=`"$digestUri`"",
            "response=`"$response`"",
            'algorithm=MD5'
        )
        if ($Digest.Qop) { $parts += "qop=auth, nc=$nonceCount, cnonce=`"$cnonce`"" }
        if ($Digest.Opaque) { $parts += "opaque=`"$($Digest.Opaque)`"" }
        return 'Digest ' + ($parts -join ', ')
    }
    finally {
        [Array]::Clear($cnonceBytes, 0, $cnonceBytes.Length)
    }
}

function Get-H264ControlUri {
    param(
        [Parameter(Mandatory)][string]$Sdp,
        [Parameter(Mandatory)][Uri]$BaseUri
    )

    if ($Sdp -notmatch '(?im)^a=rtpmap:\d+\s+H264/90000') { throw 'RTSP SDP did not advertise H.264 video.' }
    $inVideo = $false
    $control = $null
    foreach ($line in $Sdp -split "`r?`n") {
        if ($line -match '^m=') { $inVideo = $line -match '^m=video\s' }
        elseif ($inVideo -and $line -match '^a=control:(.+)$') { $control = $Matches[1].Trim(); break }
    }
    if (-not $control) { throw 'RTSP SDP did not provide a video control address.' }
    if ($control -match '^rtsp://') { return [Uri]::new($control) }
    return [Uri]::new($BaseUri, $control)
}

function Test-RtspTransportOnce {
    param(
        [Parameter(Mandatory)][Uri]$Uri,
        [Parameter(Mandatory)][string]$Username,
        [Parameter(Mandatory)][string]$Password,
        [Parameter(Mandatory)][int]$Attempt,
        [Parameter(Mandatory)][int]$TimeoutMilliseconds
    )

    $client = [Net.Sockets.TcpClient]::new()
    $stream = $null
    $sessionId = $null
    try {
        if (-not $client.ConnectAsync($Uri.DnsSafeHost, $Uri.Port).Wait($TimeoutMilliseconds) -or -not $client.Connected) {
            throw 'RTSP TCP connection timed out.'
        }
        $stream = $client.GetStream()
        $stream.ReadTimeout = $TimeoutMilliseconds
        $stream.WriteTimeout = $TimeoutMilliseconds

        $unauthenticated = Send-RtspRequest -Stream $stream -Method 'DESCRIBE' -Uri $Uri -CSeq 1 -Headers @{ Accept = 'application/sdp' }
        if ($unauthenticated.StatusCode -eq 200) { throw 'RTSP accepted an unauthenticated request; stop and isolate the camera.' }
        if ($unauthenticated.StatusCode -ne 401 -or -not $unauthenticated.Headers['WWW-Authenticate']) {
            throw "RTSP authentication challenge failed with status $($unauthenticated.StatusCode)."
        }
        $digest = New-RtspDigestState $unauthenticated.Headers['WWW-Authenticate']

        $describeAuth = New-RtspAuthorization -Digest $digest -Username $Username -Password $Password -Method 'DESCRIBE' -Uri $Uri
        $described = Send-RtspRequest -Stream $stream -Method 'DESCRIBE' -Uri $Uri -CSeq 2 -Headers @{ Accept = 'application/sdp'; Authorization = $describeAuth }
        if ($described.StatusCode -ne 200) { throw "Authenticated RTSP DESCRIBE failed with status $($described.StatusCode)." }
        $baseUri = if ($described.Headers['Content-Base']) { [Uri]::new($described.Headers['Content-Base']) } else { $Uri }
        if ($baseUri.DnsSafeHost -ne $Uri.DnsSafeHost) { throw 'RTSP returned a control address for a different host.' }
        $controlUri = Get-H264ControlUri -Sdp $described.Body -BaseUri $baseUri
        if ($controlUri.DnsSafeHost -ne $Uri.DnsSafeHost) { throw 'RTSP returned a video address for a different host.' }

        $setupAuth = New-RtspAuthorization -Digest $digest -Username $Username -Password $Password -Method 'SETUP' -Uri $controlUri
        $setup = Send-RtspRequest -Stream $stream -Method 'SETUP' -Uri $controlUri -CSeq 3 -Headers @{
            Authorization = $setupAuth
            Transport = 'RTP/AVP/TCP;unicast;interleaved=0-1'
        }
        if ($setup.StatusCode -ne 200 -or -not $setup.Headers['Session']) { throw "RTSP video SETUP failed with status $($setup.StatusCode)." }
        $sessionId = ($setup.Headers['Session'] -split ';')[0].Trim()

        $playAuth = New-RtspAuthorization -Digest $digest -Username $Username -Password $Password -Method 'PLAY' -Uri $Uri
        $played = Send-RtspRequest -Stream $stream -Method 'PLAY' -Uri $Uri -CSeq 4 -Headers @{ Authorization = $playAuth; Session = $sessionId }
        if ($played.StatusCode -ne 200) { throw "RTSP PLAY failed with status $($played.StatusCode)." }

        for ($packet = 0; $packet -lt 30; $packet++) {
            $marker = $stream.ReadByte()
            if ($marker -ne 0x24) { throw 'RTSP interleaved stream returned an unexpected frame marker.' }
            $channel = $stream.ReadByte()
            $lengthBytes = Read-ExactBytes -Stream $stream -Length 2
            $length = ([int]$lengthBytes[0] -shl 8) -bor [int]$lengthBytes[1]
            $payload = Read-ExactBytes -Stream $stream -Length $length
            try {
                if ($channel -eq 0 -and $payload.Length -gt 12 -and (($payload[0] -shr 6) -eq 2)) {
                    return [pscustomobject]@{
                        Attempt = $Attempt
                        Authenticated = $true
                        Transport = 'rtsp_tcp'
                        Encoding = 'h264'
                        AudioSetUp = $false
                        RtpPacketBytes = $payload.Length
                        TeardownRequested = $true
                    }
                }
            }
            finally {
                [Array]::Clear($lengthBytes, 0, $lengthBytes.Length)
                [Array]::Clear($payload, 0, $payload.Length)
            }
        }
        throw 'No interleaved H.264 RTP packet arrived within the bounded read.'
    }
    finally {
        if ($null -ne $stream -and $sessionId) {
            try {
                $teardownAuth = New-RtspAuthorization -Digest $digest -Username $Username -Password $Password -Method 'TEARDOWN' -Uri $Uri
                $null = Send-RtspRequest -Stream $stream -Method 'TEARDOWN' -Uri $Uri -CSeq 5 -Headers @{ Authorization = $teardownAuth; Session = $sessionId }
            } catch { }
        }
        if ($null -ne $stream) { $stream.Dispose() }
        $client.Dispose()
    }
}

function Invoke-DeckRtspProbe {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][Uri]$Uri,
        [Parameter(Mandatory)][string]$Username,
        [Parameter(Mandatory)][string]$Password,
        [Parameter(Mandatory)][int]$TimeoutMilliseconds
    )

    $resolvedExecutable = (Resolve-Path -LiteralPath $Executable -ErrorAction Stop).Path
    if ([IO.Path]::GetExtension($resolvedExecutable) -ne '.exe') {
        throw 'The Deck RTSP probe path must identify an executable.'
    }

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $resolvedExecutable
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $payload = $null
    try {
        if (-not $process.Start()) { throw 'Deck RTSP probe could not start.' }
        $payload = @{
            url = $Uri.AbsoluteUri
            username = $Username
            password = $Password
        } | ConvertTo-Json -Compress
        $process.StandardInput.WriteLine($payload)
        $process.StandardInput.Close()

        if (-not $process.WaitForExit($TimeoutMilliseconds)) {
            $process.Kill($true)
            throw 'Deck RTSP probe exceeded its bounded runtime.'
        }
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        if ($process.ExitCode -ne 0) {
            $safeFailure = if ($stderr -match 'camera_rtsp_probe failed safely: ([a-z0-9_]+)') { $Matches[1] } else { 'unknown_failure' }
            throw "Deck RTSP probe failed safely: $safeFailure"
        }
        return $stdout | ConvertFrom-Json
    }
    finally {
        $payload = $null
        $process.Dispose()
    }
}

function Invoke-DeckCredentialProvision {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][Uri]$Uri,
        [Parameter(Mandatory)][string]$Username,
        [Parameter(Mandatory)][string]$Password
    )

    $resolvedExecutable = (Resolve-Path -LiteralPath $Executable -ErrorAction Stop).Path
    if ([IO.Path]::GetExtension($resolvedExecutable) -ne '.exe') {
        throw 'The Deck credential provision path must identify an executable.'
    }

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $resolvedExecutable
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $payload = $null
    try {
        if (-not $process.Start()) { throw 'Deck credential provision could not start.' }
        $payload = @{
            credential_ref = 'front-yard'
            url = $Uri.AbsoluteUri
            username = $Username
            password = $Password
        } | ConvertTo-Json -Compress
        $process.StandardInput.WriteLine($payload)
        $process.StandardInput.Close()

        if (-not $process.WaitForExit(10000)) {
            $process.Kill($true)
            throw 'Deck credential provision exceeded its bounded runtime.'
        }
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        if ($process.ExitCode -ne 0) {
            $safeFailure = if ($stderr -match 'camera_credential_provision failed safely: ([a-z0-9_]+)') { $Matches[1] } else { 'unknown_failure' }
            throw "Deck credential provision failed safely: $safeFailure"
        }
        if ($stdout.Trim() -ne 'camera credential stored safely') {
            throw 'Deck credential provision returned an unexpected response.'
        }
        Write-Host 'Deck camera credential stored in the operating-system credential manager.' -ForegroundColor Green
    }
    finally {
        $payload = $null
        $process.Dispose()
    }
}

$ipSecret = Read-Host 'Camera IP (kept local)' -AsSecureString
$usernameSecret = Read-Host 'Camera local username (kept local)' -AsSecureString
$passwordSecret = Read-Host 'Camera local password (kept local)' -AsSecureString

$cameraIp = $null
$username = $null
$password = $null
$handler = $null
$client = $null

try {
    $cameraIp = ConvertTo-TemporaryPlainText $ipSecret
    $username = ConvertTo-TemporaryPlainText $usernameSecret
    $password = ConvertTo-TemporaryPlainText $passwordSecret

    $parsedAddress = $null
    if (-not [Net.IPAddress]::TryParse($cameraIp, [ref]$parsedAddress)) {
        throw 'Camera IP was not a valid IPv4 or IPv6 address.'
    }
    if (-not $parsedAddress.IsIPv4MappedToIPv6 -and $parsedAddress.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
        throw 'This pilot probe currently accepts a private IPv4 camera address only.'
    }

    $deviceEndpoint = [Uri]::new("http://${cameraIp}:$OnvifPort/onvif/device_service")
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.Credentials = [Net.NetworkCredential]::new($username, $password)
    $handler.PreAuthenticate = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)

    $capabilities = Invoke-OnvifRequest -Client $client -Endpoint $deviceEndpoint `
        -Action 'http://www.onvif.org/ver10/device/wsdl/GetCapabilities' `
        -Username $username -Password $password `
        -Body '<tds:GetCapabilities><tds:Category>All</tds:Category></tds:GetCapabilities>'

    $mediaAddressNode = $capabilities.SelectSingleNode(
        "//*[local-name()='Capabilities']/*[local-name()='Media']/*[local-name()='XAddr']"
    )
    if ($null -eq $mediaAddressNode) {
        throw 'ONVIF responded, but did not advertise a Media service.'
    }

    $mediaEndpoint = [Uri]::new($mediaAddressNode.InnerText)
    Assert-LocalServiceUri -Uri $mediaEndpoint -ExpectedHost $deviceEndpoint.DnsSafeHost

    $profilesResponse = Invoke-OnvifRequest -Client $client -Endpoint $mediaEndpoint `
        -Action 'http://www.onvif.org/ver10/media/wsdl/GetProfiles' `
        -Username $username -Password $password -Body '<trt:GetProfiles />'
    $profileNodes = @($profilesResponse.SelectNodes("//*[local-name()='GetProfilesResponse']/*[local-name()='Profiles']"))
    if ($profileNodes.Count -eq 0) {
        throw 'The ONVIF Media service returned no profiles.'
    }

    $results = foreach ($profile in $profileNodes) {
        $token = $profile.Attributes['token'].Value
        $escapedToken = [Security.SecurityElement]::Escape($token)
        $streamResponse = Invoke-OnvifRequest -Client $client -Endpoint $mediaEndpoint `
            -Action 'http://www.onvif.org/ver10/media/wsdl/GetStreamUri' `
            -Username $username -Password $password `
            -Body "<trt:GetStreamUri><trt:StreamSetup><tt:Stream>RTP-Unicast</tt:Stream><tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport></trt:StreamSetup><trt:ProfileToken>$escapedToken</trt:ProfileToken></trt:GetStreamUri>"

        $streamUriNode = $streamResponse.SelectSingleNode("//*[local-name()='MediaUri']/*[local-name()='Uri']")
        $streamUri = if ($null -ne $streamUriNode) { [Uri]::new($streamUriNode.InnerText) } else { $null }
        $video = $profile.SelectSingleNode("./*[local-name()='VideoEncoderConfiguration']")
        $audio = $profile.SelectSingleNode("./*[local-name()='AudioEncoderConfiguration']")
        $width = if ($null -ne $video) { Get-NodeText -Node $video -LocalName 'Width' } else { $null }
        $height = if ($null -ne $video) { Get-NodeText -Node $video -LocalName 'Height' } else { $null }

        [pscustomobject]@{
            Profile          = "profile-$((Get-ShortHash $token).Substring(0, 6))"
            Encoding         = if ($null -ne $video) { Get-NodeText -Node $video -LocalName 'Encoding' } else { $null }
            Resolution       = if ($width -and $height) { "${width}x${height}" } else { $null }
            FrameRateLimit   = if ($null -ne $video) { Get-NodeText -Node $video -LocalName 'FrameRateLimit' } else { $null }
            BitrateLimitKbps = if ($null -ne $video) { Get-NodeText -Node $video -LocalName 'BitrateLimit' } else { $null }
            AudioAdvertised  = $null -ne $audio
            RtspAdvertised   = $null -ne $streamUri -and $streamUri.Scheme -eq 'rtsp'
            EmbeddedSecret   = $null -ne $streamUri -and -not [string]::IsNullOrEmpty($streamUri.UserInfo)
            RtspUri           = $streamUri
        }
    }

    Write-Host 'ONVIF authenticated successfully. Redacted profile report:' -ForegroundColor Green
    $results | Format-Table Profile, Encoding, Resolution, FrameRateLimit, BitrateLimitKbps, AudioAdvertised, RtspAdvertised, EmbeddedSecret -AutoSize

    $candidate = $results |
        Where-Object { $_.RtspAdvertised -and $_.Encoding -eq 'H264' } |
        Sort-Object @{ Expression = {
            if ($_.Resolution -match '^(\d+)x(\d+)$') { [int]$Matches[1] * [int]$Matches[2] } else { 0 }
        }; Descending = $true } |
        Select-Object -First 1

    if ($null -ne $candidate) {
        Write-Host "Candidate selected for playback proof: $($candidate.Profile) ($($candidate.Encoding), $($candidate.Resolution))." -ForegroundColor Green
        if ($RtspProbeExecutable) {
            Write-Host 'Running two bounded Deck-owned RTSP/TCP frame proofs (initial + reconnect)...' -ForegroundColor Cyan
            $proofs = 1..2 | ForEach-Object {
                $proof = Invoke-DeckRtspProbe -Executable $RtspProbeExecutable -Uri $candidate.RtspUri `
                    -Username $username -Password $password -TimeoutMilliseconds (($TimeoutSeconds + 12) * 1000)
                [pscustomobject]@{
                    Attempt = $_
                    Authenticated = $proof.authenticated
                    Transport = $proof.transport
                    Encoding = $proof.encoding
                    AudioSetUp = $proof.audioSetUp
                    FirstFrameBytes = $proof.firstFrameBytes
                    RandomAccessFrame = $proof.randomAccessFrame
                    RtpPacketLoss = $proof.rtpPacketLossBeforeFrame
                    TeardownCompleted = $proof.teardownCompleted
                }
            }
            $proofs | Format-Table -AutoSize
            if ($CredentialProvisionExecutable) {
                Invoke-DeckCredentialProvision -Executable $CredentialProvisionExecutable `
                    -Uri $candidate.RtspUri -Username $username -Password $password
            }
        }
        else {
            Write-Warning 'RTSP frame proof skipped because -RtspProbeExecutable was not supplied.'
        }
    }
    else {
        Write-Warning 'No H.264 RTSP profile was advertised. Do not guess a stream URL.'
    }
}
catch {
    Write-Error "Camera probe failed safely: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($null -ne $client) { $client.Dispose() }
    if ($null -ne $handler) { $handler.Dispose() }
    $cameraIp = $null
    $username = $null
    $password = $null
    Remove-Variable ipSecret, usernameSecret, passwordSecret -ErrorAction SilentlyContinue
}
