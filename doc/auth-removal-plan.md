# 認証フリー化マイグレーション計画

another-sgms フォークの方向性として、認証機能を可能な限り削除し、URL を踏んだ瞬間にミーティング画面に入りアジェンダを編集できる状態にすることを目指す。本文書はその段階的な移行計画。

## 進捗

- **M1〜M4: 完了** — Guest identity（`X-Agent-Id`）、認証ガード撤去、Devise / OAuth / Stripe / 招待フローの削除、ニックネーム変更 UI まで実装済み
- **M5（keypair 化）/ M6（`MeetingMember` の意味反転）: 未着手** — 下記マイルストーン節を参照

各マイルストーンの実装内容は git 履歴（コミットメッセージ `Add M* of auth-removal plan: ...`）に対応する。

## ゴール

URL を共有された誰もが、ログイン手続きを経ずにそのまま該当ミーティングに参加し、アジェンダを編集できる。

## 思想

1. **ブラウザを実体とみなす**: identity はブラウザ単位の永続データに紐づく。サーバには対応する User レコードが存在するが、本質的な identity は client 側に保持される
2. **権威構造の反転**: 現状の「`Team` / `Project` が所有権を持ち、個人にメンバーシップを与える」モデルから、「個人が痕跡として通り過ぎたことを記録する」モデルへ。`MeetingMember` 等のテーブルは当面残すが、意味を "招待された名簿" から "通り過ぎた痕跡のログ" として再解釈する
3. **段階的詳細化**: identity の厳密さ（UUID → keypair）と権威構造の反転（テーブル意味の改名）は、独立に・後段で進める

## Phase 1 の意思決定

### identity の保存先

**localStorage に UUID** で始める。

- 「誰でも入れて、ある程度永続」という UX 自体まだ未踏なので、厳密性より UX の早期検証を優先する
- 後段で keypair 化する際は、`X-Agent-Id` ヘッダ起点というプロトコル形状を保てば additive な拡張で乗り換え可能

### ランディング画面

**全ミーティングを誰でも見せる**。認証フリーの思想に従い、隠す情報はない。

### 階層構造

**単一の "public" `Team` / `Project` をデフォルトとして使う**。全 `Meeting` をそこにぶら下げる最小破壊路線。`Team` / `Project` 層自体を bypass する案は将来検討。

## ロックイン回避プロトコル

Phase 1 で踏み外すと Phase 2（keypair 化）以降に痛む点:

- `agent_id` (UUID) はそのまま identity トークンとして機能するため、**URL や HTML、GraphQL 応答に絶対に漏らさない**
- 通信は必ず `X-Agent-Id` HTTP ヘッダ経由に統一する
- `current_user.agent_uid` を GraphQL の type に expose しない

## モジュール境界（persona モジュール / #16）

「匿名から始めてブラウザごとにペルソナを持ち運ぶ」中核を、SGMs ドメインから切り離した再利用可能なモジュールとして隔離した（挙動変更なし）。他サービスへの流用と、アカウント接続（#17）の接続点を 1 箇所に固めるのが狙い。

- **Frontend** `app/javascript/lib/persona/` — `index.ts` barrel からのみ export。agent_id ホルダ、join ハンドシェイク（`join_orchestrator`）、トランスポート結線（`createAgentIdLink` / `createJoinRetryLink` / `NOT_JOINED_CODE`）、ActionCable の `appendAgentId`。
- **Backend** `app/lib/persona.rb`（+ `config/initializers/persona.rb`）— app 固有の関心を注入するシーム:
  - `on_join` — join 時のドメイン副作用（既定 no-op。SGMs では `join_default_team!` を配線）。会議体 / プロジェクトの trace は request コンテキストを持つ `JoinAsGuest` mutation 側に残す。
  - `guest_nickname_generator` / `guest_email_factory` — 新規ゲストの表示名・識別子。
  - `AGENT_ID_HEADER` / `AGENT_ID_PARAM` — identity を運ぶワイヤプロトコル名。
- 意図的に含めないもの: `session[:agent_id]`（project-password 用のサーバセッション ULID。`X-Agent-Id` とは別物）、no-op の `Ability`。AR モデル（`User` / `AgentBinding`）は engine / gem 化せず据え置き（2 つ目の利用者が現れたら抽出）。

## アカウント連携（OIDC / #17）

