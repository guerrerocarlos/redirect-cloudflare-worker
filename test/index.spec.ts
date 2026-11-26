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
			WWW_REDIRECT: 'none'
		};
	});

	it('returns 404 page for unmatched routes', async () => {
		const request = new IncomingRequest('https://example.com/nonexistent');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(404);
		expect(response.headers.get('Content-Type')).toBe('text/html');
		expect(await response.text()).toContain('Redirecting');
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
		const envWithAdminKey = { ...testEnv, ADMIN_KEY: 'test-admin-key' };
		const request = new IncomingRequest('https://example.com/admin/rules');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, envWithAdminKey, ctx);
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

	it('redirects the Carlos Guerrero apex root to www and preserves the query', async () => {
		const request = new IncomingRequest('https://carlosguerrero.com/?ref=apex');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://www.carlosguerrero.com/?ref=apex');
	});

	it('redirects Carlos Guerrero apex paths to the matching www path', async () => {
		const request = new IncomingRequest('https://carlosguerrero.com/blog/hosting-bill?utm_source=old-link');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://www.carlosguerrero.com/blog/hosting-bill?utm_source=old-link');
	});

	it('keeps the apex calendar shortcut on its explicit destination', async () => {
		const request = new IncomingRequest('https://carlosguerrero.com/calendar?ignored=value');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(301);
		expect(response.headers.get('Location')).toBe('https://calendar.app.google/6TBBkNxv1fH7etaj6');
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
		expect(await response.text()).toContain('Redirecting');
	});
});
