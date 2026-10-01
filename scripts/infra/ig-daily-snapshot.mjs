#!/usr/bin/env node
/**
 * ig-daily-snapshot.mjs - Snapshot DIARIO das 2 contas IG + recomputo de intel/cockpit.
 *
 * POR QUE ESTE SCRIPT EXISTE (leia antes de mexer):
 * Se o unico caminho que alimenta ct_metrics_snapshots for um script semanal rodando no
 * PC do usuario (Task Scheduler), PC desligado ou login caido = semana inteira sem dado, e
 * o ct_social_insights (cockpit + best_time) fica congelado ou calculado sobre poucas amostras.
 * O ct-diretor le esse cockpit ANTES de produzir qualquer conteudo.
 *
 * A sacada: Instagram nao precisa do PC do usuario. E Graph API pura, roda headless
 * num servidor. Quem precisa de sessao logada e LinkedIn, TikTok, IG salvos e Drive;
 * esses continuam num run local. Este script pega so a parte que da pra
 * automatizar de verdade, e pode rodar todo dia num agendador (cron).
 *
 * Faz:
 *   1. ct-instagram-analyzer nas 2 contas (grava ct_metrics_snapshots, grao post+conta)
 *   2. ct-social-intel/compute.js (best_time a partir do historico real)
 *   3. ct-social-cockpit/build.js (painel que o ct-diretor le)
 * Idempotente: rodar 2x no mesmo dia faz upsert por (platform, post_id, snapshot_date).
 *
 * Uso:
 *   node scripts/infra/ig-daily-snapshot.mjs
 *   node scripts/infra/ig-daily-snapshot.mjs --skip-aggregate   # so coleta
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const skipAggregate = args.includes('--skip-aggregate');
const force = args.includes('--force');

// OPCIONAL: CT_COCKPIT_HOST = hostname da unica maquina dona do cockpit. Motivo: build.js
// reescreve content/{slug}/cockpit.md; se duas maquinas rodarem o mesmo script e commitarem,
// os dois lados geram o mesmo arquivo com timestamps diferentes e o git diverge.
// Sem CT_COCKPIT_HOST definido, roda em qualquer maquina. Com ele definido, outra maquina
// so roda com --force explicito.
import os from 'node:os';
const hostDono = process.env.CT_COCKPIT_HOST || '';
const naVps = !hostDono || os.hostname() === hostDono;
if (!naVps && !force) {
  console.error('[ig-daily-snapshot] BLOQUEADO fora da maquina dona do cockpit (CT_COCKPIT_HOST).');
  console.error('  Cockpit e gerado SO na maquina dona (cron CT_IG_DAILY), senao o sync diverge.');
  console.error('  Se precisa MESMO rodar local, use --force (e nao commite content/*/cockpit.md).');
  process.exit(2);
}

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const summary = [];
let failed = false;

function node(script, extra = [], timeout = 300000) {
  const label = script.split('/').pop();
  log(`> ${script} ${extra.join(' ')}`);
  const r = spawnSync('node', [path.join(REPO, script), ...extra], {
    cwd: REPO,
    encoding: 'utf8',
    timeout,
    env: process.env,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const ok = r.status === 0;
  if (!ok) {
    failed = true;
    // Falha silenciosa aqui foi exatamente o bug historico: o dado sumia e ninguem via.
    log(`FALHOU ${label} (exit=${r.status}): ${out.trim().split('\n').slice(-3).join(' | ')}`);
    summary.push(`FALHOU ${label}`);
  } else {
    log(`ok ${label}`);
    summary.push(`ok ${label}`);
  }
  return { ok, out };
}

log('=== ig-daily-snapshot ===');

// 1. Coleta IG (as 2 contas). limit 30 cobre bem a janela recente sem estourar rate limit.
const r = node('skills/ct-instagram-analyzer/analyze.js', ['--account', 'all', '--limit', '30']);
const posts = (r.out.match(/(\d+)\s+posts?/i) || [])[1];
if (posts) summary.push(`posts coletados: ${posts}`);

// 2 e 3. Recomputa o que o ct-diretor le. Sem isso, coletar dado novo nao muda decisao nenhuma.
if (!skipAggregate) {
  node('skills/ct-social-intel/compute.js', ['--client', 'all', '--platform', 'all', '--days', '90']);
  node('skills/ct-social-cockpit/build.js', ['--client', 'all']);
}

log('\n=== RESUMO ===');
for (const s of summary) log(`  ${s}`);
process.exit(failed ? 1 : 0);
