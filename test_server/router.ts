import { Router } from "https://deno.land/x/oak/mod.ts";
import controller from './controllers.ts';
import  { ZoicCache } from '../src/zoicCache.ts';

const router = new Router();
const cache = new ZoicCache();

router.get('/readJson', cache.use, controller.jsonRead, ctx => {
  ctx.response.headers.set('Etag', 'test tag')
  ctx.response.body = ctx.state.test;
});

router.post('/writeJson', controller.writeJson, controller.jsonRead, ctx => {
  ctx.response.body = ctx.state.zoic;
})

router.get('/object', controller.objectRead, ctx => {
  ctx.response.body = ctx.state.testObj;
});

router.get('/other', ctx => {
  ctx.response.body = 'woww cool'
});

export default router;