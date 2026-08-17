import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { security } from './security';

const app = new Hono();
app.use(...security);
app.post('/api/users/:userId/files', (c) => c.text('accepted'));
app.post('/api/users/:userId/profile', (c) => c.text('accepted'));

describe('request body limits', () => {
  test('keeps the default limit for non-upload APIs', async () => {
    const response = await app.request('/api/users/1/profile', {
      method: 'POST',
      body: new Uint8Array(1024 * 1024 + 1),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  test('allows the larger multipart envelope on file uploads', async () => {
    const response = await app.request('/api/users/1/files', {
      method: 'POST',
      body: new Uint8Array(2 * 1024 * 1024),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('accepted');
  });
});
