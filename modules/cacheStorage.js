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
   constructor(cacheLiveTime) {
     this.cacheLiveTime = cacheLiveTime;
   }
   add(key, value) {
     if !(key in this) {
       this[key] = value;
       setTimeout((obj, key) => {
         delete obj[key];
       }(this, key), this.cacheLiveTime);
     }
   }
   async get(key) {
     let that = this;
     return new Promise(function(resolve, reject) {
       if (key in that) {
         resolve(that[key]);
       } else {
         reject("key not found");
       }
     });
   }
   isInCache(key) {
     return (key in this);
   }
 }
