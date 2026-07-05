# 0003: ライブラリとしての姿勢 — spec は実装中立・consumer 非依存で書く

日付: 2026-07-05。ステータス: 採用。

## 決定

- [protocol.md](../protocol.md) は**実装中立の normative 文書**として書く。
  経緯の叙述、consumer 名(another-sgms / my-local-3-hono)、組織固有の値
  (特定 IdP のドメイン制約など)を含めない。広い読者を想定して**英語**で書く
  (README と同様。ja の設計資料・decision record はこれまで通り)。
- consumer との対応表・現状の逸脱は informative な
  [consumers.md](../consumers.md) に隔離する。spec → consumer への参照は張らない。
- コード・examples からも固有名の前提を外す(例: 開発用 stub が特定 IdP 名を
  ハードコードしない)。

## 理由

初版 draft は handoff の経緯をなぞり、既存 2 実装の現状に寄って書かれていた
(transport 節の見出しが consumer 名、逸脱の付録、特定 IdP の claim 検証など)。
persona-kit は 2 consumer を**想定はするが基準にはしない**。世に広く使われる
ライブラリとして立ち上げるなら、spec は「この protocol が何であるか」だけを
述べ、誰がどう使っているかは別紙に置く。

## 影響

- 要求 ID(P-* / H-* / C-*)は維持。conformance fixture からの参照は不変。
- 0002 の決定(cookie transport 正式化)は変わらない。表現だけ profile 名
  (header profile / cookie profile)に改めた。
