# TASKS.md — Cursor 과업 지시서 (1차-A, 순차 진행)

이 파일은 Cursor(또는 다른 코딩 에이전트)가 위에서부터 **한 번에 한 과업씩** 진행하기 위한 지시서다.
먼저 `AGENTS.md`를 읽고, 문서와 이 파일이 다르면 문서가 우선이며 다른 점은 PR에 적는다.
상태: 제안. 회의 결과(D-29·30·31·38·40 승인, 최종 범위·팀, 배포 위치, 입력 경로)가 오면 바뀔 수 있다.
기한: 오늘 10/14, 개발일 10/13~10/15, **기능 동결 10/16**, 발표·시험 늦어도 10/19.

---

## 0. 작업 규칙 (모든 과업에 적용)

1. **한 과업 = 한 브랜치 = 작은 PR 여러 개.** 과업 번호(T-xx)와 FR/AC/D 번호를 브랜치·커밋·PR 제목에 쓴다. 예: `T-01 FR-JOB-06 AC-JOB-04 날짜 정리`
2. **시험이 먼저.** 각 과업의 "시험" 항목을 먼저 쓰고, 통과하는 구현을 쓴다. 시험 이름에 AC 번호를 넣는다.
3. **완료 조건을 전부 통과해야 다음 과업으로 간다.** 하나라도 못 하면 멈추고 "질문 기록"(맨 아래)에 적는다. 추측해서 메우지 않는다.
4. **범위 밖 금지.** 1차-B(JOB-02, JOB-15 등)·2차·제외 항목, 관리자 화면, 자동 수집, 푸시는 만들지 않는다.
5. **`[승인 의존]`.** D-29·30·31·38·40에 기대는 코드에는 주석 `// [승인 의존: D-xx]`(Python은 `# [승인 의존: D-xx]`)를 단다.
6. **DB는 불변 원칙.** 이미 적용된 `supabase/migrations/0001_init_phase_a.sql`은 고치지 않는다. 바꿀 일이 있으면 `0002_*.sql`부터 새 파일로 추가하고 이유를 PR에 적는다. 기존 시험(`supabase/tests/10_schema_tests.sql`)은 계속 통과해야 한다.
7. **여러 표를 바꾸는 처리는 DB 함수 한 번 호출**(AGENTS.md 규칙 10). API에서 표를 여러 번 나눠 쓰지 않는다.
8. **현재 시각은 주입.** 코드에서 `now()`·`Date.now()`·`datetime.now()`를 직접 부르지 않는다. 시계 객체를 한 곳에서 만들어 넘긴다. DB 함수에는 `p_now`로 넘긴다.
9. **환경값은 한 파일에서만 읽는다.** 키는 서버 환경변수에만 둔다. `.env`는 커밋하지 않는다. 로그에 공고 본문·비밀값·푸시 주소를 남기지 않는다.
10. **테스트 데이터는 가짜만.** 실제 이름·이메일·공고 원문을 쓰지 않는다.
11. 10/16 이후에는 새 기능을 넣지 않는다.

각 과업을 끝낼 때마다 이 파일의 해당 체크박스를 `[x]`로 바꾸고, 바꾼 파일 목록과 남은 위험을 PR 본문에 적는다.

---

## 1. 지금 있는 것 (이미 끝난 것)

| 위치 | 내용 |
|---|---|
| `supabase/migrations/0001_init_phase_a.sql` | 테이블 12개, enum, 제약, 색인, RLS(읽기만), DB 함수 |
| `supabase/tests/10_schema_tests.sql` | 스키마·함수 시험 134개 (로컬 PostgreSQL 16에서 통과) |
| `supabase/run_local_check.sh` | 로컬 DB에 적용하고 시험을 돌린다. Supabase 로컬이 아닌 일반 PostgreSQL 기준(`tests/00_supabase_stub.sql`이 auth를 흉내 냄) |
| `docs/erd_phase_a.png`, `.svg` | ERD 그림 |
| `fixtures/date_normalization_cases.json` | 날짜 정리 시험표 13줄 |
| `AGENTS.md` | 규칙 |

### 1.1 DB 함수 (API·워커는 이것을 부른다)

