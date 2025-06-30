#  **HTTPS Enforcement** - Automatically redirect HTTP to HTTPS
- 🌐 **WWW Redirect Handling** - Add or remove www subdomain
- 📍 **Path-based Redirects** - Custom redirect rules with wildcard support
- 🌍 **External Configuration** - Load redirect rules from external gist URL
- 💾 **Smart Caching** - Cache external config for 5 minutes to improve performance
- 📊 **Health Check Endpoint** - Monitor worker status
- ⚡ **High Performance** - Edge-based redirects with minimal latency Worker - URL Redirects

A powerful and flexible Cloudflare Worker for handling various types of URL redirects including domain redirects, path-based redirects, and custom redirect rules.

## Features

- 🔒 **HTTPS Enforcement** - Automatically redirect HTTP to HTTPS
- 🌐 **WWW Redirect Handling** - Add or remove www subdomain
- 📍 **Path-based Redirects** - Custom redirect rules with wildcard support
- � **Hardcoded Configuration** - Simple, version-controlled redirect rules
- 📊 **Health Check Endpoint** - Monitor worker status
- ⚡ **High Performance** - Edge-based redirects with minimal latency

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

The worker uses environment variables for configuration. Edit `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "FORCE_HTTPS": "true",        // "true" or "false"
    "WWW_REDIRECT": "none"        // "add", "remove", or "none"
  }
}
```

### 3. Set Admin Key (Optional)

For accessing admin endpoints, set a secret:

```bash
wrangler secret put ADMIN_KEY
```

### 4. Deploy

```bash
pnpm run deploy
```

## Configuration Options

### Environment Variables

| Variable | Description | Values | Default |
|----------|-------------|--------|---------|
| `FORCE_HTTPS` | Force HTTPS redirects | `"true"`, `"false"` | `"true"` |
| `WWW_REDIRECT` | WWW subdomain handling | `"add"`, `"remove"`, `"none"` | `"none"` |
| `ADMIN_KEY` | Admin access key (secret) | Any string | Not set |

### Redirect Rules

Redirect rules are loaded from an external gist URL:

**Configuration URL:** `https://gist.githubusercontent.com/guerrerocarlos/76cfcca2a3cec827d833ca502c67fbf9/raw/redirects.json`

The worker automatically fetches the latest configuration from this URL and caches it for 5 minutes to improve performance. If the external source is unavailable, it falls back to the default rules defined in the code.

**Example configuration format:**
```json
[
  {
    "from": "/old-page",
    "to": "/new-page",
    "status": 301,
    "preserveQuery": true
  },
  {
    "from": "/blog/*",
    "to": "/articles/$1",
    "status": 301,
    "preserveQuery": true
  }
]
```

To modify redirect rules, update the gist content. Changes will be picked up automatically within 5 minutes.

### Fallback Rules

If the external configuration cannot be loaded, the worker falls back to default rules defined in `src/index.ts`. These include basic examples and can be customized as needed:

```typescript
const DEFAULT_REDIRECTS: RedirectRule[] = [
  {
    from: '/old-page',
    to: '/new-page',
    status: 301,
    preserveQuery: true
  },
  // ... more fallback rules
];
```

### Rule Properties

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `from` | string | Source path pattern (supports wildcards and regex) | Required |
| `to` | string | Destination path (supports $1, $2 for captures) | Required |
| `status` | number | HTTP redirect status code | `301` |
| `preserveQuery` | boolean | Preserve query parameters | `true` |
| `caseSensitive` | boolean | Case-sensitive matching | `true` |

### Pattern Matching

The worker supports flexible pattern matching:

- **Wildcards**: `/blog/*` matches `/blog/anything`
- **Regex**: `/product/(.*)` captures everything after `/product/`
- **Replacements**: Use `$1`, `$2`, etc. in the destination to replace captured groups

## API Endpoints

### Health Check
```
GET /health
```

Returns worker status and timestamp.

### Admin - View Rules
```
GET /admin/rules
Authorization: Bearer <ADMIN_KEY>
```

Returns current redirect rules in JSON format (from external gist or fallback defaults).

## Development

### Local Development

```bash
pnpm run dev
```

This starts the worker locally at `http://localhost:8787`

### Testing

```bash
pnpm test
```

### Type Generation

After modifying `wrangler.jsonc`, regenerate types:

```bash
pnpm run cf-typegen
```

## Examples

### Basic Domain Redirect

Redirect `example.com` to `newdomain.com`:

```typescript
{
  from: '/(.*)',
  to: 'https://newdomain.com/$1',
  status: 301,
  preserveQuery: true
}
```

### Path Restructuring

Redirect old blog structure to new structure:

```typescript
{
  from: '/blog/([0-9]{4})/([0-9]{2})/(.+)',
  to: '/posts/$1-$2/$3',
  status: 301,
  preserveQuery: true
}
```

### Simple Page Redirect

```typescript
{
  from: '/contact',
  to: '/contact-us',
  status: 301,
  preserveQuery: false
}
```

## Deployment

### Production Deployment

1. Update `wrangler.jsonc` with your worker name and domain
2. Set up environment variables and secrets
3. Deploy:

```bash
pnpm run deploy
```

### Environment-specific Configuration

Use different configurations for staging and production by creating multiple wrangler files:

- `wrangler.jsonc` (development)
- `wrangler.staging.jsonc`
- `wrangler.production.jsonc`

Deploy with specific config:

```bash
wrangler deploy --config wrangler.production.jsonc
```

## Monitoring

- Monitor redirects in Cloudflare Analytics
- Use the `/health` endpoint for uptime monitoring
- Check worker logs in Cloudflare dashboard

## Security Considerations

- Always use HTTPS for sensitive redirects
- Keep admin keys secure and rotate regularly
- Validate redirect destinations to prevent open redirects
- Monitor for redirect loops

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues and questions:
- Check the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- Review the worker logs in your Cloudflare dashboard
- Open an issue in this repository
