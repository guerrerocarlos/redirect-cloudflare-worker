# Runbook

## Verify and deploy

```sh
npm test
npx wrangler types
npx wrangler deploy --dry-run
npm run deploy
curl -sSI https://carlosguerrero.com
curl -sSI 'https://carlosguerrero.com/blog/hosting-bill?utm_source=check'
```

After deployment, confirm both apex requests redirect to the matching `https://www.carlosguerrero.com` URL. Confirm `calendar.carlosguerrero.com`, `whatsapp.carlosguerrero.com`, and the separate CV hostname remain unchanged.
