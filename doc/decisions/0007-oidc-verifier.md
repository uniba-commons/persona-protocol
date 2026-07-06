# 0007: 実 OIDC verifier を先に TS 側で実装、契約を PKCE/nonce 対応に進化

日付: 2026-07-06。ステータス: 採用。

## 背景

Phase 2(検証済み identity)の第一歩として、uniba/auth 連携を進める(Google より
優先。ユーザー指示)。uniba/auth の実状を確認したところ **github.com/uniba/auth は
「設計ドキュメント(未実装)」**だった: Cloudflare Workers +
`@cloudflare/workers-oauth-provider` で OAuth 2.1 / OIDC AS を建てる計画、上流は
Google Workspace(`hd=uniba.jp`)、クライアントは **JWKS でオフライン検証**
(EdDSA / RS256、鍵ローテ)。live endpoint はまだ無い。

## 決定

### 1. 汎用 OIDC verifier を TS server-core に実装(uniba/auth は preset)

`createOidcVerifierProvider(config)` — authorization code + PKCE、discovery
(`/.well-known/openid-configuration`)、JWKS 取得 + 署名検証、id_token 検証
(iss / aud / exp / nonce / sub + `hd` / email ドメイン)。Web Crypto + fetch のみ
(依存ゼロ、edge / workers 互換)。`unibaAuthProvider(config)` は name / scope /
`hd=uniba.jp` / email ドメイン既定を乗せた薄い preset。

これは module-update-promise(能力は kit に積む、consumer は preset 登録 1 行)
そのもの。特定 IdP のロジックを kit にハードコードせず、汎用 verifier + preset の
構成に保つ(library-posture)。

### 2. TS を先に、Ruby は後追い

uniba/auth 自身のスタックが Workers + JWKS オフライン検証で、server-core の
Web-Crypto ネイティブ・edge 前提と噛み合う。Ruby(another-sgms / header profile)の
実 verifier は JWT/JWKS ライブラリ依存が増えるため後続(roadmap Phase 2)。
consumer 化は consumer の判断に委ねる方針なので、まず TS で設計を固める。

### 3. provider 契約を per-flow stash 対応に進化(pre-v0 の破壊的変更)

実 OIDC の code+PKCE flow は authorize 時に生成した PKCE `code_verifier` と
`nonce` を callback の verify に渡す必要がある。stub 用の
`authorize_url(state) -> String` / `verify(params)` では足りないため:

- `authorize(state) -> { url, stash? }` に変更(stash = per-flow 秘密)
- `verify(params, stash?)` に変更
- `LinkStore` の `PendingData` に `stash?` を追加(begin が保存、callback が渡す)

consumer 未接続の pre-v0 なので破壊的変更で問題なし。**Ruby 側の契約は当面据え置き**
(TS のみ進化)。OIDC flow は cross-language conformance の対象外(共有 fixture は
claim 決定表 / session / wire 名のみ)なので drift しても conformance は壊れない。
Ruby 実 verifier 実装時に `authorize`/stash を Ruby へ反映して再同期する。

### 4. live endpoint 非依存の契約テスト

uniba/auth 未公開のため、**自己署名 JWTS(ローカル生成の RS256 鍵 + JWKS)+ fake
token endpoint(注入 fetch)** で検証の全経路(署名 / iss / aud / exp / nonce /
email ドメイン / 鍵ローテ)をテスト。「完成の定義」§6 が許す「uniba/auth 未公開なら
契約テストのみでも可」に沿う。

## 保留

- uniba/auth の token claim 実態(`hd` を出すか、email/email_verified か)は未確定。
  preset は email ドメイン検査を既定 on(README の「email / email_verified 確認」
  記述が根拠)だが、auth の token spec 確定時に見直す。issuer は consumer 指定。
- Google preset は後回し(uniba/auth 優先)。
- Ruby 実 verifier と契約再同期。
