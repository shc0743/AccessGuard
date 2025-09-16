const g = new Proxy({}, { get(t, p) { return document.getElementById(p) } });
const status_image = g.status_image, status_text = g.status,
    progress = g.progress, progress_inner = g.progress_inner,
    continue_button = g.continue_button,
    hint = g.hint, hint_text = g.hint_text, hint_retry_btn = g.hint_retry_btn,
    user = g.user;
user.addEventListener('toggle', () => globalThis.user_wants_to_read_more = true, { once: true });

let worker = null;
let work_data = {};
let resolve = null;
const reset_timers = () => {
    if (window.progress_timer_id) { clearInterval(window.progress_timer_id); delete window.progress_timer_id; }
    if (window.calculate_expiry_timer_id) { clearInterval(window.calculate_expiry_timer_id); delete window.calculate_expiry_timer_id; }
}
const uireset = () => {
    hint.hidden = hint_retry_btn.hidden = continue_button.hidden = true;
    status_image.src = '/web/img/loading.webp';
    status_image.classList.add('r');
    status_image.style.maxWidth = '';
    progress_inner.style.width = '0%';
    reset_timers();
}
const uifail = (reason = '') => {
    if (reason) status_text.innerText = reason;
    status_image.src = '/web/img/error.webp';
    status_image.classList.remove('r');
    status_image.style.maxWidth = '64px';
    continue_button.hidden = false;
    continue_button.innerText = 'Try again';
    continue_button.onclick = e => {
        e.preventDefault();
        uireset();
        continue_button.hidden = true;
        continue_button.onclick = null;
        status_text.innerText = 'Requesting challenge...';
        requestChallenge();
    };
    reset_timers();
}
const reset_worker = function () {
    if (worker) worker.terminate();
    worker = new Worker('/web/pow_worker.js');
    worker.onmessage = WorkerHandler;
}
try {
    reset_worker();
    worker.postMessage({ action: 'init' });
    status_text.innerText = 'Initializing...';
}
catch (e) {
    uifail('Unable to create Web Worker. Please check your Internet connection. ' +
        'Note that your browser extension may block Web Worker.\n\n' + e);
}

hint_retry_btn.onclick = () => {
    reset_worker();
    worker.postMessage({ action: 'init' });
    status_text.innerText = 'Initializing...';
}


async function WorkerHandler(e) {
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
                uifail('Failed to initialize PoW Calculator: ' + data.error);
            }
            break;
        case 'calculate':
            if (success) {
                if (result === -1n) {
                    if (!work_data.run) return;
                    const time_elapsed = (Date.now() - work_data.start_time);
                    if (time_elapsed > (work_data.expires * 1000)) {
                        uifail('Unable to solve the PoW before it expires.\nThis might be caused due to randomness or slow device.\nTrying again may solve the problem.');
                        return;
                    }
                    const time_expected = 2n ** BigInt(work_data.difficulty);
                    let shouldShowTip = true;
                    if (time_elapsed > (time_expected * 2n)) {
                        hint_text.innerText = 'It takes longer than expected to solve the PoW. To get a new challenge, you can try again.';
                        hint_retry_btn.hidden = false;
                    } else if (time_elapsed > time_expected) {
                        hint_text.innerText = 'It is taking a bit longer than usual to solve the PoW...';
                        hint_retry_btn.hidden = false;
                    } else if (time_elapsed > (time_expected / 2n)) {
                        hint_text.innerText = 'It may take a little longer than average, please wait...';
                    } else shouldShowTip = false;
                    hint.hidden = !shouldShowTip;
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
                        status_text.innerText = `Calculating...\nDifficulty: ${work_data.difficulty}, Speed: ${speed.toFixed(2)} kH/s\n${Math.floor(Number(work_data.last_nonce)/1000)}k iters`;
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
                uifail('Failed to calculate PoW: ' + data.error);
            }
            break;
        default:
            break;
    }
}

async function requestChallenge() {
    try {
        const resp = await fetch(location.href);
        if (resp.status !== 401) {
            throw `HTTP ${resp.status} ${resp.statusText}`;
        }
        const { challenge, difficulty, expires } = await resp.json();
        const now = Date.now();
        work_data = {
            BATCH_SIZE: 981207n, // 叱咤月海鱼鱼猫
            run: false,
            last_nonce: 0n,
            challenge, expires, difficulty,
            start_time: now, last_batch_time: now,
        };

        status_text.innerText = 'Calculating...';
        progress.style.display = 'inline-block';
        window.progress_timer_id = setInterval(() => {
            progress_inner.style.width = ((parseInt(progress_inner.style.width || 0)) + 1) + '%';
            if (progress_inner.style.width === '101%') {
                progress_inner.style.width = '100%';
                clearInterval(window.progress_timer_id);
                delete window.progress_timer_id;
            }
        }, 200);
        window.calculate_expiry_timer_id = setInterval(() => {
            if (!((Date.now() - work_data.start_time) > (work_data.expires * 1000))) return;
            uifail('Unable to solve the PoW before it expires (timed-out).\nThis might be caused due to randomness or slow device.\nTrying again may solve the problem.');
            reset_worker();
            continue_button.onclick = e => {
                e.preventDefault();
                uireset();
                continue_button.hidden = true;
                continue_button.onclick = null;
                worker.postMessage({ action: 'init' });
                status_text.innerText = 'Initializing...';
            };
        }, 2000);

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
            reset_timers();
            // submit answer
            work_data.nonce = nonce;
            submitAnswer();
        }).catch(e => {
            console.error('Failed to calculate PoW:', e);
            uifail('Failed to calculate: ' + e);
        });
    }
    catch (e) {
        console.error('Failed to request challenge:', e);
        uifail('Failed to request challenge: ' + e);
    }
}
async function submitAnswer() {
    if ((Date.now() - work_data.start_time) > (work_data.expires * 1000)) {
        status_text.innerText = 'Challenge has expired. Requesting new challenge...';
        uireset();
        setTimeout(() => requestChallenge(), 2000);
        return;
    }
    fetch(location.href, {
        method: 'POST',
        body: JSON.stringify({ challenge: work_data.challenge, nonce: work_data.nonce.toString() }),
    }).then(async r => {
        if (!r.ok) {
            throw `HTTP ${r.status} ${r.statusText}\n${await r.text()}`;
        }
        const { url, expires } = await r.json();
        status_text.innerText = `Verified (nonce: ${work_data.nonce})`;
        continue_button.href = url;
        continue_button.hidden = false;
        continue_button.innerText = 'Continue';
        if (!globalThis.user_wants_to_read_more) {
            window.open(url, '_self');
        }
        continue_button.onclick = null;
        setTimeout(() => {
            continue_button.onclick = e => {
                e.preventDefault();
                globalThis.user_wants_to_read_more = false;
                submitAnswer();
                continue_button.onclick = e => e.preventDefault();
            };
            continue_button.innerText = 'Submit answer again';
        }, (expires - 2) * 1000);
    }).catch(e => {
        console.error('Failed to submit answer:', e);
        status_text.innerText += (', but failed to submit answer: ' + e);
        uifail();
    });
}
