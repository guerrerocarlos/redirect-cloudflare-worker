import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Redirect Cloudflare Worker', () => {
	let testEnv: any;

	beforeEach(() => {
		testEnv = {
			...env,
			FORCE_HTTPS: 'true',
			WWW_REDIRECT: 'none',
			REDIRECTS_KV: {
				get: async (key: string) => {
					if (key === 'redirect_rules') {
						return JSON.stringify([
							{
								from: '/test-redirect',
								to: '/redirected',
								status: 302,
								preserveQuery: true
							}
						]);
					}
					return null;
				}
			}
		};
	});

	it('returns 404 page for unmatched routes', async () => {
		const request = new IncomingRequest('https://example.com/nonexistent');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(404);
		expect(response.headers.get('Content-Type')).toBe('text/html');
		expect(await response.text()).toContain('Redirect Worker');
	});

	it('redirects HTTP to HTTPS when FORCE_HTTPS is enabled', async () => {
		const request = new IncomingRequest('http://example.com/test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://example.com/test');
	});

	it('does not redirect HTTPS to HTTPS', async () => {
		const request = new IncomingRequest('https://example.com/test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		// Should not be a redirect (status would be 301/302)
		expect(response.status).not.toBe(301);
		expect(response.status).not.toBe(302);
	});

	it('handles WWW redirect when set to remove', async () => {
		const envWithWwwRemove = { ...testEnv, WWW_REDIRECT: 'remove' };
		const request = new IncomingRequest('https://www.example.com/test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, envWithWwwRemove, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://example.com/test');
	});

	it('handles WWW redirect when set to add', async () => {
		const envWithWwwAdd = { ...testEnv, WWW_REDIRECT: 'add' };
		const request = new IncomingRequest('https://example.com/test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, envWithWwwAdd, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://www.example.com/test');
	});

	it('applies redirect rules from KV storage', async () => {
		const request = new IncomingRequest('https://example.com/test-redirect?param=value');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://example.com/redirected?param=value');
	});

	it('responds to health check endpoint', async () => {
		const request = new IncomingRequest('https://example.com/health');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		
		const body = await response.json();
		expect(body).toHaveProperty('status', 'ok');
		expect(body).toHaveProperty('timestamp');
		expect(body).toHaveProperty('worker', 'redirect-cloudflare-worker');
	});

	it('requires admin key for admin endpoints', async () => {
		const request = new IncomingRequest('https://example.com/admin/rules');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('allows admin access with correct key', async () => {
		const envWithAdminKey = { ...testEnv, ADMIN_KEY: 'test-admin-key' };
		const request = new IncomingRequest('https://example.com/admin/rules', {
			headers: {
				'Authorization': 'Bearer test-admin-key'
			}
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, envWithAdminKey, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
	});

	it('handles wildcard redirects correctly', async () => {
		// This test relies on the default redirects in the worker
		const request = new IncomingRequest('https://example.com/old-page?test=123');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://example.com/new-page?test=123');
	});

	it('handles domain-based redirects', async () => {
		const envWithDomainRedirect = {
			...testEnv,
			REDIRECTS_KV: {
				get: async (key: string) => {
					if (key === 'redirect_rules') {
						return JSON.stringify([
							{
								domain: 'book.carlosguerrero.com',
								from: '/',
								to: 'https://calendar.app.google/6TBBkNxv1fH7etaj6',
								status: 301,
								preserveQuery: false
							}
						]);
					}
					return null;
				}
			}
		};

		const request = new IncomingRequest('https://book.carlosguerrero.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, envWithDomainRedirect, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://calendar.app.google/6TBBkNxv1fH7etaj6');
	});

	it('ignores domain-specific rules for different domains', async () => {
		const envWithDomainRedirect = {
			...testEnv,
			REDIRECTS_KV: {
				get: async (key: string) => {
					if (key === 'redirect_rules') {
						return JSON.stringify([
							{
								domain: 'book.carlosguerrero.com',
								from: '/',
								to: 'https://calendar.app.google/6TBBkNxv1fH7etaj6',
								status: 301,
								preserveQuery: false
							}
						]);
					}
					return null;
				}
			}
		};

		const request = new IncomingRequest('https://different.domain.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, envWithDomainRedirect, ctx);
		await waitOnExecutionContext(ctx);
		
		// Should return 404 since domain doesn't match
		expect(response.status).toBe(404);
	});

	it('handles domain-based redirects with path patterns', async () => {
		const envWithDomainRedirect = {
			...testEnv,
			REDIRECTS_KV: {
				get: async (key: string) => {
					if (key === 'redirect_rules') {
						return JSON.stringify([
							{
								domain: 'old.example.com',
								from: '/blog/*',
								to: 'https://new.example.com/articles/$1',
								status: 301,
								preserveQuery: true
							}
						]);
					}
					return null;
				}
			}
		};

		const request = new IncomingRequest('https://old.example.com/blog/my-post?utm_source=test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, envWithDomainRedirect, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://new.example.com/articles/my-post?utm_source=test');
	});

	// Integration tests using SELF
	it('integration: health check works end-to-end', async () => {
		const response = await SELF.fetch('https://example.com/health');
		expect(response.status).toBe(200);
		
		const body = await response.json() as any;
		expect(body.status).toBe('ok');
	});

	it('integration: 404 page works end-to-end', async () => {
		const response = await SELF.fetch('https://example.com/nonexistent-page');
		expect(response.status).toBe(404);
		expect(await response.text()).toContain('Redirect Worker');
	});
});
