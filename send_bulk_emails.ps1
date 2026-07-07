# ==============================================================================
# VAPE 'R' AUS - BULK ORDER CONFIRMATION DISPATCHER
# ==============================================================================
# This script loads all orders from your Firebase database, formats them into a
# beautiful brand-aligned HTML template with an apology intro, and sends them
# from admin@vaperaus.com via SMTP.
# ==============================================================================

param(
    [string]$TestEmail = "vapesonlineaustralia@proton.me",
    [switch]$SendAll = $false,
    [string]$Password = "",
    [switch]$Force = $false
)

# SMTP Configurations (Configured for local ProtonMail Bridge)
$SmtpServer = "127.0.0.1"
$SmtpPort = 1025
$Username = "vapesonlineaustralia@proton.me"

# Set security protocols
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

# Prompt for Password securely if not provided
Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host "         Vape 'R' Aus - Bulk Email Confirmation Dispatcher" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Yellow

if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "Please enter the password for: $Username" -ForegroundColor Cyan
    $SecPassword = Read-Host -AsSecureString
} else {
    $SecPassword = ConvertTo-SecureString $Password -AsPlainText -Force
}

if ($null -eq $SecPassword) {
    Write-Error "Password is required to proceed."
    exit
}

# Fetch orders from Firebase
Write-Host "`nLoading orders from Firebase Realtime Database..." -ForegroundColor Yellow
$DbUrl = "https://vapes-99ad2-default-rtdb.asia-southeast1.firebasedatabase.app/orders.json"
try {
    $orders = Invoke-RestMethod -Uri $DbUrl -TimeoutSec 10
} catch {
    Write-Error "Failed to fetch orders from database: $_"
    exit
}

# Parse orders into list
$ParsedOrders = @()
foreach ($prop in $orders.psobject.properties) {
    $item = $prop.value
    if ($item -and $item.customer) {
        $ParsedOrders += $item
    }
}

Write-Host "Successfully loaded $($ParsedOrders.Count) orders." -ForegroundColor Green

# Apology Message Header
$ApologyText = @"
Hi {CustomerName},<br><br>
First, please accept our sincere apologies for the delay in sending your order confirmation. We have been working hard behind the scenes to get our new storefront and system fully set up and synchronized. We are completely ready to process your order now, and we promise you won't experience any further delays.<br><br>
You are the lifeblood that keeps us alive, and we want to give you the absolute best experience possible! 🖤<br><br>
Below are your order details and payment instructions to complete your checkout. Once payment is received, your package will be dispatched from Melbourne within 48 hours.
"@

# Function to generate HTML Body
function Get-EmailBody($Order, $ApologyHtml) {
    # Generate items table
    $ItemsRows = ""
    foreach ($item in $Order.items) {
        $itemTotal = [double]($item.total)
        $ItemsRows += @"
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #ccc;">$($item.name) ($($item.flavor))</td>
            <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #ccc; text-align: center;">$($item.quantity)</td>
            <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #d4af37; text-align: right; font-weight: bold;">$($itemTotal.ToString("C"))</td>
        </tr>
"@
    }

    $formattedTotal = [double]($Order.total)
    $formattedDate = (Get-Date $Order.date).ToString("dd/MM/yyyy HH:mm")

    # Interpolate customer name in apology
    $intro = $ApologyHtml -replace "\{CustomerName\}", $Order.customer.name

    $body = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Order Confirmation #$($Order.orderId)</title>
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
                $intro
            </td>
        </tr>

        <!-- Order details card -->
        <tr>
            <td style="padding: 0 25px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; font-size: 13px;">
                    <tr>
                        <td style="color: #888; padding-bottom: 8px;">Order ID:</td>
                        <td style="font-weight: bold; color: #fff; padding-bottom: 8px; text-align: right;">#$($Order.orderId)</td>
                    </tr>
                    <tr>
                        <td style="color: #888; padding-bottom: 8px;">Date:</td>
                        <td style="color: #ccc; padding-bottom: 8px; text-align: right;">$formattedDate</td>
                    </tr>
                    <tr>
                        <td style="color: #888;">Order Reference:</td>
                        <td style="font-weight: bold; color: #d4af37; text-align: right; font-size: 15px;">$($Order.refCode)</td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Items Table -->
        <tr>
            <td style="padding: 25px 25px 15px 25px;">
                <h3 style="font-size: 14px; color: #d4af37; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid rgba(212,175,55,0.2); padding-bottom: 5px;">Your Ordered Items</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                    <thead>
                        <tr style="color: #888; text-transform: uppercase; font-size: 11px;">
                            <th align="left" style="padding: 5px 10px;">Item</th>
                            <th align="center" style="padding: 5px 10px; width: 60px;">Qty</th>
                            <th align="right" style="padding: 5px 10px; width: 80px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        $ItemsRows
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="padding: 15px 10px; font-weight: bold; color: #fff; text-transform: uppercase; font-size: 12px;">Total Payable</td>
                            <td align="right" style="padding: 15px 10px; font-weight: bold; color: #d4af37; font-size: 16px;">$($formattedTotal.ToString("C"))</td>
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
                            👉 PAYMENT DETAILS & INSTRUCTIONS
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 15px; border-bottom: 1px dashed rgba(212,175,55,0.2);">
                            <strong style="color: #fff; display: block; margin-bottom: 5px; font-size: 14px;">Option 1: PayID (Instant Transfer)</strong>
                            • PayID Email: <strong style="color: #d4af37; font-family: monospace;">vapesonlineaustralia@proton.me</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-top: 15px;">
                            <strong style="color: #fff; display: block; margin-bottom: 5px; font-size: 14px;">Option 2: Bank Transfer (Standard Xfer)</strong>
                            • Account Name: <strong>Vapes Discount Australia</strong><br>
                            • BSB: <strong>086-724</strong><br>
                            • Account Number: <strong>91-591-6658</strong><br>
                            • Bank Name: <strong>NAB (National Australia Bank)</strong>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding-top: 20px; font-size: 12px; color: #ff5252; font-weight: bold; line-height: 1.4;">
                            ⚠️ IMPORTANT: Please include your Order Reference "$($Order.refCode)" in the payment description so we can match and dispatch your order instantly!
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td align="center" style="padding: 25px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 11px; color: #666; line-height: 1.4;">
                Thank you for choosing Vape 'R' Aus. We appreciate your support!<br>
                For support, contact us at: <a href="mailto:vapesonlineaustralia@proton.me" style="color: #d4af37; text-decoration: none;">vapesonlineaustralia@proton.me</a>
            </td>
        </tr>
    </table>
</body>
</html>
"@
    return $body
}

