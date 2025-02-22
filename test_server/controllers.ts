import { Context } from "https://deno.land/x/oak/mod.ts";
import { writeJson, readJson } from 'https://deno.land/x/jsonfile/mod.ts';

const controller: Record <string, (ctx: Context, next: () => Promise<unknown>) => Promise<unknown> | void> = {};

controller.jsonRead = async (ctx: Context, next: () => Promise<unknown>) => {
  ctx.state.test = await readJson(`${Deno.cwd()}/test.json`);
  return next();
};

controller.writeJson = async (ctx: Context, next: () => Promise<unknown>) => {
  const reqBody = ctx.request.body();
  if (!reqBody.value || reqBody.type !== 'json') {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: 'no data provided'
    }
    return;
  }
  const reqBodyVal = await reqBody.value;
  const currentJSON: any = await readJson(`${Deno.cwd()}/test.json`);
  Object.keys(reqBodyVal).forEach((key: string) => {
    currentJSON[key] = reqBodyVal[key];
  });
  await writeJson(`${Deno.cwd()}/test.json`, currentJSON);
  return next();
};

controller.objectRead = (ctx: Context, next: () => Promise<unknown>) => {
  const testObj: Record <string, number | string> = {
    test: 'hi',
    test2: 12
  };
  testObj.name = 'hank';
  testObj.age = 31; 
  ctx.state.testObj = testObj;
  return next();
};

export default controller;