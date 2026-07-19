# PowerShell Static Article Generator & Sitemap Builder
# Usage: powershell -ExecutionPolicy Bypass -File build_articles.ps1

$configPath = "config.json"
$guidesPath = "guides.json"

if (-not (Test-Path $configPath)) {
    Write-Error "config.json not found!"
    exit 1
}
if (-not (Test-Path $guidesPath)) {
    Write-Error "guides.json not found!"
    exit 1
}

# 1. Load data with explicit UTF8 encoding to preserve Unicode emojis & en-dashes
$config = Get-Content -Raw -Encoding utf8 -Path $configPath | ConvertFrom-Json
$guides = Get-Content -Raw -Encoding utf8 -Path $guidesPath | ConvertFrom-Json

$settings = $config.settings
$siteName = $settings.siteName
if ($null -eq $siteName) { $siteName = "Vape 'R' Aus" }
$announcement = $settings.announcement
if ($null -eq $announcement) { $announcement = "FREE EXPRESS SHIPPING ON ALL ORDERS OVER `$150!" }
$contactEmail = $settings.contactEmail
if ($null -eq $contactEmail) { $contactEmail = "vapesonlineaustralia@proton.me" }
$contactPhone = $settings.contactPhone
if ($null -eq $contactPhone) { $contactPhone = "0402 179 489" }

# Create education folder
$eduDir = "education"
if (-not (Test-Path $eduDir)) {
    New-Item -ItemType Directory -Path $eduDir | Out-Null
}

Write-Host "Compiling educational articles into static HTML pages..." -ForegroundColor Cyan

# Robust Line-by-Line Markdown to HTML parser
function Convert-ContentToHtml($content) {
    # Standardize line endings and split
    $content = $content -replace "`r", ""
    $lines = $content -split "`n"
    
    $htmlParts = @()
    $inList = $false
    $listType = "" # "ul" or "ol"
    $inTable = $false
    
    foreach ($line in $lines) {
        $l = $line.Trim()
        
        # Handle empty lines
        if ($l -eq "") {
            if ($inList) {
                $htmlParts += "</$listType>"
                $inList = $false
            }
            if ($inTable) {
                $htmlParts += "</table></div>"
                $inTable = $false
            }
            continue
        }
        
        # Handle subheaders
        if ($l.StartsWith("### ")) {
            if ($inList) { $htmlParts += "</$listType>"; $inList = $false }
            if ($inTable) { $htmlParts += "</table></div>"; $inTable = $false }
            
            $title = $l.Substring(4).Trim()
            $htmlParts += "<h3>$title</h3>"
            continue
        }
        
        # Handle tables
        if ($l.StartsWith("|")) {
            if ($inList) { $htmlParts += "</$listType>"; $inList = $false }
            if ($l -match "^\|\s*---\s*\|") { continue } # separator row
            
            if (-not $inTable) {
                $htmlParts += "<div class='table-responsive'><table class='article-table'>"
                $inTable = $true
                $isHeader = $true
            } else {
                $isHeader = $false
            }
            
            $cells = $l.Split("|") | Where-Object { $_.Trim() -ne "" }
            $rowHtml = "<tr>"
            foreach ($cell in $cells) {
                $tag = if ($isHeader) { "th" } else { "td" }
                $cleanCell = $cell.Trim() -replace "\*\*(.*?)\*\*", "<strong>`$1</strong>"
                $rowHtml += "<$tag>$cleanCell</$tag>"
            }
            $rowHtml += "</tr>"
            $htmlParts += $rowHtml
            continue
        }
        
        # If we were in table but line is not table
        if ($inTable) {
            $htmlParts += "</table></div>"
            $inTable = $false
        }
        
        # Handle lists
        $isOrdered = $l -match "^\d+\.\s+"
        $isUnordered = $l.StartsWith("* ") -or $l.StartsWith("- ")
        
        if ($isOrdered -or $isUnordered) {
            $targetListType = if ($isOrdered) { "ol" } else { "ul" }
            
            if ($inList -and $listType -ne $targetListType) {
                # Close previous list if type changed
                $htmlParts += "</$listType>"
                $inList = $false
            }
            
            if (-not $inList) {
                $htmlParts += "<$targetListType>"
                $inList = $true
                $listType = $targetListType
            }
            
            # Clean list line
            $cleanLine = $l
            if ($isOrdered) {
                $cleanLine = $cleanLine -replace "^\d+\.\s+", ""
            } else {
                $cleanLine = $cleanLine -replace "^[*]\s+|^[-]\s+", ""
            }
            $cleanLine = $cleanLine -replace "\*\*(.*?)\*\*", "<strong>`$1</strong>"
            $htmlParts += "<li>$cleanLine</li>"
            continue
        }
        
        # If we were in list but line is not list
        if ($inList) {
            $htmlParts += "</$listType>"
            $inList = $false
        }
        
        # Standard paragraph line
        $cleanLine = $l -replace "\*\*(.*?)\*\*", "<strong>`$1</strong>"
        $htmlParts += "<p>$cleanLine</p>"
    }
    
    # Close any trailing lists or tables
    if ($inList) { $htmlParts += "</$listType>" }
    if ($inTable) { $htmlParts += "</table></div>" }
    
    return $htmlParts -join "`n"
}

