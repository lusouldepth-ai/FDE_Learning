import {validateBackup} from './core.js';
const KEY='fde-study-recovery-v1',ARCHIVE='fde-study-unmerged-v1';
export class Store {
  constructor(){this.state=null;this.queue=Promise.resolve();this.onStatus=()=>{};this.failed=false;this.pending=0;this.recoverySnapshot=null;}
  async load(){
    let response=null;try{response=await fetch('/api/state');}catch{}
    const type=(response&&response.headers&&response.headers.get&&response.headers.get('content-type'))||'';
    if(!response||response.status===404||response.status===405||type.includes('text/html')){
      // 托管部署（如 Vercel 静态站点）没有本地服务：学习记录只保存在当前浏览器 localStorage
      this.browserOnly=true;let cached=null;try{cached=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
      try{this.state=cached?validateBackup(cached):{schemaVersion:1,revision:0,records:{},sessions:[],activeExam:null,settings:{}};}catch{this.recoverySnapshot=cached;this.state={schemaVersion:1,revision:0,records:{},sessions:[],activeExam:null,settings:{}};}
      return this.state;
    }
    if(!response.ok)throw new Error((await response.json()).error);this.state=validateBackup(await response.json());try{const archived=JSON.parse(localStorage.getItem(ARCHIVE)||'null'),cached=JSON.parse(localStorage.getItem(KEY)||'null');const candidate=archived||(cached&&cached.revision>=this.state.revision?cached:null);if(candidate&&JSON.stringify(candidate)!==JSON.stringify(this.state)){validateBackup(candidate);this.recoverySnapshot=candidate;try{localStorage.setItem(ARCHIVE,JSON.stringify(candidate));}catch{}}}catch{}return this.state;}
  cache(){try{localStorage.setItem(KEY,JSON.stringify(this.state));return true;}catch{return false;}}
  save(){
    if(this.browserOnly){this.state.revision=(this.state.revision||0)+1;const ok=this.cache();this.failed=!ok;this.onStatus(ok?'已保存到本浏览器':'浏览器存储空间不足，请导出备份',!ok);return Promise.resolve();}
    this.cache();this.pending++;this.onStatus('正在保存…');
    this.queue=this.queue.then(async()=>{
      const snapshot=structuredClone(this.state);
      const res=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-FDE-Client':'offline-study'},body:JSON.stringify(snapshot)});
      const payload=await res.json();if(!res.ok)throw new Error(payload.error);
      this.state.revision=payload.revision;this.failed=false;
      this.cached=this.cache();
    }).catch(error=>{this.failed=true;this.onStatus(error.message+' · 请导出备份',true);}).finally(()=>{this.pending--;if(this.pending)this.onStatus('正在保存…');else if(!this.failed)this.onStatus(this.cached?'已保存到本机':'已保存到本机；浏览器应急副本空间不足',false);});
    return this.queue;
  }
  clearRecovery(){this.recoverySnapshot=null;try{localStorage.removeItem(ARCHIVE);}catch{}}
  recovery(){if(this.recoverySnapshot)return this.recoverySnapshot;try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
}
