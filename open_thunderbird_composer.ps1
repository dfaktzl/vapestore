# ==============================================================================
# VAPE 'R' AUS - THUNDERBIRD MANUAL EMAIL COMPOSER
# ==============================================================================
# This script fetches your latest orders from Firebase, lets you select one,
# and automatically opens Mozilla Thunderbird to compose a beautifully formatted
# HTML payment confirmation email.
# ==============================================================================

# Fetch orders from Firebase
Write-Host "Fetching orders from Firebase Realtime Database..." -ForegroundColor Yellow
$DbUrl = "https://vapes-99ad2-default-rtdb.asia-southeast1.firebasedatabase.app/orders.json"
try {
    $ordersData = Invoke-RestMethod -Uri $DbUrl -TimeoutSec 15
    Write-Host "Firebase fetch OK." -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "[ERROR] Failed to fetch orders from Firebase database." -ForegroundColor Red
    Write-Host "URL tried: $DbUrl" -ForegroundColor Yellow
    Write-Host "Error detail: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to close"
    exit
}

if ($null -eq $ordersData) {
    Write-Host "[ERROR] Firebase returned empty data. Check your database URL and rules." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit
}

# Parse and sort orders descending by date
$ordersList = @()
if ($ordersData -is [System.Array]) {
    foreach ($item in $ordersData) {
        if ($null -ne $item -and $null -ne $item.orderId) {
            $ordersList += $item
        }
    }
} else {
    foreach ($prop in $ordersData.psobject.properties) {
        $item = $prop.value
        if ($null -ne $item -and $null -ne $item.orderId) {
            $ordersList += $item
        }
    }
}

$ordersList = $ordersList | Sort-Object { [datetime]$_.date } -Descending

if ($ordersList.Count -eq 0) {
    Write-Host "[ERROR] No valid orders found in the database (orders may be empty or in unexpected format)." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit
}

# Display recent orders menu
Write-Host "`n==================================================================" -ForegroundColor Yellow
Write-Host "                SELECT AN ORDER TO COMPOSE EMAIL" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host ("{0,-5} {1,-15} {2,-20} {3,-12} {4,-10}" -f "Index", "Order ID", "Customer Name", "Total Price", "Ref Code") -ForegroundColor Cyan
Write-Host ("{0,-5} {1,-15} {2,-20} {3,-12} {4,-10}" -f "-----", "--------", "-------------", "-----------", "--------") -ForegroundColor Cyan

$limit = [Math]::Min(15, $ordersList.Count)
for ($i = 0; $i -lt $limit; $i++) {
    $order = $ordersList[$i]
    $name = $order.customer.name
    if ($name.Length -gt 18) { $name = $name.Substring(0, 15) + "..." }
    $total = [double]$order.total
    $ref = $order.refCode
    Write-Host ("[{0,3}] {1,-15} {2,-20} {3,-12:C} {4,-10}" -f ($i + 1), $order.orderId, $name, $total, $ref)
}

Write-Host ""
$selection = Read-Host "Select an order index (1-$limit) or 'q' to quit"
if ($selection -eq 'q' -or [string]::IsNullOrEmpty($selection)) {
    Write-Host "Cancelled." -ForegroundColor Red
    exit
}

$index = [int]$selection - 1
if ($index -lt 0 -or $index -ge $limit) {
    Write-Host "[ERROR] Invalid selection. Please run the script again and enter a number between 1 and $limit." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit
}

$selectedOrder = $ordersList[$index]
$custEmail = $selectedOrder.customer.email
$custName = $selectedOrder.customer.name
$orderId = $selectedOrder.orderId
$refCode = $selectedOrder.refCode

Write-Host "`nSelected Order: $orderId for $custName ($custEmail)" -ForegroundColor Green

# Escape HTML helper function for safety
function Escape-Html($str) {
    if ($null -eq $str) { return "" }
    return [string]$str -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;' -replace "'", '&#39;'
}

# Apply HTML escaping for email safety
$custName = Escape-Html $custName
$custEmail = Escape-Html $custEmail
$orderId = Escape-Html $orderId
$refCode = Escape-Html $refCode

# ------------------ GENERATE HTML EMAIL BODY ------------------
$bankPayId = "vapesonlineaustralia@proton.me"
$bankName = "NAB (National Australia Bank)"
$bankAccountName = "Vapes Discount Australia"
$bankBsb = "086-724"
$bankAccountNumber = "91-591-6658"
$contactEmail = "vapesonlineaustralia@proton.me"

