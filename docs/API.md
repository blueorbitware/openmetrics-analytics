# Analytics Platform API Documentation

## Overview

This analytics platform provides comprehensive tracking for websites, web apps, WordPress sites (including multisite), and link shortening services. **One single tag** tracks everything automatically.

**Base URLs (replace with your domain):**
- **API:** `https://analytics-api.your-domain.com`
- **Collector:** `https://analytics-collector.your-domain.com`
- **Dashboard:** `https://analytics-dashboard.your-domain.com`

---

## Quick Start

### 1. Get Your Tracking Key

1. Log in to the **Analytics Dashboard**
2. Go to **Projects** → create or select a project
3. Copy your **Public Key** (starts with `pk_live_...`)

### 2. Add ONE Tracking Tag

Add this single script to your website's `<head>`:

```html
<script async src="https://analytics-collector.your-domain.com/t.js?k=YOUR_PUBLIC_KEY"></script>
```

**That's it!** The script automatically tracks:
- Page views (all pages, including SPA navigation)
- Sessions (start, duration, bounce detection)
- Referrer and traffic sources (Google, Facebook, Reddit, AI tools, etc.)
- All URL parameters (UTM, fbclid, gclid, custom params)
- Device, browser, OS, screen size
- Country and city (via GeoIP)
- Scroll depth
- Outbound link clicks
- Web Vitals (LCP, FID, CLS)

### 3. Verify Tracking is Working

After adding the tag, open your website in a browser and check:

**Method A — Check the Dashboard:**
1. Go to the Analytics Dashboard → **Overview**
2. You should see a live visitor count increase within 30 seconds
3. Go to **Events** → you should see `page_view` events appearing

**Method B — Browser Console:**
1. Open your website
2. Open DevTools (F12) → **Network** tab
3. Filter by `t.js` — you should see the script loaded
4. Filter by `collect` — you should see POST requests to the collector
5. A `200` response means events are being tracked

**Method C — Debug Mode:**
Add `&debug=true` to the script tag for detailed console logging:

```html
<script async src="https://analytics-collector.your-domain.com/t.js?k=YOUR_KEY&debug=true"></script>
```

Open DevTools → **Console** and you'll see every event being sent.

---

## WordPress Integration

### Which Method To Use?

| Situation | Method |
|-----------|--------|
| Single WordPress site, quick setup | Method 1 (functions.php) |
| WordPress site, want settings in admin panel | Method 2 (Simple Plugin) |
| WordPress Multisite, same key for all sites | Method 1 (Network theme) |
| WordPress Multisite, different key per site | Method 2 (Plugin per site) |
| WooCommerce e-commerce tracking | Method 3 (WooCommerce hooks) |
| Any WordPress + logged-in user tracking | Method 4 (User identification) |

### Method 1: functions.php (Quickest — 30 seconds)

1. In WordPress Admin → **Appearance** → **Theme File Editor**
2. Select `functions.php` from the right sidebar
3. Add this at the bottom:

```php
add_action('wp_head', function() {
    echo '<script async src="https://analytics-collector.your-domain.com/t.js?k=YOUR_PUBLIC_KEY"></script>';
});
```

4. Click **Update File**

**Verify it works:**
1. Open your WordPress site in a new tab
2. Right-click → **View Page Source**
3. Search for `t.js` — you should see the script in the `<head>`
4. Check the Analytics Dashboard → **Events** — page views should appear within 30 seconds

> **Note for multisite:** If you add this to the active theme's `functions.php`, it will work for all sites using that theme.

### Method 2: Simple WordPress Plugin (Recommended for Admin Control)

Create a file `wp-content/plugins/analytics-tracker.php` with this content:

