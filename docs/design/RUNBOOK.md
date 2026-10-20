# 런북 (실행 · 시험 · 배포 · 운영 · 삭제)

상태: **제안 / 일부 `[확인 필요]`**. 웹·AI 서버의 명령은 T-00(저장소 골격)이 끝나야 정해진다. DB 명령과 운영 절차는 지금 쓸 수 있다. `[확인 필요]`가 남은 칸은 T-00 PR에서 채우고 `AGENTS.md` §11 표와 같은 값으로 맞춘다.

---

## 1. 준비물

| 도구 | 용도 | 비고 |
|---|---|---|
| Node.js, npm | 웹, 스크립트 | Node 24 이상, npm 11 (24.18.0으로 확인) |
| Python 3, pip | AI 서버 | 3.12 이상 (3.12.10으로 확인). `npm run setup:ai`가 `services/ai/.venv`를 만든다 |
| PostgreSQL 16 (또는 Docker) | DB 시험 | `supabase/run_local_check.sh`가 필요 |
| Supabase CLI | 로컬 Supabase (`supabase start`) | G-5 확인용 |
| Docker | 이미지 빌드·실행 | T-09 |

## 2. 명령 표 (AGENTS.md §11과 같은 값을 쓴다)

| 용도 | 명령 |
|---|---|
| 설치 | `npm run setup` (웹 `npm ci` + AI venv·pip. 각각: `setup:web`, `setup:ai`) |
| 실행(웹) | `npm run dev:web` |
| 실행(AI 워커) | `npm run dev:ai` |
| 테스트 | `npm test` (= `test:web` + `test:ai` + `test:db`; DB는 `supabase/run_local_check.sh`를 호출만 한다) |
| 린트·타입 | `npm run lint` (= `lint:web` + `lint:ai`) |
| DB 마이그레이션 | `npm run db:migrate` (안내만 출력). 실제 적용: 로컬 `supabase db reset` / 시험용 `run_local_check.sh` |
| 데이터 사전 다시 만들기 | `python3 -I supabase/make_data_dictionary.py` (DB 접속 환경변수 필요) |
| ERD 다시 그리기 | `python3 supabase/make_erd.py docs/erd_phase_a.svg` |

## 3. DB 시험 실행

```bash
# 일반 PostgreSQL (스텁으로 Supabase auth를 흉내)
export PGHOST=<소켓 또는 호스트> PGPORT=<포트> PGUSER=<사용자>
./supabase/run_local_check.sh        # 맨 끝에 ALL PASSED 가 나와야 한다 (현재 209개)
```
- 순서: `tests/00_supabase_stub.sql` → `migrations/*.sql` → `tests/10_*.sql`, `20_*`, `30_*`.
- 실패하면 어느 시험인지 `FAIL [이름]`이 나온다. 이름의 AC/ERD 번호로 문서를 찾는다.
- **Supabase 로컬 확인 (G-5)**: `supabase start` → `supabase db reset` 이 오류 없이 끝나는지, `auth.users` 트리거(0003)가 동작하는지 확인하고 결과를 PR에 적는다.

## 4. 개발 중 실행 순서 (로컬)

1. DB: `supabase start` (또는 로컬 PostgreSQL) → 마이그레이션 적용.
2. 환경값: 저장소 루트에서 `.env.example`을 복사해 `.env` 작성(커밋 금지). 키 이름은 `ARCHITECTURE.md` §9.2. `dev:web`·`dev:ai`가 루트 `.env`를 읽는다.
3. 웹 실행.
4. AI 워커 실행. 키가 없으면 모의 AI로(`AI_ENABLED`와 별개로 워커의 클라이언트 선택 환경값 `[확인 필요: T-02]`).
5. 알림 틱: 1분마다 `POST /api/internal/notifications/tick` (헤더 `x-cron-key`). 로컬에서는 아래 한 줄 반복.
   ```bash
   while true; do curl -s -X POST -H "x-cron-key: $CRON_KEY" http://localhost:3000/api/internal/notifications/tick; sleep 60; done
   ```

