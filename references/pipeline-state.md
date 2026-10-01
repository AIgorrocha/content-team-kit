# Pipeline State: Especificação

Referência técnica do `state.json` usado pelo `ct-diretor` pra orquestrar pipeline de criação com checkpoints.

Inspirado no padrão de squads do opensquad (Renato Asse), adaptado pra esta stack (agentes `ct-*`).

---

## Onde fica

```
content/{cliente}/{tipo}/{nome}/state.json
```

Exemplos:
- `content/{slug}/carrossel/{peca}/state.json`
- `content/{slug}/reels/{peca}/state.json`
- `content/{slug}/artigo/{peca}/state.json`

## Schema completo

```json
{
  "client": "{slug do cliente ativo}",
  "type": "carrossel | reels | story | post | artigo | thumbnail | email",
  "slug": "skills-ia-20260421",
  "title": "Skills que agentes de IA devem aprender",

  "status": "checkpoint | running | done | cancelled | failed",

  "step": {
    "current": 1,
    "total": 5,
    "label": "research | copy | design | review | publish"
  },

  "checkpoint": {
    "waiting_for": "aprovar angulo | aprovar texto | aprovar visual | validacao final",
    "started_at": "2026-04-21T22:05:00Z",
    "message_to_user": "...",
    "options": ["aprovado", "ajustar", "cancelar"]
  },

  "brief": {
    "angulo": "Skills que agentes de IA devem aprender pra cair no dia a dia",
    "tom": "tecnico acessivel",
    "publico": "dev/eng 28-45 gestao/operacao",
    "cta": "comenta qual skill voce ja criou",
    "plataformas": ["instagram", "linkedin"],
    "referencias": [
      "content/research/2026-04-21-analise-perfil-referencia-ig.md"
    ]
  },

  "agents": [
    {
      "id": "ct-pesquisador",
      "step": 1,
      "status": "done | idle | running | failed",
      "started_at": "2026-04-21T22:00:00Z",
      "finished_at": "2026-04-21T22:03:00Z",
      "output": "content/{slug}/carrossel/{peca}/research/sherlock-report.md",
      "notes": "3 perfis analisados, 5 angulos propostos"
    },
    {
      "id": "ct-redator",
      "step": 2,
      "status": "idle",
      "output": null
    },
    {
      "id": "ct-carrossel",
      "step": 3,
      "status": "idle",
      "output": null
    },
    {
      "id": "ct-diretor",
      "step": 4,
      "status": "idle",
      "output": null
    }
  ],

  "artifacts": {
    "research": "content/{slug}/carrossel/{peca}/research/",
    "copy": "content/{slug}/carrossel/{peca}/legendas/",
    "design": "content/{slug}/carrossel/{peca}/slides/",
    "published_links": []
  },

  "history": [
    { "ts": "2026-04-21T22:00:00Z", "event": "started", "by": "usuario", "from": "telegram" },
    { "ts": "2026-04-21T22:03:00Z", "event": "agent_done", "agent": "ct-pesquisador" },
    { "ts": "2026-04-21T22:05:00Z", "event": "checkpoint_waiting", "label": "aprovar angulo" },
    { "ts": "2026-04-21T22:15:00Z", "event": "checkpoint_approved", "label": "aprovar angulo", "by": "usuario", "feedback": "aprovado" },
    { "ts": "2026-04-21T22:15:01Z", "event": "step_advanced", "from": 1, "to": 2 }
  ],

  "created_at": "2026-04-21T22:00:00Z",
  "updated_at": "2026-04-21T22:15:01Z",
  "created_by": "usuario",
  "origin": "telegram | terminal | frontend"
}
```

---

## Status possíveis

| Valor | Significado |
|---|---|
| `running` | Agente da etapa atual está executando |
| `checkpoint` | Aguardando aprovação do usuário |
| `done` | Pipeline concluído, publicado |
| `cancelled` | usuário cancelou (arquivos mantidos) |
| `failed` | Erro técnico: ver `history[-1]` pra detalhes |

## Etapas (step.label)

| Step | Label | Agente principal | Checkpoint saída |
|---|---|---|---|
| 1 | `research` | ct-pesquisador ou ct-analyzer | "aprovar angulo" |
| 2 | `copy` | ct-redator | "aprovar texto" |
| 3 | `design` | ct-carrossel / ct-designer / ct-video | "aprovar visual" |
| 4 | `review` | ct-diretor | "validacao final" |
| 5 | `publish` | ct-publicar-* ou manual (so com o "pode" do usuario, por rede) | (final) |

