/* 共享渲染逻辑：被 view.html（?d= 解码）与 cases/<id>.html（内联 window.__PAYLOAD__）共用 */
(function(){
  "use strict";

  function b64urlToBytes(s){
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while(s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /* 兼容两种二维码：新版(压缩 deflate) 与 旧版(未压缩 JSON) */
  function decodePayload(d){
    const bytes = b64urlToBytes(d);
    try{
      if(typeof pako !== 'undefined'){
        const inflated = new TextDecoder('utf-8').decode(pako.inflate(bytes));
        return JSON.parse(inflated);
      }
    }catch(e){}
    try{ return JSON.parse(new TextDecoder('utf-8').decode(bytes)); }catch(e){}
    throw new Error('unrecognized');
  }

  /* 兼容短字段名（医生端新压缩格式）与旧长字段名：统一映射为渲染用长字段 */
  function normalize(p){
    if(!p || typeof p !== 'object') return p;
    return {
      clinic:   p.c  || p.clinic   || '个性化注意事项',
      patient:  p.p  || p.patient  || '',
      date:     p.d  || p.date     || '',
      groups:   (p.g || p.groups || []).map(x => ({ cat: x.t || x.cat, items: x.i || x.items || [] })),
      followUp: (p.f != null ? p.f : (p.followUp != null ? p.followUp : '')),
      doctor:   p.dr || p.doctor   || '',
      footer:   p.ft || p.footer   || '',
      generated:p.g2 || p.generated || ''
    };
  }

  function esc(s){
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderAdvice(p, box, errEl){
    if(errEl) errEl.style.display = 'none';
    if(!p){ if(errEl) errEl.style.display = 'block'; return; }
    let html = '';
    html += '<div class="head"><div class="clinic">' + esc(p.clinic || '个性化注意事项') + '</div>' +
            '<div class="title">请仔细阅读本次注意事项</div></div>';
    html += '<div class="meta"><span>患者：<b>' + esc(p.patient || '') + '</b></span>' +
            '<span>就诊日期：' + esc(p.date || '') + '</span></div>';

    (p.groups || []).forEach(g => {
      if(!g.items || !g.items.length) return;
      html += '<div class="sec"><h3>' + esc(g.cat) + '</h3>';
      g.items.forEach(t => {
        html += '<div class="item"><span class="box"></span><span>' + esc(t) + '</span></div>';
      });
      html += '</div>';
    });

    let fu = p.followUp;
    if(typeof fu === 'string') fu = fu ? [fu] : [];
    if(!Array.isArray(fu)) fu = [];
    if(fu.length){
      html += '<div class="sec"><h3>下次复诊</h3>';
      fu.forEach(t => { html += '<div class="follow" style="margin-bottom:8px">' + esc(t) + '</div>'; });
      html += '</div>';
    }

    html += '<div class="foot">';
    if(p.doctor)    html += '<span>主管医生：' + esc(p.doctor) + '</span>';
    if(p.footer)    html += '<span>' + esc(p.footer) + '</span>';
    if(p.generated) html += '<span>生成时间：' + esc(p.generated) + '</span>';
    html += '</div>';
    html += '<div class="disc">本注意事项为辅助工具，具体请以主治医师医嘱为准</div>';

    box.innerHTML = html;
    document.title = (p.clinic || '个性化注意事项') + ' · ' + (p.patient || '');
  }

  function boot(){
    const box = document.getElementById('content');
    const errEl = document.getElementById('err');
    let p = null;
    if(window.__PAYLOAD__){
      p = normalize(window.__PAYLOAD__);
    } else {
      const params = new URLSearchParams(location.search);
      const d = params.get('d');
      if(!d){ if(errEl) errEl.style.display = 'block'; return; }
      try{ p = normalize(decodePayload(d)); }
      catch(e){ if(errEl) errEl.style.display = 'block'; return; }
    }
    renderAdvice(p, box, errEl);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AdviceViewer = { renderAdvice: renderAdvice, normalize: normalize, decodePayload: decodePayload };
})();