# 2. Iterate and generate pages
foreach ($guide in $guides) {
    $id = $guide.id
    $title = $guide.title
    $keyword = $guide.keyword
    $date = $guide.date
    $summary = $guide.summary
    $author = $guide.author
    if ($null -eq $author) { $author = "Vape 'R' Aus Education" }
    
    $parsedBody = Convert-ContentToHtml $guide.content
    
    # Calculate reading time (roughly 220 words per minute)
    $wordCount = ($guide.content -split '\s+').Length
    $readTime = [Math]::Max(1, [Math]::Round($wordCount / 220))
    
    # Template HTML (escaped $ signs for prices and HTML entities for arrows/dashes)
    $html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-973WJXFS2F"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-973WJXFS2F');
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Security IP Block -->
  <script>
    (async () => {
      try {
        const geoResponse = await fetch("https://ipapi.co/json/");
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData && geoData.ip) {
            const cleanUrl = "https://vapes-99ad2-default-rtdb.asia-southeast1.firebasedatabase.app/";
            const sanitizedIp = geoData.ip.replace(/\./g, "-").replace(/:/g, "_");
            const blockResp = await fetch(cleanUrl + "blacklist/" + sanitizedIp + ".json");
            if (blockResp.ok) {
              const blockData = await blockResp.json();
              if (blockData && blockData.blocked === true) {
                document.documentElement.innerHTML = '<head><title>Website Seized</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style=\"margin:0; background:#ffffff;\"><div style=\"position:fixed; left:0; top:0; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; font-family:\'Times New Roman\',Times,serif; color:#000000; background:#ffffff;\"><div style=\"max-width:600px; text-align:center;\"><img src=\"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Coat_of_Arms_of_Australia.svg/400px-Coat_of_Arms_of_Australia.svg.png\" alt=\"Australian Coat of Arms\" style=\"width:200px; height:auto; margin-bottom:25px;\" /><h1 style=\"font-size:20px; font-weight:bold; line-height:1.6; margin:0 0 15px 0;\">The Australian Government has seized this website active immediately due to regulatory issues and other commerce failures, it is now the property of the Australian Competition & Consumer Commission (ACCC).</h1><p style=\"font-size:16px; line-height:1.6; margin:0 0 25px 0;\">For a period of no more or less than (60) days is it to be held as seized or until the Illicit Tobacco Taskforce (ITTF) has finished their investigation.</p><p style=\"font-size:14px; font-style:italic; color:#555555; margin:0;\">We are sorry for any inconvenience.</p></div></div></body>';
              }
            }
          }
        }
      } catch (e) {}
    })();
  </script>

  <!-- SEO Meta Tags -->
  <title>$title | $siteName</title>
  <meta name="description" content="$summary">
  <meta name="keywords" content="$keyword, cheap vapes, buy smokes online australia, iget bar, cigarettes carton">
  <link rel="canonical" href="https://vaperaus.com/education/$id.html">
  
  <!-- Open Graph -->
  <meta property="og:title" content="$title | $siteName">
  <meta property="og:description" content="$summary">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://vaperaus.com/education/$id.html">
  <meta property="og:site_name" content="$siteName">
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Styles -->
  <link rel="stylesheet" href="../css/design_system.css?v=30">
  <link rel="stylesheet" href="../css/main.css?v=30">
  
  <!-- Custom Article Page styling -->
  <style>
    .article-layout {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 40px;
      margin-top: 40px;
      margin-bottom: 60px;
    }
    .article-main {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 40px;
      box-shadow: var(--shadow-sm);
    }
    .article-header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 25px;
      margin-bottom: 30px;
    }
    .article-title {
      font-size: 32px;
      font-family: var(--font-title);
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
      margin-bottom: 15px;
    }
    .article-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 13px;
      color: var(--text-secondary);
    }
    .article-meta-item span {
      color: var(--gold-accent);
      font-weight: 600;
    }
    .article-body {
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.8;
      color: var(--text-secondary);
    }
    .article-body p {
      margin-bottom: 25px;
    }
    .article-body h3 {
      font-size: 20px;
      color: #fff;
      margin-top: 35px;
      margin-bottom: 15px;
      font-family: var(--font-title);
      font-weight: 600;
    }
    .article-body ul, .article-body ol {
      margin-bottom: 25px;
      padding-left: 20px;
    }
    .article-body li {
      margin-bottom: 10px;
    }
    .article-table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      font-size: 14px;
      text-align: left;
    }
    .article-table th {
      background: rgba(212, 175, 55, 0.1);
      color: var(--gold-accent);
      font-weight: 600;
      padding: 12px;
      border: 1px solid var(--border-color);
    }
    .article-table td {
      padding: 12px;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }
    .sidebar-sticky {
      position: sticky;
      top: 100px;
      display: flex;
      flex-direction: column;
      gap: 25px;
    }
    .sidebar-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 25px;
      box-shadow: var(--shadow-sm);
    }
    .sidebar-title {
      font-size: 18px;
      font-family: var(--font-title);
      color: #fff;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 10px;
    }
    .sidebar-product {
      display: flex;
      gap: 15px;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px dashed rgba(255,255,255,0.05);
      text-decoration: none;
      color: var(--text-secondary) !important;
      transition: all 0.2s ease;
    }
    .sidebar-product:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .sidebar-product:hover {
      color: var(--gold-accent) !important;
      opacity: 1;
    }
    .sidebar-product img {
      width: 60px;
      height: 60px;
      object-fit: contain;
      background: rgba(255,255,255,0.02);
      border-radius: 6px;
      border: 1px solid var(--border-color);
      padding: 4px;
    }
    .sidebar-product-info {
      flex: 1;
    }
    .sidebar-product-name {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .sidebar-product-price {
      font-size: 13px;
      color: var(--gold-accent);
      font-weight: 700;
    }
    @media (max-width: 992px) {
      .article-layout {
        grid-template-columns: 1fr;
      }
      .sidebar-sticky {
        position: static;
      }
    }
    @media (max-width: 576px) {
      .article-main {
        padding: 25px;
      }
      .article-title {
        font-size: 24px;
      }
    }
  </style>
  
  <!-- Schema.org JSON-LD structured data for Google Search -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://vaperaus.com/education/$id.html"
    },
    "headline": "$title",
    "description": "$summary",
    "datePublished": "$date",
    "dateModified": "$date",
    "author": {
      "@type": "Organization",
      "name": "$siteName"
    },
    "publisher": {
      "@type": "Organization",
      "name": "$siteName",
      "logo": {
        "@type": "ImageObject",
        "url": "https://vaperaus.com/img/logo.png"
      }
    }
  }
  </script>
