# Setup AWS pra Remotion Lambda

O Studio usa Remotion Lambda pra renderizar vídeos com legendas na nuvem.
Isso precisa de uma conta AWS (Amazon Web Services). **É opcional**: o render local
(Remotion no seu computador, veja `remotion/README.md`) é grátis e não precisa de AWS.

## Custo estimado

- **Renderização:** ~$0.05-0.15 por vídeo (1-2 minutos)
- **Armazenamento S3:** ~$0.02/GB por mês
- **Lambda:** cobrado por execução, centavos por render
- **Free tier AWS:** 1 milhão de requests Lambda/mês grátis nos primeiros 12 meses

## Passo a passo

### 1. Criar conta AWS

1. Acesse https://aws.amazon.com/
2. Clique em "Criar conta da AWS"
3. Preencha email, senha, nome
4. Adicione cartão de crédito (obrigatório, mas só cobra o que usar)
5. Escolha plano "Basic Support" (grátis)

### 2. Criar usuário IAM

1. Acesse https://console.aws.amazon.com/iam/
2. Menu lateral: "Usuários" → "Criar usuário"
3. Nome: `remotion-lambda`
4. Marque "Chave de acesso - Acesso programático"
5. Permissões: clique "Anexar políticas diretamente"
6. Adicione estas políticas:
   - `AmazonS3FullAccess`
   - `AWSLambda_FullAccess`
   - `AmazonEC2ContainerRegistryReadOnly`
   - `CloudWatchLogsFullAccess`
7. Clique "Criar usuário"
8. **COPIE** a Access Key ID e a Secret Access Key (só aparece uma vez!)

### 3. Configurar no Content Team AI

Adicione as variáveis de ambiente na Vercel:

```
REMOTION_AWS_ACCESS_KEY_ID=AKIA...       (da etapa anterior)
REMOTION_AWS_SECRET_ACCESS_KEY=xxx...    (da etapa anterior)
REMOTION_AWS_REGION=us-east-1
```

Via terminal:
```bash
npx vercel env add REMOTION_AWS_ACCESS_KEY_ID production
npx vercel env add REMOTION_AWS_SECRET_ACCESS_KEY production
npx vercel env add REMOTION_AWS_REGION production
```

Também adicione no `.env.local` pra testes locais.

### 4. Deploy da infraestrutura Remotion

Depois de configurar as credenciais, rode:

```bash
node scripts/video/deploy-remotion-lambda.mjs
```

Isso vai:
1. Criar um bucket S3 pra armazenar os vídeos
2. Criar uma Lambda function pra renderizar
3. Fazer deploy do código Remotion pro S3

O script vai mostrar `REMOTION_SERVE_URL`, `REMOTION_AWS_BUCKET` e `REMOTION_FUNCTION_NAME`:
adicione as três no `.env.local` (uso local) e na Vercel (se o dashboard estiver publicado lá).
As credenciais AWS também podem vir como `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`.

### 5. Testar

Depois de tudo configurado:
1. Abra o Studio no dashboard
2. Faça upload de um vídeo
3. Aguarde a transcrição
4. Clique "Renderizar vídeo"
5. O vídeo com legendas será gerado e salvo no S3

## Troubleshooting

- **Erro de permissão:** verifique se o IAM user tem todas as 4 políticas
- **Timeout:** vídeos longos podem precisar de mais tempo (ajustar timeoutInSeconds)
- **Custo alto:** monitore em https://console.aws.amazon.com/billing/
