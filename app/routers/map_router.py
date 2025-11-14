import yaml
from fastapi import APIRouter
from PIL import Image
import os

router = APIRouter()

MAP_DIR = "app/static/map"

def ensure_png_exists(pgm_filename: str) -> str:
    """
    PGM 파일이 있으면 PNG 자동 생성하여 반환하는 함수.
    반환값 → PNG 파일 이름
    """
    pgm_path = os.path.join(MAP_DIR, pgm_filename)
    png_filename = pgm_filename.replace(".pgm", ".png")
    png_path = os.path.join(MAP_DIR, png_filename)

    # PNG 이미 존재하면 변환 생략
    if os.path.exists(png_path):
        return png_filename

    # PGM 이미지가 존재할 경우 → 자동 PNG 변환
    if os.path.exists(pgm_path):
        try:
            img = Image.open(pgm_path)
            img.save(png_path)
            print(f"🟢 PGM → PNG 자동 변환 완료: {png_filename}")
        except Exception as e:
            print("❌ PNG 변환 실패:", e)

    return png_filename


@router.get("/map/info")
def get_map_info():
    yaml_path = os.path.join(MAP_DIR, "wasd_map3.yaml")

    with open(yaml_path, "r") as f:
        data = yaml.safe_load(f)

    pgm_file = data["image"]  # YAML에 작성된 PGM 파일명
    png_file = ensure_png_exists(pgm_file)

    # 웹 클라이언트에게 항상 PNG 제공
    return {
        "image": f"/static/map/{png_file}",
        "resolution": data["resolution"],
        "origin": data["origin"]
    }