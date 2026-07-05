# Persona モジュール切り出し — persona-kit へのハンドオフ

作成日: 2026-07-05。
本書は PR [#18](https://github.com/uniba/super-good-meetings/pull/18)（SGMS-16）/ [#19](https://github.com/uniba/super-good-meetings/pull/19)（SGMS-17）で in-repo モジュールとして隔離した **Persona 機構**を、独立リポジトリ **`persona-kit`** へ移してモジュール化を完成させ、その後 another-sgms と my-local-3-hono の 2 つを consumer 化するためのハンドオフ。persona-kit の初期ドキュメントとしてそのままコピーしてよい。

大原則: **another-sgms は出自であって参照実装ではない**。2 つの consumer はフラットに扱い、persona-kit は another-sgms / my-local-3-hono の両者から使える状態になって初めて完成とみなす。consumer 化に順序は設けず、両者同時の着地をめざす（§7）。PR #18 / #19 は another-sgms にはマージしない。

## 1. 背景と狙い

Persona は「ログインなしで始め、ブラウザごとに匿名ペルソナを持ち運ぶ」identity 機構。another-sgms（認証フリー SGMs フォーク）で実装され、設計の経緯は [auth-removal-plan.md](auth-removal-plan.md) にある。

- **PR #18**（branch `sgms-16` → `devel`、OPEN）: 機構を SGMs ドメインから切り離し、in-repo モジュール（Ruby `app/lib/persona.rb` + TS `app/javascript/lib/persona/`）として隔離。挙動変更なしの純リファクタ。
- **PR #19**（branch `sgms-17` → `sgms-16`、OPEN、#18 の上に stack）: 第 2 の binding として OIDC アカウント連携（uniba/auth 想定）を追加。`PERSONA_ACCOUNT_LINKING` env で opt-in、既定 off。

#18 の時点では「AR モデルの抽出は 2 つ目の利用者が現れたら」と据え置いた。**my-local-3-hono がその 2 つ目**（Hono + htmx + Neon、`src/identity.ts` に同型の agent_uid 機構を独自実装済み）で、抽出の条件が満たされたため独立プロジェクト化する。

## 2. 移すもの（モジュールの現在のインベントリ）

いずれも branch `sgms-17` 上のコードが最新。新リポジトリはここから seed する。

### Backend（Ruby）

- `app/lib/persona.rb` — コア。app 固有関心を注入するシーム集:
  - `Config#on_join` — join 時のドメイン副作用（既定 no-op）
  - `Config#guest_nickname_generator` / `#guest_email_factory` — 新規ゲストの表示名・placeholder 識別子
  - `Config#oidc_verifier` — `verify(params) -> Identity | nil` の契約（既定 `StubVerifier`）
  - `AGENT_ID_HEADER`（`X-Agent-Id`）/ `AGENT_ID_PARAM`（`agent_id`）— ワイヤプロトコル名
  - `account_linking_enabled?` — feature flag（env `PERSONA_ACCOUNT_LINKING`）
- `app/lib/persona/oidc.rb` — `authorize_url(state:)`、`Identity(provider, subject)`、`StubVerifier`（sub をそのまま信用する local 用）。**本番用 JWKS 検証 verifier は未実装**（uniba/auth の JWKS 公開待ち。iss / aud / hd=uniba.jp / sub 検証、同一 `#verify` 契約）。
- `app/lib/persona/account_link.rb` — bind / adopt / merge の判断ロジック。`Result(user, agent_uid, merged, merge_preview)`。recovery-code claim と同型で、衝突時は preview を返して confirm を待つ（データ無変更）。
- `app/lib/persona/oidc/link_store.rb` — `link_token` の Redis 保存。
- `config/initializers/persona.rb` — consumer 側配線の見本（`to_prepare` で reload 安全に `on_join` を注入）。

### Frontend（TypeScript）

`app/javascript/lib/persona/`（`index.ts` barrel からのみ export）:

- `agent_id.ts` — agent_uid の生成・保持（`getAgentId` / `setAgentId` / `generateAgentId` / `clearAgentId`）
- `join_orchestrator.ts` — opt-in join ハンドシェイク（`registerJoinDialogOpener` / `requestJoin` / `resolvePendingJoins`）
- `transport.ts` — Apollo 用（`createAgentIdLink` / `createJoinRetryLink` / `NOT_JOINED_CODE`）
- `cable.ts` — ActionCable 用 `appendAgentId`

### 残すもの（consumer 側に留まる）

- AR モデル `User` / `AgentBinding` / `AccountBinding`、`UserMerge` サービス、GraphQL mutations（`beginAccountLink` / `completeAccountLink` / `revokeAccountBinding` / `claimRecoveryCode`）、UI コンポーネント、migration。
- ただし新プロジェクトでは「どこまでをモジュールが規定するか」を再決定する（§5 論点 1）。ストレージ adapter 契約として一部を吸い上げる余地がある。
- `session[:agent_id]`（project-password 用のサーバセッション ULID）は **別物**。混ぜない。

## 3. プロトコル不変条件（実装より先にスペック化する）

新プロジェクトの最重要成果物はコードより **protocol spec**。consumer 2 者はスタックが違いすぎるため、共有できるのはまずプロトコル、次に言語別 adapter。

1. agent_uid は**ブラウザが生成**する self-asserted な bearer key。サーバが発行しない。
2. HTTP は `X-Agent-Id` ヘッダ、WebSocket は `agent_id` query param で運ぶ（ActionCable がカスタムヘッダ不可のため）。
3. **lock-in 回避**: サーバは agent_uid をレスポンスに echo しない。例外は「匿名ブラウザが新規ペルソナを得た瞬間」のみ（`AccountLink::Result#agent_uid` が non-nil のケース → クライアントは `setAgentId` で永続化）。
4. 未 join の書き込みは `NOT_JOINED` エラーコード → クライアントが join ハンドシェイクを起こしてリトライ。
5. OIDC 連携で URL に載るのは不透明な `state` / `link_token` のみ。agent_uid は URL に出さない。identity 判断は必ず `X-Agent-Id` 付きのリクエスト側で行う（「ブラウザが実体」を保つ）。
6. binding は 2 種で信頼レベルが違う: `AgentBinding`（self-asserted、秘匿）と `AccountBinding(provider, subject)`（IdP 検証済み、露出可）。ペルソナが結節点、merge は両方を移送。
7. 衝突（別ペルソナが同じ subject / recovery code を保持）は常に merge preview → confirm の 2 段階。confirm なしにデータを変えない。

## 4. Consumer 2 者のプロファイル差分（モジュール化の設計制約）

| | another-sgms | my-local-3-hono |
|---|---|---|
| Server | Rails + GraphQL + ActionCable | Hono（Netlify Function / Node）+ raw SQL（Neon） |
| Client | React + Apollo（SPA） | htmx + server-rendered HTML（クライアント JS ほぼなし） |
| identity 搬送 | 毎リクエスト `X-Agent-Id` ヘッダ | HMAC 署名 session cookie（profile id + browser id を wrap）、agent_uid は「共有キー」としてエクスポート/インポート |
| 暗号 | — | Web Crypto（HMAC-SHA256、edge 互換） |
| 既存実装 | `sgms-17` の persona モジュール | `src/identity.ts`（独自だが設計は another-sgms plan に合わせてある） |
| 関連 doc | doc/development/auth-removal-plan.md | docs/design_handoff_identity_onboarding/（共有キーの export / import 画面） |

含意:

- コアは transport 非依存（header / cookie 両対応）・ストレージ非依存（AR / raw SQL）・クライアント枠組み非依存（Apollo link は adapter の 1 つに降格）でなければならない。
- htmx 側には「クライアント JS なしで join / claim を成立させる」フローが要る — spec はヘッダ運搬を前提にしすぎない。
- Ruby / TS の 2 言語実装になる。**単一の protocol spec + conformance テスト**（同じテストベクタを両実装に流す）で漂流を防ぐ。

## 5. リポジトリ構成案と論点

リポジトリは **`persona-kit`**。まずローカル（`~/projects/persona-kit`）で開発し、`uniba-commons` org への公開は後段で行う。

```
persona-kit/
├── README.md
├── doc/
│   ├── protocol.md          # §3 を正とする wire スペック
│   └── decisions/           # 論点の決定記録
├── packages/                # TypeScript（npm workspace）
│   ├── core/                # agent_id 保持・join 状態機械（transport 非依存）
│   ├── apollo/              # createAgentIdLink / createJoinRetryLink
│   ├── cable/               # ActionCable glue
│   └── hono/                # Hono middleware（cookie 版 transport、server 側）
├── gems/
│   └── persona/             # Ruby gem（シーム + Oidc + AccountLink）
└── examples/
```

決めるべき論点（新プロジェクトの最初の issue にする）:

1. **モジュールが規定する範囲** — シームとプロトコルだけか、binding のストレージ契約（adapter interface）まで持つか。my-local-3-hono は AR を使わないので、持つなら interface + 各 consumer 実装。
2. **配布方法** — npm publish（`@uniba-commons` scope / GitHub Packages）vs git 参照（`gem "...", github: "uniba-commons/persona-kit"` / npm の git dep）。private でよければ git 参照が最小コスト。
3. **Ruby 側の形態** — plain gem か Rails engine か。現状シームは plain gem で足りる（Redis 依存の LinkStore だけ注入点にする）。
4. **JWKS verifier** — uniba/auth の公開状況を確認し、`StubVerifier` と同契約の `JwksVerifier` を実装。これはモジュール化と独立に進められる。
5. **my-local-3-hono の cookie 方式との統合** — cookie 運搬を spec の第 2 transport として正式化するか、ml3 を header 方式に寄せるか。

## 6. 完成の定義（両 consumer 化 PR を着地させてよい条件）

- [ ] `doc/protocol.md` が §3 を網羅し、両 transport（header / cookie）を**同格に**規定
- [ ] TS packages と Ruby gem がバージョン付きで参照可能
- [ ] 共有テストベクタによる conformance テストが両言語で green
- [ ] `StubVerifier` に加え JWKS verifier が契約を満たす（uniba/auth が未公開なら契約テストのみでも可）
- [ ] **両 consumer 化 PR（§7 手順 3）上で persona-kit が実際に動いている**
- [ ] consumer ごとの移行ガイド（下記 §7 の詳細版）

## 7. 移管手順（推奨）

前提: **PR #18 / #19 は another-sgms にマージしない**。先に another-sgms へ着地させると Rails / Apollo / GraphQL 前提のまま core が固まり、モジュールが another-sgms 由来に寄りすぎる。branch `sgms-16` / `sgms-17` は persona-kit の seed 元および consumer 化時の参照としてのみ使う。

1. **persona-kit を `sgms-17` のモジュール部分から seed** する（§2 のファイル群 + 本書 + auth-removal-plan.md の関連節を移植）。history ごと持ちたければ `git filter-repo` でパス抽出、こだわらなければ snapshot コピーで十分。seed 直後に「another-sgms は一 consumer にすぎない」前提で命名と API を総点検する（Apollo / ActionCable / Rails / GraphQL 前提が core に漏れていないか。例: `NOT_JOINED` の運搬は GraphQL error code 前提にしない）。
2. **protocol spec を両 transport（header / cookie）で書き切る**。my-local-3-hono の `src/identity.ts` と design handoff（共有キー export / import）を another-sgms 側と同格の入力として扱う。
3. **両 consumer 化を並行で進める（順序を設けない）**。another-sgms 側は `devel` 起点の新規 PR（persona-kit 依存の導入 + initializer 配線〔`config/initializers/persona.rb` 相当〕+ #19 の app 側資産〔mutations / UI / migration / UserMerge〕の移植）。my-local-3-hono 側は `src/identity.ts` を置換する PR。片方の都合で core の API を変えるときは必ずもう片方でも検証し、spec に還流する — フラットに保つこと自体が偏り防止の仕組み。
4. §6 をすべて満たしたら両 PR を着地させる。あわせて PR #18 / #19 を superseded として close する（branch は出自の記録として残す）。

## 8. 参照

- persona-kit: ローカル `~/projects/persona-kit`（公開は後段で uniba-commons org へ）
- PR #18: https://github.com/uniba/super-good-meetings/pull/18 （branch `sgms-16`）
- PR #19: https://github.com/uniba/super-good-meetings/pull/19 （branch `sgms-17`、#18 に stack）
- 設計経緯: [auth-removal-plan.md](auth-removal-plan.md)（§モジュール境界 / §アカウント連携）
- uniba/auth: https://github.com/uniba/auth （OIDC IdP、JWKS 公開待ち）
- my-local-3-hono: `src/identity.ts`、`docs/design_handoff_identity_onboarding/`
