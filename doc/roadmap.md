# Roadmap

persona-kit の約束: **consumer はモジュールを更新するだけで新しい能力を得る**。
アプリ側が書くのは配線(シームへの注入、provider の登録、UI)だけで、
フロー・検証・判断ロジックは kit 側に積む。

## Phase 0 — 立ち上げ(完了)

- seed の de-appification(gem / npm workspace、単体で green)
- protocol spec v0.1 draft(実装中立、header / cookie 両 profile)
- OIDC provider registry(複数 IdP の基盤。stub provider 同梱)
- 架空 consumer yorimichi を設計 fixture として導入

## Phase 1 — consumer 化

- ✅ `conformance/` fixture(claim 決定表 / session cookie / claim code /
  wire 名)と両言語のランナー
- ✅ TS `packages/server-core`: cookie profile のサーバ側共通部
  (session の sign / verify、claim code、claim 決定表)。
  hono / next など framework adapter はこの上の薄い層にする
- `packages/server-core` に link store 契約(OIDC round-trip 用)を追加
- `packages/hono` adapter(my-local-3-hono の `src/identity.ts` を置換)
- another-sgms / my-local-3-hono の consumer 化 PR(同時着地、順序なし)

## Phase 2 — 検証済み identity(IdP 連携の本実装)

現行の stub provider と同じ契約(`name` / `authorize_url(state:)` /
`verify(params)`)で、本物の provider を kit に同梱して配る:

- **OIDC 汎用 provider**(gem / TS server-core): authorization code + PKCE、
  JWKS 取得と id_token 検証(iss / aud / exp / sub、デプロイ固有 claim の
  検査フック)。組織 IdP(例: uniba/auth)はこの構成で登録するだけ
- **Google provider**: 汎用 OIDC provider の preset(discovery URL、scope、
  検証既定)として提供
- consumer 側の獲得手順が「バージョン更新 + `register_oidc_provider` 1 行 +
  リンク UI」で済むことを、実在 consumer で実証する

## Phase 3 — 先の構想(順不同)

- `packages/next` adapter(yorimichi 想定の RSC / Server Actions 配線)
- keypair 化: client 保持の鍵による署名を header profile に additive に追加
  (`X-Agent-Sig`)。bearer → proof-of-possession への段階強化
- claim 原子性の分散環境ガイダンス(consumers.md の宿題を spec へ還流)
- 公開: uniba-commons org、配布方法の決定(decisions/0001 の保留)