</head>
<body>

  <div class="main-wrapper">
    <!-- PROMO BANNER -->
    <div class="promo-banner" style="background: linear-gradient(90deg, #12141c 0%, #1d190e 50%, #12141c 100%); border-bottom: 1px solid rgba(212, 175, 55, 0.25); color: #fff; padding: 14px 20px; font-size: 15px; font-family: var(--font-body); display: flex; justify-content: center; align-items: center; gap: 12px; z-index: 1000; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
      <span class="promo-badge" style="background: var(--gold-accent); color: #000; font-weight: 800; padding: 4px 12px; border-radius: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 0 10px rgba(212,175,55,0.3);">PROMO</span>
      <span id="promo-banner-text" style="letter-spacing: 0.2px; text-transform: uppercase; font-weight: 600;">DAILY HAPPY HOUR 5-6PM AEST: All orders get 10% off automatically! | Beat any competitor's quote by 10%!</span>
    </div>

    <!-- ANNOUNCEMENT BAR -->
    <div class="announcement-bar">
      <p>$announcement</p>
    </div>

    <!-- MAIN HEADER -->
    <header class="main-header">
      <div class="container header-container" style="justify-content: space-between;">
        <a href="../index.html" class="logo-link" style="display:flex; align-items:center; height:100%;">
          <img src="../img/logo.png" alt="Vape 'R' Aus Logo" style="height:50px; object-fit:contain; filter: drop-shadow(0 0 4px rgba(255,255,255,0.15));">
        </a>
        <div class="header-actions">
          <a href="../index.html#catalog" class="btn-primary" style="text-decoration:none; padding:10px 20px; font-size:14px;">SHOP STOREFRONT</a>
        </div>
      </div>
    </header>

    <!-- CONTENT WRAPPER -->
    <main class="container">
      <div class="article-layout">
        
        <!-- Main Article Panel -->
        <article class="article-main">
          <div class="article-header">
            <h1 class="article-title">$title</h1>
            <div class="article-meta-row">
              <div class="article-meta-item">Published: <span>$date</span></div>
              <div class="article-meta-item">Author: <span>$author</span></div>
              <div class="article-meta-item">Reading Time: <span>$readTime min read</span></div>
            </div>
          </div>
          
          <div class="article-body">
            $parsedBody
          </div>
        </article>
        
        <!-- Sidebar CTAs -->
        <aside class="article-sidebar">
          <div class="sidebar-sticky">
            
            <div class="sidebar-card">
              <h4 class="sidebar-title">Shop Best Sellers</h4>
              
              <a href="../index.html#catalog" class="sidebar-product">
                <img src="../img/iget_bar_3500.webp" alt="IGET Bar 3500">
                <div class="sidebar-product-info">
                  <div class="sidebar-product-name">IGET Bar 3500 Puffs</div>
                  <div class="sidebar-product-price">From `$33.00</div>
                </div>
              </a>
              
              <a href="../index.html#catalog" class="sidebar-product">
                <img src="../img/jnr_vapro_7000.webp" alt="JNR Vapro 7000">
                <div class="sidebar-product-info">
                  <div class="sidebar-product-name">JNR Vapro 7000 Puffs</div>
                  <div class="sidebar-product-price">From `$35.00</div>
                </div>
              </a>

              <a href="../index.html#catalog" class="sidebar-product">
                <img src="../img/winfield_blue.png" alt="Winfield Blue Carton">
                <div class="sidebar-product-info">
                  <div class="sidebar-product-name">Winfield Blue Carton (10x25s)</div>
                  <div class="sidebar-product-price">From `$260.00</div>
                </div>
              </a>

              <a href="../index.html#catalog" class="sidebar-product">
                <img src="../img/marlboro_gold.webp" alt="Marlboro Gold Carton">
                <div class="sidebar-product-info">
                  <div class="sidebar-product-name">Marlboro Gold Carton (10x20s)</div>
                  <div class="sidebar-product-price">From `$250.00</div>
                </div>
              </a>
              
            </div>

            <div class="sidebar-card" style="background: linear-gradient(135deg, #1d190e 0%, #12141c 100%); border-color: rgba(212,175,55,0.3); text-align: center;">
              <h4 class="sidebar-title" style="border-bottom:none; margin-bottom:10px;">Why Buy From Us?</h4>
              <p style="font-size:13px; color:var(--text-secondary); line-height:1.6; margin-bottom:20px;">
                We ship express from Melbourne within 48 hours. Discreet packaging, bulk discounts, and the cheapest prices in Australia guaranteed.
              </p>
              <a href="../index.html#catalog" class="btn-primary" style="display:block; text-decoration:none; padding:12px; font-size:13px;">SHOP CATALOG</a>
            </div>

          </div>
        </aside>
        
      </div>
    </main>

    <!-- FOOTER -->
    <footer class="main-footer" style="margin-top:60px;">
      <div class="container footer-grid">
        <div>
          <h3 class="footer-col-title">$siteName</h3>
          <p style="font-size: 13px; line-height: 1.6; color: var(--text-muted); margin-bottom: 20px;">
            Australia's leading discount outlet for bulk cigarette cartons and high puff disposable vapes. Express post nationwide.
          </p>
        </div>
        
        <div>
          <h3 class="footer-col-title">Product Catalog</h3>
          <ul class="footer-links">
            <li><a href="../index.html#catalog">Browse Storefront</a></li>
            <li><a href="../index.html#faq">FAQ</a></li>
          </ul>
        </div>
        
        <div>
          <h3 class="footer-col-title">Support</h3>
          <ul class="footer-links">
            <li><a href="../index.html#contact-us">Contact Us</a></li>
          </ul>
        </div>
        
        <div>
          <h3 class="footer-col-title">Order Info</h3>
          <div class="footer-contact-item">
            <span class="footer-contact-icon">✉</span>
            <span>$contactEmail</span>
          </div>
          <div class="footer-contact-item">
            <span class="footer-contact-icon">☎</span>
            <span>$contactPhone</span>
          </div>
        </div>
      </div>
      
      <div class="container">
        <div class="footer-bottom">
          <div class="footer-copy">
            &copy; 2026 $siteName. All rights reserved.
          </div>
          <div style="display: flex; gap: 15px; color: var(--text-muted); font-size:11px;">
            <span>PayID &amp; Bank Transfer Only</span>
            <span style="opacity:0.3;">|</span>
            <span>18+ Age Restricted</span>
          </div>
        </div>
      </div>
    </footer>

  </div>

