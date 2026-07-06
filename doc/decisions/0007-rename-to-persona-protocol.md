# 0007: プロジェクト名を persona-protocol に改める

日付: 2026-07-06。ステータス: 採用。

## 決定

プロジェクトの名称・自己紹介を **persona-kit → persona-protocol** に改める。

## 理由

positioning が「再利用する codebase」ではなく「**conform する contract / protocol**」に定まった(consumer 評価の三角測量の結論。[library-posture](0003-library-posture.md) を参照)。`kit`(SDK / toolkit)は「コードを組み立てる部品袋」を連想させ、**最初の一語で positioning と逆を向く**。[0006](0006-prior-art-positioning.md) の「内部名 persona-kit は継続可・公開名は差別化語を再検討」を、この方向で確定(refine / supersede)する。

## 範囲

**今回変更した(= 自己紹介面):**

- root `package.json` の `name`
- 公開ドキュメント一式(`docs/` サイト + `docs/spec/`)、`README.md`
- VitePress の `title` / nav、`netlify.toml`
- npm パッケージの `description`、gem の `description`

**変更しない(温存 / 別作業):**

- **install される artifact 名は不変** — `@uniba-commons/persona-*` / gem `persona`。これらに `kit` は元々含まれない。
- **GitHub repo slug の改名(当初は別作業予定 → 同セッションで実施済み)。** `uniba-commons/persona-kit` → `uniba-commons/persona-protocol`(`gh repo rename`、ローカル `origin` remote も自動更新)。公開 repo URL 2箇所(VitePress socialLink、gemspec `homepage`)も新 slug に更新済み。GitHub が旧 slug を redirect するため既存参照は壊れない。**要確認(手動): Netlify 連携が新 repo に追従しているか(dashboard)。**
- **ローカルパス** `~/projects/persona-kit` と `.claude/settings.local.json` のパス。
- **履歴記録**(`persona-module-handoff.md`・過去 ADR・`prior-art.md` 等)は書き換えない。当時の名称の記録として残す。
- **公開 package 名そのものの差別化**([0006](0006-prior-art-positioning.md) の別論点)は未決。scoped `@uniba-commons/*` を継続。

## タイミング

pre-v0・tag ゼロ・未 publish の今が最も安価。release-first(tag + conformance の成果物化)の **前** に確定させる。publish 後は改名コストが跳ね上がるため。
