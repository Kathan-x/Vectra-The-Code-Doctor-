import { isBobAvailable, runBob } from '../bob/bob-client';

async function test() {
  console.log('Testing isBobAvailable()...');
  const status = await isBobAvailable();
  console.log('Status result:', status);

  if (status.available) {
    console.log('Testing runBob() with a simple prompt...');
    const result = await runBob('Reply with exactly: BOB_ADAPTER_ONLINE', {
      cwd: 'C:\\Users\\Patel Kathan\\Desktop\\VECTRA',
      maxTurns: 3,
      onChunk: (chunk) => process.stdout.write(chunk),
    });
    console.log('\nRun result success:', result.success);
    console.log('Run result text:', result.text.trim());
  }
}

test().then(() => {
  console.log('Adapter test finished cleanly.');
  process.exit(0);
}).catch(err => {
  console.error('Adapter test failed:', err);
  process.exit(1);
});
