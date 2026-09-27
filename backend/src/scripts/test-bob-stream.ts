import { spawn } from 'child_process';
import readline from 'readline';

async function testBob() {
  console.log('Testing Bob Shell CLI execution...');
  const bobBin = 'bob';
  const args = [
    'run',
    '--accept-license',
    '-f', 'stream-json',
    'Reply with exactly: BOB_STREAM_OK'
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(bobBin, args, {
      shell: true,
      env: { ...process.env },
    });

    // Close stdin so bob knows no user input is pending
    proc.stdin?.end();

    const rl = readline.createInterface({ input: proc.stdout });

    let finalMessage = '';
    let completed = false;

    rl.on('line', (line) => {
      console.log('LINE:', line);
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'chunk' || parsed.type === 'assistant') {
          process.stdout.write(parsed.text || '');
        }
        if (parsed.type === 'result') {
          finalMessage = parsed.last_message || '';
          completed = true;
          console.log('\n--- SUCCESS RESULT RECEIVED ---');
          console.log('Last message:', finalMessage);
          // Terminate gracefully
          proc.kill('SIGTERM');
          resolve(finalMessage);
        }
      } catch {
        // non-json line
      }
    });

    proc.stderr.on('data', (d) => {
      console.error('[STDERR]', d.toString());
    });

    proc.on('close', (code) => {
      console.log('Process closed with code:', code);
      if (!completed) resolve(finalMessage);
    });

    setTimeout(() => {
      if (!completed) {
        proc.kill('SIGKILL');
        reject(new Error('Bob timeout after 25s'));
      }
    }, 25000);
  });
}

testBob().then(res => {
  console.log('testBob finished successfully with:', res);
  process.exit(0);
}).catch(err => {
  console.error('testBob failed:', err);
  process.exit(1);
});
