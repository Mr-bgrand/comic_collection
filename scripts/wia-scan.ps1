<#
    Scan one page from a WIA device and save it.

    Used by `npm run scan`. Kept as a separate script because WIA is a COM API
    with no usable Node binding — shelling out to PowerShell is the honest way to
    reach it rather than adding a native dependency.

    Usage:
      powershell -File scripts/wia-scan.ps1 -Out page.jpg -Dpi 300 -Match SV600

    Exits non-zero with a message on stderr if anything fails, so the caller can
    distinguish "no scanner" from "scan failed" from "saved".
#>

param(
    [Parameter(Mandatory = $true)][string]$Out,
    [int]$Dpi = 300,
    [string]$Match = 'SV600'
)

$ErrorActionPreference = 'Stop'

# WIA format GUIDs. The device reports BMP as its preferred format; JPEG keeps
# a full-bed 300dpi scan to a few hundred KB instead of ~25MB.
$JPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'

function Set-WiaProperty($Properties, [string]$Name, $Value) {
    foreach ($p in $Properties) {
        if ($p.Name -eq $Name) {
            try { $p.Value = $Value } catch { }
            return
        }
    }
}

try {
    $manager = New-Object -ComObject WIA.DeviceManager
    $info = $null
    for ($i = 1; $i -le $manager.DeviceInfos.Count; $i++) {
        $candidate = $manager.DeviceInfos.Item($i)
        if ($candidate.Properties('Name').Value -match $Match) { $info = $candidate; break }
    }

    if (-not $info) {
        [Console]::Error.WriteLine("NO_DEVICE: no WIA scanner matching '$Match'")
        exit 2
    }

    $device = $info.Connect()
    $item = $device.Items.Item(1)

    Set-WiaProperty $item.Properties 'Horizontal Resolution' $Dpi
    Set-WiaProperty $item.Properties 'Vertical Resolution' $Dpi

    # Extents are expressed in pixels at the current resolution, so they must be
    # rescaled when the DPI changes or the scan is cropped to the old 150dpi area.
    $scale = $Dpi / 150.0
    Set-WiaProperty $item.Properties 'Horizontal Extent' ([int](2829 * $scale))
    Set-WiaProperty $item.Properties 'Vertical Extent'   ([int](2097 * $scale))

    $image = $item.Transfer($JPEG)

    if (Test-Path $Out) { Remove-Item $Out -Force }
    $image.SaveFile($Out)

    Write-Output "OK: $Out"
    exit 0
}
catch {
    [Console]::Error.WriteLine("SCAN_FAILED: $($_.Exception.Message)")
    exit 3
}
