import { spawn } from 'node:child_process';
import readline from 'node:readline';

const executable = process.argv[2];
if (!executable) throw new Error('Pass the absolute Codex executable path');
const child = spawn(executable, ['app-server', '--listen', 'stdio://'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let sequence = 0;
const pending = new Map();
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 45000);
child.stderr.on('data', () => {});
readline.createInterface({ input: child.stdout }).on('line', line => {
  const frame = JSON.parse(line);
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
} finally {
  clearTimeout(timer);
  child.stdin.end();
  child.kill();
}
