import { Context, Response } from 'https://deno.land/x/oak@v10.6.0/mod.ts';
import LRU from './lru.ts';
import LFU from './lfu.ts';

interface options {
  cache?: 'LRU' | 'LFU',
  expire?: string | number,
  respondOnHit?: boolean
}

/**
  * Class to initalize new instance of cache.
  * Takes options to define if cache eviction policy, expiration time for cache itmes, and if response should be returned on cache hit.
  * 
  * ### Example
  * 
  * ```ts
  * 
  * import { ZoicCache } from '../src/zoicCache.ts';
  * 
  * const cache = new ZoicCache({ cache: 'LFU', expire: '2h, 5m, 3s', respondOnHit: true });
  * 
  * router.get('/dbRead', cache.use, controller.dbRead, ctx => {
  *  ctx.response.body = ctx.state.somethingFromDb;});
  * 
  * 
  * ```
  * 
  * @param option (cache options)
  * @returns LRU | LFU (new cache)
*/
export class ZoicCache {
  cache: LRU | LFU;
  expire: number;
  respondOnHit: boolean;
  constructor (options?: options) {

    //initalizes cache options
    this.expire = this.#parseExpTime(options?.expire);
    this.cache = this.#initCacheType(this.expire, options?.cache);
    this.respondOnHit = options?.respondOnHit || true;

    this.use = this.use.bind(this);
    this.makeResponseCacheable = this.makeResponseCacheable.bind(this);
    this.put = this.put.bind(this);
  }


  /**
   * Sets cache eviction policty. Defaults to LRU.
   * @param expire 
   * @param cache 
   * @returns LRU | LFU
   */
  #initCacheType (expire: number, cache?: string) {
    // The client will enter the specific cache function they want as a string, which is passed as an arg here.
    if (cache === 'LFU') return new LFU(expire);
    return new LRU(expire);
  }


  /**
   * Parses expire option into time in seconds.
   * @param numberString 
   * @returns number
   */
  #parseExpTime (numberString?: string | number) {
    if (!numberString) return 86400;
    let seconds;
    if (typeof numberString === 'string'){
      seconds = numberString.trim().split(',').reduce((arr, el) => {
        if (el[el.length - 1] === 'h') return arr += parseInt(el.slice(0, -1)) * 3600;
        if (el[el.length - 1] === 'm') return arr += parseInt(el.slice(0, -1)) * 60;
        if (el[el.length - 1] === 's') return arr += parseInt(el.slice(0, -1));
        throw new TypeError(
          'Cache expiration time must be string formatted as a numerical value followed by \'h\', \'m\', or \'s\', or a number representing time in seconds.'
          )
      }, 0);
    } else seconds = numberString;
    if (seconds > 86400 || seconds < 0) throw new TypeError('Cache expiration time out of range.');
    return seconds;
  }


  /**
   * Primary caching middleware method on user end.
   * Resposible for querying cache and either returning results to client/attaching results to ctx.state.zoic (depending on user options)
   * or, in the case of a miss, signalling to make response cachable.
   * @param ctx 
   * @param next 
   * @returns Promise | void
   */
  use (ctx: Context, next: () => Promise<unknown>) {
    
    //defines key via api endpoint
    const key: string = ctx.request.url.pathname + ctx.request.url.search;
    try {
      //query cache
      const cacheResults = this.cache.get(key);

      //check if cache miss
      if (!cacheResults) {
        //makes response cacheable via patch
        this.makeResponseCacheable(ctx);
        return next();
      }

      //if user selects respondOnHit option, return cache query results immediately 
      if (this.respondOnHit) {
        ctx.response.headers = cacheResults.headers;
        ctx.response.body = cacheResults.body;
        ctx.response.status = cacheResults.status;
        ctx.response.type = cacheResults.type;

        console.log('zoicCache return on hit: ', cacheResults.headers, cacheResults.body, cacheResults.status);

        return;
      }

      //attach query results to ctx.state.zoic
      ctx.state.zoicResponse = Object.assign({}, cacheResults);

      return next();

    } catch (err) {
      ctx.response.status = 400;
      ctx.response.body = `error in ZoicCache.use: ${err}`
      console.log(`error in ZoicCache.use: ${err}`);
    }
  }


  /**
   * Makes response store to cache at the end of middleware chain in the case of a cache miss.
   * This is done by patching 'toDomRespone' to send results to cache before returning to client.
   * @param ctx 
   * @returns void
   */
  makeResponseCacheable (ctx: Context) {

    //create new response object to retain access to original toDomResponse function def
    const responsePatch = new Response(ctx.request);
    const cache = this.cache;

    //patch toDomResponse to cache response body before returning results to client
    ctx.response.toDomResponse = function() {

      //defines key via api endpoint and adds response body to cache
      const key: string = ctx.request.url.pathname + ctx.request.url.search;

      const response: unknown = {
        body: ctx.response.body,
        headers: ctx.response.headers,
        status: ctx.response.status,
        type: ctx.response.type
      };
      
      cache.put(key, response);

      //returns results to client
      responsePatch.headers = ctx.response.headers;
      responsePatch.body = ctx.response.body;
      responsePatch.status = ctx.response.status;
      responsePatch.type = ctx.response.type;

      return new Promise (resolve => {                
        resolve(responsePatch.toDomResponse());
      });
    }

    return;
  }
  

  /**
   * Manually clears all current cache entries.
   */
  clearCache () {
    this.cache.clear();
  }


  /**
   *  manually adds ctx.state.zoic to cache, in the form of a middleware function.
   *  ~~*potentailly no longer needed, via makeReponseCacheable*~~
   * @param ctx 
   * @param next 
   * @returns 
   */
  async put (ctx: Context, next: () => Promise<unknown>) {

    try {
    // deconstruct context obj for args to cache put
    const value: unknown = ctx.state.zoic; 
    
    const key: string = ctx.request.url.pathname + ctx.request.url.search;
 
    // call to put to cache: response 0 for good put, -1 for err
    const putResponse: number = await this.cache.put(key, value);
  
    if (putResponse === 0) return next();
    else if (putResponse === -1) ctx.response.body = {
      success: false,
      message: 'failed to add entry to cache'
    } 
    } catch (err) {

    // handle errors in caching process and emit
      ctx.response.body = {
        success: false,
        message: `${err} ocurred when trying to add to the cache`
      }
    }
  }
}

export default ZoicCache;

// const lru = new LRU();
// lru.put('a', 1)
// lru.put('b', 2)
// lru.put('c', 3)
// lru.put('d', 4)
// lru.put('b', 5)
// lru.put('e', 7)
// lru.put('c', 10)
// lru.put('d', 11)
// lru.put('d', 12)
// lru.put('f', 15)
// lru.put('d', 11)

// lru.printLru();
// lru.get('e')
// lru.printLru();
// console.log('length', lru.length)