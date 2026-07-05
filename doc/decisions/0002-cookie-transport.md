# 0002: cookie transport を spec の第 2 transport として正式化する

日付: 2026-07-05。ステータス: 採用(ハンドオフ §5 論点 5 の決定)。

## 決定

my-local-3-hono の HMAC 署名 session cookie 方式を、header 方式(`X-Agent-Id`)と
**同格の正式 transport** として [protocol.md](../protocol.md) §4 に規定した。
ml3 を header 方式に寄せる案は採らない。

## 理由

- ml3 は「クライアント JS ほぼなし」(htmx + server-rendered)が設計方針。
  通常の form post・ページ遷移にカスタムヘッダは付けられず、header 方式を
  強制すると設計方針ごと壊すことになる。
- ハンドオフ §6(完成の定義)が最初から「両 transport を同格に規定」を要求して
  おり、事実上この方向が既定路線だった。
- 不変条件を credential 抽象(agent_uid bearer / 署名 cookie)の上で書き直した
  ところ、P-1〜P-8(protocol.md §2)は両 transport で無理なく共有できた。
  transport 差は運搬(H-* / C-*)に閉じる。

## 付随して確定したこと

- ml3 の「移行キー」(使い切り・ダイジェスト保存)と another-sgms の
  recovery code を **claim code** として一般化し、OIDC subject の claim と
  同一の決定表(protocol.md §6)に統合した。
- reusable な共有キー(agent_uid の export/import)は不採用(ml3 design handoff
  の確定に従う)。
- ml3 の agent_uid サーバ生成は P-4 の MAY として許容(付録 A に宿題として記載)。
