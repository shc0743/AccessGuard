importScripts('/web/pow_calculator.js');

(async () => {
    globalThis.onmessage = async function (e) {
        const { data } = e;
        const { action } = data;
        try {
            switch (action) {
                case 'init':
                {
                    globalThis.calculator = await PoW_Calculator();
                    globalThis.Calc = calculator.cwrap(
                        'pow_calculate',
                        'bigint',
                        ['string', 'bigint', 'bigint', 'number']
                    );
                    postMessage({ action, type: 'init', success: true });
                    break;
                }
                case 'calculate':
                {
                    const { challenge, start_nonce, batch_size, difficulty } = data;
                    const result = Calc(challenge, start_nonce, batch_size, difficulty * 4);
                    postMessage({ action, type: 'calculate', success: true, result });
                    break;
                }
                default:
                    break;
            }
        }
        catch (e) {
            postMessage({ action, type: 'error', success: false, error: String((e || {}).stack || e) });
        }
    }
})();