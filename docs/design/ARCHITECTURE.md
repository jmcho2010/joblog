# 아키텍처 설계서

상태: **제안**. 근거: `AGENTS.md` §4·§5·§7, `TASKS.md` §2, `supabase/migrations/0001~0004`, `API_SPEC.md`. 배포 위치는 미정(`[확인 필요]`)이라 §9에 후보와 폴백을 적었다.

---

## 1. 목적과 설계 원칙

| 원칙 | 의미 | 설계에 미친 영향 |
|---|---|---|
| 약속은 DB가 지킨다 | 확정 전 일정 없음, 두 번 집기 금지, 한 진행 중 단계 등은 서버 코드가 아니라 DB 제약·함수가 보장 | 규칙 대부분이 `supabase/`에 있고 시험도 거기에 있다 |
| 여러 표를 바꾸면 함수 한 번 | 중간 실패 시 아무것도 남지 않아야 한다 (규칙 10) | API는 얇은 어댑터, DB 함수 호출이 핵심 |
| AI는 믿지 않는다 | AI 값은 확인 전 값. 날짜는 서버가 계산. 위치를 검증 (D-31) | 워커가 검증·정규화를 소유 |
| 시간은 주입한다 | `now()` 직접 호출 금지 | 시계 객체 + `p_now` 인자 |
| 한 곳에서 읽는다 | 환경값, 문구, 날짜 표시 | `env`, `messages.ts`, `DeadlineLabel` |
| 모르는 것은 모른다 | 시각 미확인, 정보 없음, 연도 추정 | 데이터 모델에 상태가 있음 |

## 2. 시스템 구성도

```
┌───────────────────────────────┐
│ 사용자 브라우저 (PWA)          │
│  Next.js 화면 (React, Tailwind)│
│  - 서버 상태: react-query       │
│  - 오늘 날짜는 /api/me 값 사용  │
└──────────────┬────────────────┘
               │ HTTPS, 같은 출처, 쿠키 세션 (Supabase 비회원 로그인)
               ▼
┌───────────────────────────────┐        ┌──────────────────────────────┐
│ Next.js 서버 (API 라우트)      │        │ 1분 예약 작업                 │
│  - 세션에서 user_id 꺼냄        │◄───────┤  pg_cron(+pg_net) 또는        │
│  - 입력 검증, 오류 변환          │ POST   │  호스팅 크론 → /api/internal/ │
│  - DB 함수 호출 (service_role)  │ x-cron │  notifications/tick           │
│  - NotificationSender (알림함)  │ -key   └──────────────────────────────┘
└──────────────┬────────────────┘
               │ service_role (서버 환경변수의 키)
               ▼
┌───────────────────────────────┐        ┌──────────────────────────────┐
│ Supabase                       │        │ Python AI 서버 (워커)         │
│  - Auth (비회원)                │◄───────┤  루프: claim_extraction_job   │
│  - PostgreSQL                  │ service│   → Gemini API 호출 (원문+지시)│
│     · 표 12개, RLS(읽기만)       │ _role  │   → 위치 검증 → 날짜 정리       │
│     · DB 함수 (규칙의 핵심)      │        │   → save_extraction_result    │
│     · 작업 큐(extraction_jobs)  │        │  + requeue_stale_*            │
│  - Storage (1차-B 이미지)        │        └──────────────┬───────────────┘
└───────────────────────────────┘                       │ HTTPS (키는 서버 환경변수)
                                                        ▼
                                              ┌──────────────────┐
                                              │ Gemini API        │
                                              └──────────────────┘
운영: Docker(web, ai) · Jenkins(빌드·시험) · Sentry(오류, 본문 제외)
```

핵심 경계:
- **브라우저는 DB에 직접 쓰지 않는다.** 모든 읽기·쓰기가 Next.js API를 지난다. RLS는 읽기 전용 안전망이다(API 버그가 있어도 남의 행은 못 읽게).
- **service_role 키는 서버 두 곳(Next.js 서버, Python 워커)에만 있다.** 브라우저에 보내지 않는다.
- **AI 서버는 HTTP를 열지 않는다.** DB 큐를 가져와 처리한다. 공격 면이 작다.

