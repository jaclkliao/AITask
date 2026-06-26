
const API=(window.APP_CONFIG?.API_BASE_URL||'/api').replace(/\/$/,'');
let token=localStorage.getItem('token'), user=JSON.parse(localStorage.getItem('user')||'{}');
let timerIntervals={}, runningTimers={}, currentProject=null;
let quill=null, editQuill=null, commentQuill=null, editTaskId=null;
let cachedTasks=[];          // 用于 ⌘K 搜索
let cmdItems=[], cmdActiveIdx=0;
let notificationItems=[];
let activeCommentTaskId=null;
let editingCommentId=null;
let mentionState=null;
let userCardTimer=null;
let captchaKey='';

function registerMentionBlot(){
  if(!window.Quill||window.MentionBlotRegistered) return;
  const Embed=Quill.import('blots/embed');
  class MentionBlot extends Embed{
    static create(value){
      const node=super.create();
      const id=String(value.id||value.userId||'');
      const label=value.value||value.nickname||value.username||'用户';
      node.setAttribute('data-user-id',id);
      node.setAttribute('data-username',value.username||'');
      node.setAttribute('data-nickname',value.nickname||label);
      node.setAttribute('contenteditable','false');
      node.className='mention-tag'+(id&&String(id)===String(currentUserId())?' self':'');
      node.textContent='@'+label;
      return node;
    }
    static value(node){
      return {
        id:node.getAttribute('data-user-id'),
        username:node.getAttribute('data-username'),
        nickname:node.getAttribute('data-nickname'),
        value:(node.textContent||'').replace(/^@/,'')
      };
    }
  }
  MentionBlot.blotName='mention';
  MentionBlot.tagName='SPAN';
  MentionBlot.className='mention-tag';
  Quill.register(MentionBlot);
  window.MentionBlotRegistered=true;
}

// ====== 登录态管理 ======
let _expiredModalShown=false;     // 防止重复弹
let _expiredCountdownTimer=null;  // 倒计时
const EXPIRED_REDIRECT_DELAY=5;   // 秒

// 触发登录过期弹窗（被 api() 拦截 / 启动时校验失败调用）
function triggerExpired(reason, opts={}){
  if(_expiredModalShown) return;   // 防止重复弹
  _expiredModalShown=true;
  const ov=document.getElementById('expiredOverlay');
  const title=document.getElementById('expiredTitle');
  const msg=document.getElementById('expiredMsg');
  const cd=document.getElementById('expiredCountdown');
  const num=document.getElementById('expiredNum');
  title.textContent=opts.silent?'会话已断开':'登录已过期';
  msg.textContent=reason||'你的登录状态已失效，请重新登录后继续使用。';
  // 自动跳转
  if(opts.autoRedirect!==false){
    cd.style.display='inline-flex';
    let n=EXPIRED_REDIRECT_DELAY;
    num.textContent=n;
    clearInterval(_expiredCountdownTimer);
    _expiredCountdownTimer=setInterval(()=>{
      n--;
      if(n<=0){clearInterval(_expiredCountdownTimer);doLogout(true);return}
      num.textContent=n;
    },1000);
  }else{
    cd.style.display='none';
  }
  ov.classList.remove('hide');
  requestAnimationFrame(()=>ov.classList.add('show'));
  // 暂停所有计时器
  Object.values(timerIntervals).forEach(clearInterval);
  timerIntervals={};
  runningTimers={};
}

function handleExpiredLogin(){
  clearInterval(_expiredCountdownTimer);
  doLogout(true);
}

function handleExpiredStay(){
  // 用户选择不立即登录：仅关闭弹窗，但保留 token=null 状态
  // 下次手动点击任何操作都会被 api() 重新触发弹窗
  clearInterval(_expiredCountdownTimer);
  const ov=document.getElementById('expiredOverlay');
  ov.classList.remove('show');
  setTimeout(()=>ov.classList.add('hide'),280);
  // 不重置 _expiredModalShown=false，以便用户刷新页面后看到的是登录页
}

// 真正执行退出：清 token + 切到登录页
function doLogout(redirectToLogin){
  token=null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  user={};
  // 清缓存
  cachedTasks=[];
  // 强制隐藏主区（双重保险）
  const ma=document.getElementById('mainApp');
  ma.classList.add('hide');
  ma.style.display='none';
  // 显示登录页
  document.getElementById('authPage').style.display='grid';
  // 清空表单
  ['loginUser','loginPass','regUser','regPass','regNick'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  switchAuth('login');
  // 关闭过期弹层
  const ov=document.getElementById('expiredOverlay');
  ov.classList.remove('show');
  setTimeout(()=>ov.classList.add('hide'),280);
  _expiredModalShown=false;
  if(typeof updateSessionIndicator==='function') updateSessionIndicator('expired');
  if(redirectToLogin) showToast('请重新登录','success');
}

// 启动时校验 token 是否还有效
async function validateTokenOnBoot(){
  if(!token) return false;
  try{
    const r=await api('/auth/me',{silent:1});
    if(r.code===200){
      user=r.data;
      localStorage.setItem('user',JSON.stringify(user));
      return true;
    }
    // 2001 = token 过期
    if(r.code===2001||r.code===401||r.code===403) return false;
    return false;
  }catch(e){
    return false;
  }
}

/* ====== Toast ====== */
let toastTimer=null;
function showToast(msg,type){
  const t=document.getElementById('toast');
  t.textContent=msg;
  // 重置动画（强制重新播放）
  t.classList.remove('show');
  void t.offsetWidth; // 触发 reflow
  t.className='toast '+(type||'')+' show';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{t.classList.remove('show')},2600);
}

/* ====== 全局 Loading 遮罩 ====== */
function showLoading(msg='请稍候…'){
  const el=document.getElementById('globalLoading');
  if(!el) return;
  const text=el.querySelector('span:last-child');
  if(text) text.textContent=msg;
  el.classList.remove('hide');
  el.classList.add('show');
}
function hideLoading(){
  const el=document.getElementById('globalLoading');
  if(!el) return;
  el.classList.remove('show');
  el.classList.add('hide');
}

/* ====== 图片预览 ====== */
function openImagePreview(src){
  const ov=document.getElementById('imagePreview');
  const img=document.getElementById('imagePreviewImg');
  if(!ov||!img||!src) return;
  img.src=src;
  ov.classList.remove('hide');
  requestAnimationFrame(()=>ov.classList.add('show'));
}
function closeImagePreview(){
  const ov=document.getElementById('imagePreview');
  if(!ov) return;
  ov.classList.remove('show');
  setTimeout(()=>ov.classList.add('hide'),280);
}
function bindImagePreview(root){
  if(!root) return;
  root.querySelectorAll('.task-desc img,.comment-content img,.ql-editor img').forEach(img=>{
    img.style.cursor='zoom-in';
    img.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();openImagePreview(img.src);});
  });
}


async function api(path,opts={}){
  const h={'Content-Type':'application/json'};
  if(token) h['Authorization']='Bearer '+token;
  // POST 默认空 body（保证后端 @RequestBody 不会报 required body missing）
  if(opts.method==='POST' && !opts.body) opts.body='{}';
  const showLoadingFlag=!opts.silent && !opts.noLoading;
  if(showLoadingFlag) showLoading();
  let res, data;
  try{
    res=await fetch(API+path,{headers:h,...opts});
  }catch(e){
    if(showLoadingFlag) hideLoading();
    if(opts.silent) return {code:-1,msg:'网络异常',data:null};
    showToast('网络异常，请检查网络连接','error');
    return {code:-1,msg:'网络异常',data:null};
  }
  // HTTP 层级错误：非 2xx 均视为后端接口异常，优先解析后端返回的 msg
  if(res.status<200||res.status>=300){
    if(showLoadingFlag) hideLoading();
    let errMsg=`请求失败(${res.status})`;
    try{
      const errData=await res.json();
      if(errData && errData.msg) errMsg=errData.msg;
    }catch(_){}
    if(res.status===401){
      if(!opts.silent) triggerExpired(errMsg);
      return {code:2001,msg:errMsg,data:null};
    }
    if(opts.silent) return {code:-1,msg:errMsg,data:null};
    showToast(errMsg,'error');
    return {code:-1,msg:errMsg,data:null};
  }

  try{
    data=await res.json();
  }catch(e){
    if(showLoadingFlag) hideLoading();
    if(opts.silent) return {code:-2,msg:'响应解析失败',data:null};
    showToast('网络异常，服务器响应异常','error');
    return {code:-2,msg:'响应解析失败',data:null};
  }
  if(showLoadingFlag) hideLoading();
  // 业务码 2001（token 过期）/ 401 / 403
  if(data.code===2001||data.code===401||data.code===403){
    if(!opts.silent) triggerExpired(data.msg||'你的登录状态已失效');
    token=null;
    localStorage.removeItem('token');
  }
  // 业务码非 200：后端逻辑异常，统一提示
  if(data.code!==200&&!opts.silent&&data.code!==2001&&data.code!==401&&data.code!==403){
    // 不在此处弹 toast，由调用方决定是否提示具体 msg
  }
  return data;
}

