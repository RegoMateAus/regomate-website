'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cheerio=require('cheerio'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),DIST=path.join(ROOT,'dist');
const config={apiUrl:process.env.API_URL||'https://regomate-backend-production.up.railway.app',supabaseUrl:process.env.SUPABASE_PUBLIC_URL||'https://njchkgyorcwmkvdpzxue.supabase.co',supabaseKey:process.env.SUPABASE_PUBLIC_KEY||'',stripeKey:process.env.STRIPE_PUBLIC_KEY||''};
if(process.env.CONTEXT==='production' && (!config.supabaseKey || !config.stripeKey))throw new Error('Production requires verified Supabase and Stripe publishable keys.');
if(process.env.CONTEXT && process.env.CONTEXT!=='production'){
 config.apiUrl=process.env.PREVIEW_API_URL||'https://preview-unconfigured.invalid';
 config.supabaseUrl=process.env.PREVIEW_SUPABASE_URL||'https://preview-unconfigured.invalid';
 config.supabaseKey=process.env.PREVIEW_SUPABASE_PUBLIC_KEY||'';
 config.stripeKey=process.env.PREVIEW_STRIPE_PUBLIC_KEY||'';
 if(config.apiUrl==='https://regomate-backend-production.up.railway.app' || config.supabaseUrl==='https://njchkgyorcwmkvdpzxue.supabase.co' || config.stripeKey.startsWith('pk_live_'))throw new Error('Previews require isolated services and Stripe sandbox keys.');
 config.previewUnavailable=!process.env.PREVIEW_API_URL || !config.supabaseKey || !config.stripeKey;
}
// Never retain files from a previous build, including server source.
if(!DIST.startsWith(ROOT+path.sep))throw new Error('Unsafe build path');
fs.rmSync(DIST,{recursive:true,force:true});
fs.mkdirSync(path.join(DIST,'assets'),{recursive:true});
const pages={index:['RegoMate | Australian Rego & Licence Reminders','Windscreen stickers and SMS reminders for Australian registration and licence expiry. First year $14.99 plus $4.99 postage; annual renewal from $9.99.'],faq:['RegoMate FAQ | Stickers, SMS & Annual Renewal','Answers about RegoMate stickers, registration reminders, vehicle owners, annual renewals and cancellation.'],install:['How to Install Your RegoMate Sticker','Learn how to position and install your RegoMate windscreen sticker safely.'],replacement:['Replacement RegoMate Stickers','Order a replacement sticker through your RegoMate account for $9.99 including postage.'],contact:['Contact RegoMate | Customer Support','Get help with your RegoMate account, stickers and SMS reminders.'],terms:['RegoMate Terms & Privacy','Read the terms, annual renewal conditions and privacy information for RegoMate.'],login:['Sign In | RegoMate','Sign in to your RegoMate account.'],account:['Your Account | RegoMate','Manage your RegoMate vehicles, SMS preferences and billing.'],admin:['Administration | RegoMate','RegoMate administrator sign in.'],success:['Order Status | RegoMate','Check the status of your RegoMate checkout.'],cancelled:['Checkout Cancelled | RegoMate','Return to RegoMate after cancelling checkout.'],'404':['Page Not Found | RegoMate','Find your way back to RegoMate.']};
const privatePages=new Set(['login','account','admin','success','cancelled','404']);
fs.writeFileSync(path.join(DIST,'assets/config.js'),'window.RM_CONFIG='+JSON.stringify(config)+';');
const vendor=path.join(ROOT,'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
if(!fs.existsSync(vendor))throw new Error('Pinned Supabase browser bundle missing');
fs.copyFileSync(vendor,path.join(DIST,'assets/supabase-2.117.3.js'));
function attr(value){return String(value).replaceAll('&','&amp;').replaceAll('"','&quot;');}
const org={'@context':'https://schema.org','@type':'Organization',name:'RegoMate',url:'https://regomate.com',email:'support@regomate.com',identifier:'ABN 88 726 510 577'};
const hashScripts=new Set();
for(const[name,[title,description]]of Object.entries(pages)){
 const file=path.join(ROOT,name+'.html');if(!fs.existsSync(file))continue;
 let source=fs.readFileSync(file,'utf8');const handlers=[];
 // Compile known source handlers into external functions. No eval or runtime code interpretation.
 source=source.replace(/\bon(click|input|change|submit|keydown)="([^"]*)"/g,(_,event,code)=>{
  const params=[];code=code.replace(/'\$\{([^}]+)\}'/g,(_,expression)=>{const i=params.length;params.push(expression);return "this.getAttribute('data-rm-param-"+i+"')";});
  const id=handlers.length;handlers.push({event,code});
  // Keep a fixed field identifier for restoring extra vehicle inputs.
  const field=/updateExtra\([^,]+,'([^']+)'/.exec(code);
  return 'data-rm-'+event+'="'+id+'"'+params.map((expression,i)=>' data-rm-param-'+i+'="${'+expression+'}"').join('')+(field?' data-rm-field="'+field[1]+'"':'');
 });
 const $=cheerio.load(source);
 $('title').text(title);$('head').append('<meta name="description" content="'+attr(description)+'"><link rel="canonical" href="https://regomate.com'+(name==='index'?'/':'/'+name)+'"><meta property="og:type" content="website"><meta property="og:title" content="'+attr(title)+'"><meta property="og:description" content="'+attr(description)+'"><meta property="og:url" content="https://regomate.com'+(name==='index'?'/':'/'+name)+'"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="'+attr(title)+'"><meta name="twitter:description" content="'+attr(description)+'">');
 if(privatePages.has(name))$('head').append('<meta name="robots" content="noindex,nofollow">');
 if(name==='index')$('head').append('<script type="application/ld+json">'+JSON.stringify(org)+'</script>');
 const scripts=[];
 $('script').each((i,el)=>{const node=$(el);if(node.attr('type')==='application/ld+json'){hashScripts.add("'sha256-"+crypto.createHash('sha256').update(node.html()).digest('base64')+"'");return;}const src=node.attr('src');if(src?.includes('@supabase/supabase-js')){node.attr('src','/assets/supabase-2.117.3.js');return;}if(src)return;scripts.push(node.html()||'');node.remove();});
 // Labels for static inputs and date groups; dynamic inputs carry explicit names in source.
 $('label:not([for])').each((i,el)=>{const label=$(el);if(label.find('input').length)return;const next=label.next();const inputs=next.is('input,select,textarea')?next:next.find('input,select,textarea');const first=inputs.first();if(first.attr('id'))label.attr('for',first.attr('id'));if(inputs.length>1)inputs.each((j,input)=>$(input).attr('aria-label',label.text().trim()+' '+(['day','month','year'][j]||'')));});
 $('input,select,textarea').each((i,el)=>{const node=$(el);if(node.attr('type')==='hidden')return;if(!node.attr('aria-label')&&!node.attr('id')&&!node.closest('label').length)node.attr('aria-label',node.attr('placeholder')||node.closest('.form-group,.fg').find('label').first().text().trim()||'Form field');});
 $('.step-tab,.mode-tab,.tab').each((i,el)=>{const node=$(el);if(el.tagName==='div'){node.attr('role','button').attr('tabindex','0');}});
 $('.section-title').each((i,el)=>{$(el).replaceWith('<h2 class="section-title">'+$(el).html()+'</h2>');});
 $('a[href]').each((i,el)=>{const node=$(el),href=node.attr('href');if(!href||/^[a-z]+:/i.test(href)||href.startsWith('#'))return;node.attr('href',href.replace(/(?:^|\/)index\.html(?=$|#)/,'/').replace(/\.html(?=$|#|\?)/,''));});
 $('img').each((i,el)=>{const node=$(el);if(!node.attr('alt'))node.attr('alt',node.closest('a').length?'RegoMate':'');node.attr('decoding','async');});
 if($('nav .nav-links').length){$('nav').prepend('<button class="rm-menu" aria-expanded="false" aria-controls="rm-nav-links">Menu</button>');$('nav .nav-links').attr('id','rm-nav-links');}
 $('body').prepend('<a class="rm-skip" href="#rm-main">Skip to content</a>');const main=$('main').first();if(main.length)main.attr('id','rm-main');else{const target=$('section,.hero,.container,.main').first();if(target.length)target.attr('id','rm-main').attr('tabindex','-1');else $('body').append('<span id="rm-main" tabindex="-1"></span>');}
 $('head').append('<link rel="stylesheet" href="/assets/accessibility.css">');
 $('body').append('<script src="/assets/config.js"></script><script src="/assets/'+name+'.js"></script>');
 let js=scripts.join('\n');
 js=js.replace("const handler=el.getAttribute('data-rm-input')||el.getAttribute('data-rm-change')||el.getAttribute('oninput')||el.getAttribute('onchange');const match=/updateExtra\\('[^']+','([^']+)'/.exec(handler||'');if(match)el.value=e[match[1]]??'';","const field=el.getAttribute('data-rm-field');if(field)el.value=e[field]??'';");
 js+='\nconst rmHandlers={'+handlers.map((h,i)=>JSON.stringify(i)+':function(event){'+h.code+'}').join(',')+'};\n';
 for(const event of new Set(handlers.map(h=>h.event)))js+="document.addEventListener('"+event+"',event=>{const el=event.target.closest('[data-rm-"+event+"]');if(!el)return;const fn=rmHandlers[el.getAttribute('data-rm-"+event+"')];if(fn&&fn.call(el,event)===false)event.preventDefault();});\n";
 js+="document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[role=button][data-rm-click]')){event.preventDefault();event.target.click();}});document.querySelector('.rm-menu')?.addEventListener('click',function(){const expanded=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!expanded));document.getElementById('rm-nav-links')?.classList.toggle('rm-open',!expanded);});\n";
 js+="let rmLabelIndex=0;function rmAssociateLabels(){document.querySelectorAll('label:not([for])').forEach(label=>{if(label.querySelector('input'))return;const group=label.closest('.form-group,.fg');if(!group)return;const fields=[...group.querySelectorAll('input,select,textarea')];fields.forEach((field,i)=>{if(!field.id)field.id='rm-field-'+(++rmLabelIndex);if(i===0)label.htmlFor=field.id;if(fields.length>1&&!field.hasAttribute('aria-label'))field.setAttribute('aria-label',label.textContent.trim()+' '+(['day','month','year'][i]||''));});});}rmAssociateLabels();new MutationObserver(rmAssociateLabels).observe(document.body,{childList:true,subtree:true});\n";
 if(['login','account','admin'].includes(name))js="if(RM_CONFIG.supabaseKey){\n"+js+"\n}else{const notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='Account access is unavailable in this preview while the isolated sign-in service is configured.';document.body.prepend(notice);document.getElementById('loading')?.remove();}\n";
 new vm.Script(js,{filename:name+'.js'});fs.writeFileSync(path.join(DIST,'assets',name+'.js'),js);fs.writeFileSync(path.join(DIST,name+'.html'),$.html());
}
const csp="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://js.stripe.com "+[...hashScripts].join(' ')+"; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' "+new URL(config.apiUrl).origin+' '+new URL(config.supabaseUrl).origin+" https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; form-action 'self' https://checkout.stripe.com; upgrade-insecure-requests";
fs.writeFileSync(path.join(DIST,'_headers'),'/*\n  Content-Security-Policy: '+csp+'\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: DENY\n/assets/*\n  Cache-Control: public, max-age=0, must-revalidate\n/assets/config.js\n  Cache-Control: no-store\n');
const urls=Object.keys(pages).filter(p=>!privatePages.has(p));
fs.writeFileSync(path.join(DIST,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /login\nDisallow: /success\nDisallow: /cancelled\nSitemap: https://regomate.com/sitemap.xml\n');
fs.writeFileSync(path.join(DIST,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(p=>'<url><loc>https://regomate.com'+(p==='index'?'/':'/'+p)+'</loc></url>').join('')+'</urlset>');
fs.writeFileSync(path.join(DIST,'assets/accessibility.css'),'.rm-skip{position:absolute;left:-9999px}.rm-skip:focus{position:fixed;left:10px;top:10px;background:#fff;color:#000;padding:12px;z-index:99999}:focus-visible{outline:3px solid #f5a623;outline-offset:3px}.rm-menu{display:none}button,[role=button],input,select{min-height:44px}h2.section-title{font:inherit;font-size:2.4rem;font-weight:800}@media(max-width:900px){.rm-menu{display:block}.nav-links.rm-open{display:flex!important;position:absolute;top:70px;left:0;right:0;padding:20px;background:#141820;flex-wrap:wrap}section{padding-left:20px!important;padding-right:20px!important}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}');
console.log('Built '+Object.keys(pages).length+' allowlisted pages; server code excluded.');