</body>
</html>
"@
    
    # Write file using native UTF8 (No BOM) .NET writer to completely resolve emoji and accent characters
    $outPath = Join-Path $eduDir "$id.html"
    [System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
    Write-Host "Generated: $outPath" -ForegroundColor Green
}


# 2b. Generate static product pages
Write-Host "Compiling product pages into static HTML..." -ForegroundColor Cyan
$prodDir = "products"
if (-not (Test-Path $prodDir)) {
    New-Item -ItemType Directory -Path $prodDir | Out-Null
}

foreach ($prod in $config.products) {
    $id = $prod.id
    $brand = $prod.brand
    $name = $prod.name
    $description = $prod.description
    $price = $prod.price
    $boxPrice = $prod.boxPrice
    $image = $prod.image
    $inStock = $prod.inStock
    $isBundle = $prod.isBundle
    
    # Calculate deterministic sold count
    $sum = 0
    for ($charIdx = 0; $charIdx -lt $id.Length; $charIdx++) {
        $sum += [int][char]$id[$charIdx]
    }
    
    $soldCount = 58 + ($sum % 30)

    # Top 5 best sellers overrides
    if ($id -eq "alibarbar-link-12k") {
        $soldCount = 135 + ($sum % 50)
    } elseif ($id -eq "alibarbar-ingot-9k") {
        $soldCount = 120 + ($sum % 40)
    } elseif ($id -eq "iget-bar-3500") {
        $soldCount = 105 + ($sum % 30)
    } elseif ($id -eq "iget-bar-plus-6000") {
        $soldCount = 115 + ($sum % 40)
    } elseif ($id -eq "jnr-falcon-x-18000") {
        $soldCount = 130 + ($sum % 45)
    }

    # Increment popular items deterministically each day since July 1, 2026
    if ($prod.popular -eq $true) {
        $epoch = Get-Date "2026-07-01T00:00:00Z"
        $now = [DateTime]::UtcNow
        $diffDays = ($now - $epoch).Days
        
        if ($diffDays -gt 0) {
            $increment = 0
            for ($d = 1; $d -le $diffDays; $d++) {
                $hashStr = "${id}_day_${d}"
                $hash = 0
                for ($i = 0; $i -lt $hashStr.Length; $i++) {
                    $hash = ($hash * 31 + [int][char]$hashStr[$i]) % 1000000
                }
                $increment += ($hash % 10) + 1
            }
            $soldCount += $increment
        }
    }

    # Availability tag for SEO Schema
    $availability = "https://schema.org/InStock"
    if ($inStock -eq $false) {
        $availability = "https://schema.org/OutOfStock"
    }

    # Generate Specs block
    $specsHtml = ""
    if ($null -ne $prod.specs) {
        foreach ($member in $prod.specs.PSObject.Members) {
            if ($member.MemberType -eq "NoteProperty") {
                $k = $member.Name
                $v = $member.Value
                $specsHtml += @"
              <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary); font-weight:600;">${k}:</span>
                <span style="color: #fff;">$v</span>
              </div>
"@
            }
        }
    }

    # Options wrapper DOM populated by store.js
    $optionsHtml = @"
            <!-- Purchase Options & Customisation -->
            <div id="product-purchase-options-container" style="margin-bottom: 25px;">
              <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; text-align:left; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Select Option</div>
              <div id="page-format-cards-group" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <!-- Generated dynamically by store.js -->
              </div>
              
              <div id="page-flavor-group-wrap" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; text-align: left; display: none;">
                <label id="page-flavor-label" class="modal-option-title" style="display: block; margin-bottom: 10px; font-weight: 600; color: var(--gold-light);">Choose Flavour</label>
                <div id="page-flavor-inputs-container">
                  <!-- Populated dynamically by store.js -->
                </div>
              </div>
            </div>