# Generate credentials object
$Creds = New-Object System.Management.Automation.PSCredential ($Username, $SecPassword)

# Custom SMTP mailer utilizing .NET SmtpClient to bypass self-signed SSL certificate issues
function Send-SmtpEmail($to, $subject, $htmlBody) {
    $mail = New-Object System.Net.Mail.MailMessage
    $mail.From = New-Object System.Net.Mail.MailAddress($Username)
    $mail.To.Add($to)
    $mail.Subject = $subject
    $mail.Body = $htmlBody
    $mail.IsBodyHtml = $true

    # Bypass certificate validation for ProtonMail Bridge self-signed certs
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

    try {
        $smtp = New-Object System.Net.Mail.SmtpClient($SmtpServer, $SmtpPort)
        $smtp.EnableSsl = $true
        $smtp.Credentials = $Creds.GetNetworkCredential()
        $smtp.Send($mail)
        $smtp.Dispose()
    } catch {
        # Retry without SSL/TLS in case the bridge has SSL disabled
        $smtp = New-Object System.Net.Mail.SmtpClient($SmtpServer, $SmtpPort)
        $smtp.EnableSsl = $false
        $smtp.Credentials = $Creds.GetNetworkCredential()
        $smtp.Send($mail)
        $smtp.Dispose()
    }
    $mail.Dispose()
}

if (-not $SendAll) {
    # ------------------ TEST MODE ------------------
    # Send test confirmation using the user's latest test order OCV-224581
    $TestOrder = $ParsedOrders | Where-Object { $_.orderId -eq "OCV-224581" }
    if ($null -eq $TestOrder) {
        $TestOrder = $ParsedOrders[0] # Fallback to first order if test order not found
    }
    
    if ($null -eq $TestOrder) {
        Write-Error "No orders found in database to use as a template."
        exit
    }

    Write-Host "`n[TEST MODE] Preparing test email for order $($TestOrder.orderId)..." -ForegroundColor Yellow
    $HtmlBody = Get-EmailBody $TestOrder $ApologyText
    
    Write-Host "Sending test email to $TestEmail from $Username..." -ForegroundColor Yellow
    try {
        Send-SmtpEmail $TestEmail "🛒 Order Confirmation #$($TestOrder.orderId)" $HtmlBody
        Write-Host "`nTest email sent successfully! Please check $TestEmail (including the spam/junk folder) to verify formatting and details." -ForegroundColor Green
        Write-Host "To send confirmations to all $($ParsedOrders.Count) customers, run: .\send_bulk_emails.ps1 -SendAll" -ForegroundColor Cyan
    } catch {
        Write-Error "Failed to send test email: $_"
        Write-Host "`nVerify your SMTP password and cPanel mail server settings." -ForegroundColor Red
    }
} else {
    # ------------------ SEND ALL MODE ------------------
    Write-Host "`n[SEND ALL MODE] Preparing to send emails to all $($ParsedOrders.Count) customers..." -ForegroundColor Yellow
    if (-not $Force) {
        $Confirm = Read-Host "Are you sure you want to send order confirmations to all $($ParsedOrders.Count) customers? (y/n)"
        if ($Confirm -ne "y") {
            Write-Host "Cancelled." -ForegroundColor Red
            exit
        }
    }

    $Count = 0
    $Failures = 0
    foreach ($order in $ParsedOrders) {
        $custEmail = $order.customer.email
        $custName = $order.customer.name
        
        # Skip dummy emails or tests if needed, but let's send to all registered valid emails
        if ($custEmail -notmatch '@') {
            Write-Host "Skipping invalid email: $custEmail for order $($order.orderId)" -ForegroundColor DarkGray
            continue
        }

        Write-Host "Sending order confirmation #$($order.orderId) to $custName ($custEmail)..." -ForegroundColor Yellow
        $HtmlBody = Get-EmailBody $order $ApologyText
        
        try {
            Send-SmtpEmail $custEmail "🛒 Order Confirmation #$($order.orderId)" $HtmlBody
            Write-Host "   -> Sent successfully!" -ForegroundColor Green
            $Count++
            # Throttle requests slightly to avoid mail server rate limits
            Start-Sleep -Seconds 1
        } catch {
            Write-Host "   -> Failed to send: $_" -ForegroundColor Red
            $Failures++
        }
    }
    
    Write-Host "`nDispatch complete! Successfully sent: $Count | Failed: $Failures" -ForegroundColor Green
}
