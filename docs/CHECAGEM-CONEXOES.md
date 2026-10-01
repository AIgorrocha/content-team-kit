# Checagem das conexões

Na pasta do Kit, execute `npm run sala:check-connections`. O comando consulta a validade dos acessos configurados e atualiza a tela Conexões. Não publica conteúdo.

A checagem confere o acesso de LEITURA que o painel guarda. Ela não prova que o acesso de publicar (o `.env.local` gerado pelos scripts de autorização, veja `docs/CONECTAR-REDES.md`) está válido: para isso, rode um publicador com `--dry-run`.

Uma chave configurada não prova que a conexão funciona. Falhas temporárias, falta de permissão ou ausência de checagem aparecem como validade desconhecida. Datas antigas desconhecidas continuam assim até uma nova autorização. A checagem não inventa uma data de renovação.

Para executar diariamente no Windows, abra o Agendador de Tarefas e crie uma tarefa básica:

- Frequência: diária, no horário escolhido.
- Programa: `cmd.exe`.
- Argumentos: `/c npm run sala:check-connections`.
- Iniciar em: a pasta onde o Kit está instalado.

O computador e o banco precisam estar ligados nesse horário. Nenhuma tarefa é criada automaticamente pelo Kit. As credenciais ficam na configuração privada; não coloque seus valores nos argumentos do agendamento.