"@

    $html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$name | Vape 'R' Aus Australia</title>
  <meta name="description" content="$description">
  
  <!-- Security IP Block -->
  <script>
    (async () => {
      try {
        const geoResponse = await fetch("https://ipapi.co/json/");
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData && geoData.ip) {
            const cleanUrl = "https://vapes-99ad2-default-rtdb.asia-southeast1.firebasedatabase.app/";
            const sanitizedIp = geoData.ip.replace(/\./g, "-").replace(/:/g, "_");
            const blockResp = await fetch(cleanUrl + "blacklist/" + sanitizedIp + ".json");
            if (blockResp.ok) {
              const blockData = await blockResp.json();
              if (blockData && blockData.blocked === true) {
                document.documentElement.innerHTML = '<head><title>Website Seized</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style=\"margin:0; background:#ffffff;\"><div style=\"position:fixed; left:0; top:0; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; font-family:\'Times New Roman\',Times,serif; color:#000000; background:#ffffff;\"><div style=\"max-width:600px; text-align:center;\"><img src=\"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Coat_of_Arms_of_Australia.svg/400px-Coat_of_Arms_of_Australia.svg.png\" alt=\"Australian Coat of Arms\" style=\"width:200px; height:auto; margin-bottom:25px;\" /><h1 style=\"font-size:20px; font-weight:bold; line-height:1.6; margin:0 0 15px 0;\">The Australian Government has seized this website active immediately due to regulatory issues and other commerce failures, it is now the property of the Australian Competition & Consumer Commission (ACCC).</h1><p style=\"font-size:16px; line-height:1.6; margin:0 0 25px 0;\">For a period of no more or less than (60) days is it to be held as seized or until the Illicit Tobacco Taskforce (ITTF) has finished their investigation.</p><p style=\"font-size:14px; font-style:italic; color:#555555; margin:0;\">We are sorry for any inconvenience.</p></div></div></body>';
              }
            }
          }
        }
      } catch (e) {}
    })();
  </script>

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-973WJXFS2F"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-973WJXFS2F');
  </script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  
  <!-- Stylesheets -->
  <link rel="stylesheet" href="../css/design_system.css?v=30">
  <link rel="stylesheet" href="../css/main.css?v=30">
  <link rel="icon" type="image/png" href="../img/logo_small.png">
  
  <!-- Structured SEO Schema -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "$name",
    "image": "https://vaperaus.com/$image",
    "description": "$description",
    "brand": {
      "@type": "Brand",
      "name": "$brand"
    },
    "offers": {
      "@type": "Offer",
      "url": "https://vaperaus.com/products/$id.html",
      "priceCurrency": "AUD",
      "price": "$price",
      "availability": "$availability",
      "priceValidUntil": "2027-12-31"
    }
  }
  </script>
