# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

**Email:** mndinesh674@gmail.com (or create a private GitHub security advisory)

**Do NOT:**

- Open a public issue
- Disclose publicly before we've addressed it

**We will:**

- Acknowledge within 48 hours
- Provide an estimated fix timeline
- Credit you in the release notes (if desired)

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x.x   | Yes       |
| < 1.0   | No        |

## Security Best Practices

When self-hosting zynqCloud:

1. Use strong `JWT_SECRET` (32+ random characters)
2. Enable HTTPS in production
3. Change default database passwords
4. Keep dependencies updated
5. Use firewall rules to restrict access
6. Run regular backups (DB + files + `FILE_ENCRYPTION_MASTER_KEY`)
