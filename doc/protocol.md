# persona-kit protocol — draft v0.1

ステータス: draft(2026-07-05)。本書が persona-kit の**正**(normative)であり、
言語パッケージ(Ruby gem / TS packages)は本書の adapter に過ぎない。
[persona-module-handoff.md](persona-module-handoff.md) §3 の不変条件を出発点に、
2 つの consumer(another-sgms / my-local-3-hono)を同格の入力として書き起こした。

キーワード **MUST** / **MUST NOT** / **SHOULD** / **MAY** は RFC 2119 の意味で使う。
各要求には ID(`P-*` = 共通、`H-*` = header transport、`C-*` = cookie transport)を
振ってあり、conformance テスト(§10)はこの ID を参照する。

## 1. 概念モデルと用語

- **ペルソナ (persona)** — identity の結節点。サーバ側レコード(consumer の
  `User` / `Profile` など)として存在するが、本質的な帰属先はブラウザ。
  アカウント登録という概念はなく、ペルソナは join の瞬間に生まれる。
- **ブラウザ (browser)** — identity の実体が宿る単位。1 ペルソナは複数ブラウザから
  使える。ブラウザは自分がそのペルソナであることを **credential**(下記)で示す。
- **credential** — ブラウザが request ごとに持参する秘密。transport により形が違う:
  header transport では agent_uid そのもの、cookie transport では署名済み session cookie。
- **agent_uid** — ペルソナとブラウザを結ぶ self-asserted な bearer key。
  不透明な文字列(§8)。IdP 等による検証を経ていないため**秘匿対象**。
- **binding** — ペルソナへの紐づけ。信頼レベルの異なる 2 種がある(P-5):
  - **agent binding**(agent_uid ↔ persona)— self-asserted。秘匿。
  - **account binding**(provider, subject ↔ persona)— IdP 検証済み。露出可。
- **claim code** — 別ブラウザ(または将来の自分)がペルソナを引き取るための
  使い切りコード。another-sgms の recovery code、my-local-3-hono の
  移行キー (migration key) がこれ。§6。
- **join** — 匿名ブラウザがペルソナを獲得する opt-in の瞬間。§5。
- **holder** — ある subject / claim code に現在紐づいているペルソナ。§6。

### Consumer 対応表(informative)

| 概念 | another-sgms | my-local-3-hono |
|---|---|---|
| persona | `User` | `Profile` |
| agent binding | `AgentBinding(agent_uid)` | `profiles.agent_uid` + `browsers(bid)` |
| credential | `X-Agent-Id` ヘッダ(= agent_uid) | HMAC 署名 cookie `{sub, bid}` |
| claim code | recovery code | 移行キー (migration key) |
| account binding | `AccountBinding(provider, subject)` | (未実装、OIDC 対応時に追加) |
| 未 join 書き込みの拒否 | GraphQL error `NOT_JOINED` | middleware が join UI へ redirect |
| join の確定 UI | JoinDialog(クライアント JS) | `/welcome` ページ(server-rendered) |

## 2. 不変条件(transport 非依存の normative core)

- **P-1: 読み取りは匿名。** 未 join のブラウザにも読み取りは開かれる。読み取りの
  ために identity を生成・要求してはならない (MUST NOT)。
- **P-2: 書き込みは opt-in。** 未 join のブラウザの書き込みは拒否し、join への導線を
  返す (MUST)。拒否の信号は論理名 `NOT_JOINED` であり、運搬方法は transport 依存
  (H-4 / C-4)。GraphQL の error code はその一形態に過ぎない。
- **P-3: credential は秘匿。** credential(agent_uid / session cookie の中身)を
  URL・HTML 本文・レスポンス body・ログに出してはならない (MUST NOT)。
  例外は「匿名ブラウザがペルソナを獲得した瞬間」の 1 回だけ(H-3 / C-3)。
