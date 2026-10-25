// Cloudflare Pages Functions: mọi đường dẫn /api/* chạy qua server/api.mjs
import { handle } from '../../server/api.mjs';

export const onRequest = (context) => handle(context.request, context.env);
