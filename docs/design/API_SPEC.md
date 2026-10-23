# API 명세 (1차-A)

상태: **제안** (회의 결과 전). 대상: API를 만드는 개발자(T-04~T-06), 화면 개발자(T-07b·T-08), 시험 담당.
근거: `supabase/migrations/0001~0004`(DB 함수·제약), `AGENTS.md` §5, `docs/UX_SPEC.md`, `docs/UI_SPEC.md`.
번호: `API-nn`(이 문서), `[FR-..]`·`[AC-..]`(명세서 v0.8), `[승인 의존: D-xx]`, `[제안]`.

---

## 1. 공통 규약

| 항목 | 규칙 |
|---|---|
| 형식 | JSON(UTF-8). 요청 `Content-Type: application/json`. 같은 출처(same-origin) 호출만 허용, CORS 열지 않음 |
| 인증 | Supabase 비회원 로그인 세션(쿠키). 서버가 세션에서 `user_id`를 꺼낸다. **요청 본문·쿼리·경로의 `user_id`는 읽지 않는다** (규칙 12). 세션이 없으면 401 `unauthenticated` |
| 소유자 확인 | 모든 DB 호출에 서버가 꺼낸 `user_id`를 넘긴다. 읽기도 `user_id = 세션 사용자` 조건을 붙인다. 하위 데이터(항목·단계·일정·알림)도 같다 |
| 남의 자료 | 없는 id와 남의 id는 **같은 404, 같은 본문, 같은 형태**: `{"code":"not_found","message":"찾을 수 없어요"}`. 응답 시간 차이도 만들지 않도록 소유자 확인 쿼리를 먼저 한 번만 쓰고 분기한다 |
| 시간 | 요청·응답의 날짜는 `YYYY-MM-DD`(KST 달력 날짜), 시각은 `HH:MM`(KST), 시점(timestamp)은 ISO 8601 UTC(`2026-10-15T09:00:00Z`). 화면이 KST로 바꿔 보여 준다 (규칙 13) |
| 현재 시각 | 서버가 주입된 시계(`clock`)에서 읽는다. 코드에서 `Date.now()`를 직접 쓰지 않는다 (규칙 7장). DB 함수에는 `p_now`로 넘긴다 |
| 중복 방지 | 공고 등록은 `request_id`(UUID, 화면이 만든다). 나머지 쓰기는 **DB 함수가 멱등**이라 같은 요청을 다시 보내도 결과가 같다 (아래 표 "멱등" 열). 알림은 `dedupe_key` (DB) |
| 성공 | 200(조회·갱신), 201(새로 만듦). 본문은 객체. 이미 처리된 멱등 재요청은 첫 응답과 같은 상태코드와 본문 |
| 오류 | `{"code": string, "message": string}`. `message`는 고정 문구이며 **공고 본문·id·내부 오류를 넣지 않는다**. 화면은 `code`로 `messages.ts` 문구를 고른다 |
| 로그 | 요청 경로·상태코드·소요 시간·`code`만 남긴다. 본문(JSON), 쿠키, 공고 원문, 푸시 주소를 남기지 않는다 (규칙 6장) |
| 크기 제한 | 요청 본문 최대 64KB(공고 10,000자 + 여유). 넘으면 413 `payload_too_large` `[제안]` |
| 검증 | 서버가 모든 입력을 검증한다(화면 검증은 편의). 실패는 400 `invalid_input` + `fields: [{name, reason}]` — `reason`은 고정 코드(`required`, `too_long`, `bad_format`) |
| 버전 | 경로에 버전을 두지 않는다(1차-A). 호환이 깨지면 새 경로를 만든다 |

### 1.1 오류 코드 → HTTP 상태 변환

DB 함수 예외 메시지(`supabase/migrations/0001` 오류 코드)를 서버가 아래대로 바꾼다. 모르는 오류는 500 `server_error`이며 상세를 로그에 남기지 않는다.

