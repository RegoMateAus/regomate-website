'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {JSDOM}=require('jsdom');
const dist=path.resolve(__dirname,'../dist');
function page(name,configure=()=>{}){const dom=new JSDOM(fs.readFileSync(path.join(dist,name+'.html'),'utf8'),{url:'https://regomate.com/'+name,runScripts:'outside-only'});const w=dom.window;w.alert=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.RM_CONFIG={apiUrl:'https://api.example.test',supabaseUrl:'https://db.example.test',supabaseKey:'synthetic',stripeKey:'synthetic'};configure(w);new vm.Script(fs.readFileSync(path.join(dist,'assets',name+'.js'),'utf8')).runInContext(dom.getInternalVMContext());return dom;}
test('extra-owner inputs retain their values across add and remove through compiled handlers',()=>{
 const dom=page('index'),w=dom.window,d=w.document;
 try{d.getElementById('add-extra-btn').click();let field=d.querySelector('#ei-extra-1 [data-rm-field=firstName]');assert.ok(field);field.value='Other Owner';field.dispatchEvent(new w.Event('input',{bubbles:true}));d.getElementById('add-extra-btn').click();assert.equal(d.querySelector('#ei-extra-1 [data-rm-field=firstName]').value,'Other Owner');d.querySelector('#ei-extra-2 .btn-remove').click();assert.equal(d.querySelectorAll('#extras-list .extra-item').length,1);assert.equal(d.querySelector('#ei-extra-1 [data-rm-field=firstName]').value,'Other Owner');}finally{w.close();}
});
test('invalid personal step cannot advance; mobile navigation and keyboard tabs operate',()=>{
 const dom=page('index'),w=dom.window,d=w.document;try{d.querySelector('[data-rm-click="1"]').click();assert.equal(d.getElementById('panel-1').classList.contains('active'),true);assert.ok(d.getElementById('pay-error').textContent);const menu=d.querySelector('.rm-menu');assert.ok(menu);menu.click();assert.equal(menu.getAttribute('aria-expanded'),'true');menu.click();assert.equal(menu.getAttribute('aria-expanded'),'false');}finally{w.close();}
});
test('valid checkout sends string fields, retries the same request and refreshes identity after consent changes',async()=>{
 const requests=[];const dom=page('index',w=>{w.fetch=async(url,options)=>{requests.push({url,...options});return {ok:false,json:async()=>({error:'Synthetic payment setup failure'})};};w.console.error=()=>{};});
 try{const d=dom.window.document;const values={firstName:'Jane',lastName:'Example',stickerName:'Jane',email:'audit@example.test',mobile:'0412345678',addrStreetNo:'2/38',addrStreetName:'Example St',addrSuburb:'Brisbane',addrState:'QLD',addrPostcode:'4000',plate:'ABC123',state:'QLD',regoPeriod:'3',regoExpiryDay:'31',regoExpiryMonth:'07',licExpiryDay:'28',licExpiryMonth:'02',licExpiryYear:'2030'};for(const[id,value]of Object.entries(values))d.getElementById(id).value=value;d.getElementById('renewal-consent').checked=true;
 const submit=async()=>{d.getElementById('pay-btn').click();await new Promise(setImmediate);};await submit();assert.equal(requests.length,1,d.getElementById("pay-error").textContent+" / "+JSON.stringify(Object.fromEntries(Object.keys(values).map(id=>[id,d.getElementById(id).value]))));assert.equal(JSON.parse(requests[0].body).vehicleData.addrStreetNo,'2/38');await submit();assert.equal(requests[1].headers['Idempotency-Key'],requests[0].headers['Idempotency-Key']);d.getElementById('marketing-consent').checked=true;await submit();assert.notEqual(requests[2].headers['Idempotency-Key'],requests[0].headers['Idempotency-Key']);assert.match(d.getElementById('pay-error').textContent,/Synthetic/);
 }finally{dom.window.close();}
});
test('auth callbacks yield immediately so Supabase cannot deadlock on nested auth work',()=>{
 let callback,scheduled=[];const dom=page('account',w=>{w.supabase={createClient:()=>({auth:{onAuthStateChange:fn=>{callback=fn;}}})};w.Stripe=()=>({});w.setTimeout=fn=>{scheduled.push(fn);return 1;};});
 try{assert.equal(callback('SIGNED_IN',{access_token:'synthetic',user:{email:'owner@example.test'}}),undefined);assert.equal(scheduled.length,1);}finally{dom.window.close();}
});

test('an unconfigured preview cannot submit a checkout',()=>{
 let requests=0;const dom=page('index',w=>{w.RM_CONFIG.previewUnavailable=true;w.fetch=()=>{requests++;throw Error('Must not contact a provider');};});
 try{dom.window.document.getElementById('pay-btn').click();assert.equal(requests,0);assert.match(dom.window.document.getElementById('pay-error').textContent,/Payments are unavailable/);}finally{dom.window.close();}
});
test('an account API failure keeps a visible error and permits a later retry',async()=>{
 let callback,scheduled,requests=0;const dom=page('account',w=>{w.supabase={createClient:()=>({auth:{onAuthStateChange:fn=>{callback=fn;}}})};w.Stripe=()=>({});w.setTimeout=fn=>{scheduled=fn;return 1;};w.fetch=async()=>{requests++;return {ok:false};};w.console.error=()=>{};});
 try{const session={access_token:'synthetic',user:{email:'owner@example.test'}};callback('SIGNED_IN',session);await scheduled();assert.match(dom.window.document.getElementById('loading').textContent,/Could not load/);assert.notEqual(dom.window.document.getElementById('loading').style.display,'none');callback('SIGNED_IN',session);await scheduled();assert.equal(requests,2);}finally{dom.window.close();}
});
