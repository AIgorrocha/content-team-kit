// Travas comuns dos publicadores.
//  - exigirSlug: --client e --slug viram caminho (Storage, pasta, fila). So minusculas, numeros e hifen.
//  - somentePrevia: sem --pode (ou com --dry-run) o publicador so mostra o que faria. Quem acrescenta
//    --pode e o assistente, e so depois do "pode" do dono.
export const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]*$/

export function slugValido(valor) {
  return typeof valor === "string" && SLUG_VALIDO.test(valor)
}

// valor ausente (null/undefined) passa: o padrao vem do workspace. Presente e invalido: aborta.
export function exigirSlug(nome, valor) {
  if (valor === null || valor === undefined) return valor
  if (!slugValido(valor)) {
    console.error(`${nome} invalido: use so letras minusculas, numeros e hifen (ex: minha-peca).`)
    process.exit(1)
  }
  return valor
}

export function temPode(args = process.argv.slice(2)) {
  return args.includes("--pode")
}

export function somentePrevia(args = process.argv.slice(2)) {
  const previa = args.includes("--dry-run") || !temPode(args)
  if (!temPode(args) && !args.includes("--dry-run")) {
    console.log("[pre-visualizacao] Nada sera publicado sem --pode. Depois do 'pode' do dono, rode de novo com --pode.")
  }
  return previa
}