```php
<?php
/**
 * Plugin Name: Analytics Tracker
 * Description: Self-hosted analytics tracking integration
 * Version: 1.0
 * Author: Your Company
 */

defined('ABSPATH') || exit;

class Analytics_Tracker {
    public function __construct() {
        add_action('wp_head', [$this, 'add_tracking_script'], 1);
        add_action('admin_menu', [$this, 'add_settings_page']);
        add_action('admin_init', [$this, 'register_settings']);
    }
    
    public function add_tracking_script() {
        $key = get_option('analytics_public_key', '');
        $url = get_option('analytics_collector_url', '');
        if (empty($key) || empty($url)) return;
        
        printf(
            '<script async src="%s/t.js?k=%s"></script>' . "\n",
            esc_url($url),
            esc_attr($key)
        );
    }
    
    public function add_settings_page() {
        add_options_page('Analytics', 'Analytics', 'manage_options', 'analytics-tracker', [$this, 'render_page']);
    }
    
    public function register_settings() {
        register_setting('analytics_tracker', 'analytics_collector_url');
        register_setting('analytics_tracker', 'analytics_public_key');
    }
    
    public function render_page() {
        $url = get_option('analytics_collector_url', '');
        $key = get_option('analytics_public_key', '');
        ?>
        <div class="wrap">
            <h1>Analytics Tracking Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields('analytics_tracker'); ?>
                <table class="form-table">
                    <tr>
                        <th>Collector URL</th>
                        <td>
                            <input type="url" name="analytics_collector_url" value="<?php echo esc_attr($url); ?>" class="regular-text"
                                   placeholder="https://analytics-collector.your-domain.com">
                            <p class="description">Your analytics collector URL (no trailing slash)</p>
                        </td>
                    </tr>
                    <tr>
                        <th>Public Key</th>
                        <td>
                            <input type="text" name="analytics_public_key" value="<?php echo esc_attr($key); ?>" class="regular-text"
                                   placeholder="pk_live_xxxxxxxxxxxxxxxxxx">
                            <p class="description">Found in Analytics Dashboard → Projects</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Save Settings'); ?>
            </form>
            
            <?php if (!empty($key) && !empty($url)): ?>
            <h2>Status</h2>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;border-radius:8px;">
                <strong style="color:#166534;">✓ Tracking Active</strong>
                <p>The tracking script is being loaded on all pages of this site.</p>
                <p><strong>Your snippet:</strong></p>
                <code>&lt;script async src="<?php echo esc_url($url); ?>/t.js?k=<?php echo esc_attr($key); ?>"&gt;&lt;/script&gt;</code>
            </div>
            <?php else: ?>
            <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;">
                <strong style="color:#991b1b;">✗ Tracking Not Configured</strong>
                <p>Enter your Collector URL and Public Key above to start tracking.</p>
            </div>
            <?php endif; ?>
        </div>
        <?php
    }
}

new Analytics_Tracker();
```

**Setup:**
1. Upload the file to `wp-content/plugins/analytics-tracker.php` (via FTP, file manager, or SSH)
2. Go to WordPress Admin → **Plugins** → Activate **Analytics Tracker**
3. Go to **Settings** → **Analytics**
4. Enter:
   - Collector URL: `https://analytics-collector.your-domain.com`
   - Public Key: `YOUR_PUBLIC_KEY` (your key)
5. Click **Save Settings**
6. The green "Tracking Active" status confirms it's working

### Method 3: WooCommerce E-commerce Tracking

Add this to `functions.php` **in addition to** Method 1 or 2:

```php
// Track Add to Cart
add_action('woocommerce_add_to_cart', function($cart_item_key, $product_id, $quantity) {
    $product = wc_get_product($product_id);
    if (!$product) return;
    ?>
    <script>
    if (window.analytics) analytics.track('add_to_cart', {
        product_id: '<?php echo esc_js($product_id); ?>',
        product_name: '<?php echo esc_js($product->get_name()); ?>',
        price: <?php echo (float)$product->get_price(); ?>,
        quantity: <?php echo (int)$quantity; ?>,
        currency: '<?php echo esc_js(get_woocommerce_currency()); ?>'
    });
    </script>
    <?php
}, 10, 3);

// Track Purchase on Thank You page
add_action('woocommerce_thankyou', function($order_id) {
    $order = wc_get_order($order_id);
    if (!$order) return;
    
    $items = [];
    foreach ($order->get_items() as $item) {
        $items[] = ['id' => $item->get_product_id(), 'name' => $item->get_name(), 
                     'quantity' => $item->get_quantity(), 'price' => (float)$item->get_total()];
    }
    ?>
    <script>
    if (window.analytics) analytics.track('purchase', {
        order_id: '<?php echo esc_js($order_id); ?>',
        total: <?php echo (float)$order->get_total(); ?>,
        currency: '<?php echo esc_js($order->get_currency()); ?>',
        items: <?php echo json_encode($items); ?>
    });
    </script>
    <?php
});

// Track Product Views
add_action('wp_footer', function() {
    if (!is_product()) return;
    global $product;
    ?>
    <script>
    if (window.analytics) analytics.track('view_product', {
        product_id: '<?php echo esc_js($product->get_id()); ?>',
        product_name: '<?php echo esc_js($product->get_name()); ?>',
        price: <?php echo (float)$product->get_price(); ?>,
        category: '<?php echo esc_js(strip_tags(wc_get_product_category_list($product->get_id()))); ?>'
    });
    </script>
    <?php
});
```

