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
- ✅ `packages/hono` adapter(cookie profile の framework 結線: session /
  pending cookie、persona 解決 middleware、`NOT_JOINED` gating)。
  my-local-3-hono の `src/identity.ts` の identity/session/claim 中核を置換
  (nickname / avatar 等の presentation helper は app 側に残る)
- ✅ `packages/server-core` に OIDC link-store 契約 + round-trip
  オーケストレーション(provider registry / `KVStore` port /
  begin・callback・complete)を追加。header / cookie 両 profile 非依存
- another-sgms / my-local-3-hono の consumer 化 PR(同時着地、順序なし)

## Phase 2 — 検証済み identity(IdP 連携の本実装)

provider 契約(`name` / `authorize` / `verify`)のまま、本物の provider を
kit に同梱して配る:

- ✅ **OIDC 汎用 verifier**(TS server-core `createOidcVerifierProvider`):
  authorization code + PKCE、discovery、JWKS 取得 + 署名検証(RS256 / ES256 /
  EdDSA、鍵ローテ)、id_token 検証(iss / aud / exp / nonce / sub + デプロイ
  固有 claim: `hd` / email ドメイン)。**自己署名 JWKS の契約テストで検証済み**
  (uniba/auth の live endpoint に依存しない)
- ✅ **uniba/auth preset**(`unibaAuthProvider`): 汎用 verifier に name /
  scope / `hd=uniba.jp` / email ドメイン既定を乗せた薄い設定。uniba/auth は
  未実装(設計ドキュメント段階)なので issuer は consumer 指定、token claim の
  ドメイン検査は暫定(auth の token spec 確定時に見直す)
- **Ruby 側の実 verifier**(gem): 同じ provider 契約の Ruby 実装。header
  profile の consumer(another-sgms)向け。TS 契約の `authorize`/stash 変更を
  Ruby にも反映して再同期する
- **Google provider preset**: 汎用 verifier の preset として後日提供(uniba/auth
  を優先したため後回し)
- consumer 側の獲得手順が「バージョン更新 + provider 登録 1 行 + リンク UI」で
  済むことを、実在 consumer で実証する

## Phase 3 — 先の構想(順不同)

- `packages/next` adapter(yorimichi 想定の RSC / Server Actions 配線)
- keypair 化: client 保持の鍵による署名を header profile に additive に追加
  (`X-Agent-Sig`)。bearer → proof-of-possession への段階強化
- claim 原子性の分散環境ガイダンス(consumers.md の宿題を spec へ還流)
- 公開: uniba-commons org、配布方法の決定(decisions/0001 の保留)
