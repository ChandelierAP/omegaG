import { spawn } from 'node:child_process';
import readline from 'node:readline';

const executable = process.argv[2];
if (!executable) throw new Error('Pass the absolute Codex executable path');
const child = spawn(executable, ['app-server', '--listen', 'stdio://'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let sequence = 0;
const pending = new Map();
const createdThreads = [];
let completed;
const completion = new Promise(resolve => { completed = resolve; });
const timer = setTimeout(() => { completed({ turn: { status: 'timeout' } }); child.kill(); process.exitCode = 1; }, 90000);
child.stderr.on('data', () => {});
readline.createInterface({ input: child.stdout }).on('line', line => {
  const frame = JSON.parse(line);
  if (frame.method === 'turn/completed') completed(frame.params);
  const call = pending.get(frame.id);
  if (call) {
    pending.delete(frame.id);
    frame.error ? call.reject(new Error(JSON.stringify(frame.error))) : call.resolve(frame.result);
  }
});
child.on('exit', () => {
  for (const call of pending.values()) call.reject(new Error('server exited'));
  pending.clear();
});
function rpc(method, params) {
  if (child.killed || child.exitCode != null) return Promise.reject(new Error('server stopped'));
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
try {
  const initialize = await rpc('initialize', { clientInfo: { name: 'omegaG', title: 'omegaG controller', version: '3.2.0' }, capabilities: { experimentalApi: false } });
  console.log(JSON.stringify({ method: 'initialize', userAgent: initialize.userAgent, resultKeys: Object.keys(initialize) }));
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const models = await rpc('model/list', {});
  console.log(JSON.stringify({ method: 'model/list', count: models.data?.length, defaultModel: models.data?.find(m => m.isDefault)?.id, efforts: models.data?.find(m => m.isDefault)?.supportedReasoningEfforts }));
  const threads = await rpc('thread/list', { limit: 64, sortKey: 'updated_at' });
  console.log(JSON.stringify({ method: 'thread/list', count: threads.data?.length, statuses: [...new Set(threads.data?.map(t => t.status?.type))] }));
  const skills = await rpc('skills/list', { cwds: [process.cwd()], forceReload: false });
  console.log(JSON.stringify({ method: 'skills/list', count: skills.data?.reduce((n, entry) => n + (entry.skills?.length ?? 0), 0) }));
  const account = await rpc('account/read', { refreshToken: false });
  console.log(JSON.stringify({ method: 'account/read', authenticated: account.account != null, type: account.account?.type }));
  if (process.argv.includes('--exercise')) {
    const started = await rpc('thread/start', { cwd: process.cwd(), sandbox: 'read-only', approvalPolicy: 'untrusted', model: models.data.find(m => m.isDefault).id });
    createdThreads.push(started.thread.id);
    console.log(JSON.stringify({ method: 'thread/start', ok: Boolean(started.thread.id) }));
    const turn = await rpc('turn/start', { threadId: started.thread.id, input: [{ type: 'text', text: 'Reply with OMEGAG_OK only. Do not use any tools or modify files.', text_elements: [] }], effort: 'low' });
    console.log(JSON.stringify({ method: 'turn/start', ok: Boolean(turn.turn.id) }));
    const result = await completion;
    console.log(JSON.stringify({ method: 'turn/completed', status: result.turn?.status, error: result.turn?.error?.message }));
    if (result.turn?.status !== 'completed') throw new Error('inference failed');
    const forked = await rpc('thread/fork', { threadId: started.thread.id });
    createdThreads.push(forked.thread.id);
    console.log(JSON.stringify({ method: 'thread/fork', ok: Boolean(forked.thread.id) }));
  }
} finally {
  for (const threadId of createdThreads.reverse()) {
    try { await rpc('thread/archive', { threadId }); } catch {}
  }
  clearTimeout(timer);
  child.stdin.end();
  child.kill();
}