### Method 4: Track Logged-In WordPress Users

Add this to `functions.php` to identify logged-in users:

```php
add_action('wp_head', function() {
    if (!is_user_logged_in()) return;
    $user = wp_get_current_user();
    echo '<script>window.analyticsUser = ' . json_encode([
        'id' => (string)$user->ID,
        'email' => $user->user_email,
        'name' => $user->display_name,
        'role' => implode(',', $user->roles)
    ]) . ';</script>' . "\n";
}, 0); // Priority 0 = runs before the tracking script
```

This goes **before** the tracking tag so the user is identified with their first page view.

### WordPress Multisite (Subdirectory Setup)

If you run a WordPress Multisite with subdirectories (e.g. `example.com`, `example.com/ksa`, `example.com/uae`, `example.com/uk`), **one single tag tracks all sites automatically** since they share the same domain.

**Option A — Network Plugin (Recommended):**

Create a file `analytics-tracker.php` with this content:

```php
<?php
/**
 * Plugin Name: Analytics Tracker
 * Description: Self-hosted analytics for all network sites
 * Version: 1.0
 * Network: true
 */

defined('ABSPATH') || exit;

add_action('wp_head', function() {
    echo '<script async src="https://analytics-collector.your-domain.com/t.js?k=YOUR_PUBLIC_KEY"></script>' . "\n";
}, 1);
```

Upload to `wp-content/plugins/`, then go to **Network Admin → Plugins** and click **Network Activate**. This activates it on all sites at once.

**Option B — Theme functions.php:**

From **Network Admin → Appearance → Theme File Editor**, add to the active theme's `functions.php`:

```php
add_action('wp_head', function() {
    echo '<script async src="https://analytics-collector.your-domain.com/t.js?k=YOUR_PUBLIC_KEY"></script>';
}, 1);
```

This works because all subsites share the same theme.

**What gets tracked automatically:**

| Visitor goes to | Tracked path | Subsite |
|---|---|---|
| `example.com/` | `/` | Main |
| `example.com/ksa/` | `/ksa/` | KSA |
| `example.com/ksa/products/` | `/ksa/products/` | KSA |
| `example.com/uae/contact` | `/uae/contact` | UAE |
| `example.com/uk/shop/item-1` | `/uk/shop/item-1` | UK |

All page views from all subsites appear in the same Analytics Dashboard project. You can filter by path prefix (`/ksa/`, `/uae/`, `/uk/`) to view per-site data separately.

**Different key per subsite (optional):**

If you want each subsite to have its own project/key in the dashboard, use Method 2 (Plugin with settings page) and activate it per-site instead of network-wide. Each site admin configures their own key in **Settings → Analytics**.

### WordPress Multisite (Subdomain Setup)

For subdomain multisites (e.g. `ksa.example.com`, `uae.example.com`), each subdomain is a different origin. You have two options:

1. **One project, one key** — Use the same tracking key on all subdomains. In your Analytics Dashboard project settings, set the domain to `example.com` (without subdomain) so it accepts traffic from all subdomains. The `hostname` is recorded automatically so you can filter by subdomain.

2. **Separate projects** — Create one project per subdomain in the dashboard, each with its own key. Use Method 2 (plugin) and configure per-site.

### Verify WordPress Tracking

After setup, follow these steps:

1. **Visit your WordPress site** in a normal browser tab (not logged into WP admin, or use incognito)
2. **Open the Analytics Dashboard** → **Overview** 
3. You should see the visitor count go up
4. Click **Events** in the sidebar — you should see `page_view` events with your WordPress pages
5. Click on an event to see full details: URL, referrer, device, country, etc.

**If no data appears after 2 minutes:**
1. View your site's page source — search for `t.js` to confirm the script is there
2. Open browser DevTools → Network tab → reload the page → look for `t.js` request
3. If `t.js` returns 404, check that the collector service is running
4. If `t.js` loads but no `collect` requests appear, check the browser console for errors
5. Make sure your project domain in the dashboard matches your WordPress domain

---

## Link Shortening Service Integration

### Server-Side Tracking (Recommended)

When a user clicks a short link, track the event server-side before redirecting:

#### PHP Example

