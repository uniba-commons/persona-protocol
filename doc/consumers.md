# Consumer プロファイル(informative)

persona-kit の想定 consumer 2 者の現状スナップショットと、protocol
([protocol.md](protocol.md))の概念との対応。**本書は informative** —
spec は consumer に依存せず、本書だけが consumer を知る。

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

## consumer 化 PR の参照元

- another-sgms: PR #18(`sgms-16`)/ #19(`sgms-17`)は persona-kit に
  superseded される(マージしない)。consumer 化は `devel` 起点の新規 PR。
- my-local-3-hono: `src/identity.ts` を `packages/hono`(未作成)で置換する PR。