- **P-4: サーバは agent_uid を発行して押し付けない。** ペルソナの可搬性は
  ブラウザ側の主導で成立する。header transport ではブラウザが生成 (H-1)。
  cookie transport では join 処理中にサーバ側で生成してもよい (MAY) が、
  その場合も agent_uid を「サーバが払い出した account id」として扱ってはならない —
  検証済み identity と結びつけず、self-asserted なまま保つ (MUST)。
- **P-5: binding の信頼レベルは 2 段。** agent binding は self-asserted で秘匿、
  account binding は IdP 検証済みで露出可。両者を同じテーブル・同じ露出ポリシーで
  扱ってはならない (MUST NOT)。ペルソナが結節点であり、merge は両方の binding と
  ドメインデータを移送する (MUST)。
- **P-6: 衝突は必ず preview → confirm の 2 段階。** 別ペルソナが同じ subject /
  claim code を保持しているとき、confirm なしにデータを変更してはならない
  (MUST NOT)。preview の算出は副作用ゼロ (MUST)。
- **P-7: claim code は使い切り・原文非保存。** claim code は 1 回の消費で無効化し
  (MUST)、保存はダイジェスト(SHA-256 等)のみ (MUST)。消費は原子的に行う
  (MUST — 二重消費の競合を許さない)。再表示・再発行は提供しない (SHOULD NOT;
  代わりに新規発行させる)。
- **P-8: identity 判断は credential 付き request 側で行う。** リダイレクトで受け取る
  token(OIDC の `state` / `link_token` 等)だけで binding を確定してはならない
  (MUST NOT)。最終確定は必ずブラウザが credential を持参する request で行う —
  「ブラウザが実体」を保つ(§7)。

## 3. Transport H — header(another-sgms 系)

クライアントがヘッダを付与できるスタック(SPA + API)向け。

- **H-1:** agent_uid は**ブラウザが生成**する (MUST)。サーバは未知の agent_uid を
  join 時にそのまま受理する。将来の keypair 化(`X-Agent-Sig` の additive な追加)は
  この形状を前提とするため、サーバ生成への変更は不可。
- **H-2:** HTTP request では agent_uid を `X-Agent-Id` ヘッダで運ぶ (MUST)。
  カスタムヘッダを設定できない WebSocket(ActionCable 等)に限り、接続 URL の
  query param `agent_id` を用いる (MAY)。この 2 名は wire 名として固定
  (Ruby: `Persona::AGENT_ID_HEADER` / `AGENT_ID_PARAM`、TS: `persona-core`)。
- **H-3:** サーバはレスポンスに agent_uid を echo しない (MUST NOT)。例外は 2 つ:
  join の受理応答(ブラウザは自分が送った値を持っているため、実際には echo 不要に
  できる)と、**匿名ブラウザが既存ペルソナを獲得した瞬間**(§6-§7 の adopt /
  sign-up ケース。`AccountLink::Result#agent_uid` が non-nil のときで、クライアントは
  この値を `setAgentId` で永続化する)。それ以外で `current_user.agent_uid` 相当を
  API type に expose してはならない (MUST NOT)。
- **H-4:** `NOT_JOINED` の運搬: GraphQL では error `extensions.code = "NOT_JOINED"`
  (MUST)。REST 等では 4xx + machine-readable な code フィールドで同名を返す (SHOULD)。
  クライアント側 adapter はこれを検知して join ハンドシェイク(§5)を起こし、
  ユーザーが join したら**元の書き込みを透過的にリトライ**する (SHOULD)。
- **H-5:** ブラウザ側の保存は durable storage(localStorage 等)で行い、読み取り
  経路では**絶対に生成しない**(P-1 の client 側対応物; MUST)。未 join の
  ブラウザは credential なしで request する。

## 4. Transport C — cookie(my-local-3-hono 系)