Pipelines simples podem pular etapas (ex: post LinkedIn texto puro: pula step 3 DESIGN).

## Eventos do history

| Evento | Campos extras |
|---|---|
| `started` | `by`, `from` |
| `agent_dispatched` | `agent`, `step` |
| `agent_done` | `agent`, `output` |
| `agent_failed` | `agent`, `error` |
| `checkpoint_waiting` | `label` |
| `checkpoint_approved` | `label`, `by`, `feedback` |
| `checkpoint_rejected` | `label`, `by`, `feedback` (vira rollback ou ajuste) |
| `step_advanced` | `from`, `to` |
| `step_rewound` | `from`, `to`, `reason` |
| `published` | `platform`, `link` |
| `cancelled` | `by`, `reason` |

---

## Como o ct-diretor opera sobre o state.json

### Criar (início)
```python
# pseudocódigo
state = {
    "client": detectar_cliente(),
    "type": tipo,
    "slug": gerar_slug(tema),
    "status": "running",
    "step": {"current": 1, "total": 5, "label": "research"},
    "brief": extrair_brief_da_mensagem_do_usuario(),
    "agents": agentes_padrao_da_pipeline(tipo),
    "history": [{"ts": now(), "event": "started", "by": "usuario", "from": origem}],
    "created_at": now(),
    "updated_at": now(),
}
salvar(f"content/{cliente}/{tipo}/{slug}/state.json", state)
```

### Avançar etapa (após aprovação)
```python
state = ler_state()
state["history"].append({"ts": now(), "event": "checkpoint_approved", "label": ..., "by": "usuario", "feedback": feedback})
state["step"]["current"] += 1
state["step"]["label"] = proxima_etapa(state["step"]["current"])
state["history"].append({"ts": now(), "event": "step_advanced", "from": current-1, "to": current})
state["status"] = "running"
state["checkpoint"] = None
state["updated_at"] = now()
salvar(state)
# Dispara próximo agente
```

### Rebobinar (usuário pediu ajuste)
```python
state = ler_state()
step_atual = state["step"]["current"]
# Volta 1 etapa
state["step"]["current"] -= 1
state["step"]["label"] = etapa_anterior(state["step"]["current"])
state["history"].append({"ts": now(), "event": "step_rewound", "from": step_atual, "to": step_atual-1, "reason": feedback})
# Marca agente da etapa anterior pra re-rodar
state["agents"][step_atual-1]["status"] = "idle"
state["status"] = "running"
state["updated_at"] = now()
salvar(state)
# Re-dispara com feedback
```

### Retomar (usuário voltou depois)
```python
# Ao receber "continua o X" ou "status do Y"
candidatos = glob("content/*/*/**/state.json")
for state_path in candidatos:
    state = ler(state_path)
    if state["status"] in ["checkpoint", "running"] and matches(state, pedido_usuario):
        apresentar_checkpoint(state)
        break
```

---

## Integração com Supabase

Cada pipeline cria/atualiza registro em `ct_content_items` com:

| Campo Supabase | Valor do state.json |
|---|---|
| `id` | derivado do slug + cliente |
| `client_slug` | `client` |
| `type` | `type` |
| `title` | `title` |
| `status` | `status` (mapeado: `running`→`in_progress`, `checkpoint`→`pending_approval`, `done`→`published`) |
| `current_step` | `step.label` |
| `state_json_path` | path absoluto do state.json |
| `updated_at` | `updated_at` |

O frontend web lê dessa tabela pra mostrar kanban de pipelines em andamento.

---

## Comandos de administração (pensados futuro)

```bash
# Listar pipelines ativos
ct pipeline list

# Ver estado de um
ct pipeline show skills-ia-20260421

# Retomar
ct pipeline resume skills-ia-20260421

# Cancelar
ct pipeline cancel skills-ia-20260421 --reason "repetido"
```

---

## Relacionamento com opensquad

Esse schema é compatível com o `state.json` que o opensquad usa. Se um dia quisermos importar/exportar squads entre os dois sistemas, a estrutura coincide o suficiente.

Diferenças principais:
- Nosso `step.label` usa verbos em PT (`research`, `copy`, `design`): opensquad usa `Aprovar ângulo`
- Nosso `agents[].id` usa `ct-*`: opensquad usa `researcher`, `copywriter`, etc.
- Nosso `brief` é estruturado; opensquad tem YAML `discovery.yaml`/`design.yaml` separados
