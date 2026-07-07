# 0008: 配布チャネルとリリース規律

日付: 2026-07-06。ステータス: 採用(publish は未実行)。

## 背景

consumer 評価の結論は「core コードの再利用価値は低い・**契約と conformance が価値**・federation は product-timing で opt-in・**タグが無いと怖くて使えない**」。これを成果物の形にする。[0007](0007-rename-to-persona-protocol.md) で protocol/標準として名乗ることも確定した。

## 決定

1. **配布チャネル = 公開 npm + RubyGems。** 公開ドキュメントを持つ「標準」を widely adopt させる以上、consumer が自由に `npm install` / `gem install` できる公開レジストリが整合。repo は private のままでよい(source と内部 refs が private なだけで、成果物の公開とは独立。[repo-visibility] と両立)。
2. **conformance を独立の成果物にする。** `@uniba-commons/persona-conformance`(`conformance/` 配下、データのみ・実装なし)として版付き publish。「価値は契約と conformance」を pinnable な artifact として具体化する ── consumer は reference 実装に依存せず、自前実装のテストとして採れる。
3. **リリース規律。** npm 側は **Changesets**(`.changeset/`、`access: public`、`baseBranch: main`)。gem 側は `version.rb` + git tag。**`v0.1.0` を最初の pinnable baseline tag** とする(rename 済みの HEAD)。
4. **install される名前。** npm は scoped の `@uniba-commons/persona-*` を継続。gem は当初 flat の `persona` を維持する計画だったが、RubyGems 上で無関係な `persona`(放棄状態)と衝突するため、**配布名を `persona-protocol` に差別化**する(repo・npm scope の物語と一致)。require パスと namespace は `require 'persona'` / `Persona::` のまま ── install 名だけが変わり、consumer の既存コードは不変。内部依存は `"*"` から `"^0.1.0"` に是正(publish 時に consumer が正しい版へ解決するため)。

## 未実行(明示 go 待ち)

- 実際の `npm publish` / `gem push` は **irreversible**(公開レジストリの名前・版は取り消せない)。明示的な合図まで実行しない。
- ~~公開前に LICENSE の付与を要検討~~ → **MIT で付与済み**、著作権表記は entity 非依存の collective **`UNIBA COMMONS Authors`**(上記 更新)。これにより LICENSE 帰属は新法人設立を待たない。collective の実体は `AUTHORS`(root と gem に配置、現状 Haruma Kikuchi のみ)。`uniba-commons` npm org への追加は **2026-07-07 完了**。**publish の残りゲートは実質「明示 go」のみ**(実行時に publish するマシンで `npm login` / RubyGems ログインが必要 — 現状このマシンは未ログイン)。新法人名義に切り替えるかどうかは product-timing の選択で、publish の前提条件ではない。
- 公開 package 名の差別化([0006](0006-prior-art-positioning.md) の論点)は npm は scoped `@uniba-commons/*` を継続、gem は上記 決定 4 のとおり `persona-protocol` へ差別化。

## 更新(2026-07-06、publish 前 consumer フィードバック)

publish 前に 2 consumer(another-sgms=Ruby・my-local-3-hono=Hono)で試験導入し、issue #1 / #2 にフィードバックを収集。blocker と freeze correctness を反映済み:

- **gem 名衝突** → 配布名を `persona-protocol` に差別化(決定 4 を改訂)。
- **scoped npm package に `publishConfig.access: "public"` を明示**(scoped の初回 publish が restricted に落ちるのを防ぐ)。
- **`wire-names.json` の `spec` パス**を旧 `doc/protocol.md §10.3` から現行 `docs/spec/header-profile.md` に修正(conformance vector に凍結される前に是正)。
- **LICENSE = MIT に決定。** repo root と gem に `LICENSE`、各 `package.json` の `"license"` と gemspec の `spec.license` に MIT を記載。Apache-2.0(特許グラント)/ vectors の CC0 分割も検討したが、npm・gem ecosystem の既定である MIT で摩擦最小を優先(枯れた技術で特許リスクは低いと判断)。`@uniba-commons/auth` に倣った公開だが、auth 自身は `license` 未記載なので、そこは MIT 明記で上回る。著作権表記は **`UNIBA COMMONS Authors`**(Go の "The Go Authors" と同じ collective 形。`Uniba Inc.` は不採用)。この collective 形は特定法人に紐付かないので、**LICENSE の帰属は新法人の設立と独立して確定**している。フッターはブランド表記 `UNIBA COMMONS`(→ uni.ba)のまま。

DX / spec の非 blocker(read-gate `requirePersona`、pending payload の型制約緩和、conformance の profile×level 適用表、cookie interop の主張スコープ化、P-3 placeholder 規約)も同 issue で対応済み。