匿名ペルソナを、外部 IdP（初手は [uniba/auth](https://github.com/uniba/auth)）のアカウントに接ぎ木する仕組み。ブラウザごとに持ち運ぶペルソナを、アカウントにも保持できるようにする（公共の広場 → プライベート空間の接続点）。`PERSONA_ACCOUNT_LINKING` env で on/off（既定 off）。auth 本体は未実装なので、検証は stub を差し込んで先行実装している。

### 第 2 の binding

`AgentBinding`（self-asserted な bearer secret）と別に **`AccountBinding(provider, subject)`** を持つ。IdP が検証した identifier なので露出しても安全（agent_uid とは信頼レベルが違うため別テーブル）。ペルソナ（`User`）が結節点で、`UserMerge` は両 binding を移送する。

### フロー（agent_uid を URL に出さない）

1. `beginAccountLink(agentUid)` — `state` を Redis に保存（agent_uid を server 側で保持）、authorize URL を返す
2. ブラウザが authorize URL へ全画面遷移（stub: `/auth/oidc/start`。本番: auth の `/authorize`）
3. `/auth/oidc/callback` — `Persona.config.oidc_verifier` で subject を検証 → `state` から発起ブラウザを解決 → 検証結果を `link_token` で Redis 保存 → `/settings/info?account_link=<token>` へ redirect
4. `completeAccountLink(linkToken, agentUid, confirmMerge)` — `Persona::AccountLink` が bind / adopt / merge。identity 判断は必ず GraphQL 側（`X-Agent-Id` あり）で行い「ブラウザが実体」を保つ

URL に載るのは不透明な `state` / `link_token` のみ。衝突（別ペルソナが同じ subject を保持）は recovery-code claim と同型で、`UserMerge` の preview / confirm を再利用する。

### シーム（`Persona`）

- `oidc_verifier` — `verify(params) -> Identity | nil`。local=`StubVerifier`（param の `sub` を信用）、本番=JWKS 検証（`iss` / `aud` / `hd` / `sub`）を差し替え
- `account_linking_enabled?` — feature flag。GraphQL の書き込み mutation と `/auth/oidc/*` route、`Query.accountLinkingEnabled`（UI 出し分け）を一括で gate

### 未了（本番化に向けて）

- 実 `JwksVerifier`（auth が JWKS 公開＝先方 M2 に到達したら）
- `link_token` とブラウザセッションの結び付けは agent_uid 一致チェックのみ。auth 実装後は state/nonce をセッション Cookie に結ぶ本来の OIDC 手順で強化する

## マイルストーン

### M1: ゲスト identity の発行

- Client: `localStorage['agent_id']` の生成 + Apollo Link で `X-Agent-Id` ヘッダ付与
- Server: Rack ミドルウェアで `X-Agent-Id` を読み、`User.find_or_create_by(agent_uid:)` で Guest User を確保し `current_user` に詰める
- Devise と共存させる（Devise でログイン済なら従来通り、未ログインなら Guest）

→ UI に変化はなし。GraphQL コンテキストに常に user がある状態が成立する。

### M2: 認証ガードの撤去 + auto-join

- `Meeting` / `Project` / `Track` 取得時に対応する `MeetingMember` / `ProjectPermission` 等が無ければ silently insert
- `raise SuperGoodMeetings::LoginRequired` と `meeting.membership?(current_user)` 系ガードの撤去
- Frontend: ログイン画面リダイレクトの bypass、ルートを直接アプリ shell に向ける
- "public" `Team` / `Project` を seed で用意し、新規 `Meeting` はそこにぶら下げる

→ この段階で「URL を踏めばアジェンダが書ける」が成立。デモ可能な最小形。

### M3: Devise / OAuth / Stripe / 招待フローの剥がし

- `devise_for`、`users/omniauth_callbacks_controller.rb`、`api/auth/*`、`stripe_*`、`invite_*` mutation の削除
- `users` テーブルを `agent_uid` / `nickname` / timestamps 程度に縮退

### M4: ニックネーム rename UI

- `RenameSelf` 程度の薄い mutation 1 つ + 簡素な UI

### M5（将来）: keypair 化

- pubkey 登録 mutation + 署名検証ミドルウェア
- `X-Agent-Id` ヘッダ形状は変えず、`X-Agent-Sig` を additive に上乗せ
- IndexedDB に `crypto.subtle.generateKey({ extractable: false })` で Ed25519 / ECDSA キーペアを格納

### M6（将来）: `MeetingMember` → `MeetingTrace` 意味反転

- リネーム migration + 命名整理
- データは M2 時点から既に「通り過ぎた痕跡」として蓄積されている