/* ====== Auth ====== */
function switchAuth(type){
  document.querySelectorAll('.auth-tab').forEach(t=>{t.classList.remove('active');t.style.background='transparent';t.style.boxShadow='none'});
  document.getElementById('loginForm').classList.toggle('hide',type!=='login');
  document.getElementById('registerForm').classList.toggle('hide',type!=='register');
  const tabs=document.querySelectorAll('.auth-tab');
  const idx=type==='login'?0:1;
  tabs[idx].classList.add('active');
  tabs[idx].style.background='var(--bg-elevated)';
  tabs[idx].style.boxShadow='var(--shadow-sm)';
  if(type==='login'&&!captchaKey) loadCaptcha();
}
async function loadCaptcha(){
  const box=document.getElementById('captchaImage');
  if(box) box.textContent='加载中';
  const r=await api('/auth/captcha',{method:'POST',silent:1});
  if(r.code===200&&r.data&&box){
    captchaKey=r.data.key;
    box.innerHTML=`<img src="${r.data.image}" alt="验证码">`;
  }else if(box){
    captchaKey='';
    box.textContent='刷新';
  }
}
async function login(){
  const u=document.getElementById('loginUser').value,p=document.getElementById('loginPass').value,c=document.getElementById('captchaCode').value;
  if(!u||!p) return showToast('请输入用户名和密码','error');
  if(!c||!captchaKey) return showToast('请输入验证码','error');
  const btn=event?.target||document.querySelector('#loginForm .btn-primary'); btn.classList.add('loading');
  const r=await api('/auth/login',{method:'POST',body:JSON.stringify({username:u,password:p,captchaKey,captchaCode:c})});
  btn.classList.remove('loading');
  if(r.code===200){token=r.data.token;user=r.data;localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify(user));showToast('登录成功','success');updateSessionIndicator('active');initApp()}
  else{showToast(r.msg||'登录失败','error');document.getElementById('captchaCode').value='';loadCaptcha()}
}
async function register(){
  const u=document.getElementById('regUser').value,p=document.getElementById('regPass').value,cp=document.getElementById('regConfirmPass').value,n=document.getElementById('regNick').value;
  if(!u||!p) return showToast('请输入用户名和密码','error');
  if(p!==cp) return showToast('两次输入的密码不一致','error');
  const r=await api('/auth/register',{method:'POST',body:JSON.stringify({username:u,password:p,confirmPassword:cp,nickname:n||undefined})});
  if(r.code===200){showToast('注册成功，请登录','success');switchAuth('login');loadCaptcha()}else showToast(r.msg||'注册失败','error');
}
function logout(){
  // 用户主动退出：直接清掉，不弹过期弹层
  token=null;localStorage.removeItem('token');localStorage.removeItem('user');
  user={};
  cachedTasks=[];
  const ma=document.getElementById('mainApp');
  ma.classList.add('hide');
  ma.style.display='none';
  document.getElementById('authPage').style.display='grid';
  // 重置过期弹层状态以便下次正常触发
  _expiredModalShown=false;
  clearInterval(_expiredCountdownTimer);
  showToast('已退出登录','success');
  loadCaptcha();
  if(typeof updateSessionIndicator==='function') updateSessionIndicator('expired');
}

function closeUserMenu(){
  const menu=document.getElementById('userMenu');
  if(menu) menu.classList.remove('show');
}
function toggleUserMenu(event){
  event.stopPropagation();
  const menu=document.getElementById('userMenu');
  if(menu) menu.classList.toggle('show');
}
function openSettingsFromMenu(){
  closeUserMenu();
  openSettings();
}
function openPasswordModal(){
  closeUserMenu();
  ['oldPassword','newPassword','confirmNewPassword'].forEach(id=>{const el=document.getElementById(id);if(el) el.value=''});
  const ov=document.getElementById('passwordOverlay');
  ov.classList.remove('hide');
  document.body.style.overflow='hidden';
  requestAnimationFrame(()=>ov.classList.add('show'));
  setTimeout(()=>document.getElementById('oldPassword').focus(),240);
}
function closePasswordModal(){
  const ov=document.getElementById('passwordOverlay');
  ov.classList.remove('show');
  document.body.style.overflow='';
  setTimeout(()=>ov.classList.add('hide'),280);
}
async function changePassword(){
  const oldPassword=document.getElementById('oldPassword').value;
  const newPassword=document.getElementById('newPassword').value;
  const confirmPassword=document.getElementById('confirmNewPassword').value;
  if(!oldPassword||!newPassword||!confirmPassword) return showToast('请完整填写密码','error');
  if(newPassword!==confirmPassword) return showToast('两次输入的新密码不一致','error');
  const btn=document.getElementById('changePasswordBtn');btn.classList.add('loading');
  const r=await api('/auth/password/change',{method:'POST',body:JSON.stringify({oldPassword,newPassword,confirmPassword})});
  btn.classList.remove('loading');
  if(r.code===200){
    showToast('密码已修改，请重新登录','success');
    closePasswordModal();
    doLogout(false);
    loadCaptcha();
  }else showToast(r.msg||'修改失败','error');
}
function openTaskStats(){
  closeUserMenu();
  const modal=document.getElementById('taskStatsModal');
  modal.classList.remove('hide');
  document.body.style.overflow='hidden';
  requestAnimationFrame(()=>modal.classList.add('show'));
  loadTaskHeatmap();
}
function closeTaskStats(){
  const modal=document.getElementById('taskStatsModal');
  modal.classList.remove('show');
  document.body.style.overflow='';
  setTimeout(()=>modal.classList.add('hide'),280);
}

function initApp(){
  // 防御性：即使被绕过调用，token 为空也拒绝进入主区
  if(!token){
    console.warn('[Auth] initApp 被调用但 token 为空，拒绝进入主区');
    document.getElementById('mainApp').style.display='none';
    document.getElementById('mainApp').classList.add('hide');
    document.getElementById('authPage').style.display='grid';
    return;
  }
  document.getElementById('authPage').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('mainApp').classList.remove('hide');
  const display=user.nickname||user.username||'用户';
  document.getElementById('userDisplay').textContent=display;
  document.getElementById('userAvatar').textContent=display.charAt(0).toUpperCase();
  loadProjects();loadTasks();loadSidebarStats();loadNotifications();
  initQuill();
}
// 启动时如果有 token，先校验有效性（防止"token 已过期但用户没感知"）
(async function bootAuth(){
  console.log('[Auth] bootAuth 启动, token=',token?'exists':'null');
  if(!token){
    // 没有 token：确保主区隐藏、登录页显示
    const ma=document.getElementById('mainApp');
    ma.classList.add('hide');ma.style.display='none';
    document.getElementById('authPage').style.display='grid';
    loadCaptcha();
    return;
  }
  // 临时挂一个"正在登录"视觉反馈
  const display=user.nickname||user.username||'用户';
  const ud=document.getElementById('userDisplay');
  if(ud) ud.textContent=display+'（验证中…）';
  try{
    const ok=await validateTokenOnBoot();
    if(ok){
      initApp();
    }else{
      doLogout(false);
      triggerExpired('上次的登录已失效，请重新登录',{autoRedirect:true});
    }
  }catch(e){
    console.error('[Auth] 校验过程异常',e);
    doLogout(false);
    triggerExpired('会话验证失败，请重新登录',{autoRedirect:true});
  }
})();

/* ====== Quill 图片上传 / 缩放 / 预览 ====== */
class ImageResize{
  constructor(quill,options={}){
    this.quill=quill;this.options={...options};
    this.overlay=null;this.activeImage=null;
    this.quill.root.addEventListener('click',this.onClick.bind(this));
    document.addEventListener('click',this.onDocClick.bind(this));
    window.addEventListener('resize',()=>{if(this.activeImage && this.overlay)this.positionOverlay();});
  }
  onClick(e){
    const img=e.target.closest('img');
    if(!img || !this.quill.root.contains(img)) return;
    e.preventDefault();e.stopPropagation();
    this.show(img);
  }
  onDocClick(e){
    if(!this.overlay || this.overlay.style.display==='none') return;
    if(e.target===this.activeImage || this.overlay.contains(e.target)) return;
    this.hide();
  }
  show(img){
    this.activeImage=img;
    if(!this.overlay) this.createOverlay();
    this.positionOverlay();
    this.overlay.style.display='block';
  }
  hide(){
    this.activeImage=null;
    if(this.overlay) this.overlay.style.display='none';
  }
  createOverlay(){
    const o=document.createElement('div');
    o.className='image-resize-overlay';
    o.innerHTML='<div class="image-resize-handle nw"></div><div class="image-resize-handle ne"></div><div class="image-resize-handle sw"></div><div class="image-resize-handle se"></div>';
    this.quill.root.parentElement.appendChild(o);
    this.overlay=o;
    o.querySelectorAll('.image-resize-handle').forEach(h=>h.addEventListener('mousedown',e=>this.onHandleDown(h,e)));
  }
  positionOverlay(){
    if(!this.activeImage) return;
    const rect=this.activeImage.getBoundingClientRect();
    const rootRect=this.quill.root.getBoundingClientRect();
    this.overlay.style.width=rect.width+'px';
    this.overlay.style.height=rect.height+'px';
    this.overlay.style.left=(rect.left-rootRect.left+this.quill.root.scrollLeft)+'px';
    this.overlay.style.top=(rect.top-rootRect.top+this.quill.root.scrollTop)+'px';
  }
  onHandleDown(handle,e){
    e.preventDefault();e.stopPropagation();
    const img=this.activeImage;
    const startX=e.clientX,startY=e.clientY;
    const startW=img.clientWidth,startH=img.clientHeight;
    const ratio=startH/startW;
    const xDir=handle.classList.contains('ne')||handle.classList.contains('se')?1:-1;
    const yDir=handle.classList.contains('sw')||handle.classList.contains('se')?1:-1;
    const onMove=ev=>{
      const dx=(ev.clientX-startX)*xDir;
      const dy=(ev.clientY-startY)*yDir;
      const newW=Math.max(50,Math.round(startW+dx));
      const newH=Math.max(50,Math.round(startH+dy));
      // 保持比例：以宽度为主
      const finalW=newW;
      const finalH=Math.round(finalW*ratio);
      img.style.width=finalW+'px';img.style.height=finalH+'px';
      img.setAttribute('width',finalW);img.setAttribute('height',finalH);
      this.positionOverlay();
    };
    const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  }
}
if(window.Quill) Quill.register('modules/imageResize',ImageResize);

