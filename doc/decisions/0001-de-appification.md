# 0001: De-appification — seed を単体でビルド・テスト可能にする

日付: 2026-07-05。ステータス: 実施済み(暫定決定を含む — 見直し歓迎)。

seed(verbatim コピー)を standalone にするための最初の一括作業。ハンドオフ
[persona-module-handoff.md](../persona-module-handoff.md) §5 の論点のうち、この作業が
先取りせざるを得なかったものはここに暫定決定として記録する。

## 決定

### Ruby: plain gem + シーム(論点 3 → ハンドオフの推奨どおり)

- `gems/persona/` を gemspec 付きの plain gem に。Rails engine にはしない。
- ActiveSupport 依存を除去: `ActiveModel::Type::Boolean` → 自前の falsey リスト
  (`0/f/false/off`、大文字含む — Rails 由来の consumer で挙動が変わらないよう互換)、
  `.presence` / `.blank?` → plain Ruby。
- specs は `rails_helper` を捨て、fake(in-memory store / fake redis)で単体実行。
  `bundle exec rspec` が green であることが standalone の定義。

### AccountLink はストレージ port を規定、実装は consumer(論点 1 の暫定回答)

bind / adopt / merge の判断ロジックは gem が持ち、永続化はすべて port
(`Persona.config.account_link_store`)経由にした。port の契約は
`lib/persona/account_link.rb` のコメントに、ActiveRecord 実装例は
`examples/rails_account_link_store.rb` に(元の AR 直書きコードの知識をそのまま移植)。

- 理由: my-local-3-hono は AR を使わない(raw SQL)。判断ロジックを共有するには
  永続化を抽象化するしかなく、ハンドオフ §2「ストレージ adapter 契約として一部を
  吸い上げる余地がある」の案を採用した形。
- user オブジェクトは host のものをそのまま流し、要求は安定した `#id` のみ。
- `create_guest!` は「agent_uid に bind 済みの guest を返し、app 通常の join 副作用も
  済ませる」contract(元の `User.join_as_guest!` と同義)。

### LinkStore は Redis 注入点化(論点 3 の補足どおり)

`RedisPool.app`(host グローバル)への直接参照をやめ、
`LinkStore.new(redis:)` に。raw client(`get/set/del`)と connection pool(`#with`)の
両方を受ける。インスタンスは `Persona.config.link_store` に登録。

### TS: §5 構成案どおり 3 パッケージに分割(npm workspace)

- `packages/core` — agent_uid 保持、join ハンドシェイク、**プロトコル定数**。
  transport / framework 依存なし。
- `packages/apollo` — `createAgentIdLink` / `createJoinRetryLink`。
  `@apollo/client/core` エントリを使い React 非依存に。
- `packages/cable` — `appendAgentId`。
- `packages/hono` は protocol spec(cookie transport)が書けてから追加する。

### プロトコル定数は core が持つ(両言語)

`AGENT_ID_HEADER` / `AGENT_ID_PARAM` / `NOT_JOINED_CODE` を TS core の
`protocol.ts` と Ruby の `Persona` 直下に対で定義。`NOT_JOINED` は
「GraphQL error code」ではなく transport 非依存の名前とした(ハンドオフ §7-1 の
指摘どおり)。Ruby 側にも `NOT_JOINED_CODE` を新設(seed には無かったが、
サーバ側が返すべき名前は protocol の一部)。

### uuid パッケージを捨てて platform crypto に

`generateAgentId` は `crypto.randomUUID()`(secure context 外では
`getRandomValues` 組み立てに fallback)。依存ゼロ、edge 互換。
なお my-local-3-hono の agent key は UUID ではなく Crockford base32 24 文字 —
**agent_uid のフォーマットは protocol spec では「不透明な文字列」として規定すべき**
で、UUID は another-sgms 系 consumer のデフォルトに過ぎない(protocol.md 執筆時の宿題)。

## 保留(論点のまま残っているもの)

- **論点 2(配布方法)**: 未決。gem 名 `persona` / npm scope `@uniba-commons` は
  ローカル用の仮置き。rubygems.org には既存の `persona` gem がありうるので、公開時に
  `persona-kit` 等への改名を検討。
- **論点 4(JWKS verifier)**: 未着手。uniba/auth の JWKS 公開待ち。契約テストのみ先行可。
- **論点 5(cookie transport の正式化)**: protocol.md 執筆時に決める。ml3 の
  実装(HMAC-SHA256 署名 cookie、pending-join cookie、共有キー export/import)は
  同格の入力として扱う。
