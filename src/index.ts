/**
 * Cloudflare Worker for URL Redirects
 * 
 * This worker handles various types of redirects:
 * - Domain redirects (www to non-www, http to https)
 * - Domain-based redirects (redirect entire domains or specific paths within domains)
 * - Path-based redirects
 * - Query parameter redirects
 * - Custom redirect rules
 * 
 * Configuration is loaded from external gist with fallback to hardcoded rules
 */

interface RedirectRule {
	from: string;
	to: string;
	status?: number;
	preserveQuery?: boolean;
	caseSensitive?: boolean;
	domain?: string; // Optional domain to match against
}

// External configuration URL - will be loaded from environment variables

// Cache for external configuration
let cachedRules: RedirectRule[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 300000; // 5 minutes in milliseconds

// Fallback redirect rules - used if external config fails to load
const DEFAULT_REDIRECTS: RedirectRule[] = [
	// Example redirects - customize as needed
	{
		from: '/old-page',
		to: '/new-page',
		status: 301,
		preserveQuery: true
	},
	{
		from: '/blog/*',
		to: '/articles/$1',
		status: 301,
		preserveQuery: true
	},
	{
		from: '/product/(.*)',
		to: '/products/$1',
		status: 301,
		preserveQuery: true
	},
	// Example domain-based redirect
	{
		domain: 'book.carlosguerrero.com',
		from: '/',
		to: 'https://calendar.app.google/6TBBkNxv1fH7etaj6',
		status: 301,
		preserveQuery: false
	},
	// Calendar domain redirect
	{
		domain: 'calendar.carlosguerrero.com',
		from: '/',
		to: 'https://calendar.app.google/6TBBkNxv1fH7etaj6',
		status: 301,
		preserveQuery: false
	},
	// Calendar path redirect on main domain
	{
		domain: 'carlosguerrero.com',
		from: '/calendar',
		to: 'https://calendar.app.google/6TBBkNxv1fH7etaj6',
		status: 301,
		preserveQuery: false
	},
	// WhatsApp domain redirect
	{
		domain: 'whatsapp.carlosguerrero.com',
		from: '/',
		to: 'https://wa.me/qr/PVZTFJDU3YOPE1',
		status: 301,
		preserveQuery: false
	},
	// WhatsApp path redirect on main domain
	{
		domain: 'carlosguerrero.com',
		from: '/whatsapp',
		to: 'https://wa.me/qr/PVZTFJDU3YOPE1',
		status: 301,
		preserveQuery: false
	},
	// LinkedIn path redirect on main domain
	{
		domain: 'carlosguerrero.com',
		from: '/linkedin',
		to: 'https://www.linkedin.com/in/carlosguerrero-com/',
		status: 301,
		preserveQuery: false
	},
	// Main domain root redirect to CV subdomain
	{
		domain: 'carlosguerrero.com',
		from: '/',
		to: 'https://cv.carlosguerrero.com',
		status: 301,
		preserveQuery: false
	}
];

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		// Force HTTPS redirect
		if (url.protocol === 'http:' && env.FORCE_HTTPS !== 'false') {
			url.protocol = 'https:';
			return Response.redirect(url.toString(), 301);
		}
		
		// WWW redirect handling
		if (env.WWW_REDIRECT === 'remove' && url.hostname.startsWith('www.')) {
			url.hostname = url.hostname.substring(4);
			return Response.redirect(url.toString(), 301);
		} else if (env.WWW_REDIRECT === 'add' && !url.hostname.startsWith('www.')) {
			url.hostname = 'www.' + url.hostname;
			return Response.redirect(url.toString(), 301);
		}
		
		// Load redirect rules from external gist with caching and fallback to defaults
		let redirectRules = DEFAULT_REDIRECTS;
		const now = Date.now();
		
		// Check if we have cached rules that are still fresh
		if (cachedRules && (now - cacheTimestamp) < CACHE_TTL) {
			redirectRules = cachedRules;
		} else {
			// Try to fetch fresh rules from external source
			if (env.GIST_CONFIG_URL) {
				try {
					const response = await fetch(env.GIST_CONFIG_URL);
					if (response.ok) {
						const externalRules = await response.json();
						// Check if we got a valid array of rules
						if (Array.isArray(externalRules) && externalRules.length > 0) {
							redirectRules = externalRules;
							cachedRules = externalRules;
							cacheTimestamp = now;
							console.log(`Loaded ${externalRules.length} redirect rules from external config`);
						} else {
							console.log('External config is empty or invalid, using fallback rules');
							// Use cached rules if available, otherwise use defaults
							redirectRules = cachedRules || DEFAULT_REDIRECTS;
						}
					} else {
						console.error(`Failed to fetch external config: ${response.status}`);
						// Use cached rules if available, otherwise use defaults
						redirectRules = cachedRules || DEFAULT_REDIRECTS;
					}
				} catch (error) {
					console.error('Error loading external config:', error);
					console.log('Using cached or default redirect rules');
					// Use cached rules if available, otherwise use defaults
					redirectRules = cachedRules || DEFAULT_REDIRECTS;
				}
			} else {
				console.log('No GIST_CONFIG_URL configured, using default redirect rules');
				redirectRules = cachedRules || DEFAULT_REDIRECTS;
			}
		}
		
		// Check for matching redirect rules
		for (const rule of redirectRules) {
			// Check if rule has domain restriction and if it matches
			if (rule.domain && rule.domain !== url.hostname) {
				continue; // Skip this rule if domain doesn't match
			}
			
			const match = matchPath(url.pathname, rule.from, rule.caseSensitive !== false);
			
			if (match) {
				let redirectTo = rule.to;
				
				// Handle wildcard replacements
				redirectTo = redirectTo.replace(/\$(\d+)/g, (_, index) => {
					const captureIndex = parseInt(index) - 1;
					return match.captures[captureIndex] || '';
				});
				
				// Build the final redirect URL
				let redirectUrl: URL;
				try {
					// If redirectTo is a full URL, use it directly
					redirectUrl = new URL(redirectTo);
				} catch {
					// If it's a relative path, resolve it against the current origin
					redirectUrl = new URL(redirectTo, url.origin);
				}
				
				// Preserve query parameters if specified
				if (rule.preserveQuery !== false && url.search) {
					redirectUrl.search = url.search;
				}
				
				const status = rule.status || 301;
				return Response.redirect(redirectUrl.toString(), status);
			}
		}
		
		// Health check endpoint
		if (url.pathname === '/health') {
			return new Response(JSON.stringify({
				status: 'ok',
				timestamp: new Date().toISOString(),
				worker: 'redirect-cloudflare-worker'
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		// Admin endpoint to view current redirect rules
		if (url.pathname === '/admin/rules' && request.method === 'GET') {
			if (env.ADMIN_KEY && request.headers.get('Authorization') !== `Bearer ${env.ADMIN_KEY}`) {
				return new Response('Unauthorized', { status: 401 });
			}
			
			return new Response(JSON.stringify(redirectRules, null, 2), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		// Default response for unmatched requests
		return new Response(`
			<html>
				<head>
					<title>Redirecting...</title>
					<style>
						body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
						.status { color: #666; }
						.path { font-family: monospace; background: #f5f5f5; padding: 2px 4px; }
					</style>
				</head>
				<body>
					<h1>🔄 Redirecting</h1>
					<p class="status">No redirect rule found for path: <span class="path">${url.pathname}</span></p>
					<p>Please contact the person who gave this link to you</p>
					<ul>
						<li>Health check: <a href="/health">/health</a></li>
						<li>Current rules: <a href="/admin/rules">/admin/rules</a> (requires admin key)</li>
					</ul>
				</body>
			</html>
		`, {
			status: 404,
			headers: { 'Content-Type': 'text/html' }
		});
	},
} satisfies ExportedHandler<Env>;

/**
 * Match a path against a pattern with wildcard support
 */
function matchPath(path: string, pattern: string, caseSensitive: boolean = true): { captures: string[] } | null {
	// Convert pattern to regex
	let regexPattern = pattern
		.replace(/\*/g, '(.*)')
		.replace(/\//g, '\\/');
	
	// Handle regex patterns (already contain parentheses)
	if (pattern.includes('(') && pattern.includes(')')) {
		regexPattern = pattern;
	}
	
	const flags = caseSensitive ? '' : 'i';
	const regex = new RegExp(`^${regexPattern}$`, flags);
	
	const match = path.match(regex);
	if (match) {
		return {
			captures: match.slice(1) // Remove the full match, keep only captures
		};
	}
	
	return null;
}