| DB 예외 | HTTP | `code` | 뜻 | 화면 처리 |
|---|---|---|---|---|
| `not_found` (P0002) | 404 | `not_found` | 없거나 남의 자료 | `ErrorState` not_found |
| `still_extracting` | 409 | `still_extracting` | 분석이 끝나기 전 확정 시도 | 화면 새로고침, 분석 중 단계 |
| `required_missing` | 422 | `required_missing` | 기업명/공고명 없음 | 해당 칸 오류 |
| `position_required` | 422 | `position_required` | 직무 선택 없음 | `position.pick_one` |
| `unreviewed_fields` | 422 | `unreviewed_fields` | 확인 안 한 필수 항목 | 해당 행 `확인 전` 강조 |
| `posting_not_confirmed` | 409 | `posting_not_confirmed` | 확정 전 지원 건 생성 | 화면 새로고침 |
| `position_not_confirmed` | 422 | `position_not_confirmed` | 확정하지 않은 직무로 지원 건 | 화면 새로고침 |
| `invalid_state` | 409 | `conflict` | 지금 상태에서 할 수 없음(다른 탭에서 이미 바꿈) | `error.conflict` + 자동 새로고침 |
| `already_terminal` | 409 | `conflict` | 이미 종료된 지원 건 | 같음 |
| `stage_not_in_progress` | 409 | `conflict` | 진행 중이 아닌 단계 | 같음 |
| `confirm_final_required` | 409 | `confirm_final_required` | 마지막 단계 합격 확인 없이 호출 | **화면 버그**. 개발 환경에서 콘솔 경고, 사용자에게는 `error.conflict` |
| `invalid_status` / `invalid_result` / `time_without_date` | 400 | `invalid_input` | 서버 검증을 통과했는데 DB가 거부(있으면 안 됨) | 서버 오류로 처리, Sentry에 코드만 |
| `raw_text_immutable` | 500 | `server_error` | 원문 수정 시도(있으면 안 됨) | 같음 |
| `deadline_choice_required` | 422 | `deadline_choice_required` | 마감 후보가 있는데 고르지도 "정보 없음"을 명시하지도 않고 확정 | `deadline.pick_one` |
| `invalid_value` / `invalid_field` | 400 | `invalid_input` | 빈 값·너무 긴 값 / 그 항목에는 할 수 없는 동작 | 해당 칸 오류 |
| 세션 없음 | 401 | `unauthenticated` | 로그인 상태 없음 | `ErrorState` session → `/start` |
| 오프라인·연결 실패 | (응답 없음) | — | 화면에서 판단 | `ErrorState` network |

`conflict`는 세 DB 예외를 하나로 묶어 화면 문구를 단순하게 한다. 구분이 필요하면 로그에만 내부 사유를 남긴다.

---

## 2. 엔드포인트 목록

| 번호 | 메서드 경로 | 하는 일 | 호출 DB 함수 | 멱등 | FR / AC |
|---|---|---|---|---|---|
| API-01 | `GET /api/me` | 세션 확인, 오늘 날짜(KST), 동의 상태 | — (조회) | 읽기 | FR-ACC-07, AC-ACC-06 |
| API-02 | `POST /api/consents` | 동의 기록 | — (`consents` 삽입) | 같은 종류·문서버전은 마지막 값 `[제안]` | FR-ACC-02, AC-ACC-08 |
| API-03 | `POST /api/postings` | 공고 등록 | `create_posting_with_job` (+ `cancel_extraction_job`) | `request_id` | FR-JOB-01·03·08, AC-JOB-01·05 |
| API-04 | `GET /api/postings/:id` | 공고 상세(원문, 항목, 추출 상태) | — (조회) | 읽기 | FR-JOB-04~06, AC-JOB-03·04·06 |
| API-05 | `PATCH /api/postings/:id` | 기업명·공고명 고치기 | `set_posting_header` | 같은 값 재전송 안전 | FR-JOB-07 |
| API-06 | `PATCH /api/postings/:id/fields/:fieldId` | 항목 확인("맞아요")·수정·마감 후보 고르기 | `edit_posting_field`, `select_deadline` | 같은 값 재전송 안전 | FR-JOB-07·10, AC-JOB-10·11 |
| API-07 | `POST /api/postings/:id/fields` | 사용자가 직무·마감 후보 추가 | `add_user_field` | 같은 값이면 기존 항목 반환 | FR-JOB-07·09 |
| API-08 | `POST /api/postings/:id/cancel-extraction` | 직접 입력으로 바꾸기 | `cancel_extraction_job` | 예 | FR-JOB-05, AC-JOB-06·07 |
| API-09 | `POST /api/postings/:id/confirm` | 공고 확정 + 직무별 지원 건 만들기 | `confirm_posting(…, p_deadline_none)` → `create_application` ×직무 수 | 예(둘 다 멱등) | FR-JOB-11, FR-APP-01·02, AC-APP-01 |
| API-10 | `GET /api/postings?review=pending` | 확인할 공고 목록 | — (조회) | 읽기 | FR-HOME-02, AC-HOME-02 |
| API-11 | `GET /api/applications?due=soon` | 곧 마감 지원 건 | — (조회) | 읽기 | FR-HOME-01, AC-HOME-01 |
| API-12 | `GET /api/applications/:id` | 지원 상세(단계, 일정, 알림 요약) | — (조회) | 읽기 | FR-APP-03·05·06 |
| API-13 | `POST /api/applications/:id/submit` | 제출 완료 | `set_submitted` | 예 | FR-APP-03 |
| API-14 | `POST /api/applications/:id/stages/:stageId/result` | 단계 결과(합격/불합격) | `record_stage_result` | 상태 확인 후 충돌 응답 | FR-APP-05, D-30 |
| API-15 | `POST /api/applications/:id/terminate` | 불합격·지원 포기 | `set_terminal_status` | 예 | FR-APP-06, AC-APP-07, **[승인 의존: D-38]** |
| API-16 | `GET /api/schedules` | 일정 목록 | — (조회) | 읽기 | FR-SCH-04, AC-SCH-04 |
| API-17 | `GET /api/notifications` | 알림함(+ 읽지 않은 수) | — (조회) | 읽기 | FR-NTF-03, AC-NTF-06·07 |
| API-18 | `POST /api/notifications/:id/read` | 읽음 처리 | — (단일 표 갱신) | 예(`read_at`이 있으면 유지) | FR-NTF-03 |
| API-19 | `PATCH /api/postings/:id/deadline` | 확정 공고의 마감 수정 | `update_confirmed_deadline` | 같은 값 재전송 안전 | FR-JOB-12 or 수정 요구 `[대조 필요]` |
| API-20 | `POST /api/internal/notifications/tick` | 1분 예약 작업: 알림 집기·처리 | `requeue_stale_notifications`, `claim_notifications`, `finish_notification` | 예(DB가 두 번 집기를 막음) | FR-NTF-01~03, AC-NTF-01·03 |