## 3. 컴포넌트 책임

| 컴포넌트 | 위치 | 책임 | 하지 않는 일 |
|---|---|---|---|
| 화면 | `apps/web/src/app` | 상태별 표시(UX 규칙), 입력 보존, 중복 클릭 방지 | 날짜 계산, 규칙 판단 |
| API 라우트 | `apps/web/src/app/api` | 인증, 소유자 확인, 입력 검증, DB 함수 호출, 오류 변환 | 여러 표를 나눠 쓰기, 본문 로그 |
| 서버 모듈 | `apps/web/src/server` | DB 클라이언트, 소유자 조회, 오류 맵, `NotificationSender` | 화면 로직 |
| 시계·환경 | `src/lib/clock.ts`, `env.ts` | 현재 시각 주입, 환경값 한 곳 | — |
| 문구·표시 | `src/lib/messages.ts`, `components/` | 모든 한국어 문구, `DeadlineLabel` | — |
| AI 워커 | `services/ai/app` | 큐 소비, Gemini 호출, 위치 검증, 날짜 정리, 저장·실패 처리 | 사용자 정보를 AI에 보내기, URL 가져오기 |
| 날짜 정리 | `services/ai/app/normalize` | 순수 함수: (인용문, 등록일) → 마감 값 | 시계·네트워크·DB 접근 |
| DB | `supabase/migrations` | 제약, 함수, 권한, 색인 | 화면 문구 |
| 예약 작업 | Supabase/호스팅 | 1분마다 틱 호출 | 알림 내용 결정 |

## 4. 기술 선택과 이유

| 선택 | 이유 | 대안·위험 |
|---|---|---|
| Next.js + TypeScript | 화면과 API를 한 저장소에서, PWA 가능 | 서버리스 환경에서 장시간 작업 불가 → AI는 별도 서버 |
| Python AI 서버 | AI 라이브러리·날짜 처리에 익숙, 큐 소비 루프가 단순 | 두 언어 유지 비용 → 날짜 시험표는 JSON으로 공유 |
| Supabase(PostgreSQL) | 인증·DB·파일을 한 곳에, SQL 제약으로 규칙 보장 | 로컬(스텁)과 실제 차이(G-5) |
| DB 함수 중심 | 원자성·권한을 DB 한곳에서 | 함수 변경 시 마이그레이션 필요 → 새 파일로 추가 |
| 작업 큐를 DB 표로 | 별도 큐 시스템 없이 `skip locked`로 안전하게 집음 | 규모가 커지면 교체 (훈련 규모에서는 충분) |
| 알림은 알림함 (푸시 1차-B) | 범위 | 푸시 인터페이스 자리 확보 |
| Docker | 같은 실행 환경 | 배포 위치 미정 |

## 5. 핵심 흐름

### 5.1 공고 등록 → 추출 → 확정

```
화면                 Next.js API              DB                         AI 워커
 │ POST /postings ──►│ 검증, user_id          │                            │
 │  (request_id,글)  │ create_posting_with_job►│ 공고+작업(대기) / 동의 없음→   │
 │◄── posting_id ────│◄───────────────────────│  작업 없이 needs_review       │
 │ GET /postings/:id │ (3초마다 폴링)          │                            │
 │                   │                        │◄── claim_extraction_job ───│ 집기(대기→처리 중)
 │                   │                        │                            │ Gemini 호출
 │                   │                        │                            │ 위치 검증 → 날짜 정리
 │                   │                        │◄── save_extraction_result ─│ (취소됐으면 false)
 │◄── needs_review ──│                        │                            │
 │ 사용자가 확인·수정 (API-05~07)               │                            │
 │ POST /confirm ───►│ confirm_posting ───────►│ 확정 (일정·알림 아직 0)       │
 │                   │ create_application ×N ─►│ 지원 건+단계+마감 일정+알림    │
 │◄── 요약(개수) ────│                        │                            │
```

