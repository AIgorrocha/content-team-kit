# Mapa de Delegacao - Content Team AI

## Hierarquia

O diretor e o ASSISTENTE PRINCIPAL da sessao: ele le `agents/ct-diretor.md` e segue. Cada sub-agente abaixo e chamado com o Agent tool em `subagent_type: general-purpose` e o prompt "leia agents/ct-X.md e siga; contexto: ..." (subagente nao cria subagente).

```
Usuario
  └── Diretor (ct-diretor), Diretor Geral
        ├── Agenda (ct-agenda), Calendario/Prazos
        ├── Redator (ct-redator), Redacao/Copy
        ├── Pesquisador (ct-pesquisador), Pesquisa/Tendencias
        ├── Carrossel (ct-carrossel), Carrosseis
        ├── Designer (ct-designer), Design/Visual
        ├── Reciclador (ct-reciclador), Reaproveitamento
        ├── Story (ct-story), Stories com arco narrativo
        ├── Video (ct-video), Videos/Avatar
        ├── Video editor (ct-video-editor), Edicao de video gravado
        ├── Video Remotion (ct-video-remotion), Video por codigo
        ├── Video Higgsfield (ct-video-higgsfield), Video IA
        ├── Video MPT (ct-video-mpt), Video faceless
        ├── Video Hypit (ct-video-hypit), Video curto
        ├── Social (ct-social), Social/DMs
        ├── Email (ct-email), Email Marketing
        ├── Otimizador (ct-otimizador), Otimizacao
        ├── Parcerias (ct-parcerias), Parcerias
        └── Integrador (ct-integrador), Integracoes
```

## Fluxos Comuns

### Criar Post Instagram
1. Usuario pede → Diretor (carrega cliente ativo)
2. Diretor → Redator (escreve copy com brand voice do cliente)
3. Diretor → Carrossel (cria carrossel com design system do cliente) ou Designer (imagem)
4. Diretor valida → Usuario aprova
5. Com o "pode" do usuario, Diretor → ct-publicar-ig skill

### Criar Stories
1. Usuario pede (ou manda foto, print, ideia) → Diretor
2. Diretor → Story (monta o arco de 3 a 5 telas e mostra os textos no chat)
3. Usuario aprova os textos → skill `ct-story` renderiza os PNG
4. Publicacao so com o "pode" do usuario

### Pesquisar Concorrentes
1. Usuario pede → Diretor
2. Diretor → Pesquisador (pesquisa concorrentes do cliente ativo)
3. Pesquisador retorna relatorio → Diretor → Usuario

### Criar Sequencia de Email
1. Usuario pede → Diretor
2. Diretor → Redator (escreve copys com tom do cliente)
3. Diretor → Email (configura sequencia)

### Criar Reel (com transcricao)
1. Usuario envia transcricao → Diretor
2. Diretor → Redator (roteiro)
3. Diretor → Otimizador (legendas pra TODAS as plataformas)
   - legenda-instagram.txt (Instagram; Threads, se a marca usa, e post proprio de ate 500 chars)
   - legenda-tiktok.txt (TikTok)
   - youtube-shorts.txt (YouTube Shorts: titulo + descricao + tags)
   - post-linkedin.txt (LinkedIn: texto independente)
4. Salva tudo em content/{slug}/reels/{nome}/
5. Diretor valida → Usuario aprova

### Reaproveitar Conteudo
1. Usuario pede → Diretor
2. Diretor → Reciclador (adapta para outra plataforma)
3. Diretor → Otimizador (otimiza para a plataforma destino)
4. Diretor valida → Usuario aprova

## Regras

- Todo pedido passa pelo Diretor primeiro
- Diretor NUNCA produz conteudo diretamente
- Sub-agentes nao chamam outros sub-agentes: se precisam de outro papel, devolvem o pedido ao Diretor
- Publicacao SEMPRE requer o "pode" explicito do usuario (por peca e por rede)