삭제 절차(규칙 14)는 **공개 API로 만들지 않는다.** 운영 스크립트가 `list_user_image_paths` → Storage 파일 삭제 → `delete_user_data`를 실행한다 (`docs/RUNBOOK.md` §삭제 절차).

---

## 3. 엔드포인트 상세

### API-01 `GET /api/me`

```jsonc
// 200
{
  "today_kst": "2026-10-16",              // 서버 시계 기준 오늘(KST). 화면의 D-Day 기준 (UX D-UX-7)
  "consents": { "terms": true, "privacy": true, "ai": false },   // 마지막 기록 기준
  "ai_enabled": false                      // ai 동의 && 서비스 AI 사용 가능
}
// 401 unauthenticated  → 화면이 /start 로 보낸다
```

### API-02 `POST /api/consents`

```jsonc
// 요청
{ "doc_version": "2026-10-01", "terms": true, "privacy": true, "ai": false }
// 201  { "consents": { "terms": true, "privacy": true, "ai": false } }
// 400 invalid_input (terms/privacy가 true가 아님 — 최초 시작에서는 필수)
```
- 최초 시작: `terms`·`privacy`가 `true`여야 한다. 이후 S-05의 [동의하기]는 `{ "ai": true }`만 보낸다(다른 키 생략 허용) `[제안]`.
- `consents`는 변경 이력을 쌓는 표(`agreed_at`)다. 현재 값은 종류별 마지막 행.

### API-03 `POST /api/postings`

```jsonc
// 요청
{ "request_id": "3f1c…(uuid v4)", "raw_text": "…공고 글…", "mode": "ai" }   // mode: "ai"(기본) | "manual"
// 201 (새로 만듦) 또는 200 (같은 request_id 재요청)
{
  "posting_id": "…",
  "review_status": "extracting",          // AI 동의가 없으면 "needs_review"
  "extraction": { "status": "queued", "mode": "ai", "reason": null }
}
// 400 invalid_input   raw_text 비었음/공백뿐/10,000자 초과/request_id 형식 오류
```
- `raw_text`는 **1~10,000자**(문자 수, UX S-05). 공백뿐이면 거부. 서버는 글을 고치거나 자르지 않는다(원문 보존, ERD-03 불변).
- `mode: "manual"`: 서버가 `create_posting_with_job` 직후 `cancel_extraction_job`을 부른다(두 호출 사이에 워커가 집으면 `cancel`이 처리 중 작업도 취소하므로 안전). 응답 `extraction.mode = "manual"`, `reason = "user_switched"`. DB 변경 없음 `[제안]`.
- AI 동의가 없으면 DB가 작업을 만들지 않는다(`extraction = {status: null, mode: "manual", reason: "no_consent"}`).
- `reason: "quota"`(전체 한도 초과)는 응답 모양에 **예약**해 두지만 1차-A에는 한도 기능이 없다(`FR` 대조 필요) → 항상 나오지 않는다.
- 같은 `request_id`로 다른 `raw_text`를 보내면 **처음 공고를 돌려준다**(내용 비교 안 함). 화면은 같은 입력일 때만 같은 `request_id`를 쓴다.
- 로그에 `raw_text`를 남기지 않는다.

### API-04 `GET /api/postings/:id`