## 5. 시연 모드 (시계 앞당기기) `[제안]`

알림을 시연에서 보여 주려면 실제로 마감 하루 전까지 기다릴 수 없다. 개발/시연 환경에서만 시계를 고정·이동할 수 있게 한다.
- 환경값 `CLOCK_NOW_OVERRIDE`(ISO 시각)이 있으면 `SystemClock`이 그 시각을 돌려준다. **`APP_ENV=production`에서는 이 값을 무시하고 기동 시 오류를 낸다.**
- 이 기능은 `clock.ts`/`clock.py` 한 곳에만 있다(코드 어디에서도 직접 현재 시각을 읽지 않는 규칙 덕분).
- 순서: 마감이 모레인 지원 건 만들기 → `CLOCK_NOW_OVERRIDE`를 마감 1일 전 직후로 → 서버 재시작 → 틱 호출 → 알림함에 "마감 1일 전" 표시.

## 6. 시연용 가짜 데이터 `[T-09]`

`scripts/seed_demo.*`가 하는 일(모두 가짜 이름):
1. 시연용 비회원 사용자 만들기(또는 시연 중 직접 시작).
2. 가짜 공고 5건(`fixtures/postings/`)을 등록해 각 상황(마감+시각 / 날짜만 / 후보 2개 / 마감 없음 / 이모지·주입)을 만든다.
3. 기존 시연 데이터 초기화 옵션(`--reset`): 시연용 사용자에 `delete_user_data`.
실제 이름·이메일·공고 원문을 쓰지 않는다.

## 7. 배포 `[확인 필요: 배포 위치 — ISS-07]`

배포 위치가 정해지면 아래를 채운다. 그 전의 기본 시연은 **로컬 Docker**.

| 단계 | 내용 | 상태 |
|---|---|---|
| 이미지 | `apps/web`, `services/ai` 각각 Dockerfile | T-09 |
| 환경값 | 배포 위치의 비밀 저장소에 `ARCHITECTURE.md` §9.2의 값 등록 | 미정 |
| DB | 호스팅 Supabase에 `migrations/*.sql` 순서대로 적용 (`supabase db push`) | 미정 |
| 예약 작업 | 호스팅 크론 또는 pg_cron으로 1분마다 틱 호출 | 미정 |
| 확인 | 배포 후 인수 체크리스트 §2 (`ACCEPTANCE_DEMO.md`) 중 핵심 5개 | — |

배포 체크: ① `.env`/키가 이미지·저장소에 없다 ② `APP_ENV=production` ③ `CLOCK_NOW_OVERRIDE` 없음 ④ 쿠키 `Secure` ⑤ `/dev/states` 비활성.

## 8. 롤백

- **웹/워커**: 이전 이미지 태그로 되돌린다.
- **DB**: 마이그레이션은 앞으로만(down 없음). 잘못 적용했으면 **새 번호의 보정 마이그레이션**을 만든다. 시연 DB는 `supabase db reset`으로 처음부터 다시 만들어도 된다(가짜 데이터라서).
- 데이터를 되돌릴 일이 생기면 시연용 사용자 삭제 후 `seed_demo`.

## 9. 모니터링·로그

| 보는 것 | 어디서 | 정상 |
|---|---|---|
| 오류 | Sentry (본문 제외) | 새 오류 없음 |
| 틱 응답 | 예약 작업 로그 | 1분마다 200, `claimed ≥ 0` |
| AI 큐 | `extraction_jobs`에서 `status='processing'` 오래된 행 | 없음(5분 넘으면 복구됨) |
| 알림 | `notifications`에서 `status='sending'` 오래된 행 | 없음 |

