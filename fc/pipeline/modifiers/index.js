import modifiers from './data.js';

export async function apply_modifiers(ctx, response) {
    for (const modifier of modifiers) {
        await modifier(ctx, response);
    }
}
