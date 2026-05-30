# Security Policy

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please email us at:

📧 **security@blueorbitware.com**

Or contact us through: [blueorbitware.com](https://blueorbitware.com)

### What to Include

Please provide as much information as possible:

1. **Description** — Clear description of the vulnerability
2. **Steps to Reproduce** — Detailed steps to reproduce the issue
3. **Impact** — Potential impact of the vulnerability
4. **Affected Versions** — Which versions are affected
5. **Proof of Concept** — Code or screenshots if applicable

### Example Report

```
Subject: [SECURITY] SQL Injection in /v1/reports endpoint

Description:
The /v1/reports/events endpoint is vulnerable to SQL injection 
through the 'filter' parameter.

Steps to Reproduce:
1. Send POST request to /v1/reports/events
2. Include payload: {"filter": "1=1; DROP TABLE events;--"}
3. Observe error response indicating SQL execution

Impact:
An authenticated attacker could read, modify, or delete data 
in the ClickHouse database.

Affected Versions:
Confirmed on v1.2.0 and v1.3.0

Proof of Concept:
curl -X POST https://api.example.com/v1/reports/events \
  -H "Authorization: Bearer TOKEN" \
  -d '{"filter": "1=1; DROP TABLE events;--"}'
```

---

## Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Initial Response | Within 48 hours |
| Vulnerability Confirmation | Within 7 days |
| Fix Development | Depends on severity |
| Public Disclosure | After fix is released |

---

## Severity Levels

### Critical
- Remote code execution
- SQL injection
- Authentication bypass
- Data breach potential

### High
- Privilege escalation
- Stored XSS
- CSRF on sensitive actions
- Sensitive data exposure

### Medium
- Reflected XSS
- Information disclosure
- Session fixation
- Missing security headers

### Low
- Clickjacking
- Verbose error messages
- Minor information leaks

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | ✅ Yes |
| Previous release | ✅ Yes |
| Older versions | ❌ No |

We recommend always running the latest version.

---

## Security Best Practices

When deploying OpenMetrics Analytics:

### 1. Secure Your Secrets

```bash
# Generate strong JWT secret
openssl rand -hex 32

# Never commit .env files
# Always use .env.example as template
```

### 2. Use HTTPS

Always use HTTPS in production:
- Dashboard
- API
- Collector (tracking endpoint)

### 3. Database Security

- Use strong passwords
- Restrict network access
- Enable authentication
- Regular backups

### 4. Keep Updated

```bash
# Watch for releases
git fetch upstream
git checkout v1.x.x

# Rebuild containers
docker compose pull
docker compose up -d
```

### 5. Monitor Access

- Review API access logs
- Monitor for unusual activity
- Set up alerting

---

## Security Features

### Built-in Protections

| Feature | Status |
|---------|--------|
| SQL Injection Prevention | ✅ Parameterized queries |
| XSS Prevention | ✅ Content Security Policy |
| CSRF Protection | ✅ Token validation |
| Rate Limiting | ✅ Configurable limits |
| Input Validation | ✅ Strict schemas |
| JWT Authentication | ✅ RS256/HS256 |
| Password Hashing | ✅ bcrypt |

### Recommended Headers

Ensure your reverse proxy sets these headers:

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
```

---

## Acknowledgments

We appreciate security researchers who help keep OpenMetrics safe. Responsible reporters will be:

- Credited in release notes (unless anonymity requested)
- Listed in our security hall of fame
- Eligible for swag (t-shirts, stickers)

---

## Contact

- **Security Issues**: security@blueorbitware.com
- **General Questions**: [GitHub Discussions](https://github.com/blueorbitware/openmetrics-analytics/discussions)

Thank you for helping keep OpenMetrics Analytics secure!
