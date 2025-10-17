# 🚀 README_VSCODE_EC2_SETUP.md

## 📘 목적

Ubuntu EC2 인스턴스를 생성하고 VS Code의 **Remote SSH** 기능을 이용해 직접 원격 개발 환경을 구축하기 위한 전체 과정.

---

## 🧱 1️⃣ EC2 인스턴스 생성

1. **AWS 콘솔 접속 → EC2 서비스 → 인스턴스 시작 (Launch Instance)**

2. 기본 설정:

   * AMI: `Ubuntu Server 22.04 LTS`
   * 인스턴스 유형: `t3.small` (무료 티어)
   * 키 페어: 새로 생성 → `.pem` 파일 다운로드 (예: `my-aws-key.pem`)
   * 보안 그룹 인바운드 규칙:

     | 유형         | 포트   | 소스        |
     | ---------- | ---- | --------- |
     | SSH        | 22   | 내 IP      |
     | HTTP       | 80   | 0.0.0.0/0 |
     | 사용자 지정 TCP | 8000 | 0.0.0.0/0 |

3. 인스턴스 생성 후 **퍼블릭 IPv4 주소 확인**

---

## 🔐 2️⃣ PEM 키 파일 권한 설정 (Windows)

1. PEM 파일을 단순한 경로로 이동:

   ```
   C:\ec2keys\my-aws-key.pem
   ```

2. 파일 우클릭 → 속성 → **보안 탭** → 편집 클릭

   * "Users" 그룹 제거
   * 자신의 계정만 남기고 **읽기(Read)** 권한만 허용
   * 상속 해제 → 적용

3. PowerShell에서 확인:

   ```powershell
   icacls "C:\ec2keys\my-aws-key.pem"
   ```

   ✅ 결과 예시:

   ```
   C:\ec2keys\my-aws-key.pem COMPUTERNAME\username:(R)
   ```

> ⚡ 위 설정은 리눅스의 `chmod 400` 과 동일한 효과.

---

## 💻 3️⃣ VS Code 환경 설정

1. VS Code 실행 → 왼쪽 **Extensions(확장)** 메뉴 클릭
2. 검색: `Remote - SSH`
3. 확장 설치 후 VS Code 재시작

---

## ⚙️ 4️⃣ SSH 구성 파일(config) 설정

1. 명령 팔레트 열기 (**Ctrl + Shift + P**) → `Remote-SSH: Open SSH Configuration File`

2. 아래 내용 추가 (경로와 IP는 본인 환경에 맞게 수정):

   ```bash
   Host my-ec2-server
       HostName 13.209.xxx.xxx
       User ubuntu
       IdentityFile C:\ec2keys\my-aws-key.pem
   ```

3. 저장 후 닫기 (파일 위치: `C:\Users\<사용자명>\.ssh\config`)

---

## 🔗 5️⃣ VS Code에서 EC2 접속

1. 명령 팔레트 열기 (**Ctrl + Shift + P**) → `Remote-SSH: Connect to Host`
2. 목록에서 `my-ec2-server` 선택
3. 플랫폼 선택 창에서 **Linux** 클릭
4. 연결 로그 예시:

   ```
   Welcome to Ubuntu 22.04 LTS
   Installing VS Code Server...
   Connected to SSH Host 'my-ec2-server'
   ```
5. VS Code 하단 상태바에 🟢 **SSH: my-ec2-server** 표시되면 연결 성공 🎉

---

## 🧩 6️⃣ 초기 환경 세팅 (EC2 내부)

터미널에서 아래 명령 실행:

```bash
sudo apt update
sudo apt install python3-pip python3-venv git -y
```

가상환경 생성 및 FastAPI 설치:

```bash
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn
```

---

## 🚀 7️⃣ FastAPI 서버 테스트

1. VS Code에서 `main.py` 생성:

   ```python
   from fastapi import FastAPI

   app = FastAPI()

   @app.get("/")
   def read_root():
       return {"message": "Hello from EC2 🚀"}
   ```

2. FastAPI 실행:

   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. 브라우저에서 접속:

   ```
   http://<EC2 퍼블릭 IP>:8000
   ```

✅ 결과:

```json
{"message": "Hello from EC2 🚀"}
```

---

## 🧠 8️⃣ 연결 및 설정 확인 체크리스트

| 항목         | 확인 방법                      | 상태 |
| ---------- | -------------------------- | -- |
| PEM 권한 제한  | `icacls` 결과 `(R)`만 표시      | ✅  |
| SSH 설정     | `.ssh/config` 내용 확인        | ✅  |
| Remote 연결  | 하단 `SSH: my-ec2-server` 표시 | ✅  |
| Python 환경  | `python3 --version` 출력     | ✅  |
| FastAPI 실행 | 브라우저 접속 성공                 | ✅  |

---

## 🧰 참고 명령어 요약

| 기능         | 명령어                                                |
| ---------- | -------------------------------------------------- |
| SSH 접속 테스트 | `ssh -i C:\ec2keys\my-aws-key.pem ubuntu@<EC2-IP>` |
| FastAPI 실행 | `uvicorn main:app --host 0.0.0.0 --port 8000`      |
| 가상환경 실행    | `source venv/bin/activate`                         |
| 가상환경 종료    | `deactivate`                                       |

---

✅ **이제 VS Code에서 EC2 환경을 로컬처럼 사용 가능!**

> 수정 → 저장 → 바로 EC2에서 반영되는 실시간 개발 환경 완성 💻🔥
