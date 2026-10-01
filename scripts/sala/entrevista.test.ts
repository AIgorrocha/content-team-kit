import test from 'node:test'
import assert from 'node:assert/strict'
import { validarMensagemEntrevista, validarPropostaEntrevista } from '../../src/lib/sala/entrevista'
import { lerOnboarding } from '../../src/lib/sala/fontes/onboarding'

test('entrevista recusa credenciais antes de enviar à IA', () => {
  assert.throws(() => validarMensagemEntrevista('minha senha: exemplo-nao-real'), /cofre/i)
  assert.throws(() => validarMensagemEntrevista('sk-proj-' + 'x'.repeat(40)), /cofre/i)
  assert.throws(() => validarMensagemEntrevista('ghp_' + 'x'.repeat(36)), /cofre/i)
  assert.equal(validarMensagemEntrevista('Quero falar com arquitetos e publicar duas vezes na semana.'), 'Quero falar com arquitetos e publicar duas vezes na semana.')
})

test('proposta só pode preencher perguntas e opções do bloco atual', () => {
  const bloco = lerOnboarding('cliente-teste', [])[4]
  assert.deepEqual(validarPropostaEntrevista({ mensagem: 'Confirme as redes.', respostas: { redes_hoje: ['Instagram', 'LinkedIn'] } }, bloco).respostas.redes_hoje, ['Instagram', 'LinkedIn'])
  assert.throws(() => validarPropostaEntrevista({ mensagem: 'Ok', respostas: { caminho: '../outro' } }, bloco))
  assert.throws(() => validarPropostaEntrevista({ mensagem: 'Ok', respostas: { redes_hoje: ['inventada'] } }, bloco))
  assert.throws(() => validarPropostaEntrevista({ mensagem: 'Ok', respostas: { ritmo: ['duas vezes'] } }, bloco))
  const visual = lerOnboarding('cliente-teste', [])[5]
  assert.throws(() => validarPropostaEntrevista({ mensagem: 'Ok', respostas: { logo: 'segredo.txt' } }, visual))
})
