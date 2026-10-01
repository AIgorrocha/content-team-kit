#!/usr/bin/env node

/**
 * Deploy Remotion Lambda Infrastructure
 *
 * Cria bucket S3, deploya a função Lambda e o site Remotion.
 * Depois de rodar, configure as variáveis de ambiente retornadas.
 *
 * Pré-requisitos:
 *   npm install @remotion/lambda
 *   AWS credentials configuradas (REMOTION_AWS_ACCESS_KEY_ID + REMOTION_AWS_SECRET_ACCESS_KEY)
 *
 * Uso:
 *   node scripts/video/deploy-remotion-lambda.mjs
 */

import "./_env.mjs"

const REGION = process.env.REMOTION_AWS_REGION || "us-east-1"
const ENTRY_POINT = "src/remotion/Root.tsx"
const MEMORY_SIZE = 2048
const TIMEOUT = 240
const DISK_SIZE = 2048

async function main() {
  console.log("=== Deploy Remotion Lambda ===\n")

  // 1. Verificar credenciais AWS
  const accessKeyId =
    process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey =
    process.env.REMOTION_AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY

  if (!accessKeyId || !secretAccessKey) {
    console.error(
      "❌ Credenciais AWS não encontradas.\n" +
        "   Configure as variáveis de ambiente:\n" +
        "     REMOTION_AWS_ACCESS_KEY_ID=...\n" +
        "     REMOTION_AWS_SECRET_ACCESS_KEY=...\n" +
        "   Ou use AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY."
    )
    process.exit(1)
  }

  console.log(`✅ Credenciais AWS encontradas`)
  console.log(`   Região: ${REGION}\n`)

  // 2. Importar módulos do @remotion/lambda
  let getOrCreateBucket, deployFunction, deploySite

  try {
    const lambdaModule = await import("@remotion/lambda")
    getOrCreateBucket = lambdaModule.getOrCreateBucket
    deployFunction = lambdaModule.deployFunction
    deploySite = lambdaModule.deploySite
  } catch (err) {
    console.error(
      "❌ Pacote @remotion/lambda não encontrado.\n" +
        "   Instale com: npm install @remotion/lambda\n" +
        `   Erro: ${err.message}`
    )
    process.exit(1)
  }

  // 3. Criar ou obter bucket S3
  console.log("📦 Criando/verificando bucket S3...")
  try {
    const { bucketName } = await getOrCreateBucket({ region: REGION })
    console.log(`   Bucket: ${bucketName}\n`)

    // 4. Deploy da função Lambda
    console.log("⚡ Fazendo deploy da função Lambda...")
    console.log(
      `   Memória: ${MEMORY_SIZE}MB | Timeout: ${TIMEOUT}s | Disco: ${DISK_SIZE}MB`
    )

    const { functionName, alreadyExisted } = await deployFunction({
      region: REGION,
      memorySizeInMb: MEMORY_SIZE,
      timeoutInSeconds: TIMEOUT,
      diskSizeInMb: DISK_SIZE,
      createCloudWatchLogGroup: true,
    })

    console.log(
      `   Função: ${functionName} ${alreadyExisted ? "(já existia)" : "(criada)"}\n`
    )

    // 5. Deploy do site (bundle das compositions)
    console.log("🌐 Fazendo deploy do site Remotion...")
    console.log(`   Entry point: ${ENTRY_POINT}`)

    const { serveUrl } = await deploySite({
      region: REGION,
      bucketName,
      entryPoint: ENTRY_POINT,
      siteName: "content-team-ai-studio",
    })

    console.log(`   Serve URL: ${serveUrl}\n`)

    // 6. Resumo final
    console.log("=".repeat(50))
    console.log("✅ Deploy concluído com sucesso!\n")
    console.log("Adicione estas variáveis de ambiente ao seu .env.local:\n")
    console.log(`   REMOTION_AWS_REGION=${REGION}`)
    console.log(`   REMOTION_AWS_BUCKET=${bucketName}`)
    console.log(`   REMOTION_SERVE_URL=${serveUrl}`)
    console.log(`   REMOTION_FUNCTION_NAME=${functionName}`)
    console.log("")
    console.log(
      "No Vercel, adicione essas mesmas variáveis em Settings > Environment Variables."
    )
    console.log("=".repeat(50))
  } catch (err) {
    console.error(`\n❌ Erro durante o deploy: ${err.message}`)
    if (err.stack) {
      console.error(err.stack)
    }
    process.exit(1)
  }
}

main()
