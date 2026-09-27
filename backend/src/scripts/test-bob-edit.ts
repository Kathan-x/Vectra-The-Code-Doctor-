import { spawn } from 'child_process';
import readline from 'readline';
import fs from 'fs';

async function testBobEdit() {
  const dir = 'C:\\Users\\Patel Kathan\\Desktop\\VECTRA\\test-fixtures\\test-scratch';
  console.log('Original hello.js:', fs.readFileSync(dir + '\\hello.js', 'utf-8'));

  const args = [
    'run',
    '--accept-license',
    '--trust',
    '-w', `"${dir}"`,
    '-f', 'stream-json',
    'In hello.js, change the value of x from 1 to 42. Save the file directly.'
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('bob', args, {
      shell: true,
      env: { ...process.env },
    });
    proc.stdin?.end();

    const rl = readline.createInterface({ input: proc.stdout });
    let fullText = '';
    let completed = false;

    rl.on('line', (line) => {
      try {
        const ev = JSON.parse(line);
        if (ev.type === 'message' && ev.role === 'assistant') {
          process.stdout.write(ev.content || '');
          fullText += ev.content || '';
        }
        if (ev.type === 'result') {
          console.log('\nResult event received:', ev);
          completed = true;
          proc.kill('SIGTERM');
          resolve(fullText);
        }
      } catch {}
    });

    proc.stderr.on('data', (d) => {
      console.error('[STDERR]', d.toString());
    });

    proc.on('close', () => {
      if (!completed) resolve(fullText);
    });

    setTimeout(() => {
      if (!completed) {
        proc.kill('SIGKILL');
        reject(new Error('Timeout'));
      }
    }, 45000);
  });
}

testBobEdit().then(() => {
  const dir = 'C:\\Users\\Patel Kathan\\Desktop\\VECTRA\\test-fixtures\\test-scratch';
  const updated = fs.readFileSync(dir + '\\hello.js', 'utf-8');
  console.log('\nUpdated hello.js contents:\n', updated);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