모든 함수는 `service_role`만 실행할 수 있다. 화면(anon/authenticated)이 직접 부르지 않는다. 마지막 인자 `p_now`는 주입한 시계의 현재 시각이다.

| 함수 | 하는 일 | 돌려주는 것 |
|---|---|---|
| `create_posting_with_job(p_user_id, p_request_id, p_raw_text)` | 공고 등록 + AI 작업 대기열. 같은 request_id는 1건만. AI 동의가 없으면 작업 없이 "확인 필요" | 공고 id |
| `claim_extraction_job(p_now)` | 작업 1건 집기(대기→처리 중, attempts+1) | 0행 또는 1행 |
| `save_extraction_result(p_job_id, p_fields jsonb, p_now)` | 결과 저장. 작업이 "처리 중"일 때만 | true / false(취소된 작업) |
| `fail_extraction_job(p_job_id, p_error_code, p_now)` | 실패 처리. 2번 미만이면 다시 대기, 아니면 실패 + 직접 입력 | 새 작업 상태 |
| `cancel_extraction_job(p_user_id, p_posting_id, p_now)` | 사용자가 직접 입력으로 바꿈 | — |
| `confirm_posting(p_user_id, p_posting_id, p_positions text[], p_now)` | 공고 확정. 이 시점까지 일정·알림은 0건 | — |
| `create_application(p_user_id, p_posting_id, p_position, p_now[, p_stage_names])` | 지원 건 + 단계 + 마감 일정 + 마감 알림 + 첫 이력. 이미 있으면 기존 건 | 지원 건 id |
| `set_submitted(p_user_id, p_application_id, p_now)` | 제출 완료 | — |
| `record_stage_result(p_user_id, p_application_id, p_stage_id, p_result, p_confirm_final, p_now)` | 단계 결과(`passed`/`failed`). 마지막 단계 합격은 `p_confirm_final=true`여야 함 | — |
| `set_terminal_status(p_user_id, p_application_id, p_status, p_now)` | 불합격·포기 `[승인 의존: D-38]` | — |
| `update_confirmed_deadline(p_user_id, p_posting_id, p_date, p_time, p_now)` | 확정 공고의 마감 수정 | — |
| `claim_notifications(p_limit, p_now)` | 보낼 때가 된 알림 집기(예약→발송 중). 마감이 지난 것은 취소 | 집힌 행들 |
| `finish_notification(p_id, p_ok)` | 발송 결과 기록 | true / false |
| `requeue_stale_notifications(p_now)` | 5분 넘게 "발송 중"인 알림을 예약으로 | 되돌린 수 |
| `list_user_image_paths(p_user_id)`, `delete_user_data(p_user_id)` | 삭제 절차(파일 먼저, 그다음 DB) | — |

**오류 코드**(예외 메시지): `not_found`(남의 자료도 같음 → API는 404 "찾을 수 없음"), `still_extracting`, `required_missing`, `position_required`, `unreviewed_fields`, `posting_not_confirmed`, `position_not_confirmed`, `invalid_state`, `invalid_status`, `already_terminal`, `stage_not_in_progress`, `invalid_result`, `confirm_final_required`, `time_without_date`, `raw_text_immutable`. 모르는 오류는 500으로 두고 상세를 로그에 남기지 않는다.

### 1.2 알려진 빈틈 (T-03b에서 메운다)

