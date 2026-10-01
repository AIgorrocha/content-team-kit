import test from 'node:test'
import assert from 'node:assert/strict'
import { checarConexao } from './connections-lib.mjs'

const token = 'credencial-sintetica-do-teste'
const response = (body, status=200) => new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json'}})

test('ausência de credencial não faz requisição nem vira conexão válida', async () => {
  const result = await checarConexao('linkedin', {env:{},fetchImpl:()=>{throw new Error('Não deve chamar rede')}})
  assert.equal(result.status, 'unknown')
})

test('LinkedIn aceita identidade válida e não devolve token', async () => {
  let calls=0
  const result=await checarConexao('linkedin',{env:{LINKEDIN_ACCESS_TOKEN:token},fetchImpl:async(url,init)=>{
    calls++;assert.equal(new URL(url).origin,'https://api.linkedin.com')
    assert.equal(new Headers(init.headers).get('authorization'),`Bearer ${token}`)
    return response({sub:'pessoa-prova',name:'Conta de prova'})
  }})
  assert.equal(calls,1);assert.equal(result.status,'ok')
  assert.equal(JSON.stringify(result).includes(token),false)
  assert.equal(result.obtained_at??null,null)
  assert.equal(result.expires_at??null,null)
})

for(const [status,expected] of [[401,'vencida'],[403,'unknown'],[429,'unknown'],[500,'unknown']]){
  test(`HTTP ${status} resulta em ${expected}, sem resposta bruta`,async()=>{
    const result=await checarConexao('linkedin',{env:{LINKEDIN_ACCESS_TOKEN:token},fetchImpl:async()=>response({error:token},status)})
    assert.equal(result.status,expected)
    assert.equal(JSON.stringify(result).includes(token),false)
  })
}

test('erro de transporte não prova expiração nem expõe detalhe',async()=>{
  const result=await checarConexao('linkedin',{env:{LINKEDIN_ACCESS_TOKEN:token},fetchImpl:async()=>{throw new Error(token)}})
  assert.equal(result.status,'unknown');assert.equal(JSON.stringify(result).includes(token),false)
})

test('YouTube renova acesso e confirma canal sem publicar',async()=>{
  const calls=[]
  const result=await checarConexao('youtube',{env:{YOUTUBE_CLIENT_ID:'app-prova',YOUTUBE_CLIENT_SECRET:'segredo-prova',YOUTUBE_REFRESH_TOKEN:token},fetchImpl:async(url,init)=>{
    calls.push({host:new URL(url).hostname,path:new URL(url).pathname,method:init?.method??'GET'})
    if(new URL(url).hostname==='oauth2.googleapis.com')return response({access_token:'acesso-prova',expires_in:3600})
    assert.equal(new URL(url).searchParams.get('mine'),'true')
    return response({items:[{id:'canal-prova'}]})
  }})
  assert.equal(result.status,'ok')
  assert.deepEqual(calls.map(x=>x.method),['POST','GET'])
  assert.equal(JSON.stringify(result).includes(token),false)
})

test('YouTube invalid_grant exige renovar autorização',async()=>{
  const result=await checarConexao('youtube',{env:{YOUTUBE_CLIENT_ID:'app',YOUTUBE_CLIENT_SECRET:'segredo',YOUTUBE_REFRESH_TOKEN:token},fetchImpl:async()=>response({error:'invalid_grant'},400)})
  assert.equal(result.status,'vencida')
})

test('LinkedIn com corpo sem identidade não prova conexão',async()=>{
  const result=await checarConexao('linkedin',{env:{LINKEDIN_ACCESS_TOKEN:token},fetchImpl:async()=>response({})})
  assert.equal(result.status,'unknown')
})

test('Meta usa o identificador da tela e reconhece token inválido do Graph',async()=>{
  const result=await checarConexao('meta_ads',{env:{META_ACCESS_TOKEN:token},fetchImpl:async()=>response({error:{code:190,message:token}},400)})
  assert.equal(result.status,'vencida')
})

test('Instagram rejeita debug_token inválido mesmo após me responder',async()=>{
  const result=await checarConexao('instagram',{env:{INSTAGRAM_ACCESS_TOKEN:token,IG_APP_ID:'app',INSTAGRAM_APP_SECRET:'segredo'},fetchImpl:async(url)=>new URL(url).pathname==='/me'?response({id:'conta'}):response({data:{is_valid:false}})})
  assert.equal(result.status,'vencida')
})

test('checagem válida informa vencimento verificável do Instagram',async()=>{
  const expires=Math.floor(Date.now()/1000)+3*86400
  const result=await checarConexao('instagram',{env:{INSTAGRAM_ACCESS_TOKEN:token,IG_APP_ID:'app',INSTAGRAM_APP_SECRET:'segredo'},fetchImpl:async(url)=>new URL(url).pathname==='/me'?response({id:'conta'}):response({data:{is_valid:true,expires_at:expires}})})
  assert.equal(result.status,'vencendo')
  assert.equal(new Date(result.expires_at).getTime(),expires*1000)
})

test('TikTok só informa sessão para diretório existente',async()=>{
  const result=await checarConexao('tiktok',{env:{},sessionDir:import.meta.dirname})
  assert.equal(result.status,'session')
})