운영 쿼리(읽기 전용, service_role로 실행 — 결과에 공고 원문 칸을 포함하지 않는다):
```sql
-- 오래 처리 중인 추출 작업
select id, status, attempts, started_at from extraction_jobs
 where status = 'processing' and started_at < now() - interval '5 minutes';
-- 보낼 때가 지났는데 아직 예약인 알림
select id, kind, scheduled_at, status from notifications
 where status = 'scheduled' and scheduled_at < now() - interval '5 minutes';
```
(운영 쿼리에서 `now()`를 쓰는 것은 코드가 아닌 사람의 점검이라 허용한다. 코드에서는 금지.)

## 10. 장애 대응표

| 증상 | 가능한 원인 | 확인 | 조치 |
|---|---|---|---|
| 공고가 계속 "분석 중" | 워커가 안 돈다 / 키 없음 | 워커 로그, `extraction_jobs` | 워커 재시작. 60초 후 화면의 "직접 입력으로 바꾸기" 사용. 5분 뒤 `requeue_stale_extraction_jobs`가 되돌림 |
| 모든 추출이 "찾지 못함" | Gemini 오류/형식 변경 | `ai_call_logs.outcome` 분포 | 모의 AI 전환 또는 직접 입력으로 시연 |
| 알림이 안 온다 | 틱이 안 돈다 / `CRON_KEY` 불일치 | 예약 작업 로그 | 키 확인, 수동 틱 호출 |
| 알림이 두 번 온다 | (발생하면 S1) | `notifications.dedupe_key`, `claim_notifications` | 즉시 이슈 기록, DB 함수 시험 재현 |
| 확정했는데 마감이 "정보 없음" | G-6 (후보 미선택) | `extracted_fields` 후보 / 선택 | 0004 적용 여부 확인, 공고 마감 수정 |
| 남의 자료가 보임 | (발생하면 S1) | API 소유자 확인 코드 | 즉시 차단, 이슈, 키 점검 |
| D-Day가 하루 어긋남 | 시간대 | 서버 `TZ`, `today_kst` | `today_kst`와 DB `Asia/Seoul` 계산 확인 |
| `supabase db reset` 실패 | 스텁/로컬 차이(G-5) | 오류 메시지의 마이그레이션 번호 | 보정 마이그레이션 |

## 11. 삭제 절차 (훈련 종료 후 7일 안 — 규칙 14, AC-NFR-08)

담당: 개발자 A, 기한 달력에 등록(훈련 종료일 + 7일). PM이 완료를 확인한다.

1. **대상 확정**: 시연·시험으로 만들어진 모든 사용자(전부 가짜 데이터). 목록을 만든다(사용자 id만, 내용 제외).
2. **파일 먼저**: 사용자마다 `list_user_image_paths(user_id)` → 나온 경로의 Storage 파일을 모두 삭제. 하나라도 실패하면 **그 사용자의 DB 삭제를 하지 않고 멈춘다.**
3. **DB**: 사용자마다 `delete_user_data(user_id)` (하위 표 연쇄 삭제).
4. **인증 계정**: Supabase 관리 기능으로 `auth.users` 삭제.
5. **확인**: 모든 표의 행 수가 0인지, Storage 폴더가 비었는지 세어 기록한다 (시험 `AC-NFR-08`과 같은 항목).
6. **백업**: 호스팅 Supabase의 백업 보관 기간을 확인하고 필요하면 PM과 협의 `[확인 필요]`.
7. **기록**: 날짜, 수행자, 확인 결과를 `DECISION_LOG.md` 이슈에 남긴다. 사용자 id는 적지 않는다.

삭제 스크립트는 `scripts/delete_all_training_data.*` (T-09). 실행 전 "대상 목록 개수"를 출력하고 확인을 받는다.

## 12. 문서 재생성

| 문서 | 언제 | 방법 |
|---|---|---|
| `DATA_DICTIONARY.md` | 마이그레이션이 바뀔 때 | `python3 -I supabase/make_data_dictionary.py` |
| ERD 그림 | 표/연결이 바뀔 때 | `make_erd.py` |
| `REQUIREMENTS_TRACE.md` | FR/AC/화면/API가 바뀔 때 | 손으로. PR 점검 항목 |
