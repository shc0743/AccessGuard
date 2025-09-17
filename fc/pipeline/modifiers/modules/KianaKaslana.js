// 留给我们的唯有一条路，那就是琪亚娜·卡斯兰娜的道路！
import { EASTER_EGG } from '../../../config.js';

export default async function modify_response(ctx, response) {
    if (!EASTER_EGG) return;
    if (!response.headers) response.headers = {};
    response.headers["X-Project-Developer-Favorite-Character"] = "Kiana Kaslana (Herrscher of Finality)";
}
