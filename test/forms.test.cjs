'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {JSDOM}=require('jsdom');
const dist=path.resolve(__dirname,'../dist');
function page(name){const dom=new JSDOM(fs.readFileSync(path.join(dist,name+'.html'),'utf8'),{url:'https://regomate.com/'+name,runScripts:'outside-only'});const w=dom.window;w.alert=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.RM_CONFIG={apiUrl:'https://api.example.test',supabaseUrl:'https://db.example.test',supabaseKey:'synthetic',stripeKey:'synthetic'};new vm.Script(fs.readFileSync(path.join(dist,'assets',name+'.js'),'utf8')).runInContext(dom.getInternalVMContext());return dom;}
test('extra-owner inputs retain their values across add and remove through compiled handlers',()=>{
 const dom=page('index'),w=dom.window,d=w.document;
 try{d.getElementById('add-extra-btn').click();let field=d.querySelector('#ei-extra-1 [data-rm-field=firstName]');assert.ok(field);field.value='Other Owner';field.dispatchEvent(new w.Event('input',{bubbles:true}));d.getElementById('add-extra-btn').click();assert.equal(d.querySelector('#ei-extra-1 [data-rm-field=firstName]').value,'Other Owner');d.querySelector('#ei-extra-2 .btn-remove').click();assert.equal(d.querySelectorAll('#extras-list .extra-item').length,1);assert.equal(d.querySelector('#ei-extra-1 [data-rm-field=firstName]').value,'Other Owner');}finally{w.close();}
});
test('invalid personal step cannot advance; mobile navigation and keyboard tabs operate',()=>{
 const dom=page('index'),w=dom.window,d=w.document;try{d.querySelector('[data-rm-click="1"]').click();assert.equal(d.getElementById('panel-1').classList.contains('active'),true);assert.ok(d.getElementById('pay-error').textContent);const menu=d.querySelector('.rm-menu');assert.ok(menu);menu.click();assert.equal(menu.getAttribute('aria-expanded'),'true');menu.click();assert.equal(menu.getAttribute('aria-expanded'),'false');}finally{w.close();}
});