```jsonc
// 200
{
  "posting": {
    "id": "…", "review_status": "needs_review",       // extracting | needs_review | confirmed
    "company_name": "가짜기업", "title": "신입 개발자",
    "confirmed_positions": [],
    "deadline": null,                                  // 확정 후: {status, date, time}
    "created_at": "2026-10-16T01:00:00Z", "confirmed_at": null
  },
  "extraction": {
    "status": "done",                                  // queued | processing | done | failed | cancelled | null
    "mode": "ai",                                      // ai | manual
    "reason": null,                                    // no_consent | failed | user_switched | quota | null
    "elapsed_seconds": 12                              // 등록 후 경과(서버 계산). 화면의 60초 판단 기준
  },
  "fields": [
    { "id": "…", "field": "position", "value": "백엔드", "value_status": "has_value",
      "source": "ai", "review_status": "unreviewed", "is_selected": false,
      "is_estimated": false, "value_date": null, "value_time": null,
      "requirement_kind": null,
      "evidence": { "quote": "백엔드", "start": 12, "end": 15 } },    // UTF-16 코드 단위 [start, end)
    { "id": "…", "field": "deadline", "value": null, "value_status": "has_value",
      "value_date": "2026-10-15", "value_time": null, "is_estimated": true,
      "is_selected": false, "review_status": "unreviewed", "source": "ai",
      "evidence": { "quote": "10월 15일까지", "start": 40, "end": 51 } }
  ],
  "raw_text": "…",                                     // 화면의 원문 보기용. 이 응답에만 포함
  "applications": [ { "id": "…", "position": "백엔드" } ],   // 확정 후에만 값이 있음
  "today_kst": "2026-10-16"
}
```
- 화면 단계(분석 중/느림/확인 필요/일부만 찾음/직접 입력/확정됨)는 이 응답에서 **계산**한다: `UI_SPEC.md` 6.4.1.
- `fields`의 `evidence`는 `source='ai'`이고 `value_status='has_value'`인 항목에만 있다. 위치가 검증되지 않은 항목은 워커가 `value_status='none'`으로 저장하므로 `evidence`가 없다 [AC-JOB-11].
- 항목의 정렬: 종류 순서(company, title, position, deadline, requirement) → 문서 내 위치 순.
- 폴링 간격 3초, 응답은 가볍게: `raw_text`는 `?include=raw`가 있을 때만 포함하고 폴링은 이를 생략한다 `[제안]`.
- 남의 공고·없는 공고: 404 `not_found`.

### API-05 `PATCH /api/postings/:id` — 기업명·공고명

```jsonc
{ "company_name": "가짜기업", "title": "신입 개발자" }       // 둘 중 하나만 보내도 됨. 빈 문자열이면 비우기
// 200  { "company_name": "…", "title": "…" }
```
- 100자 초과도 허용하되 **500자까지**(`[제안]`), 앞뒤 공백 제거. 확정된 공고는 409 `conflict`(확정 후 수정은 1차-A에 없음, 마감 수정만 API-19).
- 수정 이력 `posting_edits`(phase `reviewing`)를 같은 처리에서 남긴다. `set_posting_header`(0004)가 두 표를 한 번에 바꾼다.

### API-06 `PATCH /api/postings/:id/fields/:fieldId`

```jsonc
// 요청 (한 번에 하나의 action)
{ "action": "review" }                                           // "맞아요" → review_status = reviewed
{ "action": "select" }                                           // 마감 후보 고르기 (같은 공고의 다른 후보 선택은 해제)
{ "action": "edit", "value": "백엔드 개발자" }                    // position/requirement 등 글자 값
{ "action": "edit", "value_date": "2026-10-15", "value_time": null }   // deadline (value_time null = 시각 미확인)
// 200  { "field": { …API-04의 field 한 개… } }
```
- `review`: 항목을 `reviewed`로. 마감 후보가 1개뿐일 때 화면의 [맞아요]는 `select`와 `review`를 **한 번에** 해야 하므로 `{"action":"select"}`가 선택과 확인을 함께 처리한다(선택한 후보는 확인함으로 본다).
- `edit`: 값 변경 → `source`는 `user`로, `review_status`는 `reviewed`로 바뀐다. 마감은 `value_date`가 없는데 `value_time`만 오면 400. `quote`/`span`은 그대로 둔다(수정해도 AI가 본 근거는 보존, 변경 전/후는 `posting_edits`).
- `select`는 마감 항목에만 가능(`field = deadline`, `value_status = has_value`). 다른 항목이면 400 `invalid_input`.
- 확정된 공고의 항목은 409 `conflict`.
- 다른 공고의 `fieldId`는 404(하위 데이터 소유자 확인; DB는 `extracted_fields(id, posting_id, user_id)` 복합키로 한 번 더 막음).
- 구현: `review`/`edit` → `edit_posting_field`, `select` → `select_deadline` (둘 다 `extracted_fields`+`posting_edits`를 한 번에, 0004).

### API-07 `POST /api/postings/:id/fields` — 직무·마감 후보 직접 추가

