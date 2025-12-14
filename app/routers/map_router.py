import yaml
from fastapi import APIRouter
import imageio
import os

# 지도 관련 API 라우터
router = APIRouter()

# 지도 파일 디렉토리 경로
MAP_DIR = "app/static/map"


# PGM 파일을 PNG로 변환하고 PNG 파일명 반환
def ensure_png_exists(pgm_filename: str) -> str:
    # PGM 파일 전체 경로
    pgm_path = os.path.join(MAP_DIR, pgm_filename)

    # PNG 파일명 및 경로
    png_filename = pgm_filename.replace(".pgm", ".png")
    png_path = os.path.join(MAP_DIR, png_filename)

    # PNG가 이미 존재하면 변환 생략
    if os.path.exists(png_path):
        return png_filename

    # PGM이 존재할 경우 PNG 생성
    if os.path.exists(pgm_path):
        try:
            # 원본 크기 그대로 이미지 로드
            img = imageio.imread(pgm_path)

            # PNG 파일로 저장
            imageio.imwrite(png_path, img)
            print(f"🟢 PGM → PNG 변환 완료: {png_filename}")
        except Exception as e:
            print(f"❌ PNG 변환 실패: {e}")

    return png_filename


# 지도 이미지 및 메타데이터 제공
@router.get("/map/info")
def get_map_info():
    # 지도 YAML 파일 경로
    yaml_path = os.path.join(MAP_DIR, "wasd_map3.yaml")

    # YAML 파일 로드
    with open(yaml_path, "r") as f:
        data = yaml.safe_load(f)

    # YAML에 지정된 PGM 파일명
    pgm_file = data["image"]

    # PNG 파일 생성 또는 확인
    png_file = ensure_png_exists(pgm_file)

    # 클라이언트에 전달할 지도 정보 반환
    return {
        "image": f"/static/map/{png_file}",
        "resolution": data["resolution"],
        "origin": data["origin"],
    }