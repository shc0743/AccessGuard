import { sign_url } from 'alioss-sign-v4-util';
import { baseUrl, bucket, region, SIGNED_URL_EXPIRES } from './config.js';

export default async function geturl(objectKey, context) {
    return await sign_url(new URL(objectKey, baseUrl), {
        expires: SIGNED_URL_EXPIRES,
        bucket,
        region,
        access_key_id: context.credentials.accessKeyId,
        access_key_secret: context.credentials.accessKeySecret,
        sts_token: context.credentials.securityToken,
    })
}