async function uploadImage(file){
  const formData=new FormData();formData.append('file',file);
  const h={};
  if(token) h['Authorization']='Bearer '+token;
  const res=await fetch(API+'/file/upload',{method:'POST',headers:h,body:formData});
  const data=await res.json();
  if(data.code===200) return data.data.url;
  return null;
}
function bindImageUploadHandlers(quillInstance, containerSelector){
  const el=document.querySelector(containerSelector);
  if(!el) return;
  el.addEventListener('paste',async function(e){
    const items=e.clipboardData?.items;if(!items) return;
    for(const item of items){
      if(item.type&&item.type.startsWith('image/')){
        e.preventDefault();
        const file=item.getAsFile();if(!file) continue;
        const range=quillInstance.getSelection(true);
        quillInstance.insertEmbed(range.index,'image','data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        const url=await uploadImage(file);
        if(url){
          quillInstance.deleteText(range.index,1);
          quillInstance.insertEmbed(range.index,'image',url);
          quillInstance.setSelection(range.index+1);
        }
      }
    }
  });
  el.addEventListener('drop',async function(e){
    const files=e.dataTransfer?.files;if(!files||!files.length) return;
    for(const f of files){
      if(f.type&&f.type.startsWith('image/')){
        e.preventDefault();
        const range=quillInstance.getSelection(true);
        quillInstance.insertEmbed(range.index,'image','data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        const url=await uploadImage(f);
        if(url){
          quillInstance.deleteText(range.index,1);
          quillInstance.insertEmbed(range.index,'image',url);
          quillInstance.setSelection(range.index+1);
        }
      }
    }
  });
}
function initQuill(){
  if(quill) return;
  quill=new Quill('#editor',{theme:'snow',placeholder:'输入任务详细描述（支持富文本、粘贴图片）...',
    modules:{toolbar:[['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['clean','image']],imageResize:{}}});
  quill.getModule('toolbar').addHandler('image',()=>{
    const input=document.createElement('input');input.type='file';input.accept='image/*';
    input.onchange=async()=>{
      const file=input.files[0];if(!file) return;
      const url=await uploadImage(file);if(url){const range=quill.getSelection(true);
        quill.insertEmbed(range.index,'image',url);}
    };input.click();
  });
  bindImageUploadHandlers(quill,'#editor');
}

/* ====== Projects ====== */
async function loadProjects(){
  const r=await api('/project/list',{method:'POST'});
  if(r.code!==200) return;
  const data=r.data||[];
  const el=document.getElementById('projectList');
  el.innerHTML=`<div class="project-item ${currentProject===null?'active':''}" onclick="filterProject(null)" style="${currentProject===null?'background:var(--accent);color:#fff;border-color:transparent':''}">📋 全部</div>`+
    data.map(p=>{const a=currentProject===p.id;return `<div class="project-item ${a?'active':''}" onclick="filterProject(${p.id})" style="${a?`background:${p.color};color:#fff;border-color:transparent`:''}"><span class="dot" style="background:${a?'#fff':p.color}"></span>${p.name}<span class="del" onclick="event.stopPropagation();deleteProject(${p.id})">✕</span></div>`;}).join('');
  const sb=document.getElementById('sidebarProjects');
  sb.innerHTML=data.map(p=>{const a=currentProject===p.id;return `<div class="sidebar-item" onclick="filterProject(${p.id})" style="${a?'background:var(--accent-soft);color:var(--accent);font-weight:500':''}"><span class="icon" style="color:${p.color}">●</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span></div>`;}).join('');
  const sel=document.getElementById('editProject');
  const curVal=sel.value;
  sel.innerHTML='<option value="">无项目</option>'+data.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  sel.value=curVal;
}
function filterProject(id){
  currentProject=id;
  document.getElementById('statusFilter').value='';
  loadProjects();
  loadTasks();
  loadSidebarStats();
  updatePageHeader();
}
function setStatusFilter(s){
  document.getElementById('statusFilter').value=s;
  syncSidebarActive();
  updatePageHeader();
  loadTasks();
}
function updatePageHeader(){
  const status=document.getElementById('statusFilter')?.value||'';
  const statusTitle={TODO:'待办任务',DOING:'进行中任务',DONE:'已完成任务'}[status];
  const statusSub={TODO:'还未开始的计划',DOING:'正在推进的事项',DONE:'已经收尾的成果'}[status];
  const title=document.getElementById('pageTitle');
  const subtitle=document.getElementById('pageSubtitle');
  if(statusTitle){
    title.textContent=statusTitle;
    subtitle.textContent=currentProject?'当前项目下的'+statusSub:statusSub;
    return;
  }
  if(currentProject===null){
    title.textContent='全部任务';
    subtitle.textContent='管理你的待办与计划';
  }else{
    const it=document.querySelector(`.sidebar-item[onclick="filterProject(${currentProject})"] span:last-child`);
    title.textContent=it?it.textContent:'项目任务';
    subtitle.textContent='当前项目下的全部任务';
  }
}
function showAddProject(){document.getElementById('addProjectForm').classList.remove('hide')}
function hideAddProject(){document.getElementById('addProjectForm').classList.add('hide')}
async function createProject(){
  const n=document.getElementById('projectName').value,c=document.getElementById('projectColor').value;
  if(!n) return showToast('请输入项目名称','error');
  const r=await api('/project',{method:'POST',body:JSON.stringify({name:n,color:c})});
  if(r.code===200){showToast('项目已创建','success');document.getElementById('projectName').value='';hideAddProject();loadProjects();loadSidebarStats()}
  else showToast(r.msg||'创建失败','error');
}
async function deleteProject(id){
  if(!confirm('确定删除此项目？')) return;
  const r=await api('/project/'+id,{method:'DELETE'});
  if(r.code===200){showToast('已删除','success');loadProjects();loadSidebarStats()}
}

/* ====== Tasks ====== */
function updateSidebarCount(id,count){
  const el=document.getElementById(id);
  if(el) el.textContent=count;
}
function syncSidebarActive(){
  const currentStatus=document.getElementById('statusFilter')?.value||'';
  document.querySelectorAll('.sidebar-item[data-nav]').forEach(item=>{
    const nav=item.dataset.nav;
    item.classList.toggle('active', (nav==='all'&&!currentStatus&&currentProject===null) || nav===currentStatus);
  });
}
async function loadSidebarStats(){
  const r=await api('/task/list',{method:'POST',body:JSON.stringify({
    projectId:currentProject||null,
    status:null
  })});
  if(r.code!==200) return;
  const tasks=r.data||[];
  updateSidebarCount('allCount',tasks.length);
  updateSidebarCount('todoCount',tasks.filter(t=>t.status==='TODO').length);
  updateSidebarCount('doingCount',tasks.filter(t=>t.status==='DOING').length);
  updateSidebarCount('doneCount',tasks.filter(t=>t.status==='DONE').length);
  syncSidebarActive();
}
async function submitTask(){
  const input=document.getElementById('taskInput'), content=input.value.trim();
  if(!content) return showToast('请输入任务描述','error');
  const desc=quill?quill.root.innerHTML:'';
  const btn=document.getElementById('submitBtn');btn.classList.add('loading');
  const body={content};
  if(currentProject) body.projectId=currentProject;
  const r=await api('/task/natural',{method:'POST',body:JSON.stringify(body)});
  if(r.code===200&&desc&&desc!=='<p><br></p>'){
    await api('/task/'+r.data.id,{method:'PUT',body:JSON.stringify({description:desc})});
  }
  btn.classList.remove('loading');
  if(r.code===200){showToast('任务创建成功','success');input.value='';if(quill)quill.root.innerHTML='';loadTasks();loadSidebarStats();loadTaskHeatmap()}
  else showToast(r.msg||'创建失败','error');
}

function heatmapStatusLabel(status){
  return {DONE:'已完成',PENDING:'未完成',OVERDUE:'延期',TODO:'未开始',EMPTY:'无任务'}[status]||status;
}
function heatmapDateLabel(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function buildHeatmapTooltip(day){
  if(!day.total) return `${heatmapDateLabel(day.date)} 无任务`;
  return `${heatmapDateLabel(day.date)} · ${day.total} 个任务\n已完成 ${day.done||0} · 未完成 ${day.pending||0} · 延期 ${day.overdue||0} · 未开始 ${day.todo||0}`;
}
function renderHeatmapUsers(data){
  const select=document.getElementById('heatmapUserSelect');
  if(!data.admin){
    select.classList.add('hide');
    return;
  }
  const selected=select.value||'';
  select.classList.remove('hide');
  select.innerHTML='<option value="">全部用户</option>'+(data.users||[]).map(u=>{
    const name=esc(u.nickname||u.username||('用户'+u.id));
    return `<option value="${u.id}">${name}</option>`;
  }).join('');
  select.value=selected;
}
function renderTaskHeatmap(data){
  const grid=document.getElementById('taskHeatmap');
  const summary=document.getElementById('heatmapSummary');
  if(!grid||!data||!data.days) return;
  renderHeatmapUsers(data);
  const days=data.days;
  const total=days.reduce((s,d)=>s+(d.total||0),0);
  const done=days.reduce((s,d)=>s+(d.done||0),0);
  summary.textContent=`最近一年 ${total} 个任务，已完成 ${done} 个`;
  grid.innerHTML='';

  const start=new Date(days[0].date+'T00:00:00');
  const startOffset=start.getDay();
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthCols={};
  days.forEach((day,i)=>{
    const d=new Date(day.date+'T00:00:00');
    if(d.getDate()===1){
      const col=Math.floor((i+startOffset)/7)+2;
      monthCols[col]=monthNames[d.getMonth()];
    }
  });
  for(let c=2;c<=54;c++){
    const label=document.createElement('div');
    label.className='heatmap-month';
    label.style.gridColumn=String(c);
    label.style.gridRow='1';
    label.textContent=monthCols[c]||'';
    grid.appendChild(label);
  }
  [{row:3,text:'Mon'},{row:5,text:'Wed'},{row:7,text:'Fri'}].forEach(w=>{
    const label=document.createElement('div');
    label.className='heatmap-weekday';
    label.style.gridColumn='1';
    label.style.gridRow=String(w.row);
    label.textContent=w.text;
    grid.appendChild(label);
  });
  days.forEach((day,i)=>{
    const pos=i+startOffset;
    const cell=document.createElement('span');
    cell.className=`heatmap-cell s-${day.status||'EMPTY'}`;
    cell.style.gridColumn=String(Math.floor(pos/7)+2);
    cell.style.gridRow=String((pos%7)+2);
    cell.title=buildHeatmapTooltip(day);
    cell.setAttribute('aria-label', `${heatmapDateLabel(day.date)} ${heatmapStatusLabel(day.status)}`);
    grid.appendChild(cell);
  });
}
async function loadTaskHeatmap(){
  const modal=document.getElementById('taskStatsModal');
  if(modal&&modal.classList.contains('hide')) return;
  const select=document.getElementById('heatmapUserSelect');
  const targetUserId=select&&!select.classList.contains('hide')&&select.value?parseInt(select.value):null;
  const r=await api('/task/heatmap',{method:'POST',body:JSON.stringify({userId:targetUserId})});
  if(r.code!==200) return;
  renderTaskHeatmap(r.data);
}

let _prevUnreadCount=-1;  // 用于检测变化，触发动画
async function loadNotifications(){
  const r=await api('/task/notifications',{method:'POST',silent:1});
  if(r.code!==200) return;
  notificationItems=r.data.items||[];
  const badge=document.getElementById('notificationBadge');
  const unread=r.data.unread||0;
  if(badge){
    // 数量变化时重新触发入场动画
    if(unread!==_prevUnreadCount){
      badge.style.animation='none';
      void badge.offsetWidth;
      badge.style.animation='';
    }
    _prevUnreadCount=unread;
    badge.textContent=unread>99?'99+':unread;
    badge.classList.toggle('hide',unread<=0);
  }
  renderNotifications();
}
function toggleNotifications(e){
  if(e) e.stopPropagation();
  const pop=document.getElementById('notificationPopover');
  if(!pop) return;
  pop.classList.toggle('hide');
  if(!pop.classList.contains('hide')) renderNotifications();
}
function renderNotifications(){
  const pop=document.getElementById('notificationPopover');
  if(!pop) return;
  if(!notificationItems.length){
    pop.innerHTML='<div class="comment-empty">暂无@通知</div>';
    return;
  }
  pop.innerHTML=notificationItems.map(n=>`<div class="notification-item ${(n.readStatus||0)===0?'unread':''}" onclick="openNotification(${n.taskId},${n.id})">
    <div class="notification-title">${esc(n.content||'你被@了')}</div>
    <div class="notification-time">${fmtTime(n.createTime||'')}</div>
  </div>`).join('')+
    '<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px" onclick="markNotificationsRead()">全部标记已读</button>';
}
async function openNotification(taskId,notificationId){
  document.getElementById('notificationPopover').classList.add('hide');
  await markNotificationsRead(false,[notificationId]);
  let card=document.querySelector(`.task-item[data-id="${taskId}"]`);
  if(!card) card=await showMentionedTask(taskId);
  if(card){
    card.scrollIntoView({behavior:'smooth',block:'center'});
    const panel=document.getElementById('comments-'+taskId);
    if(panel&&panel.classList.contains('hide')) toggleComments(taskId);
  }else{
    openEditModal(taskId);
  }
}
async function showMentionedTask(taskId){
  const r=await api('/task/get',{method:'POST',body:JSON.stringify({id:taskId})});
  if(r.code!==200||!r.data) return null;
  const el=document.getElementById('taskList');
  const empty=el.querySelector('.text-center');
  if(empty) empty.remove();
  const card=renderTaskCard(r.data);
  card.classList.add('mentioned-task-card');
  el.prepend(card);
  cachedTasks=[r.data,...cachedTasks.filter(t=>t.id!==r.data.id)];
  loadSubTasks(taskId);
  loadTimeLogs(taskId);
  return card;
}
async function markNotificationsRead(showMsg=true,ids){
  const body=ids&&ids.length?JSON.stringify(ids):undefined;
  const r=await api('/task/notifications/read',{method:'POST',body});
  if(r.code===200){
    if(showMsg) showToast(ids&&ids.length?'通知已标记已读':'全部通知已标记已读','success');
    loadNotifications();
  }
}

/* 截止日期状态 */
function deadlineStatus(deadline){
  if(!deadline) return null;
  const ms=new Date(deadline).getTime()-Date.now();
  const day=ms/86400000;
  if(ms<0) return 'overdue';
  if(day<=1) return 'soon';
  return null;
}

async function loadTasks(){
  const el=document.getElementById('taskList');
  const loading=document.getElementById('listLoading');
  loading.style.display='flex';el.innerHTML='';
  const sf=document.getElementById('statusFilter').value;
  const r=await api('/task/list',{method:'POST',body:JSON.stringify({
    projectId:currentProject||null,
    status:sf||null
  })});
  loading.style.display='none';
  if(r.code!==200){
    el.innerHTML='<div class="error-state"><div class="icon">⚠️</div><div>加载失败，请检查网络连接</div><button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="loadTasks()">重试</button></div>';
    return;
  }
  const tasks=r.data||[];
  cachedTasks=tasks;
  activeCommentTaskId=null;
  commentQuill=null;
  if(!tasks.length){
    el.innerHTML='<div class="text-center" style="padding:48px 20px;color:var(--text-tertiary)"><div style="font-size:40px;margin-bottom:8px;opacity:0.5;animation:taskEnter 0.6s var(--ease-spring) both">📭</div><div style="font-size:13px">暂无任务</div><div style="font-size:11px;margin-top:4px;opacity:0.7">试着创建一个吧</div></div>';
    return;
  }
  for(const t of tasks){
    const d=renderTaskCard(t);
    el.appendChild(d);
    loadSubTasks(t.id);loadTimeLogs(t.id);
  }
}

function renderTaskCard(t){
  const d=document.createElement('div');
  d.className='task-item';
  if(t.status==='DONE') d.classList.add('done-state');
  if(t.deadline && deadlineStatus(t.deadline)==='overdue' && t.status!=='DONE') d.classList.add('overdue-card');
  d.dataset.id=t.id;
  const ds=t.deadline?deadlineStatus(t.deadline):null;
  const deadlineTagStyle=ds==='overdue'?'tag-deadline-overdue':(ds==='soon'?'tag-deadline-soon':'');
  const checkedClass=t.status==='DONE'?'checked':'';
  const checkSvg='<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 7 12 13 4"></polyline></svg>';
  const ownTask=String(t.userId)===String(currentUserId());
  d.innerHTML=`<div class="task-header"><div style="flex:1;min-width:0">
      <div class="task-title" onclick="openEditModal(${t.id})">
        <span class="check-circle ${checkedClass}" onclick="event.stopPropagation();toggleComplete(${t.id},this)" title="标记完成">${checkSvg}</span>
        <span>${esc(t.title)}</span>
      </div>
      <div class="task-meta">
        <span class="tag tag-p${t.priority||2}">${['','高','中','低'][t.priority||2]}优先</span>
        <span class="tag tag-s-${t.status}">${statusText(t.status)}</span>
        ${t.costTime?`<span class="tag" style="background:var(--accent-soft);color:var(--accent)">⏱ 预估 ${t.costTime}min</span>`:''}
        ${t.actualTime?`<span class="tag" style="background:var(--warning-soft);color:var(--warning)">⌛ 实际 ${t.actualTime}min</span>`:''}
        ${t.deadline?`<span class="tag ${deadlineTagStyle}">📅 ${fmtTime(t.deadline)}${ds==='overdue'?' · 已逾期':''}</span>`:''}
      </div>
      <div class="task-desc">${t.description||''}</div>
    </div></div>
    ${(t.costTime||t.actualTime)?renderProgress(t):''}
    <div class="task-actions" id="actions-${t.id}">${ownTask?statusActions(t):''}<button class="btn btn-ghost btn-sm" onclick="openEditModal(${t.id})">${ownTask?'编辑':'查看'}</button>
    <button class="btn btn-ghost btn-sm" onclick="toggleComments(${t.id})">评论</button>
    ${ownTask?`<button class="btn btn-ghost btn-sm" onclick="deleteTask(${t.id})" style="color:var(--danger)">删除</button>
    <button class="btn btn-ghost btn-sm" onclick="redecompose(${t.id})">🔄 AI 重拆分</button>`:''}</div>
    <div class="sub-tasks" id="sub-${t.id}"></div>
    <div class="task-comment-panel hide" id="comments-${t.id}"></div>
    <div class="time-logs" id="logs-${t.id}"></div>`;
  bindImagePreview(d);
  return d;
}


function renderProgress(t){
  const cost=t.costTime||0, actual=t.actualTime||0;
  if(!cost) return '';
  const pct=Math.min(100,Math.round((actual/cost)*100));
  return `<div class="task-progress"><span>⏱</span><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div><span>${pct}%</span></div>`;
}

function statusText(s){return {TODO:'待办',DOING:'进行中',DONE:'已完成',OVERDUE:'已逾期'}[s]||s}
function statusActions(t){
  const a=[];
  if(t.status==='TODO') a.push(`<button class="btn btn-success btn-sm" onclick="updateStatus(${t.id},'DOING')">开始</button>`);
  if(t.status==='DOING') a.push(`<button class="btn btn-primary btn-sm" onclick="updateStatus(${t.id},'DONE')">完成</button>`);
  if(t.status!=='DONE'){
    if(runningTimers[t.id]){
      a.push(`<button class="btn btn-warning btn-sm" onclick="pauseTimer(${t.id})">⏸ 暂停</button>`);
    }else if(t.status==='DOING'){
      a.push(`<button class="btn btn-secondary btn-sm" onclick="startTimer(${t.id})">▶ 继续</button>`);
    }else{
      a.push(`<button class="btn btn-secondary btn-sm" onclick="startTimer(${t.id})">⏱ 计时</button>`);
    }
  }
  return a.join('');
}
function refreshTaskActions(taskId){
  const task=cachedTasks.find(t=>t.id===taskId);
  const el=document.getElementById('actions-'+taskId);
  if(!task||!el) return;
  const ownTask=String(task.userId)===String(currentUserId());
  el.innerHTML=`${ownTask?statusActions(task):''}<button class="btn btn-ghost btn-sm" onclick="openEditModal(${task.id})">${ownTask?'编辑':'查看'}</button>
    <button class="btn btn-ghost btn-sm" onclick="toggleComments(${task.id})">评论</button>
    ${ownTask?`<button class="btn btn-ghost btn-sm" onclick="deleteTask(${task.id})" style="color:var(--danger)">删除</button>
    <button class="btn btn-ghost btn-sm" onclick="redecompose(${task.id})">🔄 AI 重拆分</button>`:''}`;
}

/* 任务完成切换（带动画） */
async function toggleComplete(id,el){
  const card=el.closest('.task-item');
  const checked=el.classList.contains('checked');
  const newStatus=checked?'TODO':'DONE';
  // 乐观更新
  if(newStatus==='DONE'){
    el.classList.add('checked');
    stopTimerDisplay(id);
    card.classList.add('completing');
    setTimeout(()=>{card.classList.remove('completing');card.classList.add('done-state')},400);
  }else{
    el.classList.remove('checked');
    card.classList.remove('done-state');
  }
  const r=await api('/task/status/'+id,{method:'POST',body:JSON.stringify({status:newStatus})});
  if(r.code===200){
    showToast(newStatus==='DONE'?'🎉 已完成':'已恢复待办','success');
    setTimeout(()=>{loadTasks();loadSidebarStats();loadTaskHeatmap();if(newStatus==='DONE') loadNotifications()},500);
  }else{
    // 回滚
    if(newStatus==='DONE'){el.classList.remove('checked');card.classList.remove('done-state')}
    else{el.classList.add('checked');card.classList.add('done-state')}
    showToast(r.msg||'更新失败','error');
  }
}

async function updateStatus(id,s){
  const r=await api('/task/status/'+id,{method:'POST',body:JSON.stringify({status:s})});
  if(r.code===200){
    if(s==='DONE') stopTimerDisplay(id);
    if(s==='DOING') loadTimeLogs(id);
    showToast('状态已更新','success');loadTasks();loadSidebarStats();loadTaskHeatmap();if(s==='DONE') loadNotifications();
  }
  else showToast(r.msg||'更新失败','error');
}

async function deleteTask(id){
  if(!confirm('确定删除？')) return;
  const card=document.querySelector(`.task-item[data-id="${id}"]`);
  if(card){
    card.classList.add('removing');
    setTimeout(async()=>{
      const r=await api('/task/'+id,{method:'DELETE'});
      if(r.code===200){showToast('已删除','success');loadTasks();loadSidebarStats();loadTaskHeatmap()}
      else showToast(r.msg||'删除失败','error');
    },300);
  }else{
    const r=await api('/task/'+id,{method:'DELETE'});
    if(r.code===200){showToast('已删除','success');loadTasks();loadSidebarStats();loadTaskHeatmap()}
  }
}

async function loadSubTasks(taskId){
  const r=await api('/task/sub',{method:'POST',body:JSON.stringify({taskId})});
  if(r.code===200&&r.data&&r.data.length){
    document.getElementById('sub-'+taskId).innerHTML=r.data.map(st=>`<div class="sub-task-item">${esc(st.content)}</div>`).join('');}
}
async function redecompose(taskId){
  const task=cachedTasks.find(t=>t.id===taskId)||{};
  const body={
    title:task.title,
    description:task.description,
    costTime:task.costTime
  };
  const r=await api('/task/'+taskId+'/decompose',{method:'POST',body:JSON.stringify(body)});
  if(r.code===200){showToast('AI 重拆分完成','success');loadTasks();loadSidebarStats()}else showToast(r.msg||'拆分失败','error');
}

/* ====== Timer ====== */
function startTimerDisplay(taskId,startTimeStr,baseSeconds=0){
  const ms=new Date(startTimeStr).getTime();runningTimers[taskId]=ms;
  if(timerIntervals[taskId]) clearInterval(timerIntervals[taskId]);
  timerIntervals[taskId]=setInterval(()=>{
    const e=baseSeconds+Math.floor((Date.now()-ms)/1000);
    const el=document.getElementById('timer-'+taskId);
    if(el) el.textContent=`⏱ ${String(Math.floor(e/3600)).padStart(2,'0')}:${String(Math.floor((e%3600)/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`;
  },1000);
}
function stopTimerDisplay(taskId){if(timerIntervals[taskId]){clearInterval(timerIntervals[taskId]);delete timerIntervals[taskId]}delete runningTimers[taskId]}
async function loadTimeLogs(taskId){
  const r=await api('/task/time/logs',{method:'POST',body:JSON.stringify({taskId})});if(r.code!==200) return;
  const logs=r.data||[], running=logs.find(l=>!l.endTime), el=document.getElementById('logs-'+taskId);
  const completedSeconds=logs.reduce((s,l)=>s+(l.endTime?(l.duration||0):0),0);
  if(running){
    const elapsed=completedSeconds+Math.floor((Date.now()-new Date(running.startTime).getTime())/1000);
    startTimerDisplay(taskId,running.startTime,completedSeconds);
    el.innerHTML=`<span class="timer running" id="timer-${taskId}">⏱ ${String(Math.floor(elapsed/3600)).padStart(2,'0')}:${String(Math.floor((elapsed%3600)/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}</span>`;
  }
  else{stopTimerDisplay(taskId);if(logs.length){el.innerHTML=`<span class="timer stopped">⏱ 累计 ${Math.round(completedSeconds/60)} 分钟</span>`;}else el.innerHTML='';}
  refreshTaskActions(taskId);
}
async function startTimer(id){
  const r=await api('/task/'+id+'/time/start',{method:'POST'});
  if(r.code===200){showToast('计时已开始','success');loadTimeLogs(id);loadTasks();loadSidebarStats();loadTaskHeatmap()}else showToast(r.msg||'操作失败','error');
}
async function pauseTimer(id){
  const r=await api('/task/'+id+'/time/pause',{method:'POST'});
  if(r.code===200){showToast('已暂停计时','success');stopTimerDisplay(id);loadTimeLogs(id);loadTasks();loadSidebarStats();loadTaskHeatmap();}
  else showToast(r.msg||'操作失败','error');
}
async function stopTimer(id){
  const r=await api('/task/'+id+'/time/stop',{method:'POST'});
  if(r.code===200){showToast('计时已停止','success');stopTimerDisplay(id);loadTimeLogs(id);loadTasks();loadSidebarStats();loadTaskHeatmap();}
  else showToast(r.msg||'操作失败','error');
}

/* ====== Edit Modal ====== */
let lastFocus=null;
async function openEditModal(taskId){
  lastFocus=document.activeElement;
  const r=await api('/task/get',{method:'POST',body:JSON.stringify({id:taskId})});if(r.code!==200) return;
  const t=r.data;editTaskId=taskId;
  const readOnly=String(t.userId)!==String(currentUserId());
  document.getElementById('editTitle').value=t.title||'';
  document.getElementById('editDeadline').value=t.deadline?t.deadline.substring(0,16):'';
  document.getElementById('editCostTime').value=t.costTime||'';
  document.getElementById('editPriority').value=t.priority||2;
  document.getElementById('editStatus').value=t.status||'TODO';
  const sel=document.getElementById('editProject');
  if(t.projectId) sel.value=t.projectId;else sel.value='';
  ['editTitle','editDeadline','editCostTime','editPriority','editStatus','editProject'].forEach(id=>{
    const field=document.getElementById(id);
    if(field) field.disabled=readOnly;
  });
  document.getElementById('saveEditBtn').classList.toggle('hide',readOnly);
  document.getElementById('editModalTitle').textContent=readOnly?'查看任务':'编辑任务';
  resetQuillHost('editEditor');
  editQuill=new Quill('#editEditor',{theme:'snow',modules:{toolbar:[['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['clean','image']],imageResize:{}}});
  if(t.description) editQuill.root.innerHTML=t.description;
  editQuill.getModule('toolbar').addHandler('image',()=>{
    const input=document.createElement('input');input.type='file';input.accept='image/*';
    input.onchange=async()=>{
      const file=input.files[0];if(!file) return;
      const url=await uploadImage(file);if(url){const range=editQuill.getSelection(true);editQuill.insertEmbed(range.index,'image',url);}
    };input.click();
  });
  bindImageUploadHandlers(editQuill,'#editEditor');
  editQuill.enable(!readOnly);
  // 锁定背景滚动
  document.body.style.overflow='hidden';
  document.getElementById('editModal').classList.remove('hide');
  requestAnimationFrame(()=>document.getElementById('editModal').classList.add('show'));
  setTimeout(()=>document.getElementById('editTitle').focus(),320);
}
function closeEditModal(){
  const m=document.getElementById('editModal');
  m.classList.remove('show');
  document.body.style.overflow='';
  setTimeout(()=>{m.classList.add('hide');editQuill=null;editTaskId=null;if(lastFocus&&lastFocus.focus)lastFocus.focus()},280);
}
function resetQuillHost(id, className=''){
  const old=document.getElementById(id);
  if(!old) return null;
  const group=old.closest('.form-group')||old.parentElement;
  if(group){
    group.querySelectorAll('.ql-toolbar,.ql-container').forEach(el=>el.remove());
    const fresh=document.createElement('div');
    fresh.id=id;
    if(className) fresh.className=className;
    group.appendChild(fresh);
    return fresh;
  }
  const fresh=document.createElement('div');
  fresh.id=id;
  if(className) fresh.className=className;
  old.replaceWith(fresh);
  return fresh;
}
function buildCommentPanel(taskId){
  return `<div class="comment-section">
    <div class="comment-header">
      <h3>评论</h3>
      <span>@用户名 或 @昵称 可提醒对方</span>
    </div>
    <div class="comment-list" id="commentList-${taskId}"></div>
    <div class="task-comment-editor" id="commentEditor-${taskId}"></div>
    <div class="comment-actions">
      <button class="btn btn-primary btn-sm" id="sendCommentBtn-${taskId}" onclick="sendComment(${taskId})">发表评论</button>
    </div>
  </div>`;
}
async function toggleComments(taskId){
  const panel=document.getElementById('comments-'+taskId);
  if(!panel) return;
  if(activeCommentTaskId&&activeCommentTaskId!==taskId){
    const old=document.getElementById('comments-'+activeCommentTaskId);
    if(old) old.classList.add('hide');
  }
  const willOpen=panel.classList.contains('hide');
  panel.classList.toggle('hide',!willOpen);
  if(!willOpen){
    activeCommentTaskId=null;
    commentQuill=null;
    editingCommentId=null;
    return;
  }
  activeCommentTaskId=taskId;
  panel.innerHTML=buildCommentPanel(taskId);
  await loadComments(taskId);
  initCommentEditor(taskId);
}
function initCommentEditor(taskId){
  registerMentionBlot();
  commentQuill=new Quill('#commentEditor-'+taskId,{theme:'snow',placeholder:'写评论，输入 @username 或 @昵称 提醒对方...',
    modules:{toolbar:false,imageResize:{}}});

  bindImageUploadHandlers(commentQuill,'#commentEditor-'+taskId);
  bindMentionHandlers(commentQuill,taskId);
}
function bindMentionHandlers(q,taskId){
  q.root.addEventListener('compositionstart',()=>{q.root.dataset.composing='1'});
  q.root.addEventListener('compositionend',()=>{q.root.dataset.composing='0';setTimeout(()=>scheduleMentionSearch(q,taskId),0)});
  q.root.addEventListener('keydown',e=>{
    if(!mentionState||mentionState.taskId!==taskId) return;
    if(e.isComposing||q.root.dataset.composing==='1') return;
    if(e.key==='ArrowDown'){e.preventDefault();e.stopImmediatePropagation();moveMentionActive(1);return}
    if(e.key==='ArrowUp'){e.preventDefault();e.stopImmediatePropagation();moveMentionActive(-1);return}
    if(e.key==='Enter'){
      e.preventDefault();
      e.stopImmediatePropagation();
      if(mentionState.items&&mentionState.items.length) pickMention();
      return;
    }
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeMentionMenu();return}
  },true);
  q.keyboard.addBinding({key:'Enter'},range=>{
    if(mentionState&&mentionState.taskId===taskId&&mentionState.items&&mentionState.items.length){
      pickMention();
      return false;
    }
    return true;
  });
  q.on('text-change',()=>scheduleMentionSearch(q,taskId));
  q.on('selection-change',range=>{if(!range) closeMentionMenu()});
}
function scheduleMentionSearch(q,taskId){
  const range=q.getSelection();
  if(!range){closeMentionMenu();return}
  const before=q.getText(Math.max(0,range.index-40),Math.min(40,range.index));
  const match=before.match(/(?:^|\s)@([\p{L}\p{N}_\-\u4e00-\u9fa5]{0,30})$/u);
  if(!match){closeMentionMenu();return}
  const query=match[1]||'';
  const atIndex=range.index-query.length-1;
  mentionState={quill:q,taskId,query,atIndex,items:[],active:0};
  clearTimeout(scheduleMentionSearch.timer);
  scheduleMentionSearch.timer=setTimeout(()=>loadMentionOptions(query),120);
}
async function loadMentionOptions(query){
  if(!mentionState) return;
  const r=await api('/auth/users/search',{method:'POST',body:JSON.stringify({keyword:query}),silent:1});
  if(r.code!==200||!mentionState) return;
  mentionState.items=r.data||[];
  mentionState.active=0;
  renderMentionMenu();
}
function renderMentionMenu(){
  const state=mentionState;
  if(!state||!state.items.length){closeMentionMenu();return}
  let menu=document.getElementById('mentionMenu');
  if(!menu){
    menu=document.createElement('div');
    menu.id='mentionMenu';
    menu.className='mention-menu';
    document.body.appendChild(menu);
  }
  menu.innerHTML=state.items.map((u,i)=>`<div class="mention-option ${i===state.active?'active':''}" onmousedown="event.preventDefault();pickMention(${i})">
    <span class="mention-avatar">${escapeText((u.nickname||u.username||'用').charAt(0).toUpperCase())}</span>
    <span class="mention-info"><span class="mention-name">${escapeText(u.nickname||u.username||'用户')}</span><span class="mention-username">@${escapeText(u.username||'')}</span></span>
  </div>`).join('');
  const bounds=state.quill.getBounds(state.quill.getSelection(true).index);
  const host=state.quill.root.getBoundingClientRect();
  menu.style.left=Math.min(host.left+bounds.left,window.innerWidth-260)+'px';
  menu.style.top=Math.min(host.top+bounds.top+bounds.height+6,window.innerHeight-230)+'px';
}
function moveMentionActive(delta){
  if(!mentionState||!mentionState.items.length) return;
  mentionState.active=(mentionState.active+delta+mentionState.items.length)%mentionState.items.length;
  renderMentionMenu();
}
function pickMention(index){
  const state=mentionState;
  if(!state||!state.items.length) return;
  const u=state.items[index??state.active];
  const q=state.quill;
  const range=q.getSelection(true);
  const len=Math.max(1,range.index-state.atIndex);
  q.deleteText(state.atIndex,len,'user');
  q.insertEmbed(state.atIndex,'mention',{id:u.id,username:u.username,nickname:u.nickname,value:u.nickname||u.username},'user');
  q.insertText(state.atIndex+1,' ','user');
  q.setSelection(state.atIndex+2,0,'user');
  closeMentionMenu();
}
function closeMentionMenu(){
  mentionState=null;
  const menu=document.getElementById('mentionMenu');
  if(menu) menu.remove();
}
function decorateMentions(html){
  const wrap=document.createElement('div');
  wrap.innerHTML=html||'';
  wrap.querySelectorAll('.mention-tag,[data-user-id]').forEach(el=>{
    el.classList.add('mention-tag');
    if(String(el.getAttribute('data-user-id'))===String(currentUserId())) el.classList.add('self');
  });
  return wrap.innerHTML;
}
function bindUserCards(root){
  root.querySelectorAll('.mention-tag[data-user-id]').forEach(el=>{
    el.addEventListener('mouseenter',()=>showUserCard(el));
    el.addEventListener('mouseleave',hideUserCardSoon);
  });
}
async function showUserCard(el){
  clearTimeout(userCardTimer);
  const id=el.getAttribute('data-user-id');
  let card=document.getElementById('userCardPopover');
  if(!card){
    card=document.createElement('div');
    card.id='userCardPopover';
    card.className='user-card-popover';
    document.body.appendChild(card);
  }
  const nickname=el.getAttribute('data-nickname')||el.textContent.replace(/^@/,'');
  const username=el.getAttribute('data-username')||'';
  card.innerHTML=renderUserCard({id,nickname,username});
  const rect=el.getBoundingClientRect();
  card.style.left=Math.min(rect.left,window.innerWidth-260)+'px';
  card.style.top=Math.min(rect.bottom+8,window.innerHeight-140)+'px';
  const r=await api('/auth/users/search',{method:'POST',body:JSON.stringify({keyword:username||nickname}),silent:1});
  const u=(r.data||[]).find(x=>String(x.id)===String(id));
  if(u) card.innerHTML=renderUserCard(u);
}
function renderUserCard(u){
  const name=escapeText(u.nickname||u.username||'用户');
  const username=escapeText(u.username||'');
  const email=u.email?`<div class="user-card-email">${escapeText(u.email)}</div>`:'';
  return `<div class="user-card-head"><span class="mention-avatar">${name.charAt(0).toUpperCase()}</span>
    <span><div class="user-card-name">${name}${String(u.id)===String(currentUserId())?'（我）':''}</div><div class="user-card-sub">@${username}</div></span></div>${email}`;
}
function hideUserCardSoon(){
  clearTimeout(userCardTimer);
  userCardTimer=setTimeout(()=>{const card=document.getElementById('userCardPopover');if(card) card.remove()},120);
}
async function loadComments(taskId){
  const list=document.getElementById('commentList-'+taskId);
  if(!list) return;
  list.innerHTML='<div class="loading active"><span class="spinner"></span>加载评论…</div>';
  const r=await api('/task/'+taskId+'/comments',{method:'POST'});
  if(r.code!==200){list.innerHTML='<div class="comment-empty">评论加载失败</div>';return}
  const comments=r.data||[];
  if(!comments.length){list.innerHTML='<div class="comment-empty">暂无评论</div>';return}
  list.innerHTML=comments.map(c=>{
    const author=esc(c.nickname||c.username||('用户'+c.userId));
    const canDelete=String(c.userId)===String(currentUserId());
    return `<div class="comment-item">
      <div class="comment-meta">
        <span><span class="comment-author">${author}</span> · ${fmtTime(c.createTime||'')}</span>
        ${canDelete?`<span class="comment-tools">
          <button class="comment-more" onclick="toggleCommentMenu(event,${c.id})">...</button>
          <span class="comment-menu hide" id="commentMenu-${c.id}">
            <button onclick="startEditComment(${taskId},${c.id})">编辑</button>
            <button class="danger" onclick="deleteComment(${taskId},${c.id})">删除</button>
          </span>
        </span>`:''}
      </div>
      <div class="comment-content">${decorateMentions(c.content||'')}</div>
    </div>`;
  }).join('');
  bindUserCards(list);
  bindImagePreview(list);
}
async function sendComment(taskId){
  if(!taskId||!commentQuill||activeCommentTaskId!==taskId) return;
  const content=commentQuill.root.innerHTML;
  if(!content||content==='<p><br></p>') return showToast('评论内容不能为空','error');
  const btn=document.getElementById('sendCommentBtn-'+taskId);btn.classList.add('loading');
  const path=editingCommentId?('/task/'+taskId+'/comments/'+editingCommentId):('/task/'+taskId+'/comments/add');
  const method=editingCommentId?'PUT':'POST';
  const r=await api(path,{method,body:JSON.stringify({content})});
  btn.classList.remove('loading');
  if(r.code===200){
    commentQuill.root.innerHTML='';
    showToast(editingCommentId?'评论已更新':'评论已发布','success');
    editingCommentId=null;
    btn.textContent='发表评论';
    loadComments(taskId);
    loadNotifications();
  }else showToast(r.msg||'评论保存失败','error');
}
function toggleCommentMenu(e,commentId){
  e.stopPropagation();
  document.querySelectorAll('.comment-menu').forEach(m=>{if(m.id!=='commentMenu-'+commentId)m.classList.add('hide')});
  const menu=document.getElementById('commentMenu-'+commentId);
  if(menu) menu.classList.toggle('hide');
}
function startEditComment(taskId,commentId){
  const item=document.getElementById('commentMenu-'+commentId)?.closest('.comment-item');
  const content=item?.querySelector('.comment-content')?.innerHTML||'';
  if(!commentQuill) return;
  editingCommentId=commentId;
  commentQuill.root.innerHTML=content;
  document.getElementById('sendCommentBtn-'+taskId).textContent='保存修改';
  document.getElementById('commentMenu-'+commentId)?.classList.add('hide');
  commentQuill.focus();
}
async function deleteComment(taskId,commentId){
  if(!taskId||!confirm('确定删除这条评论？')) return;
  const r=await api('/task/'+taskId+'/comments/'+commentId,{method:'DELETE'});
  if(r.code===200){showToast('评论已删除','success');loadComments(taskId);loadNotifications()}
  else showToast(r.msg||'删除失败','error');
}
async function saveEditTask(){
  const btn=document.getElementById('saveEditBtn');btn.classList.add('loading');
  const body={
    title:document.getElementById('editTitle').value,
    description:editQuill?editQuill.root.innerHTML:'',
    deadline:document.getElementById('editDeadline').value?document.getElementById('editDeadline').value+':00':null,
    costTime:parseInt(document.getElementById('editCostTime').value)||null,
    priority:parseInt(document.getElementById('editPriority').value),
    status:document.getElementById('editStatus').value,
    projectId:parseInt(document.getElementById('editProject').value)||null
  };
  if(!body.title){btn.classList.remove('loading');return showToast('任务标题不能为空','error')}
  const r=await api('/task/'+editTaskId,{method:'PUT',body:JSON.stringify(body)});
  btn.classList.remove('loading');
  if(r.code===200){showToast('已保存','success');closeEditModal();loadTasks();loadSidebarStats();loadTaskHeatmap()}
  else showToast(r.msg||'保存失败','error');
}

function fmtTime(t){return t?t.substring(0,16).replace('T',' '):''}
function esc(s){const d=document.createElement('div');if(s&&s.includes('<')) return s;d.textContent=s||'';return d.innerHTML}
function escapeText(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}
function currentUserId(){return user.id||user.userId}

/* ====== 设置面板 ====== */
let settingsProviderList=[];
let settingsCurrent=null;
let settingsDirty=false;
const providerIconColors={
  deepseek:'#1f6feb', doubao:'#0a84ff', qwen:'#ff6a00', glm:'#3b82f6',
  minimax:'#7c3aed', openai:'#10a37f', custom:'#6e6e73'
};
const providerIcons={
  deepseek:'🐋', doubao:'🫘', qwen:'☁️', glm:'🧠',
  minimax:'🌊', openai:'🌀', custom:'🔧'
};

function openSettings(){
  const ov=document.getElementById('settingsOverlay');
  ov.classList.remove('hide');
  document.body.style.overflow='hidden';
  lastFocus=document.activeElement;
  requestAnimationFrame(()=>ov.classList.add('show'));
  loadLlmConfig();
}
function closeSettings(){
  const ov=document.getElementById('settingsOverlay');
  ov.classList.remove('show');
  document.body.style.overflow='';
  setTimeout(()=>ov.classList.add('hide'),280);
  if(lastFocus&&lastFocus.focus)lastFocus.focus();
}

async function loadLlmConfig(){
  const body=document.getElementById('settingsBody');
  body.innerHTML='<div class="loading active" style="padding:60px 20px"><span class="spinner"></span>加载配置中…</div>';
  const r=await api('/llm/providers',{method:'POST'});
  if(r.code!==200){
    body.innerHTML='<div class="error-state"><div class="icon">⚠️</div><div>加载失败: '+(r.msg||'未知错误')+'</div></div>';
    return;
  }
  settingsProviderList=r.data.providers||[];
  settingsCurrent=r.data.current||{};
  renderSettings();
}

function renderSettings(){
  const body=document.getElementById('settingsBody');
  const c=settingsCurrent;
  const p=findProvider(c.provider)||settingsProviderList[0];
  document.getElementById('settingsFooterLeft').textContent='当前: '+(p?(p.name+' · '+(c.model||p.defaultModel)):'');
  body.innerHTML=`
    <div class="settings-section">
      <div class="settings-section-title">AI 提供商</div>
      <div class="settings-section-desc">选择大模型服务，并填入对应平台的 API Key。所有配置均加密保存在你的本地账户下。</div>
      <select class="input" id="setProvider" onchange="onProviderChange()">
        ${settingsProviderList.map(pp=>`<option value="${pp.code}" ${pp.code===c.provider?'selected':''}>${pp.name} ${pp.code==='custom'?'(兼容 OpenAI 协议)':''}</option>`).join('')}
      </select>
      <div class="provider-card" id="providerCard" style="margin-top:12px">
        <div class="provider-icon" id="providerIcon" style="background:${providerIconColors[p.code]||'#666'}">${providerIcons[p.code]||'🤖'}</div>
        <div class="provider-info">
          <div class="name" id="providerName">${p.name}</div>
          <div class="desc" id="providerDesc">${p.description||''}</div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">API Key</div>
      <div class="settings-section-desc" id="apiKeyHint">${p.apiKeyHint||'在对应平台申请 API Key'}</div>
      <div class="input-with-icon">
        <input class="input" id="setApiKey" type="password" placeholder="sk-..." value="${esc(c.apiKey||'')}" oninput="markDirty()">
        <button class="toggle-vis" onclick="toggleKeyVisibility()" title="显示/隐藏">👁</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">API 地址</div>
      <div class="settings-section-desc">通常使用预填默认值；自部署或代理可改写。</div>
      <input class="input" id="setApiUrl" placeholder="https://api.example.com/v1/chat/completions" value="${esc(c.apiUrl||p.defaultUrl||'')}" oninput="markDirty()">
    </div>

    <div class="settings-section">
      <div class="settings-section-title">模型</div>
      <div class="settings-section-desc">选择预置模型或自定义输入。</div>
      <input class="input" id="setModel" placeholder="模型名，如 deepseek-chat" value="${esc(c.model||p.defaultModel||'')}" oninput="markDirty()">
      <div class="model-grid" id="modelGrid">
        ${(p.models||[]).map(m=>`<div class="model-chip ${m.value===(c.model||p.defaultModel)?'active':''}" data-model="${m.value}" onclick="pickModel('${m.value}',this)">
          <span class="mc-label">${esc(m.label)}</span>
          <span class="mc-desc">${esc(m.description||'')}</span>
        </div>`).join('')}
        ${p.code==='custom'?'<div class="model-chip" onclick="document.getElementById(\'setModel\').focus()"><span class="mc-label">+ 自定义模型</span><span class="mc-desc">在输入框中填写</span></div>':''}
      </div>
    </div>

    <div class="settings-section">
      <button class="advanced-toggle" id="advancedToggle" onclick="toggleAdvanced()">
        <span class="chevron">▶</span><span>高级参数</span>
      </button>
      <div class="advanced-panel" id="advancedPanel">
        <div class="settings-row">
          <div class="form-group">
            <label>Temperature <span style="color:var(--text-tertiary);font-weight:400">(${(c.temperature||0.2).toFixed(2)})</span></label>
            <input class="input" id="setTemp" type="range" min="0" max="2" step="0.05" value="${c.temperature||0.2}" oninput="this.previousElementSibling.lastChild.textContent='('+parseFloat(this.value).toFixed(2)+')'">
          </div>
          <div class="form-group">
            <label>Max Tokens</label>
            <input class="input" id="setMaxTokens" type="number" min="100" max="32000" value="${c.maxTokens||2000}" oninput="markDirty()">
          </div>
        </div>
        <div class="settings-row">
          <div class="form-group">
            <label>超时（毫秒）</label>
            <input class="input" id="setTimeout" type="number" min="5000" max="180000" step="1000" value="${c.timeout||30000}" oninput="markDirty()">
          </div>
          <div class="form-group">
            <label>启用</label>
            <select class="input" id="setEnabled" onchange="markDirty()">
              <option value="1" ${(c.enabled===1||c.enabled===undefined)?'selected':''}>✅ 启用</option>
              <option value="0" ${c.enabled===0?'selected':''}>⏸ 停用</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="test-result" id="testResult">
      <span class="icon" id="testResultIcon">✓</span>
      <span class="text" id="testResultText"></span>
    </div>
  `;
  // restore advanced open
  settingsDirty=false;
}

function findProvider(code){
  return settingsProviderList.find(p=>p.code===code);
}

function onProviderChange(){
  const code=document.getElementById('setProvider').value;
  const p=findProvider(code);
  if(!p) return;
  document.getElementById('setApiUrl').value=p.defaultUrl||'';
  document.getElementById('setModel').value=p.defaultModel||'';
  const icon=document.getElementById('providerIcon');
  icon.style.background=providerIconColors[p.code]||'#666';
  icon.textContent=providerIcons[p.code]||'🤖';
  document.getElementById('providerName').textContent=p.name;
  document.getElementById('providerDesc').textContent=p.description||'';
  document.getElementById('apiKeyHint').textContent=p.apiKeyHint||'';
  // 重建模型列表
  const mg=document.getElementById('modelGrid');
  mg.innerHTML=(p.models||[]).map(m=>`<div class="model-chip ${m.value===p.defaultModel?'active':''}" data-model="${m.value}" onclick="pickModel('${m.value}',this)">
    <span class="mc-label">${esc(m.label)}</span>
    <span class="mc-desc">${esc(m.description||'')}</span>
  </div>`).join('')+(p.code==='custom'?'<div class="model-chip" onclick="document.getElementById(\'setModel\').focus()"><span class="mc-label">+ 自定义模型</span><span class="mc-desc">在输入框中填写</span></div>':'');
  markDirty();
}

function pickModel(model,el){
  document.getElementById('setModel').value=model;
  document.querySelectorAll('.model-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  markDirty();
}

function toggleKeyVisibility(){
  const inp=document.getElementById('setApiKey');
  inp.type=inp.type==='password'?'text':'password';
}

function toggleAdvanced(){
  const t=document.getElementById('advancedToggle');
  const p=document.getElementById('advancedPanel');
  t.classList.toggle('open');
  p.classList.toggle('open');
}

function markDirty(){ settingsDirty=true; }

function collectLlmForm(){
  return {
    provider:document.getElementById('setProvider').value,
    apiKey:document.getElementById('setApiKey').value,
    apiUrl:document.getElementById('setApiUrl').value,
    model:document.getElementById('setModel').value,
    temperature:parseFloat(document.getElementById('setTemp').value),
    maxTokens:parseInt(document.getElementById('setMaxTokens').value),
    timeout:parseInt(document.getElementById('setTimeout').value),
    enabled:parseInt(document.getElementById('setEnabled').value)
  };
}

async function saveLlmConfig(){
  const body=collectLlmForm();
  if(!body.apiKey||body.apiKey.includes('****')){
    // 用户没改 apiKey，单独提示
    if(!confirm('检测到 API Key 未填写或未变更。\n继续保存将沿用现有 Key，确认？')) return;
  }
  if(!body.apiUrl){showToast('请填写 API 地址','error');return}
  if(!body.model){showToast('请填写模型名','error');return}
  const btn=document.getElementById('settingsSaveBtn');btn.classList.add('loading');
  const r=await api('/llm/config',{method:'PUT',body:JSON.stringify(body)});
  btn.classList.remove('loading');
  if(r.code===200){
    showToast('配置已保存','success');
    settingsCurrent=r.data;
    settingsDirty=false;
    setTimeout(closeSettings,500);
  }else{
    showToast(r.msg||'保存失败','error');
  }
}

async function testLlmConnection(){
  const body=collectLlmForm();
  if(!body.apiUrl){showToast('请填写 API 地址','error');return}
  if(!body.model){showToast('请填写模型名','error');return}
  const btn=document.getElementById('settingsTestBtn');btn.classList.add('loading');
  const box=document.getElementById('testResult');
  box.className='test-result';
  box.style.display='flex';
  document.getElementById('testResultIcon').textContent='⏳';
  document.getElementById('testResultText').textContent='正在测试连接…';
  const r=await api('/llm/test',{method:'POST',body:JSON.stringify({
    provider:body.provider,apiKey:body.apiKey,apiUrl:body.apiUrl,
    model:body.model,timeout:body.timeout
  })});
  btn.classList.remove('loading');
  if(r.code===200){
    const data=r.data;
    box.className='test-result show '+(data.success?'success':'error');
    document.getElementById('testResultIcon').textContent=data.success?'✓':'✗';
    document.getElementById('testResultText').innerHTML=
      (data.success?'连接成功':'连接失败')+' · 模型 '+esc(data.model||'')+' · 耗时 '+data.latencyMs+'ms'
      +'<br><span style="opacity:0.85">'+esc(data.message||'')+'</span>';
  }else{
    box.className='test-result show error';
    document.getElementById('testResultIcon').textContent='✗';
    document.getElementById('testResultText').textContent=r.msg||'测试失败';
  }
}
function openCommand(){
  const ov=document.getElementById('commandOverlay');
  ov.classList.remove('hide');
  requestAnimationFrame(()=>{ov.classList.add('show');document.getElementById('commandInput').focus()});
  buildCommandList('');
}
function closeCommand(){
  const ov=document.getElementById('commandOverlay');
  ov.classList.remove('show');
  setTimeout(()=>{ov.classList.add('hide');document.getElementById('commandInput').value=''},280);
}
function buildCommandList(q){
  const list=document.getElementById('commandList');
  const ql=(q||'').trim().toLowerCase();
  // 静态命令
  const cmds=[
    {icon:'📋',text:'查看全部任务',tag:'导航',action:()=>{filterProject(null);setStatusFilter('');closeCommand()}},
    {icon:'📌',text:'查看待办任务',tag:'导航',action:()=>{setStatusFilter('TODO');closeCommand()}},
    {icon:'⏳',text:'查看进行中任务',tag:'导航',action:()=>{setStatusFilter('DOING');closeCommand()}},
    {icon:'✅',text:'查看已完成任务',tag:'导航',action:()=>{setStatusFilter('DONE');closeCommand()}},
    {icon:'➕',text:'新建项目',tag:'操作',action:()=>{showAddProject();closeCommand()}},
    {icon:'🔄',text:'刷新任务列表',tag:'操作',action:()=>{loadTasks();closeCommand()}},
    {icon:'⚙️',text:'打开设置',tag:'系统',action:()=>{closeCommand();setTimeout(openSettings,200)}},
    {icon:'🤖',text:'配置 AI 模型',tag:'系统',action:()=>{closeCommand();setTimeout(openSettings,200)}},
  ];
  // 任务搜索
  const matchedTasks=ql?cachedTasks.filter(t=>((t.title||'')+' '+(t.description||'')).toLowerCase().includes(ql)).slice(0,8):[];
  const items=[];
  matchedTasks.forEach(t=>{
    items.push({icon:'🔍',text:t.title,tag:statusText(t.status),action:()=>{openEditModal(t.id);closeCommand()}});
  });
  cmds.forEach(c=>{
    if(!ql||c.text.toLowerCase().includes(ql)) items.push(c);
  });
  cmdItems=items;
  cmdActiveIdx=0;
  if(!items.length){
    list.innerHTML='<div class="command-empty">未找到匹配项</div>';
    return;
  }
  renderCommandList();
}
function renderCommandList(){
  const list=document.getElementById('commandList');
  list.innerHTML=cmdItems.map((it,i)=>`<div class="command-item ${i===cmdActiveIdx?'active':''}" data-idx="${i}" onclick="cmdItems[${i}].action()" onmouseenter="cmdActiveIdx=${i};renderCommandList()">
    <span class="ci-icon">${it.icon}</span>
    <span class="ci-text">${esc(it.text)}</span>
    ${it.tag?`<span class="ci-tag">${esc(it.tag)}</span>`:''}
  </div>`).join('');
}
function onCommandInput(){buildCommandList(document.getElementById('commandInput').value)}
function onCommandKey(e){
  if(e.key==='Escape'){e.preventDefault();closeCommand()}
  else if(e.key==='ArrowDown'){e.preventDefault();cmdActiveIdx=Math.min(cmdItems.length-1,cmdActiveIdx+1);renderCommandList()}
  else if(e.key==='ArrowUp'){e.preventDefault();cmdActiveIdx=Math.max(0,cmdActiveIdx-1);renderCommandList()}
  else if(e.key==='Enter'){e.preventDefault();if(cmdItems[cmdActiveIdx]){cmdItems[cmdActiveIdx].action()}}
}

/* ====== 全局快捷键 ====== */
document.addEventListener('keydown',function(e){
  // ⌘K / Ctrl+K 打开搜索
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){
    e.preventDefault();
    if(document.getElementById('mainApp').classList.contains('hide')) return;
    const ov=document.getElementById('commandOverlay');
    if(ov.classList.contains('show')) closeCommand();else openCommand();
  }
  // Esc 关闭模态
  if(e.key==='Escape'){
    if(!document.getElementById('settingsOverlay').classList.contains('hide')) closeSettings();
    else if(!document.getElementById('passwordOverlay').classList.contains('hide')) closePasswordModal();
    else if(!document.getElementById('taskStatsModal').classList.contains('hide')) closeTaskStats();
    else if(!document.getElementById('editModal').classList.contains('hide')) closeEditModal();
    closeUserMenu();
  }
});
document.addEventListener('click',closeUserMenu);
document.addEventListener('click',()=>{
  const pop=document.getElementById('notificationPopover');
  if(pop) pop.classList.add('hide');
  document.querySelectorAll('.comment-menu').forEach(m=>m.classList.add('hide'));
});

window.addEventListener('beforeunload',()=>{Object.values(timerIntervals).forEach(clearInterval)});

// ====== Session 状态指示（每 30s 同步一次） ======
function updateSessionIndicator(state){
  // state: 'active' | 'expired' | 'idle'
  const dot=document.getElementById('sessionDot');
  const label=document.getElementById('sessionLabel');
  const exp=document.getElementById('sessionExpired');
  if(!dot) return;
  if(state==='active'){
    dot.style.background='var(--success)';
    dot.style.boxShadow='0 0 0 2px var(--success-soft)';
    if(label) label.textContent='已登录';
    if(exp) exp.style.display='none';
  }else if(state==='expired'){
    dot.style.background='var(--danger)';
    dot.style.boxShadow='0 0 0 2px var(--danger-soft)';
    if(label){label.textContent='未登录';label.style.color='var(--danger)'}
    if(exp) exp.style.display='none';
  }else if(state==='expiring'){
    if(label) label.textContent='已登录';
    if(exp) exp.style.display='inline';
  }
}
// 启动一个 30s 间隔的 session 监控：检查 token 是否还在
setInterval(()=>{
  // 重新从 localStorage 读（防止 storage 事件漏掉）
  const stored=localStorage.getItem('token');
  if(!stored && token){
    // token 被外部清掉了
    console.log('[Session] 检测到 localStorage 中 token 已清空');
    token=null;user={};
    doLogout(false);
    triggerExpired('登录状态被外部清除',{autoRedirect:false});
    return;
  }
  if(stored && !token){
    // 外部注入了新 token（罕见情况）
    token=stored;
    location.reload();
  }
},30000);
// 每次 token 写入后立即刷新指示器
const _origSetItem=localStorage.setItem.bind(localStorage);
localStorage.setItem=function(k,v){
  _origSetItem(k,v);
  if(k==='token' && v) updateSessionIndicator('active');
};

// ====== 多标签页同步：监听 localStorage 变化 ======
// 任意标签页清掉 token，当前标签页立即退出登录态
window.addEventListener('storage',(e)=>{
  if(e.key==='token' || e.key==='user'){
    const newToken=localStorage.getItem('token');
    if(!newToken && token){
      // token 在其他标签页被清空，本页立即退出
      console.log('[Auth] 检测到其他标签页清除了登录态，自动退出');
      doLogout(false);
      triggerExpired('登录状态在另一标签页被清除',{autoRedirect:false});
    }
  }
});

// ====== 调试用：在浏览器控制台手动清除登录态 ======
// 用法：DevTools Console 输入 clearAuth()
window.clearAuth=function(){
  console.log('[Auth] 手动清除登录态');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  token=null;user={};
  doLogout(false);
  triggerExpired('已手动清除登录态',{autoRedirect:false});
};

// ====== 全局 fetch 拦截：兜底捕获所有 401（防止业务代码绕过 api()） ======
const _origFetch=window.fetch;
window.fetch=async function(...args){
  const res=await _origFetch.apply(this,args);
  if(res.status===401 && !_expiredModalShown){
    try{
      const cloned=res.clone();
      const data=await cloned.json();
      if(data.code===2001||res.status===401){
        triggerExpired(data.msg||'你的登录状态已失效');
        token=null;localStorage.removeItem('token');
      }
    }catch(e){
      triggerExpired('你的登录状态已失效');
    }
  }
  return res;
};

