# Prior art & positioning

調査日: 2026-07-06。informative。persona-kit を「作り続けるか、既存を採用するか」を
判断するための先行事例調査。deep-research harness による多角検索 → ソース精読 →
敵対的検証(49 票、反証 0)で確定した主張を土台に、日本の匿名掲示板文化からの
系譜(§6)を加えて合成した。引用元は各節末尾。

## 0. 結論

**作り続けるべき。** ただし persona-kit の 6 要素は独創性が一様ではない:

- **anonymous-first + verified grafting(OIDC 接ぎ木)は完全な既定路線**。
  Firebase / Supabase / Auth0 / PlayFab / Jazz すべてが「匿名で始め、後から
  検証済み credential を同一アカウントに link する」in-place graft を実装済み。
  ここは**車輪の再発明**であり、我々の仕事は「発明」ではなく「移植可能な形での
  標準化」。
- **merge preview → confirm は明確に差別化された貢献**。上記の商用 BaaS は
  **例外なく衝突時 merge をアプリに丸投げ**している(§1)。protocol レベルで
  merge を規定するのは persona-kit 独自。
- **claim code は local-first 界隈に先行例があるが、我々の使い方は別物**。
  single-use 移送コード自体は @localfirst/auth の Seitan、magic-wormhole、
  DXOS HALO が持つ(§3)。ただし彼らが移送するのは *client-held keypair* で、
  persona-kit が移送するのは *server-anchored persona への参照* — 設計の力点が違う。
- **keypair 昇格(step 6)は DPoP / DBSC / UCAN / DID が既に道を示している**。
  自前で全部設計せず、**DPoP(RFC 9449)の header ベース PoP を参照実装の
   target にする**のが妥当(§2)。
- **命名は要再考**。npm `persona` は withpersona.com の KYC SDK が現役(週 34.6 万 DL)、
  gem `persona` も取得済み。加えて "Persona" は Mozilla の死んだ identity
  プロジェクトの名前(§4, §5)。

## 1. 比較表

persona-kit の 6 概念に対する各システムの対応。✓=組み込みで持つ / △=部分的・
別形 / ✗=持たない・アプリ任せ / —=設計外。

| システム | 匿名で読める | per-browser anchor | claim code 移送 | merge preview→confirm | verified grafting | lock-in 回避/portability |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Firebase Auth** | △¹ | ✗² | ✗³ | ✗⁴ | ✓⁵ | ✗ |
| **Supabase** | △¹ | ✗² | ✗³ | ✗⁴ | ✓⁵ | △⁶ |
| **Auth0** | ✗⁷ | ✗ | ✗ | ✗⁸ | ✓⁸ | ✗ |
| **PlayFab(ゲーム)** | ✓⁹ | △¹⁰ | △¹⁰ | ✗¹¹ | ✓¹² | ✗ |
| **Jazz(local-first)** | ✓¹³ | ✓ keypair | △ passphrase¹⁴ | ✗¹⁵ | ✓¹³ | ✓ |
| **DXOS HALO** | — | ✓ keypair | ✓ device invite¹⁶ | ✗ | ✗¹⁶ | ✓ |
| **@localfirst/auth** | — | ✓ keypair | ✓ Seitan¹⁷ | ✗ CRDX¹⁷ | ✗¹⁷ | ✓ |
| **magic-wormhole** | — | — | ✓ PAKE code¹⁸ | — | — | — |
| **UCAN** | — | ✓ did:key | △ delegation¹⁹ | — | ✗ | ✓ |
| **DID / did:nostr** | ✓²⁰ | ✓ keypair | ✗²⁰ | — | △²⁰ | ✓ |
| **DBSC** | — | ✗²¹ | ✗ | — | — | ✗²¹ |
| **DPoP(RFC 9449)** | — | — | — | — | — | — (PoP 標準²²) |
| **Mozilla Persona**† | ✗ | △²³ | ✗ | ✗ | ✓ email | ✓²⁴ |
| **Syncthing** | — | ✓ 自己主張 ID²⁵ | △ QR/introducer²⁵ | ✗ | — | ✓ |
| **2ch/5ch トリップ**† | ✓²⁶ | △²⁶ | ✗ | ✗ | ✗ | ✓ |

†=現存しない/直接の実装ではないが概念的先行例。persona-kit は
「匿名で読める + per-browser anchor + single-use claim code 移送 + merge
preview→confirm + verified grafting + lock-in 回避」の**6 つを同時に満たす**点が
既存のどの単体システムとも異なる。個々の要素はどれも既出。