### 5.2 직접 입력으로 전환 (경쟁 조건)

1. 사용자가 전환을 누른다 → API-08 → `cancel_extraction_job`(처리 중 작업도 `cancelled`, 공고 `needs_review`).
2. 그 사이 워커가 결과를 보내도 `save_extraction_result`는 작업이 `processing`이 아니면 `false` → 워커는 버린다. 화면은 다시 불러온 서버 상태만 믿는다 (AC-JOB-06).

### 5.3 알림 틱

```
예약 작업 ─POST /internal/notifications/tick (x-cron-key)─► Next.js
  1. requeue_stale_notifications(now)    5분 넘게 sending인 것을 scheduled로
  2. claim_notifications(limit, now)     scheduled→sending 조건부 갱신. 마감 지난 것은 cancelled
  3. 각 건 NotificationSender.send()     1차-A: 알림함 노출(= 상태를 sent로)
  4. finish_notification(id, ok)         sent 또는 failed
```
두 번 호출돼도(동시 틱) 같은 알림을 두 번 집지 않는다 (규칙 9).

### 5.4 불합격·포기

`set_terminal_status` 한 번이 상태·이력·아직 안 지난 일정 중지·그 알림 취소를 모두 처리한다 `[승인 의존: D-38]`. 이미 지난 일정과 알림 기록은 그대로 둔다.

## 6. 시계 주입

```
서버/워커 시작 시: clock = SystemClock()  (유일한 Date.now()/datetime.now() 호출 지점)
라우트: const now = clock.now();  DB 함수에 p_now 로 전달;  today_kst = toKstDate(now)
시험:  clock = FixedClock('2026-10-13T00:00:00Z')  → 같은 입력은 항상 같은 결과
```
린트 규칙(ESLint/ruff)으로 `Date.now`, `new Date()`(인자 없음), `datetime.now`, `datetime.utcnow`를 금지하되 `clock.*` 파일만 예외로 둔다.

## 7. 오류 처리와 재시도 정책

| 위치 | 정책 |
|---|---|
| API → 화면 | `{code, message}` 고정 형식, 화면이 `code`로 문구 선택. 본문·내부 오류 미노출 |
| AI 호출 | 20초 제한, 실패 시 대기열로 되돌려 1번 재시도(attempts ≤ 2), 그래도 실패면 직접 입력 |
| 워커 정지 | `requeue_stale_extraction_jobs`(5분)로 되돌림 |
| 알림 | 5분 넘게 `sending`이면 되돌림, 실패는 `failed`로 남김 |
| 요청 중복 | 화면 비활성화 + `request_id` + DB 멱등 |
| 알 수 없는 오류 | 500, Sentry에 코드·경로만 (본문 제외) |

## 8. 품질 속성(비기능) 목표

번호는 명세서 AC-NFR이 확인된 것만 썼고, 숫자 목표는 **제안**이다.

| 속성 | 목표 | 확인 |
|---|---|---|
| 정확성(시간) | KST 날짜 경계에서도 D-Day·마감이 같음 (AC-NFR-04) | 경계 시험 |
| 보안 | 남의 자료 비노출 (AC-ACC-05), 키 비노출, 로그에 본문 없음 | API 시험, 로그 검색 |
| 안전한 AI 사용 | 공고 속 명령문 무시 (AC-NFR-03) | 워커 시험 |
| 호환성 | Android Chrome, iPhone Safari, PC Chrome/Edge (AC-NFR-05) | 수동 점검 |
| 삭제 | 종료 후 7일 안에 전체 삭제 (규칙 14, AC-NFR-08) | 삭제 시험 |
| 응답 속도 `[제안]` | 일반 조회 p95 < 1초, 공고 등록 응답 < 1초, 추출 보통 20초 안 | 시연 중 측정 |
| 가용성 `[제안]` | 훈련 규모: 별도 SLA 없음. AI 장애 시에도 직접 입력으로 완주 (UX P2) | AI 끈 시험 |
| 관측성 | 구조화 로그(경로·상태·소요), Sentry(본문 제외) | 로그 점검 |
| 접근성 | 키보드 완주, 터치 44px, 대비 AA (UX 8장) | 점검표 |
| 유지보수성 | strict TS, 타입 힌트, `any` 금지, 문서와 코드 같은 PR | 린트·리뷰 |