クライアント JS をほぼ持たない server-rendered スタック(htmx 等)向け。
ブラウザは agent_uid を直接持たず、**署名済み session cookie** がペルソナへの参照を
運ぶ。agent_uid はサーバ側でペルソナの anchor として保持される。

- **C-1:** session cookie は改竄防止のため MAC 付きとする (MUST)。参照実装は
  HMAC-SHA256(Web Crypto、edge 互換)で `{sub: <persona id>, bid: <browser id>, exp}`
  を署名。検証は timing-safe 比較 (MUST)、`exp` 超過は不成立 (MUST)。
- **C-2:** cookie 属性は `HttpOnly`(MUST)、https 配下では `Secure`(MUST)、
  `SameSite=Lax` 以上 (SHOULD)。cookie 値そのものが credential なので P-3 が適用される。
- **C-3:** P-3 の「獲得の瞬間」は `Set-Cookie` として現れる — join 確定・claim 消費の
  応答でのみ session cookie を発行する (MUST)。agent_uid はレスポンスに一切
  出さない(現行 ml3 では wire 上に一度も現れない)。
- **C-4:** `NOT_JOINED` の運搬: 未 join の書き込みはサーバ側 middleware が拒否し、
  join UI(またはそれを提供する画面)へ誘導する (MUST)。server-rendered では
  redirect がそれに当たる。guest に許す write(join フロー自体・claim 消費・
  招待申請など)は明示的な allowlist とする (SHOULD)。
- **C-5:** per-browser の識別子(`bid`)を session に併載してよい (MAY)。これは
  「このペルソナを使っているブラウザ一覧」表示のためのメタデータであり、
  credential の一部として単独で信用してはならない (MUST NOT)。

## 5. Join ハンドシェイク

join は「匿名ブラウザがペルソナを獲得する」opt-in の瞬間。両 transport とも
**propose → confirm** の 2 段で行う(ユーザーが確定するまでペルソナを作らない)。

- **P-9:** ペルソナの作成はユーザーの明示的な確定操作による (MUST)。読み取りや
  エラー発生の副作用として silent にペルソナを作ってはならない (MUST NOT)。
- **P-10:** join 時にニックネーム等の初期値をサーバが提案してよい (MAY)。確定前の
  提案状態は、header transport ではクライアント側(dialog の state)、cookie
  transport では短寿命の署名付き pending cookie(ml3: 1h)等に保持する。
  確定前にドメインデータを書いてはならない (MUST NOT)。
- **P-11:** join の確定でサーバは agent binding を作成し、consumer の join 副作用
  (`Persona.config.on_join`)を走らせる (MUST)。join は冪等に再訪できる —
  既知の agent_uid の再 join はエラーではなく既存ペルソナの解決になる (MUST)。

フローの対応(informative):

| 段階 | header(sgms) | cookie(ml3) |
|---|---|---|
| 起点 | 書き込みが `NOT_JOINED` で拒否され dialog が開く | guest が「参加する」/ 書き込み導線を踏む |
| propose | dialog が `generateAgentId()` で候補生成 | `/join` が招待検証 + pending cookie 設置 |
| confirm | ユーザーが dialog で承諾 → join mutation | `/welcome` で「参加する」→ `/join/confirm` |
| 確定後 | `setAgentId` で永続化、元の書き込みをリトライ | `Set-Cookie` して本画面へ redirect |

## 6. Claim — ペルソナの引き取り(recovery code / 移行キー / OIDC subject)

**claim は 1 つの同型なイベント**である: 「subject(claim code のダイジェスト、
または IdP 検証済みの (provider, subject))が holder を指し、行為中のブラウザが
その holder を引き取る or subject を自分に結ぶ」。persona-kit の判断ロジック
(`Persona::AccountLink.perform`)はこの決定表を実装する:

| # | ブラウザの状態 | holder | 動作 | 結果の credential |
|---|---|---|---|---|
| 1 | 匿名 | 不在 | ゲスト新規作成 + subject を bind(sign-up) | agent_uid を echo(H-3 例外)/ Set-Cookie |
| 2 | 匿名 | 存在 | holder を adopt、このブラウザの binding を追加(restore) | 同上 |
| 3 | join 済み(=holder) | 自分 | 冪等 no-op | 変更なし |
| 4 | join 済み | 不在 | subject を現ペルソナに bind(link) | 変更なし |
| 5 | join 済み(≠holder)、confirm なし | 存在 | **preview を返すのみ、無変更**(P-6) | 変更なし |
| 6 | join 済み(≠holder)、confirm あり | 存在 | merge: 現ペルソナを holder に統合、source は退役 | ブラウザは holder を指す |

- **P-12:** 上表 5→6 の遷移で、preview 提示から confirm までの間に holder が変わり
  うる。confirm 時に holder を再解決し、変わっていれば再度 preview に落とす
  (SHOULD)。merge の実行はトランザクション内 (MUST)。
- **P-13:** merge は source の agent binding・account binding・ドメインデータを
  target に移し、source を退役させる (MUST)。方向は常に「行為中のペルソナ →
  holder」(subject の帰属は動かさない)。

claim code の発行・消費(P-7 の具体化):

- 発行はペルソナ保持ブラウザからの credential 付き request で行う (MUST)。
- 表示はその場限り (SHOULD)。ml3 の UI 仕様: 再表示不可・「再発行」ボタンを
  置かない・ブラウザを増やすたび新規発行。
- 入力は正規化してから照合する (SHOULD — ml3: 大文字化 + 英数字以外を除去)。
  表示形式は 4 文字区切り(`XXXX-XXXX-…`)を推奨 (MAY)。
- 有効期限は consumer 判断 (MAY)。付ける場合も P-7 の使い切り性が主防御。

## 7. OIDC アカウント連携

account binding(P-5 の検証済み側)を作るための、IdP(初手 uniba/auth)との
round-trip。全体を feature flag(`PERSONA_ACCOUNT_LINKING`、既定 off)で gate する。

```
begin ──▶ authorize(IdP)──▶ callback ──▶ complete
 |            |                |             |
 | state 発行  | 全画面遷移      | verify       | link_token を credential 付き
 | pending 保存 |               | result 保存   | request で消費 → §6 決定表
```

1. **begin** — credential 付き request。サーバは opaque な `state` を発行し、
   `state → agent_uid` を短寿命保存(参照実装 `Oidc::LinkStore`、TTL 600s)。
   authorize URL を返す。
2. **authorize** — ブラウザが IdP へ全画面遷移。stub 環境では自前の
   `/auth/oidc/start`。
3. **callback** — `Persona.config.oidc_verifier`(契約:
   `verify(params) -> Identity(provider, subject) | nil`)で検証。`state` を
   **単回消費**して発起ブラウザを解決し、検証結果を opaque な `link_token` で
   短寿命保存(TTL 300s)。UI へ redirect(URL に載るのは `link_token` のみ)。
4. **complete** — credential 付き request で `link_token` を渡し、§6 の決定表を
   実行。merge preview の往復があるため `link_token` の読み出しは非破壊とし、
   最終成功時に破棄する。

- **P-14:** URL に載せてよいのは opaque な `state` / `link_token` のみ (MUST)。
  agent_uid・persona id・subject を query に載せてはならない (MUST NOT)。
- **P-15:** `state` は単回消費 (MUST)。`link_token` は confirm 往復のため
  再読み出し可だが TTL を持ち (MUST)、成功時に破棄する (MUST)。
- **P-16:** verifier は同一契約(`verify(params) -> Identity | nil`)を保って
  差し替え可能とする (MUST)。本番 verifier は code 交換 + JWKS 検証 +
  `iss` / `aud` / (uniba/auth では `hd = uniba.jp`) / `sub` の検証を行う。
  StubVerifier(param の `sub` を信用)は開発・テスト専用であり、本番投入は
  不可 (MUST NOT)。

