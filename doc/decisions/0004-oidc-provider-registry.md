# 0004: OIDC は単一 verifier シームではなく provider registry にする

日付: 2026-07-05。ステータス: 採用。

## 決定

`Persona.config.oidc_verifier`(単一 verifier の差し替え)を廃止し、
**provider registry** に置き換えた:

- provider 契約: `name` / `authorize_url(state:)` / `verify(params) -> Identity | nil`
- 登録: `Persona.config.register_oidc_provider(provider)`、
  解決: `Persona.oidc_provider(name)`(未登録は `ConfigurationError`)
- 既定の registry は**空**。開発用 `StubProvider`(name 既定 `'stub'`)も
  明示登録が必要 — 未登録の provider は決して verify できない
- `LinkStore` の pending は `{agent_uid, provider}` を保持し、callback が
  開始時と同じ provider で検証する

protocol.md には §7(registry の SHOULD、begin の provider 指定)と
P-13a(provider, subject の一意性、複数 binding の許容)として反映済み。

## 理由

persona-kit の次フェーズは「組織 IdP や Google との紐付けを、consumer が
**モジュール更新で**手に入れる」こと(roadmap.md Phase 2)。単一 verifier
シームは provider が 1 つの世界の形で、複数 IdP 併用・kit 同梱 provider の
配布と両立しない。authorize_url が provider ごとに違う以上、URL 構築と検証は
1 つの provider オブジェクトに束ねるのが自然。

既定を空にしたのは安全側の判断: stub を既定登録すると、本番で消し忘れた
stub が callback params を信用する事故経路になる(P-16 違反)。

## 影響

- 破壊的変更だが pre-v0 で consumer 未接続のため影響なし。
- `StubVerifier` は `StubProvider` に改名(固有 IdP 名のハードコードも廃止、
  name はコンストラクタ引数)。
