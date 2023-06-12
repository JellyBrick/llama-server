import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import { LLM } from 'llama-node';
import { LLamaCpp } from 'llama-node/dist/llm/llama-cpp.js';
import * as fs from 'fs';
import os from 'os';

const model = process.env.MODEL_PATH;
const llama = new LLM(LLamaCpp);
const config = {
  modelPath: model,
  enableLogging: false,
  nCtx: 2048,
  seed: 0,
  f16Kv: false,
  logitsAll: false,
  vocabOnly: false,
  useMlock: false,
  embedding: false,
  useMmap: true,
  nGpuLayers: 0,
};

const generationConfig = {
  nThreads: os.cpus().length,
  nTokPredict: 2048,
  topK: 40,
  topP: 0.1,
  temp: 0.3,
  repeatPenalty: 1.176,
  stopSequence: 'Human A',
};

const promptTemplate = fs.readFileSync(process.env.PROMPT_PATH, { encoding: 'utf8', flag: 'r' });

const main = async () => {
  await llama.load(config);

  const app = new Koa();
  app.use(bodyParser());
  
  const router = new Router();

  app.use(router.routes());
  app.use(router.allowedMethods());
  
  router.post('/', async (ctx, next) => {
    const body = ctx.request.body;
    console.log(body);
    if (body.authKey == process.env.GLOBAL_AUTH_KEY) {
      ctx.status = 200;
      const userPrompt = body.prompt;
      let semyResponse = '';

      const finalPrompt
        = promptTemplate.replace(/\%NOW_DATE_TIME\%/g, (new Date()).toString()) + '\n' + userPrompt + '\nSydney:';

      await llama.createCompletion({
        ...generationConfig,
        prompt: finalPrompt,
      }, (response) => {
        semyResponse += response.token;
      });

      ctx.body = {
        response: semyResponse,
      };
    } else {
      ctx.status = 403;
    }
    await next();
  });

  app.listen(8884);
};

main();