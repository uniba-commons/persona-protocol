# Consumer プロファイル(informative)

persona-kit の想定 consumer の現状スナップショットと、protocol
([protocol.md](protocol.md))の概念との対応。**本書は informative** —
spec は consumer に依存せず、本書だけが consumer を知る。

consumer は実在 2 者(another-sgms / my-local-3-hono)+ 設計を鍛えるための
**架空 1 者(yorimichi、§架空 consumer)**。spec の変更は 3 者すべてで検証する。

## 対応表

| protocol の概念 | another-sgms | my-local-3-hono |
|---|---|---|
| transport profile | header(§3) | cookie(§4) |
| persona | `User` | `Profile` |
| agent binding | `AgentBinding(agent_uid)` | `profiles.agent_uid` + `browsers(bid)` |
| credential | `X-Agent-Id` ヘッダ(= agent_uid) | HMAC 署名 cookie `{sub, bid}` |
| claim code | recovery code | 移行キー (migration key) |
| account binding | `AccountBinding(provider, subject)` | (未実装、OIDC 対応時に追加) |
| `NOT_JOINED` の運搬 | GraphQL `extensions.code` | middleware が join UI へ redirect |
| join の確定 UI | JoinDialog(クライアント JS) | `/welcome` ページ(server-rendered) |
| agent_uid 形式 | UUID v4 | Crockford base32・24 文字 |

join フローの対応(protocol.md §5 の表の具体例):

| 段階 | another-sgms | my-local-3-hono |
|---|---|---|
| 起点 | 書き込みが `NOT_JOINED` → dialog | guest の「参加する」導線 |
| propose | `generateAgentId()` で候補生成 | `/join` が招待検証 + pending cookie |
| confirm | dialog 承諾 → join mutation | `/welcome` →「参加する」→ `/join/confirm` |
| 確定後 | `setAgentId` + 元の書き込みをリトライ | `Set-Cookie` → 本画面へ redirect |

## 現状の spec からの逸脱・宿題

- **ml3: agent_uid がサーバ生成**(`/join` 内 `newAgentKey()`)。P-4 の MAY の
  範囲内。header profile への将来的な合流や keypair 化を望むならブラウザ生成へ
  寄せる選択肢がある。
- **ml3: reusable な「共有キー」は不採用**(design handoff で使い切りの移行キーが
  確定)。spec はこれを claim code として一般化済み(§6)。
- **another-sgms: recovery code は consumer 側実装**(`claimRecoveryCode`)。
  consumer 化 PR で §6 の claim 決定表(`Persona::AccountLink` の port)に
  合流させる。
- **ml3: `NOT_JOINED` の HTML fragment 運搬**(htmx 部分更新での拒否応答)は
  実例なし(現状すべて redirect)。実例が出たら C-4 に還流する。
- **another-sgms: OIDC の state をブラウザセッションに未結線**(P-16a)。
  IdP 本実装時に引き上げる。

## 架空 consumer: yorimichi(設計 fixture)

実装しない第 3 の consumer。実在 2 者がどちらも「Rails SPA」「htmx
server-rendered」という両極で、その間にある**モダンなハイブリッド構成**の想定が
抜けやすいため、設計変更のたびに「yorimichi で成立するか」を問う fixture として置く。

**想定アプリ**: 通勤・散歩の寄り道メモを地図に残す PWA。匿名で始まり、
ペルソナをブラウザに宿し、スマホ+PC で使うために claim code を使う。

**アーキテクチャ(2026 年時点のモダン構成を意図的に寄せ集め)**:

| 層 | 選択 |
|---|---|
| フレームワーク | Next.js App Router(RSC + Server Actions、streaming SSR) |
| ランタイム | edge(Web Crypto のみ、Node API なし、多リージョン) |
| DB | serverless Postgres(HTTP driver) |
| realtime | SSE(presence)+ 同一オリジン WebSocket |
| クライアント | rich client(React)+ PWA(offline キュー、Background Sync) |
| transport profile | **cookie**(SSR personalization に credential が要るため) |
| account linking | Google + 組織 IdP の 2 provider 併用 |

**この fixture が既に spec に還流させたもの**:

- profile の選択基準を「クライアント JS の量」から「**render 時に credential が
  どこで要るか**」に再定義(§2 Choosing a profile)。rich client でも SSR するなら
  cookie profile が正、という帰結は yorimichi なしでは出てこなかった。
- `NOT_JOINED` の cookie profile 運搬を caller 依存に一般化(C-4: redirect /
  fragment / RPC・server action の typed result)。
- rich client が credential に触れずに join 状態を知る手段(C-6: non-secret
  metadata、credential cookie は HttpOnly のまま)。
- 複数 provider の同時登録(§7 registry、P-13a)。
- cookie profile では WS / SSE に追加の運搬が不要(§4 冒頭)— header profile の
  query param fallback(H-2)が ActionCable 固有の妥協だったことの裏づけ。

**未解決の stress(spec の宿題)**:

- **offline キューと join**: Background Sync が未 join のまま書き込みを flush
  したときの `NOT_JOINED` 再処理。クライアント adapter の関心だが、spec が
  「リトライは冪等であるべき」程度の指針を持つべきかは未定。
- **多リージョン edge での claim 原子性**: P-7 の原子的消費は単一 DB なら自明だが、
  リージョン分散 KV に claim code を置くと壊れる。「claim の消費は単一の
  linearizable なストアで行う (SHOULD)」の追記候補。
- **native アプリ版 yorimichi**(cookie jar なし)を作るなら header profile との
  併存になる — 「1 アプリ 1 profile」原則(§2)と「同一ペルソナを 2 profile の
  デプロイが共有する」ことの整理。

## consumer 化 PR の参照元

- another-sgms: PR #18(`sgms-16`)/ #19(`sgms-17`)は persona-kit に
  superseded される(マージしない)。consumer 化は `devel` 起点の新規 PR。
- my-local-3-hono: `src/identity.ts` を `packages/hono`(未作成)で置換する PR。