| 번호 | 빈틈 | 제안 |
|---|---|---|
| G-1 | `confirm_posting`은 `job_postings.company_name/title`이 채워져 있어야 통과하는데, AI가 찾은 기업명·공고명을 이 칸으로 옮기는 곳이 없다 | `save_extraction_result`가 `field in ('company','title')`이고 `value_status='has_value'`인 값을 `job_postings`의 빈 칸에 미리 채운다. 사용자가 고치면 API가 두 곳을 함께 갱신한다 |
| G-2 | 비회원 로그인(Supabase Auth)을 하면 `auth.users`만 생기고 `public.users` 행이 없다 | `auth.users` insert 뒤 `public.users`를 만드는 트리거를 `0002`에 추가한다 |
| G-3 | 워커가 죽어 "처리 중"에 멈춘 추출 작업을 되돌리는 정리가 없다 | `requeue_stale_extraction_jobs(p_now, p_minutes)` 추가(기본 5분). 알림 정리와 같은 주기로 부른다 |
| G-4 | 사용자가 확인 창에서 값을 고치는 쓰기(`extracted_fields`, `posting_edits`, `job_postings.company_name/title`)에는 DB 함수가 없다 | 먼저 `user_id` 조건을 항상 붙인 서비스 코드로 쓰고(T-04), 여러 표를 건드리면 DB 함수로 옮긴다 |
| G-5 | `supabase/run_local_check.sh`는 일반 PostgreSQL용이다. Supabase 로컬(`supabase start`)에서는 `auth` 스키마가 이미 있어 `00_supabase_stub.sql`이 충돌할 수 있다 | 둘 다 돌아가게 스텁을 `create ... if not exists`로 유지하고, Supabase 로컬에서 `supabase db reset`이 통과하는지 확인해 결과를 PR에 적는다 |

---

## 2. 저장소 구조 (제안 — AGENTS.md §4 "디렉터리 구조 [확인 필요]"를 채운다)

```
/
├─ AGENTS.md, TASKS.md
├─ apps/web/            Next.js + TypeScript (PWA, API 라우트)
│   ├─ src/lib/clock.ts        시계 주입 (한 곳)
│   ├─ src/lib/env.ts          환경값 (한 곳)
│   ├─ src/server/             서버 전용: DB 호출, 소유자 확인, 오류 변환
│   └─ src/app/                화면과 API 라우트
├─ services/ai/         Python AI 서버 (작업 큐 워커)
│   ├─ app/clock.py, app/env.py
│   ├─ app/normalize/          날짜 정리 (순수 함수)
│   └─ tests/
├─ supabase/            migrations/, tests/, run_local_check.sh
├─ fixtures/            공유 시험 자료 (날짜 시험표)
└─ docs/                ERD 그림, 결정 기록
```

바꾸고 싶으면 T-00에서 바꾸고 AGENTS.md §4·§11에 반영한다.
**한 가지 결정을 제안한다**: 날짜 정리(T-01)는 Python AI 서버에 둔다. 이유는 AI 서버가 `save_extraction_result`를 직접 부르기 때문에, 인용문 검증 → 정리 → 저장이 한 프로세스 안에서 끝나야 D-31(검증 후 정규화)이 지켜지기 때문이다. 시험표는 JSON이라 언어와 무관하다. 팀이 TypeScript로 몰고 싶다면 질문 기록에 적고 PM 확인 후 옮긴다.

---

## 3. 과업 (순서대로)

범례: 🔴 먼저 끝내야 다른 것이 풀린다 · 🟡 1단계 필수 · 🟢 2단계(시간이 되면)

### [ ] T-00 저장소 골격과 도구 🔴 (목표 1시간)

- **만든다**: 위 구조, Next.js(TS strict, `any` 금지), Python(타입 힌트, `mypy --strict` 또는 `pyright`), 시계 주입(`clock`)과 환경값(`env`) 모듈 각 한 곳, 린트·포맷·시험 명령.
- **AGENTS.md §11 표를 실제 명령으로 채운다**: 설치, 실행, 테스트, 린트, DB 마이그레이션.
- **하지 않는다**: Docker·Jenkins·Sentry 설정(T-09), 화면, DB 변경.
- **시험**: `clock`을 고정 시계로 바꾸면 시험에서 현재 시각이 고정된다(ESLint/ruff 규칙으로 `Date.now`·`datetime.now` 직접 호출이 린트 오류가 되게 한다).
- **완료**: 명령 5개가 실제로 돌고, 빈 시험 1개씩이 통과한다. `.env.example`만 커밋된다.

### [ ] T-03b DB 보강 🔴 (목표 1.5시간)