## 2. anonymous → verified の昇格は普遍パターン、merge は普遍的にアプリ任せ

主要 BaaS/IDaaS/ゲーム基盤はすべて「匿名で始め、後から credential を同一
アカウントに link する in-place graft」を実装している — persona-kit の OIDC
接ぎ木(step 5)は**業界標準の再実装**であって新規性はない:

- **Firebase**: `signInAnonymously` で登録なしの匿名 uid を発行。昇格は
  `linkWithCredential`(`signInWith` ではない)で provider credential を既存
  匿名アカウントに接ぎ、uid が保持されるのでデータ移行不要。匿名も linkable
  provider の 1 つ。
- **Supabase**: `signInAnonymously()` → `updateUser()`(email/phone、OTP 検証必須)
  / `linkIdentity()`(OAuth)。匿名は `is_anonymous` JWT claim で RLS が低信頼
  として扱える — **persona-kit の 2 種 binding(self-asserted / verified)の先例**。
- **Auth0**: primary/secondary を指定し secondary を `user.identities[]` に埋める
  graft。multi-provider 対応。ただし linking は**既に検証ログイン済みの user**
  起点で、anonymous-first の upgrade path ではない。
- **PlayFab**: anonymous と recoverable の 2 認証形態を形式化。`CreateAccount=false`
  で起動時プローブ → 「Play Now」で `CreateAccount=true`(= persona-kit の
  「読みは匿名・書き込みで join」に酷似)。昇格は `LinkGoogleAccount` 等の
  in-place link。

**しかし衝突時の merge は 5 者すべてがアプリに丸投げ**している:

- Firebase: 「Account linking will fail if the credentials are already linked to
  another user account. …you must handle merging the accounts and associated
  data」。公式サンプルすら retrieve/delete/restore を app-specific コードに委ねる。
- Supabase: 「Reassign entities tied to the anonymous user. This step will vary
  based on your specific use case and data model.」
- Auth0: secondary の `user_metadata`/`app_metadata` は**破棄**、`profileData` に
  属性だけ残す。merge は Management API で手動。
- PlayFab: **明示的に merge ではなく reconciliation(profile 選択)**。
  「prefer clearer terms like "Choose Progress" … emphasize that the player is
  selecting one profile to continue with (not merging)」。衝突は `ForceLink=True`
  で warn-then-overwrite し、旧アカウントを orphan 化しうる。

→ **protocol レベルの merge preview → confirm は persona-kit の実質的な独自貢献**。
「confirm なしにデータを変えない(P-6)」を仕様が保証するのは、上記のどれもやって
いない。ただし PlayFab の知見「UI では *merge* より *選択* と言え」は、我々の
merge preview UI 文言への直接の教訓(§7 参照)。

引用: Firebase account-linking / anonymous-auth / firebase.blog best-practices;
Supabase auth-anonymous; Auth0 user-account-linking; PlayFab game-saves/linking。

## 3. keypair 昇格(step 6)には標準が揃っている — 自作せず参照する

- **DPoP(RFC 9449, IETF Standards Track)** — application-layer の PoP。client の
  keypair で署名した JWT を HTTP header で運び、token を公開鍵に sender-constrain。
  `jkt`(JWK SHA-256 thumbprint)で key↔token 束縛を表現、`jti`+`iat` freshness+
  server nonce で replay 防止。**persona-kit の header profile(X-Agent-Id)が
  bearer から PoP へ昇格するときの、そのままの設計図**。standards track で安定。
- **DBSC(Device Bound Session Credentials)** — browser ネイティブ。TPM/secure
  element の非抽出鍵で session を device 束縛。だが**鍵は per-session/per-site で、
  cookie/site データ消去時に削除**される設計 → **identity anchor にはなり得ず、
  session 硬化専用**。W3C FPWD(2025-08-21)、GA は Chrome/Windows のみ(Chrome 146,
  2026-04)。**依存先ではなく参照方向**。設計者は Token Binding 失敗の原因を
  「TLS 層結合」に帰し HTTP 応用層へ移した — persona-kit が header/cookie の
  応用層に留まる判断の裏づけ。
- **UCAN** — 全 principal が did:key の keypair、token は PoP(bearer ではない)。
  ただし**cross-device は鍵転送ではなく per-device 鍵間の delegation** — claim code
  で 1 つの anchor を移送する persona-kit とは対照的な設計。参考にはなるが道が違う。
