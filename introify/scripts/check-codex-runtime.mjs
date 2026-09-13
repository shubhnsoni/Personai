// Run with the production Node version: exercise the real transport, not Vitest's fetch mock.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Agent, fetch } from 'undici';

assert.ok(!process.env.VITEST, 'Runtime check must use the real Undici transport');
const dispatcher = new Agent({ connections: 4, pipelining: 1 });
const codexFetch = (url, options) => fetch(url, { ...options, dispatcher });
const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    response.end(request.method === 'HEAD' ? undefined : 'transport-ok');
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/`;
try {
    const head = await codexFetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    assert.equal(head.status, 200);
    const response = await codexFetch(url, { method: 'POST', body: 'probe', signal: AbortSignal.timeout(5000) });
    assert.equal(await response.text(), 'transport-ok');
    console.log(`Codex transport HEAD and POST passed on ${process.version}`);
} finally {
    await dispatcher.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}