```php
<?php
function trackLinkClick($shortCode, $targetUrl, $request) {
    $collectorUrl = 'https://analytics-collector.your-domain.com/collect';
    $publicKey = 'YOUR_PUBLIC_KEY';
    
    $eventData = [
        'k' => $publicKey,
        'e' => 'link_click',
        'n' => 'Short Link Click',
        'p' => [
            'short_code' => $shortCode,
            'target_url' => $targetUrl,
            'referrer' => $_SERVER['HTTP_REFERER'] ?? '',
        ],
        // Pass through UTM parameters
        'utm_source' => $_GET['utm_source'] ?? '',
        'utm_medium' => $_GET['utm_medium'] ?? '',
        'utm_campaign' => $_GET['utm_campaign'] ?? '',
        // Visitor info
        'ua' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'ip' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'],
        'r' => $_SERVER['HTTP_REFERER'] ?? '',
        'ts' => round(microtime(true) * 1000),
    ];
    
    // Send async (fire-and-forget)
    $ch = curl_init($collectorUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($eventData),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT_MS => 500, // Don't slow down redirect
    ]);
    curl_exec($ch);
    curl_close($ch);
}

// In your redirect handler:
$shortCode = $_GET['code'];
$targetUrl = getTargetUrl($shortCode); // Your function to get target URL

trackLinkClick($shortCode, $targetUrl, $_REQUEST);
header("Location: $targetUrl", true, 302);
exit;
```

#### Node.js Example

```javascript
const axios = require('axios');

async function trackLinkClick(shortCode, targetUrl, req) {
    const collectorUrl = 'https://analytics-collector.your-domain.com/collect';
    const publicKey = 'YOUR_PUBLIC_KEY';
    
    const eventData = {
        k: publicKey,
        e: 'link_click',
        n: 'Short Link Click',
        p: {
            short_code: shortCode,
            target_url: targetUrl,
        },
        utm_source: req.query.utm_source || '',
        utm_medium: req.query.utm_medium || '',
        utm_campaign: req.query.utm_campaign || '',
        ua: req.headers['user-agent'] || '',
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        r: req.headers.referer || '',
        ts: Date.now(),
    };
    
    // Fire-and-forget (don't await)
    axios.post(collectorUrl, eventData).catch(() => {});
}

// Express.js example
app.get('/:code', async (req, res) => {
    const { code } = req.params;
    const targetUrl = await getTargetUrl(code);
    
    trackLinkClick(code, targetUrl, req);
    res.redirect(302, targetUrl);
});
```

#### Python Example

```python
import requests
import time
from threading import Thread

def track_link_click(short_code, target_url, request):
    collector_url = 'https://analytics-collector.your-domain.com/collect'
    public_key = 'YOUR_PUBLIC_KEY'
    
    event_data = {
        'k': public_key,
        'e': 'link_click',
        'n': 'Short Link Click',
        'p': {
            'short_code': short_code,
            'target_url': target_url,
        },
        'utm_source': request.args.get('utm_source', ''),
        'utm_medium': request.args.get('utm_medium', ''),
        'utm_campaign': request.args.get('utm_campaign', ''),
        'ua': request.headers.get('User-Agent', ''),
        'ip': request.headers.get('X-Forwarded-For', request.remote_addr),
        'r': request.headers.get('Referer', ''),
        'ts': int(time.time() * 1000),
    }
    
    # Fire-and-forget
    def send():
        try:
            requests.post(collector_url, json=event_data, timeout=0.5)
        except:
            pass
    
    Thread(target=send).start()

# Flask example
@app.route('/<code>')
def redirect_link(code):
    target_url = get_target_url(code)
    track_link_click(code, target_url, request)
    return redirect(target_url, code=302)
```

### Append UTM Parameters to Target URLs

For better attribution, append UTM parameters to target URLs:

```php
<?php
function appendUtmToUrl($targetUrl, $shortCode, $campaignName) {
    $utm = [
        'utm_source' => 'shortlink',
        'utm_medium' => 'link',
        'utm_campaign' => $campaignName,
        'utm_content' => $shortCode,
    ];
    
    $separator = (parse_url($targetUrl, PHP_URL_QUERY) === null) ? '?' : '&';
    return $targetUrl . $separator . http_build_query($utm);
}
```

### Client-Side Tracking (Alternative)

If you can't modify server code, use a tracking pixel on an intermediate page:

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://analytics-collector.your-domain.com/t.js?k=YOUR_PUBLIC_KEY"></script>
    <script>
        // Track and redirect
        const targetUrl = '{{TARGET_URL}}';
        const shortCode = '{{SHORT_CODE}}';
        
        if (window.analytics) {
            analytics.track('link_click', {
                short_code: shortCode,
                target_url: targetUrl
            });
        }
        
        // Redirect after brief delay to ensure tracking
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 100);
    </script>
