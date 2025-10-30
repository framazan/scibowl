import{_ as M,r as re,g as ne,b as P}from"./vendor-firebase-app-DqcDUDC6.js";import{C as O}from"./vendor-firebase-component-B9jxOSis.js";import{E as oe,v as K,x as ie,D as g,c as ae,y as se,z as ce}from"./vendor-firebase-util-CIVODmCg.js";import{L as le}from"./vendor-firebase-logger-CNz1B4Yj.js";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const R=new Map,z={activated:!1,tokenObservers:[]},ue={initialized:!1,enabled:!1};function c(e){return R.get(e)||{...z}}function he(e,t){return R.set(e,t),R.get(e)}function A(){return ue}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const y="https://content-firebaseappcheck.googleapis.com/v1",de="exchangeRecaptchaV3Token",fe="exchangeRecaptchaEnterpriseToken",pe="exchangeDebugToken",$={RETRIAL_MIN_WAIT:30*1e3,RETRIAL_MAX_WAIT:960*1e3},ge=1440*60*1e3;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ke{constructor(t,r,n,o,i){if(this.operation=t,this.retryPolicy=r,this.getWaitDuration=n,this.lowerBound=o,this.upperBound=i,this.pending=null,this.nextErrorWaitInterval=o,o>i)throw new Error("Proactive refresh lower bound greater than upper bound!")}start(){this.nextErrorWaitInterval=this.lowerBound,this.process(!0).catch(()=>{})}stop(){this.pending&&(this.pending.reject("cancelled"),this.pending=null)}isRunning(){return!!this.pending}async process(t){this.stop();try{this.pending=new g,this.pending.promise.catch(r=>{}),await Ee(this.getNextRun(t)),this.pending.resolve(),await this.pending.promise,this.pending=new g,this.pending.promise.catch(r=>{}),await this.operation(),this.pending.resolve(),await this.pending.promise,this.process(!0).catch(()=>{})}catch(r){this.retryPolicy(r)?this.process(!1).catch(()=>{}):this.stop()}}getNextRun(t){if(t)return this.nextErrorWaitInterval=this.lowerBound,this.getWaitDuration();{const r=this.nextErrorWaitInterval;return this.nextErrorWaitInterval*=2,this.nextErrorWaitInterval>this.upperBound&&(this.nextErrorWaitInterval=this.upperBound),r}}}function Ee(e){return new Promise(t=>{setTimeout(t,e)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Te={"already-initialized":"You have already called initializeAppCheck() for FirebaseApp {$appName} with different options. To avoid this error, call initializeAppCheck() with the same options as when it was originally called. This will return the already initialized instance.","use-before-activation":"App Check is being used before initializeAppCheck() is called for FirebaseApp {$appName}. Call initializeAppCheck() before instantiating other Firebase services.","fetch-network-error":"Fetch failed to connect to a network. Check Internet connection. Original error: {$originalErrorMessage}.","fetch-parse-error":"Fetch client could not parse response. Original error: {$originalErrorMessage}.","fetch-status-error":"Fetch server returned an HTTP error status. HTTP status: {$httpStatus}.","storage-open":"Error thrown when opening storage. Original error: {$originalErrorMessage}.","storage-get":"Error thrown when reading from storage. Original error: {$originalErrorMessage}.","storage-set":"Error thrown when writing to storage. Original error: {$originalErrorMessage}.","recaptcha-error":"ReCAPTCHA error.","initial-throttle":"{$httpStatus} error. Attempts allowed again after {$time}",throttled:"Requests throttled due to previous {$httpStatus} error. Attempts allowed again after {$time}"},u=new oe("appCheck","AppCheck",Te);/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function m(e=!1){return e?self.grecaptcha?.enterprise:self.grecaptcha}function D(e){if(!c(e).activated)throw u.create("use-before-activation",{appName:e.name})}function I(e){const t=Math.round(e/1e3),r=Math.floor(t/(3600*24)),n=Math.floor((t-r*3600*24)/3600),o=Math.floor((t-r*3600*24-n*3600)/60),i=t-r*3600*24-n*3600-o*60;let a="";return r&&(a+=E(r)+"d:"),n&&(a+=E(n)+"h:"),a+=E(o)+"m:"+E(i)+"s",a}function E(e){return e===0?"00":e>=10?e.toString():"0"+e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function _({url:e,body:t},r){const n={"Content-Type":"application/json"},o=r.getImmediate({optional:!0});if(o){const f=await o.getHeartbeatsHeader();f&&(n["X-Firebase-Client"]=f)}const i={method:"POST",body:JSON.stringify(t),headers:n};let a;try{a=await fetch(e,i)}catch(f){throw u.create("fetch-network-error",{originalErrorMessage:f?.message})}if(a.status!==200)throw u.create("fetch-status-error",{httpStatus:a.status});let h;try{h=await a.json()}catch(f){throw u.create("fetch-parse-error",{originalErrorMessage:f?.message})}const l=h.ttl.match(/^([\d.]+)(s)$/);if(!l||!l[2]||isNaN(Number(l[1])))throw u.create("fetch-parse-error",{originalErrorMessage:`ttl field (timeToLive) is not in standard Protobuf Duration format: ${h.ttl}`});const s=Number(l[1])*1e3,N=Date.now();return{token:h.token,expireTimeMillis:N+s,issuedAtTimeMillis:N}}function me(e,t){const{projectId:r,appId:n,apiKey:o}=e.options;return{url:`${y}/projects/${r}/apps/${n}:${de}?key=${o}`,body:{recaptcha_v3_token:t}}}function we(e,t){const{projectId:r,appId:n,apiKey:o}=e.options;return{url:`${y}/projects/${r}/apps/${n}:${fe}?key=${o}`,body:{recaptcha_enterprise_token:t}}}function L(e,t){const{projectId:r,appId:n,apiKey:o}=e.options;return{url:`${y}/projects/${r}/apps/${n}:${pe}?key=${o}`,body:{debug_token:t}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const be="firebase-app-check-database",Ae=1,k="firebase-app-check-store",F="debug-token";let T=null;function q(){return T||(T=new Promise((e,t)=>{try{const r=indexedDB.open(be,Ae);r.onsuccess=n=>{e(n.target.result)},r.onerror=n=>{t(u.create("storage-open",{originalErrorMessage:n.target.error?.message}))},r.onupgradeneeded=n=>{const o=n.target.result;switch(n.oldVersion){case 0:o.createObjectStore(k,{keyPath:"compositeKey"})}}}catch(r){t(u.create("storage-open",{originalErrorMessage:r?.message}))}}),T)}function _e(e){return W(j(e))}function Ce(e,t){return U(j(e),t)}function ve(e){return U(F,e)}function Re(){return W(F)}async function U(e,t){const n=(await q()).transaction(k,"readwrite"),i=n.objectStore(k).put({compositeKey:e,value:t});return new Promise((a,h)=>{i.onsuccess=l=>{a()},n.onerror=l=>{h(u.create("storage-set",{originalErrorMessage:l.target.error?.message}))}})}async function W(e){const r=(await q()).transaction(k,"readonly"),o=r.objectStore(k).get(e);return new Promise((i,a)=>{o.onsuccess=h=>{const l=h.target.result;i(l?l.value:void 0)},r.onerror=h=>{a(u.create("storage-get",{originalErrorMessage:h.target.error?.message}))}})}function j(e){return`${e.options.appId}-${e.name}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const d=new le("@firebase/app-check");/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Pe(e){if(K()){let t;try{t=await _e(e)}catch(r){d.warn(`Failed to read token from IndexedDB. Error: ${r}`)}return t}}function C(e,t){return K()?Ce(e,t).catch(r=>{d.warn(`Failed to write token to IndexedDB. Error: ${r}`)}):Promise.resolve()}async function ye(){let e;try{e=await Re()}catch{}if(e)return e;{const t=crypto.randomUUID();return ve(t).catch(r=>d.warn(`Failed to persist debug token to IndexedDB. Error: ${r}`)),t}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function S(){return A().enabled}async function x(){const e=A();if(e.enabled&&e.token)return e.token.promise;throw Error(`
            Can't get debug token in production mode.
        `)}function De(){const e=se(),t=A();if(t.initialized=!0,typeof e.FIREBASE_APPCHECK_DEBUG_TOKEN!="string"&&e.FIREBASE_APPCHECK_DEBUG_TOKEN!==!0)return;t.enabled=!0;const r=new g;t.token=r,typeof e.FIREBASE_APPCHECK_DEBUG_TOKEN=="string"?r.resolve(e.FIREBASE_APPCHECK_DEBUG_TOKEN):r.resolve(ye())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ie={error:"UNKNOWN_ERROR"};function Se(e){return ie.encodeString(JSON.stringify(e),!1)}async function w(e,t=!1,r=!1){const n=e.app;D(n);const o=c(n);let i=o.token,a;if(i&&!p(i)&&(o.token=void 0,i=void 0),!i){const s=await o.cachedTokenPromise;s&&(p(s)?i=s:await C(n,void 0))}if(!t&&i&&p(i))return{token:i.token};let h=!1;if(S())try{o.exchangeTokenPromise||(o.exchangeTokenPromise=_(L(n,await x()),e.heartbeatServiceProvider).finally(()=>{o.exchangeTokenPromise=void 0}),h=!0);const s=await o.exchangeTokenPromise;return await C(n,s),o.token=s,{token:s.token}}catch(s){return s.code==="appCheck/throttled"||s.code==="appCheck/initial-throttle"?d.warn(s.message):r&&d.error(s),v(s)}try{o.exchangeTokenPromise||(o.exchangeTokenPromise=o.provider.getToken().finally(()=>{o.exchangeTokenPromise=void 0}),h=!0),i=await c(n).exchangeTokenPromise}catch(s){s.code==="appCheck/throttled"||s.code==="appCheck/initial-throttle"?d.warn(s.message):r&&d.error(s),a=s}let l;return i?a?p(i)?l={token:i.token,internalError:a}:l=v(a):(l={token:i.token},o.token=i,await C(n,i)):l=v(a),h&&V(n,l),l}async function xe(e){const t=e.app;D(t);const{provider:r}=c(t);if(S()){const n=await x(),{token:o}=await _(L(t,n),e.heartbeatServiceProvider);return{token:o}}else{const{token:n}=await r.getToken();return{token:n}}}function G(e,t,r,n){const{app:o}=e,i=c(o),a={next:r,error:n,type:t};if(i.tokenObservers=[...i.tokenObservers,a],i.token&&p(i.token)){const h=i.token;Promise.resolve().then(()=>{r({token:h.token}),H(e)}).catch(()=>{})}i.cachedTokenPromise.then(()=>H(e))}function X(e,t){const r=c(e),n=r.tokenObservers.filter(o=>o.next!==t);n.length===0&&r.tokenRefresher&&r.tokenRefresher.isRunning()&&r.tokenRefresher.stop(),r.tokenObservers=n}function H(e){const{app:t}=e,r=c(t);let n=r.tokenRefresher;n||(n=Ne(e),r.tokenRefresher=n),!n.isRunning()&&r.isTokenAutoRefreshEnabled&&n.start()}function Ne(e){const{app:t}=e;return new ke(async()=>{const r=c(t);let n;if(r.token?n=await w(e,!0):n=await w(e),n.error)throw n.error;if(n.internalError)throw n.internalError},()=>!0,()=>{const r=c(t);if(r.token){let n=r.token.issuedAtTimeMillis+(r.token.expireTimeMillis-r.token.issuedAtTimeMillis)*.5+3e5;const o=r.token.expireTimeMillis-300*1e3;return n=Math.min(n,o),Math.max(0,n-Date.now())}else return 0},$.RETRIAL_MIN_WAIT,$.RETRIAL_MAX_WAIT)}function V(e,t){const r=c(e).tokenObservers;for(const n of r)try{n.type==="EXTERNAL"&&t.error!=null?n.error(t.error):n.next(t)}catch{}}function p(e){return e.expireTimeMillis-Date.now()>0}function v(e){return{token:Se(Ie),error:e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Me{constructor(t,r){this.app=t,this.heartbeatServiceProvider=r}_delete(){const{tokenObservers:t}=c(this.app);for(const r of t)X(this.app,r.next);return Promise.resolve()}}function Oe(e,t){return new Me(e,t)}function $e(e){return{getToken:t=>w(e,t),getLimitedUseToken:()=>xe(e),addTokenListener:t=>G(e,"INTERNAL",t),removeTokenListener:t=>X(e.app,t)}}const He="@firebase/app-check",Be="0.11.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ke="https://www.google.com/recaptcha/api.js",ze="https://www.google.com/recaptcha/enterprise.js";function Le(e,t){const r=new g,n=c(e);n.reCAPTCHAState={initialized:r};const o=Y(e),i=m(!1);return i?b(e,t,i,o,r):Ue(()=>{const a=m(!1);if(!a)throw new Error("no recaptcha");b(e,t,a,o,r)}),r.promise}function Fe(e,t){const r=new g,n=c(e);n.reCAPTCHAState={initialized:r};const o=Y(e),i=m(!0);return i?b(e,t,i,o,r):We(()=>{const a=m(!0);if(!a)throw new Error("no recaptcha");b(e,t,a,o,r)}),r.promise}function b(e,t,r,n,o){r.ready(()=>{qe(e,t,r,n),o.resolve(r)})}function Y(e){const t=`fire_app_check_${e.name}`,r=document.createElement("div");return r.id=t,r.style.display="none",document.body.appendChild(r),t}async function J(e){D(e);const r=await c(e).reCAPTCHAState.initialized.promise;return new Promise((n,o)=>{const i=c(e).reCAPTCHAState;r.ready(()=>{n(r.execute(i.widgetId,{action:"fire_app_check"}))})})}function qe(e,t,r,n){const o=r.render(n,{sitekey:t,size:"invisible",callback:()=>{c(e).reCAPTCHAState.succeeded=!0},"error-callback":()=>{c(e).reCAPTCHAState.succeeded=!1}}),i=c(e);i.reCAPTCHAState={...i.reCAPTCHAState,widgetId:o}}function Ue(e){const t=document.createElement("script");t.src=Ke,t.onload=e,document.head.appendChild(t)}function We(e){const t=document.createElement("script");t.src=ze,t.onload=e,document.head.appendChild(t)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Q{constructor(t){this._siteKey=t,this._throttleData=null}async getToken(){te(this._throttleData);const t=await J(this._app).catch(n=>{throw u.create("recaptcha-error")});if(!c(this._app).reCAPTCHAState?.succeeded)throw u.create("recaptcha-error");let r;try{r=await _(me(this._app,t),this._heartbeatServiceProvider)}catch(n){throw n.code?.includes("fetch-status-error")?(this._throttleData=ee(Number(n.customData?.httpStatus),this._throttleData),u.create("initial-throttle",{time:I(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):n}return this._throttleData=null,r}initialize(t){this._app=t,this._heartbeatServiceProvider=P(t,"heartbeat"),Le(t,this._siteKey).catch(()=>{})}isEqual(t){return t instanceof Q?this._siteKey===t._siteKey:!1}}class Z{constructor(t){this._siteKey=t,this._throttleData=null}async getToken(){te(this._throttleData);const t=await J(this._app).catch(n=>{throw u.create("recaptcha-error")});if(!c(this._app).reCAPTCHAState?.succeeded)throw u.create("recaptcha-error");let r;try{r=await _(we(this._app,t),this._heartbeatServiceProvider)}catch(n){throw n.code?.includes("fetch-status-error")?(this._throttleData=ee(Number(n.customData?.httpStatus),this._throttleData),u.create("initial-throttle",{time:I(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):n}return this._throttleData=null,r}initialize(t){this._app=t,this._heartbeatServiceProvider=P(t,"heartbeat"),Fe(t,this._siteKey).catch(()=>{})}isEqual(t){return t instanceof Z?this._siteKey===t._siteKey:!1}}function ee(e,t){if(e===404||e===403)return{backoffCount:1,allowRequestsAfter:Date.now()+ge,httpStatus:e};{const r=t?t.backoffCount:0,n=ce(r,1e3,2);return{backoffCount:r+1,allowRequestsAfter:Date.now()+n,httpStatus:e}}}function te(e){if(e&&Date.now()-e.allowRequestsAfter<=0)throw u.create("throttled",{time:I(e.allowRequestsAfter-Date.now()),httpStatus:e.httpStatus})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ze(e=ne(),t){e=ae(e);const r=P(e,"app-check");if(A().initialized||De(),S()&&x().then(o=>console.log(`App Check debug token: ${o}. You will need to add it to your app's App Check settings in the Firebase console for it to work.`)),r.isInitialized()){const o=r.getImmediate(),i=r.getOptions();if(i.isTokenAutoRefreshEnabled===t.isTokenAutoRefreshEnabled&&i.provider.isEqual(t.provider))return o;throw u.create("already-initialized",{appName:e.name})}const n=r.initialize({options:t});return je(e,t.provider,t.isTokenAutoRefreshEnabled),c(e).isTokenAutoRefreshEnabled&&G(n,"INTERNAL",()=>{}),n}function je(e,t,r=!1){const n=he(e,{...z});n.activated=!0,n.provider=t,n.cachedTokenPromise=Pe(e).then(o=>(o&&p(o)&&(n.token=o,V(e,{token:o.token})),o)),n.isTokenAutoRefreshEnabled=r&&e.automaticDataCollectionEnabled,!e.automaticDataCollectionEnabled&&r&&d.warn("`isTokenAutoRefreshEnabled` is true but `automaticDataCollectionEnabled` was set to false during `initializeApp()`. This blocks automatic token refresh."),n.provider.initialize(e)}async function et(e,t){const r=await w(e,t);if(r.error)throw r.error;if(r.internalError)throw r.internalError;return{token:r.token}}const Ge="app-check",B="app-check-internal";function Xe(){M(new O(Ge,e=>{const t=e.getProvider("app").getImmediate(),r=e.getProvider("heartbeat");return Oe(t,r)},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,r)=>{e.getProvider(B).initialize()})),M(new O(B,e=>{const t=e.getProvider("app-check").getImmediate();return $e(t)},"PUBLIC").setInstantiationMode("EXPLICIT")),re(He,Be)}Xe();export{Z as R,Q as a,et as g,Ze as i};
