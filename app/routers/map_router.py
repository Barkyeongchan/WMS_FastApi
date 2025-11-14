import yaml
from fastapi import APIRouter
import imageio
import os

router = APIRouter()

MAP_DIR = "app/static/map"


def ensure_png_exists(pgm_filename: str) -> str:
    """
    PGM → PNG 변환 (imageio 사용하여 원본 이미지 크기 100% 유지)
    반환값 → PNG 파일 이름
    """
    pgm_path = os.path.join(MAP_DIR, pgm_filename)
    png_filename = pgm_filename.replace(".pgm", ".png")
    png_path = os.path.join(MAP_DIR, png_filename)

    # 이미 PNG가 있으면 변환 생략
    if os.path.exists(png_path):
        return png_filename

    # PGM이 존재하면 PNG 생성
    if os.path.exists(pgm_path):
        try:
            img = imageio.imread(pgm_path)  # 원본 픽셀 크기 그대로 로드
            imageio.imwrite(png_path, img)  # 그대로 PNG 저장
            print(f"🟢 PGM → PNG 변환 완료: {png_filename}")
        except Exception as e:
            print(f"❌ PNG 변환 실패: {e}")

    return png_filename


@router.get("/map/info")
def get_map_info():
    """
    클라이언트에게 제공할 지도 정보
    - PNG 이미지 경로
    - resolution
    - origin
    """
    yaml_path = os.path.join(MAP_DIR, "wasd_map3.yaml")

    with open(yaml_path, "r") as f:
        data = yaml.safe_load(f)

    pgm_file = data["image"]  # YAML에 지정된 PGM 파일명
    png_file = ensure_png_exists(pgm_file)

    # 항상 PNG 이미지 경로 제공
    return {
        "image": f"/static/map/{png_file}",
        "resolution": data["resolution"],
        "origin": data["origin"]
    }