# 0005: 架空の第 3 consumer(yorimichi)を設計 fixture として導入する

日付: 2026-07-05。ステータス: 採用。

## 決定

実装しない架空の consumer **yorimichi**(Next.js App Router + RSC/Server
Actions、edge、PWA offline、複数 IdP 併用)を [consumers.md](../consumers.md)
に定義し、spec・API の変更は実在 2 者に加えて yorimichi でも成立するかを
検証する運用にする。

## 理由

実在 consumer は「Rails + Apollo SPA」(header)と「htmx server-rendered」
(cookie)の両極で、その間にある**モダンなハイブリッド構成**(SSR + rich
client、edge、offline)の想定が抜ける。2 点しかない入力で一般化すると、
profile の定義が「SPA か server-rendered か」という誤った軸に固まる恐れが
あった。第 3 の点を意図的に置いて三角測量する。

## 初回の還流(protocol.md へ反映済み)

- profile 選択基準を「render 時に credential がどこで要るか」に再定義
  (§2 Choosing a profile)
- C-4 を caller 依存(redirect / fragment / typed result)に一般化
- C-6 新設: rich client 向けの non-secret join 状態(credential は HttpOnly のまま)
- §4 冒頭: cookie profile では WS / SSE に追加運搬が不要

未解決の stress(offline キュー、分散環境での claim 原子性、native 併存)は
consumers.md に宿題として残してある。