```jsonc
{ "client_key": "uuid", "field": "position", "value": "데이터 엔지니어" }
{ "client_key": "uuid", "field": "deadline", "value_date": "2026-10-20", "value_time": "18:00" }   // value_time null/생략 = 시각 미확인
// 201 { "field": { … source: "user", review_status: "reviewed", value_status: "has_value" … } }
```
- 사용자가 만든 항목은 `source='user'`이고 근거(quote/span)가 없다(DB가 `source='user'`이면 허용). 직접 추가한 마감은 그 공고의 **선택된 마감**이 된다(기존 선택 해제) — 사용자가 직접 입력했다는 것은 그 값을 고른 것이기 때문 `[제안]`.
- `field`는 `position`, `deadline`만 허용(기업명·공고명은 API-05). 직무는 1~100자, 중복 이름 무시(같은 값이면 기존 항목 반환).
- `client_key`는 중복 방지용. 같은 키는 같은 항목을 돌려준다. 키 저장 칸이 DB에 없으므로 `[제안]`: 같은 `(posting, field, value[,date,time])`이 이미 있으면 새로 만들지 않는 방식으로 대체(키 칸을 추가하지 않는다).

### API-08 `POST /api/postings/:id/cancel-extraction`

- 요청 본문 없음. `cancel_extraction_job` 호출 → 공고는 `needs_review`(직접 입력). 이미 `needs_review`여도 200(멱등). 확정된 공고도 200이며 아무 일도 하지 않는다.
- 응답: `{ "review_status": "needs_review", "extraction": { "status": "cancelled", "mode": "manual", "reason": "user_switched", "elapsed_seconds": 30 } }`
- 이후 도착한 AI 결과는 `save_extraction_result`가 `false`를 돌려 저장하지 않는다 [AC-JOB-06].

### API-09 `POST /api/postings/:id/confirm`

```jsonc
// 요청
{ "positions": ["백엔드", "프론트엔드"], "deadline_none": false }
// 200  (모든 직무 성공)
{
  "review_status": "confirmed",
  "applications": [ { "id": "…", "position": "백엔드", "created": true },
                    { "id": "…", "position": "프론트엔드", "created": false } ],   // created:false = 이미 있던 건 (UX X-24)
  "summary": { "applications": 2, "schedules": 2, "notifications": 4 },
  "deadline": { "status": "has_value", "date": "2026-10-16", "time": "18:00" },
  "past_deadline": false
}
// 207-스타일을 쓰지 않고, 일부 실패는 200 + failed 배열
{ "review_status": "confirmed", "applications": [ … 성공한 것 … ],
  "failed": [ { "position": "프론트엔드", "code": "server_error" } ], "summary": { … } }
// 422 position_required / required_missing / unreviewed_fields / deadline_choice_required(G-6)
// 409 still_extracting
```
- 순서: ① `confirm_posting(p_user_id, id, positions, now)` ② 직무마다 `create_application(…)`. ①이 실패하면 ②를 부르지 않는다. ①은 멱등(이미 확정이면 조용히 반환)이라 재호출이 안전하다. ②도 멱등(같은 `user, posting, position`이면 기존 건).
- 부분 실패: ②의 일부만 실패하면 공고는 확정된 채 `failed`를 돌려준다. 화면은 `confirm.partial` 문구와 [다시 시도]를 보이고, 같은 요청을 다시 보내면 성공한 직무는 `created:false`로 돌아온다 (UX X-22).
- `summary`: 응답 직전에 DB에서 해당 공고의 지원 건·일정·알림 수를 센다(만든 개수를 서버가 추정하지 않는다). 알림 수는 `status != cancelled`인 예약 알림.
- `positions`는 확정할 직무 이름 배열(1~50개, 각 1~100자). 공고에 없는 직무 이름도 허용(직접 추가한 것).
- `deadline_none`: 사용자가 "정보 없음"을 명시적으로 확인했다는 뜻. 마감 후보가 있는데 선택하지 않고 `deadline_none`도 아니면 422 `deadline_choice_required`. DB가 `deadline_choice_required`로 거부한다(0004, G-6). 서버는 `deadline_none`을 `p_deadline_none`으로 그대로 전달한다.
- `[승인 의존: D-31]` 확정 때 선택된 마감 후보의 값이 공고 마감 칸으로 복사된다.

### API-10 `GET /api/postings?review=pending`

```jsonc
// 200
{ "items": [ { "id": "…", "company_name": null, "title": null,
               "review_status": "extracting",         // extracting | needs_review
               "extraction_status": "processing",     // 화면 상태 글자 계산용
               "created_at": "…" } ] }
```
- `review=pending`은 `review_status in (extracting, needs_review)`이고 아직 확정 전인 공고. 최근 등록순, 최대 50건. 확정하면 목록에서 빠진다 [AC-HOME-02].

### API-11 `GET /api/applications?due=soon`

