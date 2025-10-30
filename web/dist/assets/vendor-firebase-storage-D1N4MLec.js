import{_ as te,r as S,S as ne,a as se,g as re,b as oe}from"./vendor-firebase-app-DqcDUDC6.js";import{F as ie,c as P,T as ae,h as B,p as ue,u as ce,U as le}from"./vendor-firebase-util-CIVODmCg.js";import{C as he}from"./vendor-firebase-component-B9jxOSis.js";/**
 * @license
 * Copyright 2017 Google LLC
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
 */const j="firebasestorage.googleapis.com",V="storageBucket",de=120*1e3,pe=600*1e3;/**
 * @license
 * Copyright 2017 Google LLC
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
 */class l extends ie{constructor(t,n,s=0){super(y(t),`Firebase Storage: ${n} (${y(t)})`),this.status_=s,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,l.prototype)}get status(){return this.status_}set status(t){this.status_=t}_codeEquals(t){return y(t)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(t){this.customData.serverResponse=t,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var c;(function(e){e.UNKNOWN="unknown",e.OBJECT_NOT_FOUND="object-not-found",e.BUCKET_NOT_FOUND="bucket-not-found",e.PROJECT_NOT_FOUND="project-not-found",e.QUOTA_EXCEEDED="quota-exceeded",e.UNAUTHENTICATED="unauthenticated",e.UNAUTHORIZED="unauthorized",e.UNAUTHORIZED_APP="unauthorized-app",e.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",e.INVALID_CHECKSUM="invalid-checksum",e.CANCELED="canceled",e.INVALID_EVENT_NAME="invalid-event-name",e.INVALID_URL="invalid-url",e.INVALID_DEFAULT_BUCKET="invalid-default-bucket",e.NO_DEFAULT_BUCKET="no-default-bucket",e.CANNOT_SLICE_BLOB="cannot-slice-blob",e.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",e.NO_DOWNLOAD_URL="no-download-url",e.INVALID_ARGUMENT="invalid-argument",e.INVALID_ARGUMENT_COUNT="invalid-argument-count",e.APP_DELETED="app-deleted",e.INVALID_ROOT_OPERATION="invalid-root-operation",e.INVALID_FORMAT="invalid-format",e.INTERNAL_ERROR="internal-error",e.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(c||(c={}));function y(e){return"storage/"+e}function q(){const e="An unknown error occurred, please check the error payload for server response.";return new l(c.UNKNOWN,e)}function fe(e){return new l(c.OBJECT_NOT_FOUND,"Object '"+e+"' does not exist.")}function _e(e){return new l(c.QUOTA_EXCEEDED,"Quota for bucket '"+e+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function ge(){const e="User is not authenticated, please authenticate using Firebase Authentication and try again.";return new l(c.UNAUTHENTICATED,e)}function me(){return new l(c.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project.")}function Re(e){return new l(c.UNAUTHORIZED,"User does not have permission to access '"+e+"'.")}function Te(){return new l(c.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function ke(){return new l(c.CANCELED,"User canceled the upload/download.")}function be(e){return new l(c.INVALID_URL,"Invalid URL '"+e+"'.")}function we(e){return new l(c.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+e+"'.")}function Ee(){return new l(c.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+V+"' property when initializing the app?")}function Oe(){return new l(c.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function C(e){return new l(c.INVALID_ARGUMENT,e)}function X(){return new l(c.APP_DELETED,"The Firebase app was deleted.")}function Ie(e){return new l(c.INVALID_ROOT_OPERATION,"The operation '"+e+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function I(e){throw new l(c.INTERNAL_ERROR,"Internal error: "+e)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class f{constructor(t,n){this.bucket=t,this.path_=n}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const t=encodeURIComponent;return"/b/"+t(this.bucket)+"/o/"+t(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(t,n){let s;try{s=f.makeFromUrl(t,n)}catch{return new f(t,"")}if(s.path==="")return s;throw we(t)}static makeFromUrl(t,n){let s=null;const r="([A-Za-z0-9.\\-_]+)";function o(g){g.path.charAt(g.path.length-1)==="/"&&(g.path_=g.path_.slice(0,-1))}const i="(/(.*))?$",a=new RegExp("^gs://"+r+i,"i"),u={bucket:1,path:3};function h(g){g.path_=decodeURIComponent(g.path)}const d="v[A-Za-z0-9_]+",R=n.replace(/[.]/g,"\\."),m="(/([^?#]*).*)?$",k=new RegExp(`^https?://${R}/${d}/b/${r}/o${m}`,"i"),T={bucket:1,path:3},E=n===j?"(?:storage.googleapis.com|storage.cloud.google.com)":n,_="([^?#]*)",U=new RegExp(`^https?://${E}/${r}/${_}`,"i"),O=[{regex:a,indices:u,postModify:o},{regex:k,indices:T,postModify:h},{regex:U,indices:{bucket:1,path:2},postModify:h}];for(let g=0;g<O.length;g++){const A=O[g],v=A.regex.exec(t);if(v){const ee=v[A.indices.bucket];let x=v[A.indices.path];x||(x=""),s=new f(ee,x),A.postModify(s);break}}if(s==null)throw be(t);return s}}class Ue{constructor(t){this.promise_=Promise.reject(t)}getPromise(){return this.promise_}cancel(t=!1){}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Ae(e,t,n){let s=1,r=null,o=null,i=!1,a=0;function u(){return a===2}let h=!1;function d(..._){h||(h=!0,t.apply(null,_))}function R(_){r=setTimeout(()=>{r=null,e(k,u())},_)}function m(){o&&clearTimeout(o)}function k(_,...U){if(h){m();return}if(_){m(),d.call(null,_,...U);return}if(u()||i){m(),d.call(null,_,...U);return}s<64&&(s*=2);let O;a===1?(a=2,O=0):O=(s+Math.random())*1e3,R(O)}let T=!1;function E(_){T||(T=!0,m(),!h&&(r!==null?(_||(a=2),clearTimeout(r),R(0)):_||(a=1)))}return R(0),o=setTimeout(()=>{i=!0,E(!0)},n),E}function Ne(e){e(!1)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function De(e){return e!==void 0}function ve(e){return typeof e=="object"&&!Array.isArray(e)}function K(e){return typeof e=="string"||e instanceof String}function F(e,t,n,s){if(s<t)throw C(`Invalid value for '${e}'. Expected ${t} or greater.`);if(s>n)throw C(`Invalid value for '${e}'. Expected ${n} or less.`)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function W(e,t,n){let s=t;return n==null&&(s=`https://${t}`),`${n}://${s}/v0${e}`}function z(e){const t=encodeURIComponent;let n="?";for(const s in e)if(e.hasOwnProperty(s)){const r=t(s)+"="+t(e[s]);n=n+r+"&"}return n=n.slice(0,-1),n}var b;(function(e){e[e.NO_ERROR=0]="NO_ERROR",e[e.NETWORK_ERROR=1]="NETWORK_ERROR",e[e.ABORT=2]="ABORT"})(b||(b={}));/**
 * @license
 * Copyright 2022 Google LLC
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
 */function xe(e,t){const n=e>=500&&e<600,r=[408,429].indexOf(e)!==-1,o=t.indexOf(e)!==-1;return n||r||o}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ye{constructor(t,n,s,r,o,i,a,u,h,d,R,m=!0,k=!1){this.url_=t,this.method_=n,this.headers_=s,this.body_=r,this.successCodes_=o,this.additionalRetryCodes_=i,this.callback_=a,this.errorCallback_=u,this.timeout_=h,this.progressCallback_=d,this.connectionFactory_=R,this.retry=m,this.isUsingEmulator=k,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((T,E)=>{this.resolve_=T,this.reject_=E,this.start_()})}start_(){const t=(s,r)=>{if(r){s(!1,new N(!1,null,!0));return}const o=this.connectionFactory_();this.pendingConnection_=o;const i=a=>{const u=a.loaded,h=a.lengthComputable?a.total:-1;this.progressCallback_!==null&&this.progressCallback_(u,h)};this.progressCallback_!==null&&o.addUploadProgressListener(i),o.send(this.url_,this.method_,this.isUsingEmulator,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&o.removeUploadProgressListener(i),this.pendingConnection_=null;const a=o.getErrorCode()===b.NO_ERROR,u=o.getStatus();if(!a||xe(u,this.additionalRetryCodes_)&&this.retry){const d=o.getErrorCode()===b.ABORT;s(!1,new N(!1,null,d));return}const h=this.successCodes_.indexOf(u)!==-1;s(!0,new N(h,o))})},n=(s,r)=>{const o=this.resolve_,i=this.reject_,a=r.connection;if(r.wasSuccessCode)try{const u=this.callback_(a,a.getResponse());De(u)?o(u):o()}catch(u){i(u)}else if(a!==null){const u=q();u.serverResponse=a.getErrorText(),this.errorCallback_?i(this.errorCallback_(a,u)):i(u)}else if(r.canceled){const u=this.appDelete_?X():ke();i(u)}else{const u=Te();i(u)}};this.canceled_?n(!1,new N(!1,null,!0)):this.backoffId_=Ae(t,n,this.timeout_)}getPromise(){return this.promise_}cancel(t){this.canceled_=!0,this.appDelete_=t||!1,this.backoffId_!==null&&Ne(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class N{constructor(t,n,s){this.wasSuccessCode=t,this.connection=n,this.canceled=!!s}}function Ce(e,t){t!==null&&t.length>0&&(e.Authorization="Firebase "+t)}function Pe(e,t){e["X-Firebase-Storage-Version"]="webjs/"+(t??"AppManager")}function Le(e,t){t&&(e["X-Firebase-GMPID"]=t)}function Se(e,t){t!==null&&(e["X-Firebase-AppCheck"]=t)}function Fe(e,t,n,s,r,o,i=!0,a=!1){const u=z(e.urlParams),h=e.url+u,d=Object.assign({},e.headers);return Le(d,t),Ce(d,n),Pe(d,o),Se(d,s),new ye(h,e.method,d,e.body,e.successCodes,e.additionalRetryCodes,e.handler,e.errorHandler,e.timeout,e.progressCallback,r,i,a)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function G(e){let t;try{t=JSON.parse(e)}catch{return null}return ve(t)?t:null}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Me(e){if(e.length===0)return null;const t=e.lastIndexOf("/");return t===-1?"":e.slice(0,t)}function He(e,t){const n=t.split("/").filter(s=>s.length>0).join("/");return e.length===0?n:e+"/"+n}function Y(e){const t=e.lastIndexOf("/",e.length-2);return t===-1?e:e.slice(t+1)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function $e(e,t){return t}class p{constructor(t,n,s,r){this.server=t,this.local=n||t,this.writable=!!s,this.xform=r||$e}}let D=null;function Be(e){return!K(e)||e.length<2?e:Y(e)}function je(){if(D)return D;const e=[];e.push(new p("bucket")),e.push(new p("generation")),e.push(new p("metageneration")),e.push(new p("name","fullPath",!0));function t(o,i){return Be(i)}const n=new p("name");n.xform=t,e.push(n);function s(o,i){return i!==void 0?Number(i):i}const r=new p("size");return r.xform=s,e.push(r),e.push(new p("timeCreated")),e.push(new p("updated")),e.push(new p("md5Hash",null,!0)),e.push(new p("cacheControl",null,!0)),e.push(new p("contentDisposition",null,!0)),e.push(new p("contentEncoding",null,!0)),e.push(new p("contentLanguage",null,!0)),e.push(new p("contentType",null,!0)),e.push(new p("metadata","customMetadata",!0)),D=e,D}function Ve(e,t){function n(){const s=e.bucket,r=e.fullPath,o=new f(s,r);return t._makeStorageReference(o)}Object.defineProperty(e,"ref",{get:n})}function qe(e,t,n){const s={};s.type="file";const r=n.length;for(let o=0;o<r;o++){const i=n[o];s[i.local]=i.xform(s,t[i.server])}return Ve(s,e),s}function Xe(e,t,n){const s=G(t);return s===null?null:qe(e,s,n)}function Ke(e,t,n,s){const r=G(t);if(r===null||!K(r.downloadTokens))return null;const o=r.downloadTokens;if(o.length===0)return null;const i=encodeURIComponent;return o.split(",").map(h=>{const d=e.bucket,R=e.fullPath,m="/b/"+i(d)+"/o/"+i(R),k=W(m,n,s),T=z({alt:"media",token:h});return k+T})[0]}class We{constructor(t,n,s,r){this.url=t,this.method=n,this.handler=s,this.timeout=r,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function ze(e){if(!e)throw q()}function Ge(e,t){function n(s,r){const o=Xe(e,r,t);return ze(o!==null),Ke(o,r,e.host,e._protocol)}return n}function Ye(e){function t(n,s){let r;return n.getStatus()===401?n.getErrorText().includes("Firebase App Check token is invalid")?r=me():r=ge():n.getStatus()===402?r=_e(e.bucket):n.getStatus()===403?r=Re(e.path):r=s,r.status=n.getStatus(),r.serverResponse=s.serverResponse,r}return t}function Ze(e){const t=Ye(e);function n(s,r){let o=t(s,r);return s.getStatus()===404&&(o=fe(e.path)),o.serverResponse=r.serverResponse,o}return n}function Je(e,t,n){const s=t.fullServerUrl(),r=W(s,e.host,e._protocol),o="GET",i=e.maxOperationRetryTime,a=new We(r,o,Ge(e,n),i);return a.errorHandler=Ze(t),a}class Qe{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=b.NO_ERROR,this.sendPromise_=new Promise(t=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=b.ABORT,t()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=b.NETWORK_ERROR,t()}),this.xhr_.addEventListener("load",()=>{t()})})}send(t,n,s,r,o){if(this.sent_)throw I("cannot .send() more than once");if(B(t)&&s&&(this.xhr_.withCredentials=!0),this.sent_=!0,this.xhr_.open(n,t,!0),o!==void 0)for(const i in o)o.hasOwnProperty(i)&&this.xhr_.setRequestHeader(i,o[i].toString());return r!==void 0?this.xhr_.send(r):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw I("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw I("cannot .getStatus() before sending");try{return this.xhr_.status}catch{return-1}}getResponse(){if(!this.sent_)throw I("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw I("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(t){return this.xhr_.getResponseHeader(t)}addUploadProgressListener(t){this.xhr_.upload!=null&&this.xhr_.upload.addEventListener("progress",t)}removeUploadProgressListener(t){this.xhr_.upload!=null&&this.xhr_.upload.removeEventListener("progress",t)}}class et extends Qe{initXhr(){this.xhr_.responseType="text"}}function tt(){return new et}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class w{constructor(t,n){this._service=t,n instanceof f?this._location=n:this._location=f.makeFromUrl(n,t.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(t,n){return new w(t,n)}get root(){const t=new f(this._location.bucket,"");return this._newRef(this._service,t)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return Y(this._location.path)}get storage(){return this._service}get parent(){const t=Me(this._location.path);if(t===null)return null;const n=new f(this._location.bucket,t);return new w(this._service,n)}_throwIfRoot(t){if(this._location.path==="")throw Ie(t)}}function nt(e){e._throwIfRoot("getDownloadURL");const t=Je(e.storage,e._location,je());return e.storage.makeRequestWithTokens(t,tt).then(n=>{if(n===null)throw Oe();return n})}function st(e,t){const n=He(e._location.path,t),s=new f(e._location.bucket,n);return new w(e.storage,s)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function rt(e){return/^[A-Za-z]+:\/\//.test(e)}function ot(e,t){return new w(e,t)}function Z(e,t){if(e instanceof L){const n=e;if(n._bucket==null)throw Ee();const s=new w(n,n._bucket);return t!=null?Z(s,t):s}else return t!==void 0?st(e,t):e}function it(e,t){if(t&&rt(t)){if(e instanceof L)return ot(e,t);throw C("To use ref(service, url), the first argument must be a Storage instance.")}else return Z(e,t)}function M(e,t){const n=t?.[V];return n==null?null:f.makeFromBucketSpec(n,e)}function at(e,t,n,s={}){e.host=`${t}:${n}`;const r=B(t);r&&(ue(`https://${e.host}/b`),ce("Storage",!0)),e._isUsingEmulator=!0,e._protocol=r?"https":"http";const{mockUserToken:o}=s;o&&(e._overrideAuthToken=typeof o=="string"?o:le(o,e.app.options.projectId))}class L{constructor(t,n,s,r,o,i=!1){this.app=t,this._authProvider=n,this._appCheckProvider=s,this._url=r,this._firebaseVersion=o,this._isUsingEmulator=i,this._bucket=null,this._host=j,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=de,this._maxUploadRetryTime=pe,this._requests=new Set,r!=null?this._bucket=f.makeFromBucketSpec(r,this._host):this._bucket=M(this._host,this.app.options)}get host(){return this._host}set host(t){this._host=t,this._url!=null?this._bucket=f.makeFromBucketSpec(this._url,t):this._bucket=M(t,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(t){F("time",0,Number.POSITIVE_INFINITY,t),this._maxUploadRetryTime=t}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(t){F("time",0,Number.POSITIVE_INFINITY,t),this._maxOperationRetryTime=t}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const t=this._authProvider.getImmediate({optional:!0});if(t){const n=await t.getToken();if(n!==null)return n.accessToken}return null}async _getAppCheckToken(){if(se(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const t=this._appCheckProvider.getImmediate({optional:!0});return t?(await t.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(t=>t.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(t){return new w(this,t)}_makeRequest(t,n,s,r,o=!0){if(this._deleted)return new Ue(X());{const i=Fe(t,this._appId,s,r,n,this._firebaseVersion,o,this._isUsingEmulator);return this._requests.add(i),i.getPromise().then(()=>this._requests.delete(i),()=>this._requests.delete(i)),i}}async makeRequestWithTokens(t,n){const[s,r]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(t,n,s,r).getPromise()}}const H="@firebase/storage",$="0.14.0";/**
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
 */const J="storage";function ft(e){return e=P(e),nt(e)}function _t(e,t){return e=P(e),it(e,t)}function gt(e=re(),t){e=P(e);const s=oe(e,J).getImmediate({identifier:t}),r=ae("storage");return r&&ut(s,...r),s}function ut(e,t,n,s={}){at(e,t,n,s)}function ct(e,{instanceIdentifier:t}){const n=e.getProvider("app").getImmediate(),s=e.getProvider("auth-internal"),r=e.getProvider("app-check-internal");return new L(n,s,r,t,ne)}function lt(){te(new he(J,ct,"PUBLIC").setMultipleInstances(!0)),S(H,$,""),S(H,$,"esm2020")}lt();export{ft as a,gt as g,_t as r};