# Generate items list rows
$itemsRows = ""
$subtotal = 0.0
foreach ($item in $selectedOrder.items) {
    $itemTotal = [double]$item.total
    $subtotal += $itemTotal
    $flavorText = if ($item.flavor) { " ($($item.flavor))" } else { "" }
    $formatText = if ($item.format) { " [$($item.format)]" } else { "" }
    $desc = Escape-Html "$($item.name)$flavorText$formatText"
    
    $itemsRows += @"
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #ffffff;">$desc</td>
            <td align="center" style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #cccccc;">$($item.quantity)</td>
            <td align="right" style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #d4af37; font-weight: bold;">$($itemTotal.ToString("C"))</td>
        </tr>
"@
}

$orderTotal = [double]$selectedOrder.total
$shippingFee = if ($orderTotal -ge 150) { 0.0 } else { 15.0 }
$formattedDate = (Get-Date $selectedOrder.date).ToString("dd/MM/yyyy HH:mm")

$htmlBody = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Order Confirmation #$orderId</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090a0c; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #ffffff;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #0e1014; border: 1px solid rgba(212,175,55,0.15); border-radius: 12px; margin-top: 30px; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
        <!-- Header -->
        <tr>
            <td align="center" style="padding: 30px 0; border-bottom: 1px solid rgba(212,175,55,0.15); background: linear-gradient(90deg, #12141c 0%, #1d190e 100%); border-top-left-radius: 11px; border-top-right-radius: 11px;">
                <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #d4af37;">VAPE 'R' AUS</span><br>
                <span style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 5px; display: inline-block;">Premium Vapes & Smokes</span>
            </td>
        </tr>
        
        <!-- Apology & Intro -->
        <tr>
            <td style="padding: 30px 25px; line-height: 1.6; font-size: 14px; color: #e0e0e0;">
                G'day <strong>$custName</strong>,<br><br>
                We're so glad you chose Vape 'R' Aus &mdash; thank you for your order! Since automatic email receipts can sometimes be delayed or blocked by spam filters, we're personally sending this confirmation so you have everything you need to complete your payment and get your order on the way.<br><br>
                Please process payment via PayID or bank transfer using the instructions below. Once payment is received, we'll have your order packed and shipped from Melbourne within 48 hours.
            </td>
        </tr>

        <!-- Order details card -->
        <tr>
            <td style="padding: 0 25px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; font-size: 13px;">
                    <tr>
                        <td style="color: #888; padding-bottom: 8px;">Order ID:</td>
                        <td style="font-weight: bold; color: #fff; padding-bottom: 8px; text-align: right;">#$orderId</td>
                    </tr>
                    <tr>
                        <td style="color: #888; padding-bottom: 8px;">Date:</td>
                        <td style="color: #ccc; padding-bottom: 8px; text-align: right;">$formattedDate</td>
                    </tr>
                    <tr>
                        <td style="color: #888;">Order Reference:</td>
                        <td style="font-weight: bold; color: #d4af37; text-align: right; font-size: 15px;">$refCode</td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Items Table -->
        <tr>
            <td style="padding: 25px 25px 15px 25px;">
                <h3 style="font-size: 14px; color: #d4af37; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid rgba(212,175,55,0.2); padding-bottom: 5px; margin-top: 0;">Your Ordered Items</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                    <thead>
                        <tr style="color: #888; text-transform: uppercase; font-size: 11px;">
                            <th align="left" style="padding: 5px 10px; border-bottom: 2px solid rgba(255,255,255,0.08);">Item</th>
                            <th align="center" style="padding: 5px 10px; width: 60px; border-bottom: 2px solid rgba(255,255,255,0.08);">Qty</th>
                            <th align="right" style="padding: 5px 10px; width: 80px; border-bottom: 2px solid rgba(255,255,255,0.08);">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        $itemsRows
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="padding: 10px; color: #888;"><strong style="color: #cccccc;">Subtotal</strong></td>
                            <td align="right" style="padding: 10px; color: #fff; font-weight: bold;">$($subtotal.ToString("C"))</td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding: 5px 10px; color: #888;"><strong style="color: #cccccc;">Shipping Fee</strong></td>
                            <td align="right" style="padding: 5px 10px; color: #fff; font-weight: bold;">$(if ($shippingFee -eq 0.0) { "Free Express" } else { $shippingFee.ToString("C") })</td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding: 15px 10px; font-weight: bold; color: #fff; text-transform: uppercase; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.08)">Total Payable</td>
                            <td align="right" style="padding: 15px 10px; font-weight: bold; color: #d4af37; font-size: 16px; border-top: 1px solid rgba(255,255,255,0.08)">$($orderTotal.ToString("C"))</td>
                        </tr>
                    </tfoot>
                </table>
            </td>
        </tr>

        <!-- Payment Instructions Callout -->
        <tr>
            <td style="padding: 0 25px 25px 25px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #d4af37; background-color: rgba(212,175,55,0.06); border-radius: 8px; padding: 20px; font-size: 13px; color: #e0e0e0;">
                    <tr>
                        <td align="center" style="font-size: 15px; font-weight: bold; color: #d4af37; padding-bottom: 15px;">
                            PAYMENT DETAILS & INSTRUCTIONS
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 15px; border-bottom: 1px dashed rgba(212,175,55,0.2);">
                            <strong style="color: #fff; display: block; margin-bottom: 5px; font-size: 14px;">Option 1: PayID (Instant Verification)</strong>
                            &bull; PayID Email: <strong style="color: #d4af37; font-family: monospace;">$bankPayId</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-top: 15px; padding-bottom: 15px; border-bottom: 1px dashed rgba(212,175,55,0.2);">
                            <strong style="color: #fff; display: block; margin-bottom: 5px; font-size: 14px;">Option 2: Bank Transfer (Standard Transfer)</strong>
                            &bull; Bank Name: <strong>$bankName</strong><br>
                            &bull; Account Name: <strong>$bankAccountName</strong><br>
                            &bull; BSB: <strong>$bankBsb</strong><br>
                            &bull; Account Number: <strong>$bankAccountNumber</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-top: 15px; font-size: 13px; color: #cccccc; line-height: 1.6;">
                            We apologise &mdash; due to regulation and other legal requirements, we are unable to accept Visa/Mastercard/Amex payments at this time. We'll be sure to let you know if that changes in the future!
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding-top: 20px; font-size: 12px; color: #ff5252; font-weight: bold; line-height: 1.4;">
                            <strong>IMPORTANT:</strong> Please include your Order Reference "$refCode" in the payment description so we can match and dispatch your order instantly!
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td align="center" style="padding: 20px; background-color: #0c0d12; border-bottom-left-radius: 11px; border-bottom-right-radius: 11px; font-size: 13px; color: #aaaaaa; border-top: 1px solid rgba(255,255,255,0.05); line-height: 1.8;">
                <strong>Thank you so much for supporting Vape 'R' Aus &mdash; we truly appreciate it!</strong><br>
                For any questions, feel free to reply to this email or reach us at $contactEmail.<br><br>
                <strong style="color: #d4af37;">Warm Regards,<br>Vape 'R' Aus Team</strong>
            </td>
        </tr>
    </table>