## 9. 환경과 배포

### 9.1 환경

| 환경 | 구성 | 용도 |
|---|---|---|
| 로컬 개발 | Next.js dev, Python 워커, 로컬 PostgreSQL(스텁) 또는 Supabase CLI(`supabase start`) | 개발·시험 |
| CI | Jenkins에서 DB 시험 + 서버·화면·워커 시험 + 린트·타입 검사 | 합치기 전 검증 |
| 시연 | 시연 PC 또는 임시 호스팅 `[확인 필요: 배포 위치]` | 발표 |

### 9.2 환경변수 (이름만. 값은 저장소에 두지 않는다)

| 이름 | 쓰는 곳 | 비밀 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저·서버 | 아니오(공개용) |
| `SUPABASE_SERVICE_ROLE_KEY` | Next.js 서버, 워커 | **예** |
| `SUPABASE_URL` | 서버, 워커 | 아니오 |
| `GEMINI_API_KEY` | 워커 | **예** |
| `CRON_KEY` | 틱 엔드포인트 | **예** |
| `AI_ENABLED` | 서버 | 아니오 |
| `SENTRY_DSN` | 서버, 워커 | 낮음 |
| `APP_ENV` | 전체 (`development`/`test`/`production`) | 아니오 |

`.env`는 커밋하지 않고 `.env.example`(키 이름만)을 커밋한다. 읽는 곳은 `env.ts`/`env.py` 한 파일뿐이다.

### 9.3 배포 후보(위치 미정)

| 후보 | 장점 | 단점 |
|---|---|---|
| 시연 PC에서 Docker 실행 | 외부 의존 없음, 확실 | 외부 접속 불가 |
| 임시 호스팅(웹) + Supabase 클라우드 + AI 서버 한 대 | 링크로 공유 | 키·비용·시간 필요 |

폴백: 로컬 실행을 기본 시연 방법으로 준비하고(`RUNBOOK.md`), 호스팅이 정해지면 같은 Docker 이미지를 올린다.

### 9.4 CI 파이프라인(Jenkins) 제안

1. 체크아웃 → 2. 린트·타입 검사 → 3. DB 시험(`supabase/run_local_check.sh`) → 4. Python 시험(날짜 13줄 포함) → 5. 웹 시험(단위·API) → 6. 빌드(Docker 이미지) → 7. 비밀 검색(`.env`, 키 패턴) → 8. 결과 보고.
Jenkins·Sentry 설정은 T-09, 배포 위치 결정 뒤.

## 10. 보안 경계 요약

상세는 `SECURITY_PRIVACY.md`. 신뢰 경계는 ① 브라우저 ↔ Next.js(세션 쿠키), ② Next.js/워커 ↔ DB(service_role 키), ③ 워커 ↔ Gemini(원문+지시문만), ④ 예약 작업 ↔ 틱 엔드포인트(`CRON_KEY`). 각 경계에서 입력을 검증하고, 안쪽으로 신뢰를 넘기지 않는다.

## 11. 열린 항목

| 번호 | 내용 | 임시 |
|---|---|---|
| ARC-1 | 배포 위치 | 로컬 Docker 시연 |
| ARC-2 | 예약 작업 방식(pg_cron vs 호스팅 크론) | 엔드포인트 방식 고정, 호출 주체만 교체 |
| ARC-3 | Supabase 로컬에서 마이그레이션·트리거(`auth.users`) 검증(G-5) | `supabase db reset` 확인 필요 |
| ARC-4 | 단계 기본 이름 | 서류/면접/최종 (P-11) |