- **읽는다**: 위 1.2의 G-1~G-5, `supabase/migrations/0001_init_phase_a.sql`.
- **만든다**: `0002_gaps.sql` — G-1(미리 채우기), G-2(트리거), G-3(정리 함수). 시험을 `supabase/tests/20_gap_tests.sql`에 추가한다.
- **시험(AC 번호 붙임)**: ① 추출 결과 저장 뒤 `job_postings.company_name/title`이 채워지고, 이미 있는 값은 덮어쓰지 않는다 ② `auth.users`에 행을 넣으면 `public.users`에 행이 생긴다(비회원) ③ 5분 넘게 "처리 중"인 작업이 "대기"로 돌아가고 attempts는 유지된다 ④ 기존 134개 시험이 그대로 통과한다.
- **하지 않는다**: 0001 수정, 테이블·칸 이름 바꾸기.
- **완료**: `supabase/run_local_check.sh`가 `ALL PASSED`. G-5 결과를 PR에 적는다.

### [ ] T-01 날짜 정리 규칙 🔴 (FR-JOB-06, AC-JOB-04, D-31) (목표 2시간)

- **근거**: `fixtures/date_normalization_cases.json`(13줄), 명세서 v0.8 4.2.
- **만든다**: `services/ai/app/normalize/` — 입력 `(quote: str, registered_on: date)` → 출력 `Deadline(kind, date, time, time_status, year_estimated, candidates)`. **순수 함수**(시계·네트워크·DB 없음). 날짜 경계는 Asia/Seoul. 24:00과 "자정"은 그날 23:59. 범위("A ~ B")는 끝 날짜가 마감. 연도가 없으면 등록일 기준 "그 날짜가 지났으면 다음 해"로 두고 `year_estimated=True`.
- **규칙**: 시각이 없으면 `time=None`, `time_status="time_unconfirmed"`. 임의 시각(예 09:00)을 넣지 않는다. 해석하지 못하면 `kind="unparsed"`로 두고 값을 비운다. 후보가 2개 이상이면 `multiple_candidates`로 모두 돌려주고 하나를 자동으로 고르지 않는다.
- **시험**: JSON 13줄을 그대로 테스트로 옮긴다(`test_AC_JOB_04_case_01` … `_13`). 추가로 윤년 2/29, 12/31→1/1 경계, 등록일이 UTC 자정 직전·직후인 경우.
- **하지 않는다**: AI 호출, DB 쓰기, 연도 추정의 세부 규칙을 문서와 다르게 정하기(13줄로 안 풀리면 질문 기록).
- **완료**: 13줄 + 추가 시험 통과, 린트·타입 검사 통과.

### [ ] T-02 AI 추출 워커 🟡 (FR-JOB-03·04·05, AC-JOB-05~07·11, AC-NFR-03, D-31) (목표 3시간)

- **선행**: T-00, T-03b, T-01.
- **만든다**: `services/ai/` 워커 루프 — `claim_extraction_job` → Gemini 호출 → 응답 검증 → T-01 정리 → `save_extraction_result`. 실패는 `fail_extraction_job`.
- **Gemini 호출은 인터페이스 뒤에 둔다**(`ExtractionClient`). 처음에는 **모의 구현**으로 시험하고, 키가 준비되면 실제 구현을 붙인다. 실제 호출 시험은 가짜 공고 샘플 5건으로 한다.
- **AI에게 요구하는 출력**: 항목별 `{field, quote, span_start, span_end}`만(기업명, 공고명, 직무 여러 개, 마감 후보 여러 개, 자격 요건 필수/우대). **날짜·시각 값을 AI가 만들게 하지 않는다.** span은 UTF-16 코드 단위.
- **검증(정리보다 먼저)**: `raw_text`를 UTF-16으로 보고 `[span_start:span_end]`가 `quote`와 같은지 확인. 다르면 그 항목은 `value_status='none'`으로 저장(AC-JOB-11). 값은 서버가 만든다.
- **프롬프트 주입 방어**: 공고 안의 명령문은 데이터로 취급한다. AI에는 공고 원문과 지시문만 보낸다. 사용자 이메일·번호 같은 계정 정보를 보내지 않는다.
- **로그**: 공고 본문을 남기지 않는다. `ai_call_logs`에는 시도 번호, 결과(outcome), 지연 시간, 토큰 수만 쓴다.
- **시험**: ① 모의 AI가 원문에 없는 글자를 주면 "정보 없음" ② "10월 15일 오후 6시"를 정확한 위치로 주면 `2026-10-15 18:00`으로 정리됨 ③ AI를 일부러 실패시키면 1번만 다시 시도하고 직접 입력으로 넘어감(AC-JOB-07) ④ "이전 지시를 무시하고…"가 앞·중간·끝에 들어간 공고 3건이 다른 공고와 같은 형식으로 추출됨(AC-NFR-03) ⑤ 이모지가 섞인 원문에서 UTF-16 위치가 맞는다.
- **하지 않는다**: URL 가져오기(`FR-JOB-02`는 안전 규칙 확정 전 금지), 이미지 인식, 사용자별 한도.
- **완료**: 위 시험 통과. 워커를 로컬에서 켜 두고 DB에 공고를 넣으면 `needs_review`와 `extracted_fields`가 생긴다.