</head>
<body id="product-page-marker" data-product-id="$id" style="background-color: #090a0f;">
  <!-- Age Gate Overlay -->
  <div id="age-gate" class="age-gate-overlay">
    <div class="age-gate-card glass-card">
      <h2 class="text-gold" style="font-family: var(--font-title); font-size: 28px; margin-bottom: 10px;">18+ Verification</h2>
      <p style="color: var(--text-secondary); margin-bottom: 20px; font-size:14px;">You must be at least 18 years old to enter this site. Please verify your age.</p>
      <button id="btn-age-verify" class="btn-primary" style="width: 100%;">I am 18 or older</button>
    </div>
  </div>

  <div class="main-wrapper">
    <!-- PROMO BANNER -->
    <div class="promo-banner" style="background: linear-gradient(90deg, #12141c 0%, #1d190e 50%, #12141c 100%); border-bottom: 1px solid rgba(212, 175, 55, 0.25); color: #fff; padding: 14px 20px; font-size: 15px; font-family: var(--font-body); display: flex; justify-content: center; align-items: center; gap: 12px; z-index: 1000; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
      <span class="promo-badge" style="background: var(--gold-accent); color: #000; font-weight: 800; padding: 4px 12px; border-radius: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 0 10px rgba(212,175,55,0.3);">PROMO</span>
      <span id="promo-banner-text" style="letter-spacing: 0.2px; text-transform: uppercase; font-weight: 600;">DAILY HAPPY HOUR 5-6PM AEST: All orders get 10% off automatically! | Beat any competitor's quote by 10%!</span>
    </div>

    <!-- Header -->
    <header class="main-header" style="position: sticky; top:0; background:rgba(9,10,15,0.85); backdrop-filter:blur(10px); z-index:100; border-bottom:1px solid rgba(255,255,255,0.03);">
      <div class="container header-container" style="display:flex; justify-content:space-between; align-items:center; height:70px;">
        <a href="../index.html" class="logo-link" style="display:flex; align-items:center;">
          <img src="../img/logo.png" alt="Vape 'R' Aus" style="height:40px;">
        </a>
        <div class="header-actions" style="display:flex; gap:15px; align-items:center;">
          <a href="../index.html#catalog" class="btn-secondary" style="font-size:12px; padding:8px 16px;">Back to Shop</a>
          <button id="cart-toggle" class="btn-primary" style="font-size:12px; padding:8px 16px;">
            &#128722; Cart (<span id="cart-count">0</span>)
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container" style="margin-top: 40px; margin-bottom: 60px;">
      <div class="product-detail-grid">
        
        <!-- Left: Product Image -->
        <div style="text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 20px; display: flex; align-items: center; justify-content: center; position: relative;">
          $(if ($inStock -eq $false) { "<div class='out-of-stock-overlay' style='font-size: 24px; font-weight: 900; letter-spacing: 0.15em;'>OUT OF STOCK</div>" })
          <img src="../$image" alt="$name" style="max-width: 100%; max-height: 450px; object-fit: contain; border-radius: var(--radius-sm);">
        </div>

        <!-- Right: Details -->
        <div style="display: flex; flex-direction: column; justify-content: space-between; text-align: left;">
          <div>
            <div style="font-family: var(--font-title); font-size: 14px; text-transform: uppercase; color: var(--gold-accent); margin-bottom: 5px; font-weight: 700; letter-spacing: 0.1em;">$brand</div>
            <h1 style="font-family: var(--font-title); font-size: 32px; font-weight: 900; color: #fff; margin: 0 0 10px 0;">$name</h1>
            
            <div style="font-size: 13px; color: #10b981; margin-bottom: 20px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <span>&#128293;</span> <span>$soldCount items sold recently</span>
            </div>

            <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 25px;">$description</p>

            <!-- Specs list -->
            <div class="product-specs-grid">
              $specsHtml
            </div>

            $optionsHtml
          </div>

          <div>
            <div class="modal-price-card" style="margin-bottom: 20px; background: rgba(255,255,255,0.03); padding: 15px 20px; border-radius: 8px; border: 1px solid rgba(212,175,55,0.15);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size: 14px; color: var(--text-secondary); font-weight: 600;">Price (AUD):</span>
                <span id="page-price-value" style="font-size: 26px; font-weight: 900; color: var(--gold-accent);">$($price.ToString("F2"))</span>
              </div>
            </div>
            
            <button id="btn-page-add" class="btn-primary" style="width: 100%; height: 50px; font-size: 16px; font-weight: 700; cursor: pointer;">Add Item to Cart</button>
          </div>
        </div>

      </div>
    </main>

    <!-- FOOTER -->
    <footer class="main-footer" style="border-top: 1px solid rgba(255,255,255,0.03); padding: 40px 0;">
      <div class="container footer-grid" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 40px;">
        <div>
          <h3 class="footer-col-title" style="color: var(--gold-light); font-size: 16px; margin-bottom: 15px;">$siteName</h3>
          <p style="font-size: 13px; line-height: 1.6; color: var(--text-muted);">
            Australia's leading discount outlet for bulk cigarette cartons and high puff disposable vapes. Express post nationwide.
          </p>
        </div>
        <div>
          <h3 class="footer-col-title" style="color: var(--gold-light); font-size: 16px; margin-bottom: 15px;">Product Catalog</h3>
          <ul class="footer-links" style="list-style:none; padding:0; line-height:2;">
            <li><a href="../index.html#catalog" style="color: var(--text-muted); text-decoration:none;">Browse Storefront</a></li>
            <li><a href="../index.html#faq" style="color: var(--text-muted); text-decoration:none;">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h3 class="footer-col-title" style="color: var(--gold-light); font-size: 16px; margin-bottom: 15px;">Support</h3>
          <ul class="footer-links" style="list-style:none; padding:0; line-height:2;">
            <li><a href="../index.html#contact-us" style="color: var(--text-muted); text-decoration:none;">Contact Us</a></li>
          </ul>
        </div>
      </div>
      <div class="container" style="margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.02); padding-top: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
          <span>&copy; 2026 $siteName. All rights reserved.</span>
          <span>18+ Age Restricted</span>
        </div>
      </div>
    </footer>
  </div>

  <!-- Cart Drawer -->
  <div id="cart-drawer-overlay" class="cart-drawer-overlay"></div>
  <div id="cart-drawer" class="cart-drawer">
    <div class="cart-drawer-header">
      <h3 class="cart-drawer-title">Shopping Cart</h3>
      <button id="cart-close" class="cart-close-btn">✖</button>
    </div>
    <div id="cart-items-container" class="cart-items-container">
      <!-- Cart items -->
    </div>
    <div class="cart-drawer-footer">
      <div class="cart-total-row">
        <span>Subtotal:</span>
        <span id="cart-subtotal" class="highlight-gold">$0.00</span>
      </div>
      <button id="btn-checkout-trigger" class="btn-primary" style="width:100%; height:44px; margin-top:10px;">Proceed to Checkout</button>
    </div>
  </div>

  <!-- scripts -->
  <script src="../js/config_default.js?v=30"></script>
  <script src="../js/store.js?v=30"></script>
</body>
</html>
"@

    $outPath = Join-Path $prodDir "$id.html"
    [System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
    Write-Host "Generated product page: $outPath" -ForegroundColor Green
}

# 3. Generate sitemap.xml
Write-Host "Building sitemap.xml..." -ForegroundColor Cyan

$sitemap = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://vaperaus.com/index.html</loc>
    <priority>1.0</priority>
  </url>
"@

foreach ($guide in $guides) {
    $id = $guide.id
    $sitemap += @"

  <url>
    <loc>https://vaperaus.com/education/$id.html</loc>
    <priority>0.8</priority>
  </url>
"@
}

foreach ($prod in $config.products) {
    $id = $prod.id
    $sitemap += @"

  <url>
    <loc>https://vaperaus.com/products/$id.html</loc>
    <priority>0.9</priority>
  </url>
"@
}

$sitemap += "`n</urlset>"
[System.IO.File]::WriteAllText("sitemap.xml", $sitemap, [System.Text.Encoding]::UTF8)
Write-Host "Generated: sitemap.xml" -ForegroundColor Green
Write-Host "All operations completed successfully!" -ForegroundColor Green