- **DID / did:nostr** — 鍵そのものが identity。did:nostr は secp256k1 公開鍵から
  DID を決定論的・オフライン導出。**ただし key rotation も recovery も無い**
  (鍵紛失 = identity 永久喪失)→ **persona-kit の claim code recovery は
  did:nostr に無い本物の gap**であって再発明ではない。DID primer の SSI 4 要件
  (persistence / global resolvability / cryptographic verifiability /
  decentralization)のうち persona-kit は**意図的に persistence だけを満たす**
  (server-scoped・非 resolvable・bearer)— これが比較軸そのもの。
- **WebAuthn/passkeys** — ブラウザ内暗号サインインの standards-track 本命。
  Persona 亡き後の in-browser crypto の後継として HN でも指摘。

引用: W3C DBSC(/TR/dbsc/); RFC 9449; ucan-wg/spec; nostrcg did-nostr; w3c-ccg
did-primer。

## 4. claim code / デバイス間移送の先行実装

single-use 移送コードは local-first 界隈に厚い先例がある。**ただし彼らが移送するのは
client-held keypair であり、persona-kit が移送するのは server-anchored persona への
参照** — この違いが設計の要:

- **@localfirst/auth の Seitan invitation** — single-use 16 文字 base-30 コード
  (例 `aj7x d2jr 9c8f zrbs`)。招待者はコードから invitation の proof を導出し、
  既存メンバが検証して admit。**digest 保存・single-use という点で claim code の
  最も直接的な先行例**。ただし identity 本体は per-device keypair(転送しない)、
  衝突解決は interactive merge ではなく CRDX(CRDT)。
- **magic-wormhole** — `4-purple-sausages` 形式の single-use PAKE(SPAKE2)コード。
  低エントロピー(既定 16 bit)でも安全なのは PAKE がオンライン 1 推測に制限する
  から。**短いコードを digest でなく PAKE で守る**のは、我々が「なぜ digest の
  長いコードなのか」を再検討する材料。identity は持たない純粋な移送チャネル。
- **DXOS HALO** — device-invitation で新デバイスへ identity 同期 + recovery code
  (paper key)/ passkey での復旧。ただし**1 identity を複数デバイスで同期**する
  モデルで、独立した per-device persona ではない。merge/conflict flow も OIDC
  linking も無い。
- **Jazz** — 起動時に登録なしで keypair アカウントを自動生成(persona-kit の
  planned end-state)。読み取り専用の **Guest Mode** を別状態として持つ = 我々の
  「匿名で読む(P-1)」と一致。ただし cross-device は**再利用可能な 24 語
  passphrase(seed phrase)**で、single-use ではない。衝突時は既定でデータ破棄 +
  `onAnonymousAccountDiscarded` handler で手動コピー。
- **Syncthing** — device ID は TLS 証明書ハッシュ由来の**自己主張的識別子**、
  登録不要、QR で受け渡し、introducer で信頼の推移的導入。agent_uid の
  「self-asserted bearer key」の実運用先例。
- **Signal のデバイスリンク** — QR ベースのデバイス追加(調査では概念として確認)。

→ claim code そのものは新規ではない。**新規なのは「single-use + digest 保存の
コードで、keypair ではなく *サーバに錨を下ろした persona* を別ブラウザに引き取らせ、
かつ衝突を merge preview に落とす」という組み合わせ**。PAKE(magic-wormhole)は
将来 claim code を短縮する選択肢として頭に置く価値がある。

引用: github local-first-web/auth; magic-wormhole.readthedocs.io; docs.dxos.org
halo; jazz.tools authentication-states; docs.syncthing.net device-ids;
herbcaudill.com local-first auth。

## 5. Mozilla Persona の教訓(名前と設計の両方)

同名の死んだプロジェクトは、避けるべき失敗と、奇妙な符合の両方を残している:

1. **中央 fallback への依存崩壊** — email provider が誰も IdP endpoint を実装せず、
   「分散」protocol が Mozilla の単一 fallback サーバ(Persona.org)依存に崩れた。
   → **「自分が永久に運用し続ける中央 fallback を前提にした portable identity は
   死ぬ」**。persona-kit が中央サービスを持たず consumer 各自の server で完結する
   設計であることの正しさの裏づけ(逆に言えば、公開 IdP を 1 つに集約しない)。
2. **feature creep** — session 管理・attribute exchange を足して core auth から
   注意が逸れた。→ **protocol surface を最小に保て**。