既知の弱点(uniba/auth 実装後に強化): `link_token` とブラウザの結び付けが
agent_uid 一致チェックのみ。本来の OIDC 手順(state/nonce をセッション cookie に
結ぶ)へ引き上げる。

## 8. agent_uid フォーマット

- **P-17:** agent_uid は**不透明な文字列**である (MUST)。サーバは形式を解釈せず、
  等値比較のみに使う。consumer 間でフォーマットを揃える必要はない。
  - another-sgms: UUID v4(`crypto.randomUUID()`)
  - my-local-3-hono: Crockford base32、24 文字(≈120 bit)
- **P-18:** 新規生成は CSPRNG により 120 bit 以上のエントロピーを持つ (MUST)。
- **P-19:** 受理側の検証は「印字可能 ASCII・空白なし・長さ上限(256 推奨)」程度に
  とどめる (SHOULD)。特定フォーマットの強制は将来の consumer を縛るため避ける。

## 9. セキュリティ考慮事項

- agent_uid は bearer secret — 漏えい=なりすまし。P-3 の徹底(ログ含む)が第一。
  header transport ではアクセスログに query param が残らないよう、WebSocket 用
  `agent_id` param のログ除外を確認すること。
- claim code はダイジェスト保存 + 原子的消費(P-7)により、DB 露出・二重使用に
  耐える。
- cookie transport の秘密鍵(HMAC key)はサーバ側 secret。ローテーション時は
  全ブラウザの再 join…ではなく、多重鍵検証(新旧 2 鍵)での移行を推奨 (SHOULD)。
- merge は破壊的操作(source 退役)。P-6 の preview → confirm を UI で薄めない
  こと(「OK」連打で通る 1 クリック確認にしない)。
- 匿名読み取り(P-1)はスクレイピングにも開かれる。それは思想上の選択であり、
  必要なら rate limit 等 identity 以外の層で守る。

## 10. 適合性(conformance)

consumer / 言語実装は、上記の ID 付き要求を満たすことを本書基準で確認する。
共有テストベクタ(両言語の実装に同じ入力を流す)は次の 3 系を予定:

1. **claim 決定表**(§6 の 6 ケース + P-12 の holder 再解決)— Ruby は
   `Persona::AccountLink`、TS は hono パッケージ(未作成)が対象。fixture は
   JSON で `{browser_state, holder_state, confirm} -> {action, echo, merged}`。
2. **session cookie**(C-1)— sign/verify のベクタ(key, payload, exp, token)。
   改竄・期限切れ・フォーマット不正の負例を含む。
3. **wire 名**— `X-Agent-Id` / `agent_id` / `NOT_JOINED` の両言語定数の一致
   (Ruby `Persona::*` = TS `persona-core`)。

fixture の置き場所は `conformance/`(未作成)。

## 付録 A: 現状の逸脱と宿題(informative)

- **ml3: agent_uid がサーバ生成**(`/join` 内 `newAgentKey()`)。P-4 の MAY の
  範囲内だが、header transport への将来的な合流(または keypair 化)を望むなら
  ブラウザ生成へ寄せる選択肢がある。現状は cookie transport の正式な形とする。
- **ml3: reusable な「共有キー」は不採用に確定**。design handoff(identity
  onboarding)で、agent_uid の export/import ではなく使い切りの移行キーが確定版。
  本 spec はこれを claim code として一般化した(§6)。
- **another-sgms: recovery code は consumer 側実装**(`claimRecoveryCode`)。
  §6 の決定表に合流させ、`Persona::AccountLink` と同じ port を通す移植が
  consumer 化 PR の作業項目になる。
- **NOT_JOINED の HTML fragment 運搬**(htmx で部分更新する書き込みの拒否応答)は
  ml3 に実例がまだない(現状は全て redirect)。実例が出たら C-4 に追記する。