### [ ] T-04 공고·확정·지원 건 API 🟡 (FR-JOB-01·05~11, FR-APP-01·02, AC-JOB-01·03·05·10, AC-APP-01, AC-ACC-05) (목표 3시간)

- **선행**: T-03b. T-02와 병행 가능하지만 한 명이면 T-02 뒤.
- **만든다**: `apps/web/src/app/api/**` 라우트와 `src/server/` — 비회원 로그인과 동의 기록(`consents`), 공고 등록(`create_posting_with_job`, 화면이 만든 `request_id`), 상태 조회(폴링), 확인 창 값 고치기(G-4), 마감 후보 고르기(`is_selected`), 직접 입력으로 바꾸기(`cancel_extraction_job`), 확정(`confirm_posting`), 지원 건 만들기(`create_application`).
- **소유자 확인**: 모든 라우트가 인증된 사용자 id를 서버에서 꺼내 DB 호출에 넘긴다. 요청 본문의 `user_id`를 믿지 않는다. 남의 자료·없는 자료는 모두 404 `찾을 수 없음`(존재 여부를 알려주지 않음).
- **오류 변환**: 1.1의 오류 코드를 일관된 JSON(`{code, message}`)으로 바꾼다. 메시지에 공고 본문을 넣지 않는다.
- **시험**: ① 같은 `request_id` 3번 → 공고 1건(AC-JOB-05) ② 확정 전 일정·알림 0건 ③ 남의 공고 id로 모든 라우트를 호출하면 404이고 응답이 없는 id와 같다(AC-ACC-05, 하위 데이터 포함) ④ 확정 안 한 공고로 지원 건 생성 거부 ⑤ 같은 조합 2번 → 지원 건 1건(AC-APP-01).
- **하지 않는다**: URL·이미지 입력, 2단계 항목(JOB-12 공고 수정 포함은 T-04 뒤 별도).
- **완료**: 시험 통과, 라우트별 입력 검증, 로그에 본문 없음 확인.

### [ ] T-05 상태·결과·불합격 처리 🟡 (FR-APP-03·05·06, FR-SCH-01, AC-APP-07, D-30·38) (목표 2시간)

- **선행**: T-04.
- **만든다**: 제출 완료(`set_submitted`), 단계 결과(`record_stage_result`, 마지막 단계는 확인 후 `p_confirm_final=true`), 불합격·포기(`set_terminal_status`) `[승인 의존: D-38]`, 확정 공고 마감 수정(`update_confirmed_deadline`).
- **규칙**: 최종 합격 전에는 반드시 사용자에게 "최종 합격" 확인을 받는다(서버가 `confirm_final_required`를 돌려줌). 중지된 일정과 취소된 알림이 응답에 드러나게 한다.
- **시험**: AC 번호를 붙여 `supabase/tests/10_schema_tests.sql`의 해당 시나리오를 API 수준으로 다시 확인(상태 이력의 마지막 행 = 지원 상태, "진행 중" 단계는 최대 1개).
- **완료**: 시험 통과, API 오류 변환 일관.

### [ ] T-06 알림 만들기·집기·보내기 🟡 (FR-NTF-01~03, AC-NTF-01·03·06·07, 규칙 7·9) (목표 2시간)

