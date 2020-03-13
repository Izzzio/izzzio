/**
 iZ³ | Izzzio blockchain - https://izzz.io

 Copyright 2018 Izio LLC (OOO "Изио")

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

 class CacheStorage {

  /**
   * 
   * @param {number} cacheLifeTime 
   */
   constructor(cacheLifeTime) {
     this.cacheLifeTime = cacheLifeTime;
     this._cache = {};
   }


   /**
    * Add block value to cache with timeout expiration
    * @param {string} key 
    * @param {any} value 
    */
   add(key, value) {
     if (! this._isInCache) {
       this._cache[key]['value'] = value;
       this._cache[key]['expire'] = this._generateTimeout(key);
     }
   }

  /**
   * Get block value from cache if it exists in cache, else - undefined
   * @param {String} key 
   * @returns {any}
   */
   get(key) {
     if (this._isInCache(key)) {
       clearTimeout(this._cache[key]['expire']);
       this._cache[key]['expire'] = this._generateTimeout(key);
       return this._cache[key]['value'];
     } else {
       return undefined;
     }
   }

   /**
    * Delete block value from cache if it exists, else - nothing
    * @param {string} key 
    */
   del(key) {
     if (this._isInCache(key)) {
       clearTimeout(this._cache[key]['expire']);
       delete this._cache[key];
     }
   }
   
   /**
    * Check if key exists in cache
    * @param {string} key
    * @returns {boolean} 
    */
   _isInCache(key) {
     return (key in this._cache);
   }

   /**
    * Generate timeout for data cache
    * @param {string} key
    * @returns {object} 
    */
   _generateTimeout(key) {
     return setTimeout(() => {
       delete this._cache[key];
     }, this.cacheLifeTime);
   } 
 }

 module.exports = CacheStorage; 