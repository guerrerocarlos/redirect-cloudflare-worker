# Sample Redirect Rules for External Configuration

This file contains example redirect rules that can be used in the external gist configuration.

## External Configuration

The worker loads rules from this gist URL:
```
https://gist.githubusercontent.com/guerrerocarlos/76cfcca2a3cec827d833ca502c67fbf9/raw/redirects.json
```

Update the gist content to modify redirect rules. Changes are automatically picked up within 5 minutes due to caching.

## Example Rules

```json
[
  {
    "from": "/old-about",
    "to": "/about",
    "status": 301,
    "preserveQuery": true,
    "caseSensitive": false
  },
  {
    "from": "/blog/(.+)",
    "to": "/articles/$1",
    "status": 301,
    "preserveQuery": true
  },
  {
    "from": "/product/([0-9]+)",
    "to": "/products/item-$1",
    "status": 302,
    "preserveQuery": true
  },
  {
    "from": "/legacy/*",
    "to": "/archive/$1",
    "status": 301,
    "preserveQuery": false
  },
  {
    "from": "/support",
    "to": "https://help.example.com",
    "status": 302,
    "preserveQuery": true
  }
]
```

## Rule Properties

- **from**: Source path pattern (supports regex and wildcards)
- **to**: Destination path or full URL
- **status**: HTTP status code (301 for permanent, 302 for temporary)
- **preserveQuery**: Whether to keep URL parameters (default: true)
- **caseSensitive**: Whether matching is case-sensitive (default: true)
- **domain**: Optional domain to match against (if not specified, applies to all domains)

## Pattern Examples

- Simple redirect: `/old-page` → `/new-page`
- Wildcard: `/blog/*` → `/articles/$1`
- Regex capture: `/user/([0-9]+)` → `/profile/$1`
- External redirect: `/support` → `https://help.example.com`
- Domain-specific redirect: `book.carlosguerrero.com` → `https://calendar.app.google/6TBBkNxv1fH7etaj6`

## Domain-Based Redirects

You can now redirect entire domains or specific paths within domains:

```json
{
  "domain": "book.carlosguerrero.com",
  "from": "/",
  "to": "https://calendar.app.google/6TBBkNxv1fH7etaj6",
  "status": 301,
  "preserveQuery": false
}
```

This will redirect all requests to `book.carlosguerrero.com` to the Google Calendar link.