```jsonc
{ "today_kst": "2026-10-16",
  "items": [ { "id": "…", "company_name": "…", "position": "백엔드",
               "deadline": { "date": "2026-10-16", "time": "18:00", "status": "confirmed" },   // confirmed | time_unconfirmed
               "status": "interested" } ] }
```
- 조건: 마감 일정(`type='deadline'`, `source='posting'`)이 `today_kst`부터 `today_kst + 3일`까지이고, 일정이 `stopped`가 아니며, 지원 상태가 `interested`/`preparing`. 제출 완료는 제외 [AC-HOME-01].
- **이미 마감 시점이 지난 것**(규칙 6: 시각이 있으면 그 시각, 미확인은 다음 날 00:00)은 포함하지 않는다.
- 마감 임박 순. 최대 20건.

### API-12 `GET /api/applications/:id`

```jsonc
{
  "application": { "id": "…", "position": "백엔드", "status": "submitted", "posting_id": "…",
                   "company_name": "…", "title": "…" },
  "stages": [ { "id": "…", "seq": 1, "name": "서류", "status": "in_progress" }, … ],
  "schedules": [ { "id": "…", "type": "deadline", "title": "지원 마감", "date": "2026-10-16", "time": "18:00",
                   "status": "confirmed" } ],
  "notifications": { "scheduled": 0, "cancelled": 2, "sent": 0 },      // 이 지원 건의 알림 수 요약
  "today_kst": "2026-10-16"
}
```
- 단계 이름(서류/면접/최종)은 임시값이다 `[제안]`(요구사항에 단계 이름이 없음 — `create_application`의 기본값).

### API-13 `POST /api/applications/:id/submit`

- 요청 본문 없음 → `set_submitted`. 성공 `200 { "application": {…API-12의 application…}, "stages": […] }`.
- 이미 제출/전형 진행이면 200(멱등). 이미 종료된 건이면 409 `conflict`.
- 한 번의 호출로 상태, 이력, 첫 단계 `in_progress`, 남은 마감 알림 취소가 모두 반영된다 (DB 함수 한 번, 규칙 10).

### API-14 `POST /api/applications/:id/stages/:stageId/result`

```jsonc
{ "result": "passed", "confirm_final": false }       // result: passed | failed
// 200  { "application": { … }, "stages": [ … ] }
// 409 confirm_final_required   (마지막 단계 합격인데 confirm_final=false)
// 409 conflict                 (진행 중 단계가 아님 등)
```
- 화면은 마지막 단계에서 `final.*` 확인 창을 거쳐 `confirm_final: true`로 보낸다. 서버는 `confirm_final`을 **그대로 DB로 전달**하고, 기본값을 `true`로 두지 않는다.
- `failed`는 단계 `failed` + 지원 `rejected` + 일정 중지 + 알림 취소를 DB 함수가 한 번에 한다 `[승인 의존: D-38]`.
- `[승인 의존: D-30]` 단계 상태 값(`upcoming/in_progress/passed/failed`)에 기댄다.

### API-15 `POST /api/applications/:id/terminate`

```jsonc
{ "status": "withdrawn" }       // rejected | withdrawn
// 200 { "application": {…}, "schedules": [ … status "stopped" 반영 … ] }
```
- `[승인 의존: D-38]` 아직 지나지 않은 일정은 `stopped`, 그 알림은 `cancelled`. 이미 지난 일정은 그대로. 이미 같은 상태면 200(멱등), 다른 종료 상태면 409.
- 코드 주석: `// [승인 의존: D-38]`.

### API-16 `GET /api/schedules`

```jsonc
{ "today_kst": "2026-10-16",
  "items": [ { "id": "…", "application_id": "…", "company_name": "…", "position": "백엔드",
               "type": "deadline", "title": "지원 마감",
               "date": "2026-10-16", "time": "18:00",       // time null = 시각 미확인
               "status": "confirmed" } ] }                  // confirmed | time_unconfirmed | stopped
```
- 정렬: 날짜 오름차순(같은 날은 시각 있는 것 먼저, 시각 미확인 뒤). 지난 일정 구분은 **화면**이 `DeadlineLabel` 규칙(규칙 6)으로 한다. 최대 200건.

### API-17 `GET /api/notifications`

```jsonc
{ "unread_count": 2,
  "items": [ { "id": "…", "kind": "deadline_1d",       // deadline_1d | deadline_1h | deadline_eve_9am
               "status": "sent",                       // sent | cancelled
               "scheduled_at": "2026-10-15T09:00:00Z", "read_at": null,
               "application_id": "…", "company_name": "…", "position": "백엔드",
               "deadline": { "date": "2026-10-16", "time": "18:00" } } ] }
```
- 알림함에는 `sent`(보냄 = 알림함에 노출)와 `cancelled`만 나온다. `scheduled`/`sending`/`failed`는 노출하지 않는다 `[제안]`. 최신순, 최대 100건.
- "보냄"의 1차-A 의미: 알림함에 보이는 상태(`FR-NTF-03`). 푸시는 1차-B. 이 해석은 TASKS Q-03 확인 대기.
- `unread_count` = `sent`이고 `read_at is null`.

