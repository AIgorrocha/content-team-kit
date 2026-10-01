"""
mpt_generate.py — driver do MoneyPrinterTurbo pro Content Team AI.

Roda DENTRO do ambiente do MPT (uv run, cwd = integrations/moneyprinter-turbo).
Recebe 1 argumento: caminho de um JSON com os parametros ja resolvidos pelo
wrapper Node (scripts/mpt/run-mpt.mjs), que leu a identidade do cliente ativo.

Monta o VideoParams COMPLETO (incluindo cor/fonte/stroke da legenda, que o
cli.py oficial nao expoe) e chama o motor. Imprime JSON com os MP4 finais.

Roteiro e termos vem prontos -> o LLM interno do MPT nao e acionado.
"""
import sys
import os
import json
import glob

# garante que a raiz do MPT esta no sys.path (rodamos com cwd = MPT_DIR,
# mas python so adiciona o dir do script). Sem isso: ModuleNotFoundError: app.
sys.path.insert(0, os.getcwd())

from app.models.schema import VideoParams
from app.services import task as tm
from app.utils import utils


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing params json path"}))
        return 1

    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        cfg = json.load(fh)

    task_id = cfg.get("task_id") or utils.get_uuid()

    terms = cfg.get("terms")
    if isinstance(terms, str):
        terms = [t.strip() for t in terms.split(",") if t.strip()]

    params = VideoParams(
        video_subject=cfg["subject"],
        video_script=cfg["script"],
        video_terms=terms,
        video_source=cfg.get("source", "pexels"),
        video_aspect=cfg.get("aspect", "9:16"),
        video_count=cfg.get("count", 1),
        voice_name=cfg.get("voice", ""),
        subtitle_enabled=cfg.get("subtitle_enabled", True),
        subtitle_position=cfg.get("subtitle_position", "bottom"),
        font_name=cfg.get("font_name", "MicrosoftYaHeiBold.ttc"),
        text_fore_color=cfg.get("text_fore_color", "#FFFFFF"),
        text_background_color=cfg.get("text_background_color", False),
        font_size=cfg.get("font_size", 60),
        stroke_color=cfg.get("stroke_color", "#000000"),
        stroke_width=cfg.get("stroke_width", 1.5),
        bgm_type=cfg.get("bgm_type", "random"),
        bgm_volume=cfg.get("bgm_volume", 0.2),
    )

    result = tm.start(task_id=task_id, params=params, stop_at="video")
    if not result:
        print(json.dumps({"task_id": task_id, "error": "video generation failed"}, ensure_ascii=False))
        return 1

    task_dir = utils.task_dir(task_id)
    finals = sorted(glob.glob(os.path.join(task_dir, "final-*.mp4")))

    print(json.dumps({
        "task_id": task_id,
        "task_dir": task_dir,
        "final_videos": finals,
        "result": result,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