3. **利便性で social login に敗北** — ユーザーは既存アカウント再利用の最小努力に
   流れる。→ 新規 portable identity の採用リスク。persona-kit の答えは「そもそも
   ログインを要求しない」= 土俵を変えている点が Persona と違う。
4. **奇妙な符合** — Persona の当初案の核心は「ブラウザが保持する identity を
   Firefox Sync でデバイス間 portable にする」だったが、**このブラウザ保持 identity
   コンポーネントは prototype addon 止まりで出荷されず、それが無いまま Persona は
   説得力ある use case を欠いた**。→ **persona-kit のブラウザ保持 persona は、
   Persona が出荷できなかったまさにその機能**。ここに賭ける価値がある。
5. **data portability** — identity を(サイトが保持する)email に鍵付けたため、
   shutdown 後もサイトは別方式へ移行できユーザーを失わなかった。→ persona-kit の
   lock-in 回避(agent_uid を echo しない、binding は consumer 側)と同じ思想。

Portier(旧 Let's Auth、Persona の精神的後継、一部 Mozilla 出資)は email-based の
self-hostable broker として現存 — 我々が OIDC provider を足す際の参照候補。

引用: news.ycombinator.com/item?id=16172999; lwn.net/Articles/671604;
wiki.mozilla.org Identity/Persona_AAR; en.wikipedia.org Mozilla_Persona。

### 命名衝突(結論: bare name は両エコシステムで使用不可)

- **npm `persona`** — **hard collision**。withpersona.com の KYC/本人確認 SDK が
  現役(v5.8.0 / 2026-04-01、週 34.6 万 DL、2014 年から 100+ versions)。npm 上の
  "persona" の支配的意味は**商用 ID 検証** — persona-kit の匿名 identity とは
  意味的に正反対。scoped `@uniba-commons/persona-*` は名前空間的には衝突しないが、
  discoverability/brand 混同のコストは実在。
- **gem `persona`** — 取得済みだが放棄状態(2011 年、personal CMS、~1.9 万 DL、
  license 無し)。名前空間衝突であって機能競合ではない。RubyGems の再割り当ては
  標準ポリシー上ほぼ不可。
- **"Persona" ブランド全体** — Mozilla の死んだ identity プロジェクトの名前が
  永続的に紐づく。

→ **プロジェクト内部名として persona-kit を使い続けるのは可**だが、**公開 package
名は scoped + 明確な差別化語**を推奨(例: `agent-id` 系や、掲示板文化を汲むなら
§6 の語彙)。少なくとも bare `persona` を npm/rubygems に publish する道は塞がって
いる。

引用: npmjs.com/package/persona; rubygems.org/gems/persona。

## 6. 見落とされた系譜 — 日本の匿名掲示板文化(コテハン/ステハン/トリップ)

自動検索は英語圏の auth/identity 文献を掃いたため完全に見落としたが、
**「アカウントなしで持続的な擬似名を名乗る」問題は 2ch/5ch が 20 年以上前に
tripcode で解いている**。persona-kit の設計語彙にほぼそのまま対応する:

| 掲示板文化 | 意味 | persona-kit の対応 |
|---|---|---|
| **名無し (nanashi)** | 既定の無名投稿者、identity 無し | 匿名で読む/書ける状態(join 前、P-1) |
| **ステハン (捨てハンドル)** | 使い捨ての名前。次回は名乗らない | ブラウザ限定の使い捨て persona(claim code を発行せず、grafting もしない) |
| **コテハン (固定ハンドル)** | 固定して名乗り続ける名前 | join 済みで持ち運ぶ persona |
| **トリップ (tripcode)** | `名前#秘密` → ハッシュを公開表示。秘密を知る者だけが同じトリップを再現でき「同一人物」を**登録なしで**証明 | self-asserted bearer proof。**agent_uid にきわめて近い** |
| **強制/セキュアトリップ (‡)** | 板ごとに salt を変え、なりすまし耐性を上げた版 | bearer → keypair(PoP)昇格(step 6)の思想的対応物 |

**トリップは agent_uid の直接の先祖**と言ってよい: ユーザーは proof(ハッシュ)を
公開しつつ secret(パスワード)を手元に保持し、サーバは登録を持たず等値照合だけを
する。persona-kit の「サーバは agent_uid を発行しない・echo しない(P-3/P-4)」は、
トリップの「板は誰の trip も発行しない、ただ再現されたものを照合するだけ」と同型。

そして**ユーザーの指摘「ブラウザ限定の persona は *ステハン* も可能にしている」は
正鵠**: 商用アカウント基盤ではアカウントが重い分ステハンは非対応(作っては消す運用は
abuse 扱い、§ 参照)だが、persona-kit の persona は**既定で使い捨て可能**(ブラウザが
localStorage を消せば消える、cross-device もしない)。**コテハン(join + grafting で
持ち運ぶ)とステハン(その場限り)を 1 つの機構の両端として自然に扱える**のが、
アカウント中心の設計には出せない persona-kit の性質。これは §1 比較表の
「per-browser anchor が既定で disposable」という列の、文化的な言語化でもある。

> 補足: この系譜は一次資料の英語文献に乏しく、本節は検証済み claim ではなく
> 設計者の知見として記録する。将来 §protocol の非規範的な導入や、公開名の
> 候補語彙(名無し/コテハン/トリップ を汲む命名)として再訪する価値がある。

## 7. 提言

**採用する(adopt)**:
- keypair 昇格(step 6)の設計は **DPoP(RFC 9449)を参照実装の target** に。
  `jkt` thumbprint・`jti`・nonce の replay 防止機構をそのまま踏襲。自作しない。
- merge preview の UI 文言は **PlayFab の教訓**に従い「merge/統合」より
  「どちらの記録を残すか選ぶ」寄りの語を検討(protocol の 2 段階は維持しつつ、
  提示は選択のメタファ)。
- 短い claim code を将来検討するなら **magic-wormhole の PAKE** を根拠に。

**参照する(reference / 明記して差別化)**:
- protocol.md に「DBSC は session 硬化専用で identity anchor 不可」「did:nostr は
  recovery 無し」を、persona-kit が埋める gap として非規範的に言及。
- SSI 4 要件のうち **persistence のみを意図的に満たす**ことを設計スタンスとして明記
  (over-engineering への牽制)。
- Mozilla Persona の AAR を「中央 fallback 依存で死ぬな」「surface を最小に」の
  一次資料としてリンク。

**意図的に違える(differ)**:
- 商用 BaaS が丸投げする **merge を protocol で規定する**(P-6)— ここが売り。
- local-first が転送する *keypair* ではなく **server-anchored persona への参照**を
  claim code で移送する(サーバ側モデルを持つ consumer に適合)。
- **公開 package 名は bare `persona` を避け scoped + 差別化語**(§5)。

**本当に新しい部分 vs 再発明**:
- 再発明: anonymous-first、in-place verified grafting、single-use 移送コード、
  2 種 trust binding — どれも個別には既出。
- 新しい: (a) **これら 6 要素の同時成立を 1 つの transport 非依存 protocol に
  まとめ、header/cookie 両プロファイルで規定**したこと、(b) **衝突 merge を
  protocol レベルで preview→confirm 保証**したこと、(c) **persona を既定で
  disposable(ステハン)に保ちつつ grafting で持続(コテハン)にもできる二面性**。

## 参照ソース

- Firebase: firebase.google.com/docs/auth/web/{account-linking,anonymous-auth}、
  firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication
- Supabase: supabase.com/docs/guides/auth/auth-anonymous
- Auth0: auth0.com/docs/manage-users/user-accounts/user-account-linking
- PlayFab: learn.microsoft.com/en-us/gaming/playfab/player-progression/game-saves/linking
- DBSC: w3.org/TR/dbsc/
- DPoP: datatracker.ietf.org/doc/html/rfc9449
- UCAN: github.com/ucan-wg/spec
- did:nostr: nostrcg.github.io/did-nostr/ ・ DID primer: w3c-ccg.github.io/did-primer/
- Jazz: jazz.tools/docs/react/authentication/authentication-states
- @localfirst/auth: github.com/local-first-web/auth ・ herbcaudill.com/words/20240602-local-first-auth
- magic-wormhole: magic-wormhole.readthedocs.io
- DXOS HALO: docs.dxos.org/halo/introduction/
- Syncthing: docs.syncthing.net/dev/device-ids.html
- Mozilla Persona: news.ycombinator.com/item?id=16172999 ・ lwn.net/Articles/671604 ・
  wiki.mozilla.org/Identity/Persona_AAR ・ en.wikipedia.org/wiki/Mozilla_Persona
- 命名: npmjs.com/package/persona ・ rubygems.org/gems/persona
- コテハン/ステハン/トリップ: 2ch/5ch 匿名掲示板文化(§6、設計者知見)
