## 251017

1. Pydantic 버전 호환 문제

서버 실행 후 오류 발생

```bash
pydantic.errors.PydanticImportError: `BaseSettings` has been moved to the `pydantic-settings` package.
```

```python
from pydantic import BaseSettings
```
`Pydantic 2.x`에서는 `BaseSettings`가 pydantic-settings 패키지로 분리

해결 방법 : `pydantic 1.x` 버전으로 다운그레이드

- 안정적이고 협업에 유리한 버전 1을 사용함

```bash
python -m pip install "pydantic<2.0"    # 다운 그레이드

python -m pip show pydantic    # 설치 확인
```

버전 확인
```bash
Name: pydantic
Version: 1.10.24
```

### **서버 실행 확인**