- **선행**: T-04.
- **만든다**: 1분마다 도는 예약 작업(Supabase 예약 또는 Next.js 크론 라우트 + 보호 키): `requeue_stale_notifications(p_now)` → `claim_notifications(limit, p_now)` → 각 건 처리 → `finish_notification(id, ok)`. **1차-A에는 푸시가 없다.** "보냄"은 알림함에 보이는 상태로 바꾸는 것이다(`FR-NTF-03`, `read_at`으로 읽음 처리). 푸시(1차-B)를 붙일 자리는 인터페이스(`NotificationSender`)로 남긴다.
- **규칙**: 두 번 집히면 안 된다(조건부 갱신은 DB가 보장). 마감 알림만. 시각이 있으면 1일 전·1시간 전, 시각 미확인이면 전날 09:00 한 번(DB가 만든다). 마감이 지난 알림은 보내지 않고 취소됨.
- **시험**: 시계를 고정하고 ① 집기 1회째 N건, 2회째 0건 ② 마감 후 호출 시 취소됨 ③ 5분 지난 "발송 중"이 되살아남 ④ 예약 작업 엔드포인트는 보호 키 없이 호출하면 거부.
- **하지 않는다**: 푸시 구독·전송, 알림 묶기(NTF-07), 발표 당일 알림.
- **완료**: 시험 통과, 로컬에서 시계를 앞으로 돌려 알림이 알림함에 나타남.

### [ ] T-07 공고 등록·확인·확정 화면 🟡 (FR-JOB-01·05·06·07·09·10·11, FR-ACC-02·07, AC-JOB-01·03, AC-ACC-08) (목표 3시간)

- **선행**: T-04. 화면 와이어프레임이 오면 그에 맞춘다(없으면 `docs/디자인 규칙` 원칙만 지키고 최소 구성).
- **만든다**: S-01 시작·동의(이용·개인정보·AI), S-04 공고 붙여넣기, S-05 공고 확인(추출 진행 상태, 항목별 값, **원문 근거 보기**), S-06 확정(마감 후보 고르기, 직무 선택).
- **화면 규칙(디자인 규칙 요약)**: 확정 전 값에는 "확인 전" 배지, 시각이 없으면 "시각 미확인", 연도를 추정했으면 "연도를 추정했어요", 근거 글자는 원문에서 강조하고 그 위치로 스크롤, 값이 없으면 "정보 없음"(빈칸을 임의 값으로 채우지 않음). 상태는 색만으로 구분하지 않고 글자를 함께 쓴다. 확정 버튼은 누른 직후 비활성화(request_id).
- **시험(컴포넌트·E2E 1~2개)**: ① 붙여넣기 → 폴링 → 확인 창에 값 표시 ② 시각 미확인 표시 ③ 확정 후 지원 건이 만들어짐.
- **하지 않는다**: URL·이미지 입력 UI, 관리자 화면, 색·글꼴 시안 작업(규칙 문서만 따름).
- **완료**: 가짜 공고로 "붙여넣기 → 확인 → 확정 → 지원 건"이 화면에서 끝까지 된다.

### [ ] T-08 홈·일정·알림함·지원 상세 화면 🟡/🟢 (FR-HOME-01·02, FR-APP-03·05·06, FR-SCH-04, FR-NTF-03, AC-HOME-01·02, AC-NFR-04) (목표 3시간)

- **선행**: T-04~T-06.
- **1단계(필수)**: HOME-01 곧 마감(오늘~3일 뒤, 미제출), HOME-02 확인할 공고, SCH-04 일정 목록(날짜순, D-Day, 시각 미확인 표시), NTF-03 알림함, 지원 건 제출 완료 처리·결과 입력의 최소 화면.
- **2단계(🟢, 시간이 되면)**: 지원 상세 전체, HOME-03~06, JOB-12 공고 목록, APP-04·07, SCH-02·03.
- **규칙**: D-Day는 한국 날짜 기준. 시각 미확인 일정은 마감일 다음 날 00:00 KST에 "마감". 서버 시간대가 UTC여도 같은 결과.
- **시험**: 시계 고정으로 D-Day 경계(자정 전후), "곧 마감" 목록, 중지된 일정 표시.
- **완료**: 홈에서 "곧 마감" → 지원 건 → 제출/결과까지 이어진다.

