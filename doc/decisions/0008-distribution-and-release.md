# 0008: 配布チャネルとリリース規律

日付: 2026-07-06。ステータス: 採用(publish は未実行)。

## 背景

consumer 評価の結論は「core コードの再利用価値は低い・**契約と conformance が価値**・federation は product-timing で opt-in・**タグが無いと怖くて使えない**」。これを成果物の形にする。[0007](0007-rename-to-persona-protocol.md) で protocol/標準として名乗ることも確定した。

## 決定

1. **配布チャネル = 公開 npm + RubyGems。** 公開ドキュメントを持つ「標準」を widely adopt させる以上、consumer が自由に `npm install` / `gem install` できる公開レジストリが整合。repo は private のままでよい(source と内部 refs が private なだけで、成果物の公開とは独立。[repo-visibility] と両立)。
2. **conformance を独立の成果物にする。** `@uniba-commons/persona-conformance`(`conformance/` 配下、データのみ・実装なし)として版付き publish。「価値は契約と conformance」を pinnable な artifact として具体化する ── consumer は reference 実装に依存せず、自前実装のテストとして採れる。
3. **リリース規律。** npm 側は **Changesets**(`.changeset/`、`access: public`、`baseBranch: main`)。gem 側は `version.rb` + git tag。**`v0.1.0` を最初の pinnable baseline tag** とする(rename 済みの HEAD)。
4. **install される名前は不変。** `@uniba-commons/persona-*` / gem `persona`。内部依存は `"*"` から `"^0.1.0"` に是正(publish 時に consumer が正しい版へ解決するため)。

## 未実行(明示 go 待ち)

- 実際の `npm publish` / `gem push` は **irreversible**(公開レジストリの名前・版は取り消せない)。明示的な合図まで実行しない。
- 公開前に **LICENSE の付与**を要検討(現状ライセンス未宣言。無ライセンスは法的に曖昧)。
- 公開 package 名の差別化([0006](0006-prior-art-positioning.md) の論点)は scoped `@uniba-commons/*` を継続。