### API-18 `POST /api/notifications/:id/read`

- 본문 없음. `read_at`이 비었으면 서버 시각으로 채운다(있으면 유지). `200 { "read_at": "…" }`. 남의 알림은 404.

### API-19 `PATCH /api/postings/:id/deadline` (확정 후 마감 수정)

```jsonc
{ "date": "2026-10-20", "time": null }          // time null = 시각 미확인, date null = 마감 정보 없음
// 200 { "deadline": { "status": "time_unconfirmed", "date": "2026-10-20", "time": null }, "reminders_rescheduled": 1 }
```
- `update_confirmed_deadline` 호출: 공고 마감 칸, 모든 지원 건의 마감 일정, 제출 전 지원 건의 알림 재예약, 수정 이력이 한 번에 처리된다. `date`가 없는데 `time`만 있으면 400.
- 1차-A에서 **화면은 만들지 않는다**(TASKS §4 자르는 순서). API와 시험만 둔다. 어떤 FR에서 오는지는 명세서 v0.8 대조 필요.

### API-20 `POST /api/internal/notifications/tick` (1분 예약 작업)

- 인증: 헤더 `x-cron-key`가 서버 환경변수 `CRON_KEY`와 같을 때만. 틀리거나 없으면 401, 본문 없이. 사용자 세션으로는 호출할 수 없다.
- 순서: `requeue_stale_notifications(now)` → `claim_notifications(limit, now)` → 각 건 `NotificationSender.send()`(1차-A는 "알림함 노출 처리" — 이미 DB가 `sending`으로 바꾼 것을 `finish_notification(id, true)`로 `sent`로) → 실패는 `finish_notification(id, false)`.
- 한 번에 최대 200건. 응답 `{ "claimed": 3, "sent": 3, "failed": 0, "requeued": 0 }`.
- 두 번 집히면 안 된다(규칙 9): 동시에 두 번 호출돼도 DB의 `claim_notifications`가 한 번만 넘겨준다.
- 마감이 지난 알림은 `claim_notifications`가 취소로 돌린다(보내지 않음).
- 호출 주체는 Supabase 예약 작업(pg_cron) 또는 호스팅 쪽 크론(배포 위치 미정 `[확인 필요]`). 어느 쪽이든 이 엔드포인트와 `CRON_KEY` 방식은 같다.

---

## 4. AI 워커 계약 (HTTP가 아님)

Python AI 서버는 HTTP API를 열지 않는다. Supabase에 `service_role`로 접속해 DB 함수를 부른다.

| 단계 | 호출 | 입력 | 출력 |
|---|---|---|---|
| 1 | `claim_extraction_job(now)` | — | 0~1행(`id`, `user_id`, `posting_id`, `attempts`) |
| 2 | 공고 원문 읽기 | `job_postings.raw_text` (service_role 읽기) | 원문 |
| 3 | Gemini 호출 | 원문 + 지시문 **만** (계정 정보·사용자 id 금지) | 항목별 `{field, quote, span_start, span_end}` (날짜·시각 값 없음, 규칙 2) |
| 4 | 위치 검증 | `raw_text`를 UTF-16으로 보고 `[span_start:span_end] == quote` | 다르면 그 항목 `value_status='none'`, 값 비움 [AC-JOB-11] |
| 5 | 날짜 정리 | 마감 항목의 `quote` + 등록일(KST) | `value_date`, `value_time`, `is_estimated`, (후보 여러 개면 항목을 여러 개) [D-31] |
| 6 | `save_extraction_result(job_id, fields, now)` | `p_fields` jsonb 배열 | `true` 또는 `false`(취소된 작업의 늦은 결과: 버리고 끝) |
| 실패 | `fail_extraction_job(job_id, code, now)` | `timeout`/`ai_error`/`bad_format`/`input_error` | 새 작업 상태. 2번 미만이면 대기로 돌아감, 아니면 실패 |
| 기록 | `ai_call_logs` 삽입 | 시도 번호, 결과, 지연(ms), 토큰 수 | 본문·계정 정보 없음 (ERD-08) |
| 정리 | `requeue_stale_extraction_jobs(now, 5)` | — | 되돌린 작업 수. 워커 루프가 주기적으로 호출 |

`p_fields` 항목 모양(`save_extraction_result`가 읽는 키):

```jsonc
{ "field": "deadline",            // company | title | position | deadline | requirement
  "quote": "10월 15일 오후 6시까지",
  "value": "2026-10-15 18:00",    // 사람이 읽는 글자(선택)
  "value_date": "2026-10-15",     // 서버 규칙(날짜 정리)이 계산한 값. AI가 만든 값이 아니다 (D-31)
  "value_time": "18:00",
  "value_status": "has_value",    // has_value | none | failed
  "is_estimated": true,           // 연도를 추정했으면 true (규칙 4)
  "requirement_kind": null,       // requirement 항목만: required | preferred | unknown
  "span_start": 40, "span_end": 55 }   // UTF-16 코드 단위
```

