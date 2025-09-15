const worker = new Worker('/web/pow_worker.js');

let last_nonce = 0n;

worker.onmessage = async function (e) {
    const { data } = e;
    const { action, success, result } = data;
    switch (action) {
        case 'init':
            if (success) {
                console.log('PoW Calculator initialized');
            }
            else {
                console.error('Failed to initialize PoW Calculator:', data.error);
                alert('Failed to initialize PoW Calculator: ' + data.error);
            }
            break;
        case 'calculate':
            if (success) {
                if (result === -1n) {
                    // not found, continue search
                    console.log('Not found, continue search');
                    last_nonce += 1000000n;
                    worker.postMessage({ action: 'calculate', challenge, difficulty, start_nonce: last_nonce, batch_size: last_nonce });
                }
                console.log('PoW calculation result:', result);
                Nonce.value = result;
                Hash.value = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(Challenge.value + Nonce.value)))).map(b => b.toString(16).padStart(2, '0')).join('');
            }
            else {
                console.error('Failed to calculate PoW:', data.error);
                Nonce.value = ('Failed to calculate PoW: ' + data.error);
            }
            break;
        default:
            break;
    }
}
worker.postMessage({ action: 'init' });

calculate.onclick = function () {
    globalThis.challenge = (Challenge.value);
    globalThis.difficulty = +(Difficulty.value);
    last_nonce = 1000000n;
    worker.postMessage({ action: 'calculate', challenge, difficulty, start_nonce: 0n, batch_size: last_nonce });
}