</body>
</html>
"@

# Save HTML file to Temp directory
$tempHtmlPath = [System.IO.Path]::Combine($env:TEMP, "vaperaus_order_confirm_$orderId.html")
[System.IO.File]::WriteAllText($tempHtmlPath, $htmlBody, [System.Text.Encoding]::UTF8)

# ------------------ LAUNCH THUNDERBIRD ------------------
$tbPaths = @(
    "C:\Program Files\Mozilla Thunderbird\thunderbird.exe",
    "C:\Program Files (x86)\Mozilla Thunderbird\thunderbird.exe",
    "thunderbird" # Checks path
)

$tbFound = $false
$tbExe = ""

foreach ($path in $tbPaths) {
    if ($path -eq "thunderbird") {
        $check = Get-Command "thunderbird" -ErrorAction SilentlyContinue
        if ($null -ne $check) {
            $tbFound = $true
            $tbExe = "thunderbird"
            break
        }
    } elseif (Test-Path $path) {
        $tbFound = $true
        $tbExe = $path
        break
    }
}

if (-not $tbFound) {
    Write-Host "`n[ERROR] Mozilla Thunderbird could not be located in Program Files or environment path." -ForegroundColor Red
    Write-Host "To use this script, please install Mozilla Thunderbird, or add its directory to your Windows environment variables." -ForegroundColor Yellow
    Write-Host "`nFallback: HTML content is generated and saved. You can open it manually at:" -ForegroundColor Cyan
    Write-Host "$tempHtmlPath" -ForegroundColor White
    exit
}

Write-Host "`nLaunching Thunderbird Composer..." -ForegroundColor Yellow
$subject = "Order Confirmation & Payment Instructions - #$orderId"

# Execute compose process
try {
    Start-Process $tbExe -ArgumentList "-compose `"to='$custEmail',subject='$subject',message='$tempHtmlPath',format=1`""
    Write-Host "`nSuccess! Thunderbird compose window has been opened with your pre-written rich email." -ForegroundColor Green
    Write-Host "You can make final edits and click 'Send' inside Thunderbird." -ForegroundColor Cyan
} catch {
    Write-Error "Failed to launch Thunderbird process: $_"
}

# Wait slightly and clean up the temp file
Start-Sleep -Seconds 10
if (Test-Path $tempHtmlPath) {
    Remove-Item $tempHtmlPath -Force -ErrorAction SilentlyContinue
}