- 재시도: 한 작업은 최대 2번 집힌다(`attempts <= 2`). 워커는 오류를 삼키지 않고 `fail_extraction_job`을 부른다.
- 공고 속 명령문은 데이터다. 지시문과 원문을 분리해 보내고, 응답이 형식에 맞지 않으면 `bad_format`.
- URL 가져오기 코드는 쓰지 않는다 (FR-JOB-02 안전 규칙 확정 전).

---

## 5. API 때문에 추가한 DB 함수 (`0004`, **적용·시험 완료**)

API를 쓰려고 작업하다 드러난 DB 빈틈을 `supabase/migrations/0004_edit_and_deadline_guard.sql`로 메웠다(시험 `tests/30_edit_and_guard_tests.sql`, 전체 209개 통과). 표 2개 이상을 바꾸는 처리는 DB 함수 한 번(규칙 10)이다.

| 번호 | 함수 | 하는 일 | 오류 |
|---|---|---|---|
| G-4a | `set_posting_header(p_user_id, p_posting_id, p_company, p_title, p_now)` | 기업명·공고명 수정(null = 그대로, 빈 글자 = 비움, 500자), 바뀐 칸만 `posting_edits` | `not_found`, `invalid_state`(확정 후), `invalid_value` |
| G-4b | `edit_posting_field(p_user_id, p_posting_id, p_field_id, p_patch jsonb, p_now)` | `{"action":"review"}` 또는 `{"action":"edit", value / value_date, value_time}`. 수정하면 `source=user`, `reviewed`, 연도 추정 해제 + 이력 | 위 + `time_without_date` |
| G-4c | `select_deadline(p_user_id, p_posting_id, p_field_id, p_now)` | 다른 선택을 풀고 이 후보를 선택 + 확인함 + 이력 | + `invalid_field`(마감이 아니거나 값 없음) |
| G-4d | `add_user_field(p_user_id, p_posting_id, p_field, p_value, p_date, p_time, p_now)` → 항목 id | 직무·마감 직접 추가. 같은 값이면 기존 항목 반환. 추가한 마감은 곧바로 선택됨 | + `invalid_field`(직무·마감 외) |
| **G-6** | `confirm_posting(…, p_now, p_deadline_none boolean default false)` | 마감 후보(`has_value`)가 있는데 선택하지도 `p_deadline_none`도 아니면 `deadline_choice_required`. `p_deadline_none=true`면 "정보 없음"으로 확정(선택된 후보가 있어도 무시). 후보가 아예 없으면 기존처럼 확정 | `deadline_choice_required` |

기존 4인자 호출(`confirm_posting(user, posting, positions, now)`)은 기본값 때문에 그대로 동작한다.

G-6은 사용자가 마감을 놓치게 만드는 종류의 결함(앱의 핵심 약속과 직결)이었고, 이제 DB가 직접 막는다(어느 경로로 호출해도 안전).

---

## 6. 시험 기준 (T-04~T-06)

시험 이름에 AC 번호를 넣는다(`docs/TEST_PLAN.md` 참고). 모든 라우트 공통:

1. 세션 없이 호출 → 401 (API-20은 `x-cron-key` 없이 401).
2. 남의 id로 호출 → 404이고 **없는 id로 호출한 응답과 바이트까지 같다**(상태·본문·헤더 중 가변 값 제외). 하위 데이터(필드/단계/알림)도 포함 [AC-ACC-05].
3. 본문에 `user_id`를 넣어도 무시된다(남의 id를 넣어도 내 자료로만 동작).
4. 같은 요청 2번 → 같은 결과, 데이터 중복 없음.
5. 잘못된 입력 → 400 `invalid_input` + 고정 `reason`, 응답과 로그에 입력 본문이 없음.
6. 확정 전에는 일정·알림이 0건 (규칙 1).

---

## 7. 열린 항목

| 번호 | 내용 | 임시 결정 |
|---|---|---|
| API-Q1 | API-07 `client_key`는 쓰지 않는다 | 내용이 같으면 DB가 기존 항목을 돌려준다 (`add_user_field`) |
| API-Q2 | 기업명·공고명 최대 길이 | 500자 `[제안]` |
| API-Q3 | `ai_enabled`의 "서비스 AI 사용 가능"(키 없음, 장애) 판단 기준 | 환경값 `AI_ENABLED`(기본 true) `[제안]` |
| API-Q4 | API-19가 대응하는 FR 번호 | 명세서 v0.8 대조 필요 |
| API-Q5 | 푸시(1차-B) 때 `NotificationSender` 교체 지점 | 인터페이스만 두고 구현은 알림함 |
| API-Q6 | 전체 AI 한도(reason `quota`)의 요구사항 존재 여부 | 1차-A에서 만들지 않음, 응답 값만 예약 |