### [ ] T-09 마무리 (10/16 이후는 버그 수정만) 🟡 (목표 2시간)

- **만든다**: 삭제 절차(파일 목록 조회 → 서버가 Storage 파일 삭제 → `delete_user_data`, 실패하면 멈춤), 로그 점검(본문·비밀값 없음 검색), Dockerfile(web, ai), 환경변수 목록 문서화, 시연용 가짜 데이터 스크립트. Sentry·Jenkins는 배포 위치가 정해진 뒤.
- **시험**: 삭제 후 모든 표 0행, 파일 0개(AC-NFR-08).
- **완료**: 전체 시험 통과, `docs/RUNBOOK.md`에 실행·시험·배포 명령.

---

## 4. 막혔을 때 (자르는 순서)

10/15 17시에 아래가 안 끝났으면 위에서부터 자른다.
1. T-08의 2단계 전부
2. T-08 1단계에서 지원 상세 화면(제출·결과는 목록에서 바로 처리)
3. T-05의 마감 수정 화면(API만 둔다)
4. 절대 자르지 않는다: T-01, T-02, T-04, 확정 화면(T-07), 알림 집기(T-06)

## 5. 문서 쪽에서 곧 올 것 (Cursor는 기다리지 말고, 오면 반영)

| 문서 | 영향받는 과업 |
|---|---|
| 화면 와이어프레임(S-01~S-10) | T-07, T-08 |
| API 명세 | T-04~T-06 (없으면 1.1과 위 과업 설명으로 진행) |
| 회의 결과 반영본(v1.1) | `[승인 의존]` 표시된 코드 전부 |

## 6. 질문 기록 (모르면 여기에 적고 멈춘다. 추측 금지)

| 번호 | 과업 | 질문 | 답 | 날짜 |
|---|---|---|---|---|
| Q-01 | T-01 | 연도 추정 규칙(등록일 이전이면 다음 해)을 명세서 4.2 본문과 대조 | | |
| Q-02 | T-01 | 날짜 정리를 Python에 두는 제안(2장)을 팀이 받아들이는가 | | |
| Q-03 | T-06 | 1차-A의 "발송"을 알림함 노출로 보는 해석이 맞는가 | | |
| Q-04 | T-00 | 배포 위치가 정해지면 Docker·Sentry·Jenkins 설정을 어디서 시작하는가 | | |
| Q-05 | T-00 | `supabase/`(migrations 0001~0004, tests, `run_local_check.sh`)가 작업 폴더에 없다. `npm run test:db`는 그 스크립트를 부를 뿐이라 ALL PASSED(209)를 확인하지 못했다. 파일을 어디서 가져오는가 | | 2026-10-20 |
| Q-06 | T-00 | `npm run test:db`는 `bash`를 쓴다. Windows에서 `bash`가 WSL 스텁이면 실패한다(Git Bash 필요). 팀 개발 환경을 무엇으로 가정하는가 | | 2026-10-20 |
| Q-07 | T-00 | AGENTS.md에 §4·§11 번호가 없다. 번호 없는 `Commands` 절로 명령 표를 넣었다. 번호 체계를 만들 것인가 | | 2026-10-20 |
| Q-08 | T-00 | 시작 시 필수인 환경값은 무엇인가(ARCHITECTURE §9.2는 이름만 있다). 지금 `env.ts`/`env.py`는 `APP_ENV` 외에 모두 선택값이다 | | 2026-10-20 |
| Q-09 | T-00 | "준비 중" 문구는 컴포넌트에 직접 쓰면 문구 규칙과 충돌하고 `messages.ts`는 비워 두라고 했다. 임시로 `page.tsx`에 직접 썼다. 화면 과업에서 옮겨도 되는가 | | 2026-10-20 |
| Q-10 | T-00 | PWA 아이콘·테마 색은 DESIGN.md가 UNDECIDED라 `manifest.ts`에 넣지 않았다(`public/icons/`는 빈 자리). 승인 시점은 | | 2026-10-20 |
| Q-11 | T-00 | 선택 과업인 `.github/workflows/ci.yml`은 만들지 않았다(GitHub에서 실행해 확인할 수 없음). 만들 것인가 | | 2026-10-20 |
