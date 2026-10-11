import { appUrl } from "@/lib/env";

/**
 * Script leve de presença: <script src="APP_URL/t.js" data-k="TOKEN" defer></script>
 * Registra abertura, tempo na página (heartbeat), rolagem até o fim e clique no WhatsApp.
 * Nenhum dado pessoal do visitante. Quem tem o cookie/localStorage de exclusão (o vendedor) não conta.
 */
export function GET() {
  const endpoint = `${appUrl()}/api/track`;
  const js = `(function(){try{
var s=document.currentScript||document.querySelector('script[data-k]');if(!s)return;var k=s.getAttribute('data-k');if(!k)return;
if(/bot|crawl|spider|preview|headless|lighthouse/i.test(navigator.userAgent))return;
try{if(location.search.indexOf('cm_excluir=1')>-1)localStorage.setItem('cm_excluir','1');if(localStorage.getItem('cm_excluir')==='1')return;}catch(e){}
var E=${JSON.stringify(endpoint)},p=location.pathname,t0=Date.now(),sent={};
function send(ev,extra){var b=JSON.stringify(Object.assign({k:k,e:ev,p:p},extra||{}));if(navigator.sendBeacon){navigator.sendBeacon(E,new Blob([b],{type:'text/plain'}))}else{fetch(E,{method:'POST',body:b,keepalive:true,mode:'no-cors'})}}
send('open');
var hb=setInterval(function(){if(document.visibilityState==='visible')send('heartbeat',{d:Math.round((Date.now()-t0)/1000)})},15000);
addEventListener('scroll',function(){if(sent.s)return;var h=document.documentElement;if(h.scrollTop+innerHeight>=h.scrollHeight-40){sent.s=1;send('scroll_end')}},{passive:true});
document.addEventListener('click',function(ev){var a=ev.target&&ev.target.closest&&ev.target.closest('a');if(a&&/wa\\.me|whatsapp\\.com/i.test(a.href))send('click_whatsapp')},true);
addEventListener('pagehide',function(){clearInterval(hb);send('heartbeat',{d:Math.round((Date.now()-t0)/1000)})});
}catch(e){}})();`;
  return new Response(js, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
  });
}
