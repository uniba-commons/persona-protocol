# 0006: 先行事例調査の結論 — 作り続ける、DPoP を昇格の的に、名前は要再考

日付: 2026-07-06。ステータス: 採用。

## 決定

先行事例調査([prior-art.md](../prior-art.md))を踏まえ、以下を確定する。

1. **persona-kit を作り続ける。** 6 要素の同時成立(匿名読み取り + per-browser
   anchor + single-use claim code 移送 + merge preview→confirm + verified
   grafting + lock-in 回避)を transport 非依存 protocol にまとめた既存物は無い。
   既存を採用して置き換える選択肢は却下。
2. **step 6(keypair 昇格)は DPoP(RFC 9449)を参照実装の target とする。**
   自前設計せず、`jkt` thumbprint・`jti`・server nonce の replay 防止を踏襲。
   DBSC は session 硬化専用(per-session/per-site、cookie 消去で消える)で
   identity anchor 不可のため、依存先ではなく参照方向に留める。roadmap Phase 3。
3. **公開 package 名は bare `persona` を使わない。** npm `persona` は
   withpersona.com の KYC SDK が現役(週 34.6 万 DL)、gem `persona` も取得済み、
   "Persona" は Mozilla の死んだ identity プロジェクト名。scoped
   `@uniba-commons/persona-*` は技術的には可だが brand 混同コストあり。公開時に
   差別化語を含む名前を再検討する(内部開発名 persona-kit は継続可)。

## 独自性として保持・強化するもの

- **merge を protocol レベルで preview→confirm 保証(P-6)** — 商用 BaaS
  (Firebase/Supabase/Auth0/PlayFab)は例外なくアプリに丸投げしており、ここが
  実質的な差別化点。強化・明文化する。
- **claim code は keypair ではなく server-anchored persona への参照を移送する** —
  local-first(Seitan/HALO/wormhole)との設計上の分岐点。protocol.md に明記。
- **persona は既定で disposable(ステハン)、grafting で持続(コテハン)** —
  アカウント中心設計に出せない二面性。将来 protocol 導入部で言語化を検討。

## フォロー(prior-art.md §7 由来)

- protocol.md に非規範的注記: DBSC の位置づけ / did:nostr の recovery gap /
  SSI 4 要件のうち persistence のみ意図的に満たす。
- merge preview UI 文言は PlayFab の教訓(「統合」より「選択」)を consumer に助言。
- short claim code を検討する場合の PAKE(magic-wormhole)参照。
