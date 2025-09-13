const g = new Proxy({}, { get(t, p) { return document.getElementById(p) } });
const status_image = g.status_image,
    status_text = g.status,
    progress = g.progress,
    progress_inner = g.progress_inner,
    continue_button = g.continue_button,
    user = g.user;
user.addEventListener('toggle', () => globalThis.user_wants_to_read_more = true, { once: true });

const worker = new Worker('/web/pow_worker.js');
let work_data = {};
let resolve = null;
const uifail = () => {
    status_image.src = '/web/img/error.webp';
    status_image.classList.remove('r');
    status_image.style.maxWidth = '64px';
}
worker.onmessage = async function (e) {
    const { data } = e;
    const { action, success, result } = data;
    switch (action) {
        case 'init':
            if (success) {
                console.log('PoW Calculator initialized');
                status_text.innerText = 'Requesting challenge...';
                requestChallenge();
            }
            else {
                console.error('Failed to initialize PoW Calculator:', data.error);
                status_text.innerText = ('Failed to initialize PoW Calculator: ' + data.error);
                uifail();
            }
            break;
        case 'calculate':
            if (success) {
                if (result === -1n) {
                    if (!work_data.run) return;
                    if ((Date.now() - work_data.start_time) > (work_data.expires * 1000)) {
                        status_text.innerText = 'Unexpected Failure!\nMaybe your device is too slow to solve the PoW ' +
                            'before it expires?\nPlease try to refresh the page.';
                        uifail();
                        return;
                    }
                    // not found, continue search
                    work_data.last_nonce += work_data.BATCH_SIZE;
                    worker.postMessage({
                        action: 'calculate',
                        challenge: work_data.challenge,
                        difficulty: work_data.difficulty,
                        start_nonce: work_data.last_nonce,
                        batch_size: work_data.BATCH_SIZE,
                    });
                    const last_batch_time = work_data.last_batch_time;
                    if (last_batch_time) {
                        const elapsed = Date.now() - last_batch_time;
                        const speed = +(work_data.BATCH_SIZE.toString()) / elapsed;
                        status_text.innerText = `Calculating...\nDifficulty: ${work_data.difficulty}, Speed: ${speed.toFixed(2)} kH/s`;
                    }
                    work_data.last_batch_time = Date.now();
                    return;
                }
                work_data.run = false;
                console.log('PoW calculation result:', result);
                if (resolve) resolve(result);
                resolve = null;
            }
            else {
                work_data.run = false;
                console.error('Failed to calculate PoW:', data.error);
                status_text.innerText = ('Failed to calculate PoW: ' + data.error);
                uifail();
            }
            break;
        default:
            break;
    }
}
worker.postMessage({ action: 'init' });

status_text.innerText = 'Initializing...';


async function requestChallenge() {
    try {
        const resp = await fetch(location.href);
        if (resp.status !== 401) {
            throw `HTTP ${resp.status} ${resp.statusText}`;
        }
        const { challenge, difficulty, expires } = await resp.json();
        const now = Date.now();
        work_data = {
            BATCH_SIZE: 981207n, // Kiana Kaslana's Birthday
            run: false,
            last_nonce: 0n,
            expires: expires,
            difficulty: difficulty,
            challenge: challenge,
            start_time: now,
            last_batch_time: now,
        };

        status_text.innerText = 'Calculating...';
        progress.style.display = 'inline-block';
        window.progress_timer_id = setInterval(() => {
            progress_inner.style.width = ((parseInt(progress_inner.style.width || 0)) + 1) + '%';
            if (progress_inner.style.width === '101%') {
                progress_inner.style.width = '100%';
                clearInterval(window.progress_timer_id);
            }
        }, 200);

        new Promise((res, rej) => {
            resolve = res;
            work_data.run = true;
            worker.postMessage({ action: 'calculate', challenge, difficulty, start_nonce: work_data.last_nonce, batch_size: work_data.BATCH_SIZE });
        }).then(nonce => {
            if ((Date.now() - work_data.start_time) > (work_data.expires * 1000)) {
                // expired calculation. re-request challenge.
                status_text.innerText = 'Challenge has expired. Requesting new challenge...';
                setTimeout(() => requestChallenge(), 1000);
                return;
            }
            status_text.innerText = `Calculation completed (nonce: ${nonce})`;
            status_image.src = '/web/img/success.webp';
            status_image.classList.remove('r');
            progress.style.display = 'none';
            clearInterval(window.progress_timer_id);
            // submit answer
            work_data.nonce = nonce;
            submitAnswer();
        }).catch(e => {
            console.error('Failed to calculate PoW:', e);
            status_text.innerText = ('Failed to calculate: ' + e);
            uifail();
        });
    }
    catch (e) {
        console.error('Failed to request challenge:', e);
        status_text.innerText = ('Failed to request challenge: ' + e);
        uifail();
    }
}

async function submitAnswer() {
    if ((Date.now() - work_data.start_time) > (work_data.expires * 1000)) {
        status_text.innerText = 'Challenge has expired. Requesting new challenge...';
        setTimeout(() => requestChallenge(), 2000);
        continue_button.hidden = true;
        status_image.src = '/web/img/loading.webp';
        status_image.classList.add('r');
        status_image.style.maxWidth = '';
        progress_inner.style.width = '0%';
        return;
    }
    fetch(location.href, {
        method: 'POST',
        body: JSON.stringify({ challenge: work_data.challenge, nonce: work_data.nonce.toString() }),
    }).then(async r => {
        if (!r.ok) {
            throw `HTTP ${r.status} ${r.statusText}\n${await r.text()}`;
        }
        const url = await r.text();
        status_text.innerText = `Verified (nonce: ${work_data.nonce})`;
        continue_button.href = url;
        continue_button.hidden = false;
        continue_button.innerText = 'Continue';
        if (!globalThis.user_wants_to_read_more) {
            window.open(url, '_self');
        }
        setTimeout(() => {
            continue_button.onclick = e => {
                e.preventDefault();
                globalThis.user_wants_to_read_more = false;
                submitAnswer();
            };
            continue_button.innerText = 'Submit answer again';
        }, 8000);
    }).catch(e => {
        console.error('Failed to submit answer:', e);
        status_text.innerText += (', but failed to submit answer: ' + e);
        uifail();
    });
}
