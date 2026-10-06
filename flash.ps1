#Requires -Version 5.1
<#
  Flash the AksharaScan switch firmware to an ESP32, from Windows.

      .\flash.ps1
      .\flash.ps1 -Port COM5      # if auto-detection picks the wrong one

  The macOS equivalent is flash.sh. Same job, same firmware.

  You do NOT need an Arduino board. "Arduino" here is only the software that
  compiles and uploads; the ESP32 is the only board involved.

  You also do not need this script to USE the switches. The firmware stays in
  the ESP32's flash across power cycles, so a laptop is only a 5 V supply. Run
  this only to flash the board the first time, or after the sketch changes.
#>
param([string]$Port)

$ErrorActionPreference = 'Stop'
if ($PSScriptRoot) { Set-Location $PSScriptRoot }

$FQBN   = 'esp32:esp32:esp32'
$SKETCH = 'app/firmware/switch'
$BAUD   = 115200

function Say($m) { Write-Host "`n$m" -ForegroundColor White }
function Ok($m)  { Write-Host "  [ok] $m" -ForegroundColor Green }
function Bad($m) { Write-Host "  [!!] $m" -ForegroundColor Red }

Say '1. Tools'
if (-not (Get-Command arduino-cli -ErrorAction SilentlyContinue)) {
  Write-Host '  installing arduino-cli...'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id ArduinoSA.CLI -e --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path','User')
  }
}
if (-not (Get-Command arduino-cli -ErrorAction SilentlyContinue)) {
  Bad 'arduino-cli is not installed and winget could not install it.'
  Write-Host @'

  Install it by hand, then run this again:
    https://arduino.github.io/arduino-cli/latest/installation/
  Download the Windows zip, extract arduino-cli.exe, and either put it next to
  this script or add its folder to PATH.
'@
  exit 1
}
Ok "$(arduino-cli version)"

if (-not (arduino-cli core list 2>$null | Select-String -Quiet '^esp32:esp32')) {
  Write-Host '  installing the ESP32 core (a few minutes, once)...'
  arduino-cli config add board_manager.additional_urls `
    https://espressif.github.io/arduino-esp32/package_esp32_index.json 2>$null | Out-Null
  arduino-cli core update-index | Out-Null
  arduino-cli core install esp32:esp32
}
Ok 'ESP32 core'

# "ESP32 HID Keyboard", not "ESP32 BLE Keyboard" -- the latter is absent from
# the Arduino registry and fails to build against ESP32 core 3.x. Same
# BleKeyboard class, so the sketch is unchanged.
if (-not (arduino-cli lib list 2>$null | Select-String -Quiet -SimpleMatch 'ESP32 HID Keyboard')) {
  arduino-cli lib install 'ESP32 HID Keyboard' | Out-Null
}
Ok 'BLE keyboard library'

Say '2. Finding the board'
if (-not $Port) {
  $found = @()
  try {
    $listed = arduino-cli board list --format json | ConvertFrom-Json
    $entries = if ($null -ne $listed.detected_ports) { $listed.detected_ports } else { $listed }
    foreach ($e in $entries) {
      $addr  = if ($e.port.address)  { $e.port.address }  else { $e.address }
      $proto = if ($e.port.protocol) { $e.port.protocol } else { $e.protocol }
      if ($proto -eq 'serial' -and $addr -match '^COM\d+$') { $found += $addr }
    }
  } catch { }
  if ($found.Count -eq 1) { $Port = $found[0] }
  elseif ($found.Count -gt 1) {
    Write-Host "  more than one serial port: $($found -join ', ')"
    Write-Host '  unplug anything else, or pass the right one: .\flash.ps1 -Port COMn'
    $Port = $found[0]
    Write-Host "  trying $Port"
  }
}

if (-not $Port) {
  Bad 'No ESP32 found.'
  Write-Host @'

  Check, in this order:

  1. Is it plugged in? The cable must carry DATA, not just power. Charging-only
     cables are the single most common cause and they look identical.
  2. Does a light come on? No light means no power.
  3. Still nothing: Windows needs the USB-serial driver for your board. Look at
     the small square chip next to the USB socket.
       CH340 chip  ->  https://www.wch-ic.com/downloads/CH341SER_EXE.html
       CP2102 chip ->  https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers
     Install, replug the board, then run this again.

  Serial ports Windows can see right now:
'@
  try {
    [System.IO.Ports.SerialPort]::GetPortNames() | ForEach-Object { Write-Host "    $_" }
  } catch {
    Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue |
      ForEach-Object { Write-Host "    $($_.DeviceID)  $($_.Name)" }
  }
  exit 1
}
Ok "found $Port"

Say '3. Compiling'
arduino-cli compile --fqbn $FQBN $SKETCH 2>&1 |
  Select-String -Pattern 'Sketch uses', 'error' | ForEach-Object { $_.Line }

Say '4. Uploading'
Write-Host "  If this stalls at 'Connecting...', hold the BOOT button on the ESP32"
Write-Host '  until it starts, then let go.'
arduino-cli upload -p $Port --fqbn $FQBN $SKETCH
Ok 'uploaded'

Say '5. Watching the serial output -- press your buttons'
Write-Host @'
  Expect:  AksharaScan: advertising, 2 switches
  Then on each press:   select down / select up / backspace down / backspace up

  The banner prints within milliseconds of reset, so you may well miss it --
  that is normal and not a fault. The press lines are the ones that matter.

  Nothing on a press means the wiring is wrong -- on a 4-pin button, use pins
  DIAGONALLY opposite each other. See HARDWARE.md. Ctrl-C to stop.

'@
arduino-cli monitor -p $Port -c "baudrate=$BAUD"