</head>
<body>
    <p>Redirecting...</p>
</body>
</html>
```

---

## API Reference

### Authentication

All API requests require a Bearer token:

```bash
curl -X GET "https://analytics-api.your-domain.com/v1/workspaces" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Endpoints

#### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/login` | Login and get tokens |
| POST | `/v1/auth/refresh` | Refresh access token |
| POST | `/v1/auth/logout` | Logout (revoke tokens) |

**Login Example:**
```bash
curl -X POST "https://analytics-api.your-domain.com/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@analytics.local", "password": "SuperAdmin123!"}'
```

#### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/projects` | List all projects |
| POST | `/v1/projects` | Create a project |
| GET | `/v1/projects/{id}` | Get project details |
| PATCH | `/v1/projects/{id}` | Update project |
| DELETE | `/v1/projects/{id}` | Delete project |

**Create Project Example:**
```bash
curl -X POST "https://analytics-api.your-domain.com/v1/projects" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Workspace-ID: YOUR_WORKSPACE_ID" \
  -d '{
    "name": "My Website",
    "domain": "example.com"
  }'
```

#### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/reports/summary` | Get summary stats |
| GET | `/v1/reports/live` | Real-time visitors |
| POST | `/v1/reports/events` | Query events |
| POST | `/v1/reports/funnel` | Funnel analysis |
| POST | `/v1/reports/retention` | Retention analysis |
| GET | `/v1/reports/raw` | Raw event data |

**Summary Example:**
```bash
curl -X GET "https://analytics-api.your-domain.com/v1/reports/summary?start=2024-01-01&end=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-ID: YOUR_WORKSPACE_ID"
```

#### Super Admin (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/super/users` | List all users |
| POST | `/v1/super/users` | Create a user |
| DELETE | `/v1/super/users/{id}` | Delete a user |
| POST | `/v1/super/users/workspace` | Add user to workspace |

**Create User Example:**
```bash
curl -X POST "https://analytics-api.your-domain.com/v1/super/users" \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }'
```

---

## Event Tracking

### Track Custom Events

```javascript
// Basic event
analytics.track('button_click', {
    button_id: 'signup-cta',
    page: '/pricing'
});

// E-commerce event
analytics.track('purchase', {
    order_id: 'ORD-123',
    total: 99.99,
    currency: 'USD',
    items: [
        { id: 'PROD-1', name: 'Widget', price: 49.99, quantity: 2 }
    ]
});

// Form submission
analytics.track('form_submit', {
    form_id: 'contact-form',
    form_name: 'Contact Us'
});
```

### Identify Users

```javascript
analytics.identify('user-123', {
    email: 'user@example.com',
    name: 'John Doe',
    plan: 'premium',
    signup_date: '2024-01-15'
});
```

### Track Page Views (Manual)

```javascript
// For SPAs or custom page view tracking
analytics.page('/dashboard', {
    title: 'User Dashboard',
    section: 'main'
});
```

---

## Collector Endpoints

### POST /collect

Track events via POST request.

```bash
curl -X POST "https://analytics-collector.your-domain.com/collect" \
  -H "Content-Type: application/json" \
  -d '{
    "k": "YOUR_PUBLIC_KEY",
    "e": "custom_event",
    "n": "Button Click",
    "p": {
        "button_id": "cta-main"
    },
    "url": "https://example.com/page",
    "r": "https://google.com",
    "ts": 1704067200000
  }'
```

### GET /collect

Track events via GET request (for pixels/no-JS environments).

```html
<img src="https://analytics-collector.your-domain.com/collect?k=YOUR_KEY&e=email_open&p[email_id]=123" width="1" height="1">
```

---

## Best Practices

### 1. Security

- Never expose your **Private Key** in client-side code
- Use domain validation in project settings
- Enable HTTPS for all endpoints

### 2. Performance

- Use `async` attribute on tracking script
- Server-side tracking doesn't block page loads
- Events are batched automatically

### 3. Privacy

- Enable IP anonymization if required
- Configure data retention policies
- Support GDPR data export/deletion

### 4. Debugging

Add `?debug=true` to tracking script for console logging:

```html
<script src="https://collector.your-domain.com/t.js?k=YOUR_KEY&debug=true" async></script>
```

---

## Support

For issues or questions, contact your system administrator.
