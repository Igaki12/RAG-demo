# RAG Demo 編集ガイド

このリポジトリで作業するエージェント向けのメモです。編集は以下のポリシーを守って進めてください。

## バックアップと命名規則

- 各シリーズの最新版ファイル名は `*-latest.html` とします。
- 更新・保存時には必ず当日のバックアップを `*-YYYYMMDD.html`（例: `current-affairs-quest-20250309.html`）として作成します。
- 既存ファイルに手を加える際は、編集前の版をバックアップとして残したことを作業報告で明記してください。

## 作業フロー

1. 編集対象の最新版 (`*-latest.html`) を確認する。
2. 変更前の内容を日付付きバックアップに複製する。
3. バックアップ作成後に最新版を編集する。
4. 作業終了時に、どのバックアップを生成したかを報告する。

## 備考

- 既存の複数バージョンが存在する場合は、もっとも新しいものを最新版として扱い、そこから命名規則を適用してください。
- 新しい運用ルールが発生した場合は、このファイルに追記して全員で共有します。

## 現行Web UI仕様（HTML/CSS/JS）

- 対象ファイルは `commonsense-latest.html`、`current-affairs-quest-latest.html`、`index.html`（必要に応じてサブページ）です。更新前に必ず日付付きバックアップを作成してください。
- 利用者は JSONL ファイルをアップロードし、ニュース記事の共起ネットワーク図と理解度テストを体験します。アプリは利用者がアップロードした JSONL のみをデータソースとし、リポジトリ同梱データを自動読み込みしないでください。
- アップロード UI は filters パネルの最上部に配置し、ファイルが正常に読み込まれたら自動的に非表示へ切り替えます（再アップロードはメニューや設定モーダルなど別導線で対応）。
- データがまだ読み込まれていない場合は、ネットワークグラフ・クイズ・サマリーカードをスケルトン／プレースホルダー表示にし、アップロード完了後に初めて実データを描画します。
- 理解度テストは 3 択形式で、JSONL 内の `choices` 配列の先頭要素を正解として扱います。表示時はシャッフルし、正解選択時は旧「GOOD」挙動、不正解時は旧「BAD」挙動を踏襲してください。
- ランダム出題や記事詳細モーダルなど既存の UI/UX 挙動は維持しつつ、問題表示・フィードバック領域のみ新仕様に合わせてあります。編集時は既存アニメーション・アクセシビリティ属性を壊さないよう注意してください。

## データ仕様（JSONL）

- 基本構造は 1 行 1 レコードの JSON。主要キーは `date_id`（YYYYMMDD 文字列）、`headline`、`content`、`named_entities`、`questions` です。
- `questions` は配列で、各要素は最低限 `question`（文字列）と `choices`（文字列配列）を持ちます。`choices[0]` が正解であることが前提です。任意で `explanation` または `reasoning` を含められます。
- 共起ネットワーク計算は `named_entities` を前提に行います。エンティティは重複を避け、意味のある文字列のみを格納してください。
- 新旧フォーマットが混在する場合は、新フォーマット（`news_full_mcq3_type9_entities_novectors.jsonl` に準拠）が優先です。旧フォーマットを扱うページを改修する際は、正解が単一文字列で提供されるケースへのフォールバックを検討してください。
- アップロードバリデーションでは `.jsonl` 拡張子／テキスト MIME を確認し、ファイルサイズ上限は 8MB とします（`news_full_mcq3_type9_entities_novectors.jsonl` は約 6.5MB なので必ず通過）。行単位で JSON をパースし、主要キーが欠けていても致命的エラーにせず、利用者に修正ポイントを伝える形で寛容に扱ってください。

## 対象ユーザーと目的

- 利用者は学生および新社会人を想定しています。ニュース理解力・社会常識力の測定および底上げがゴールです。
- 出題やネットワーク図は、タイムリーなニュースに対する背景理解を促すよう構成してください。説明文、フィードバック文言は過度に専門的にならないよう保ちます。

## React デモアプリ開発方針（次フェーズ）

### 公開・ビルド方針

- GitHub Pages（`/docs` ディレクトリ公開）を前提とし、Vite + React + TypeScript 構成でプロジェクトを生成します。ビルド成果物は `vite.config.ts` で `base` を `/RAG-demo/` に設定し、`npm run build` 時に `dist` → `docs` へ出力（`"build": "vite build && cp -R dist/* docs/"` など）する運用を徹底してください。
- UI ライブラリは Chakra UI を採用します。テーマは PC 向けワイド画面での視認性を優先し、ブレークポイントは Chakra のデフォルトを活かしながら主要ブレークポイント（md/lg）での配置崩れを重点確認します。
- JSON データは利用者がアップロードした JSONL ファイルのみを `services/data/newsService.ts`（または同等のサービス層）経由で読み込みます。ファイル選択・ドラッグ＆ドロップ後に `File` → 文字列 → レコード配列へ変換し、拡張子確認と 8MB 制限のバリデーションもこの層で集中管理してください。`news_full_mcq3_type9_entities_novectors.jsonl` は QA／検証用サンプルとして `public/` に保持しますが、UI からは自動読み込みしません。
- vis-network は公式パッケージ（`vis-network`）を使用し、React では `useRef` + `useEffect` で DOM を制御します。既存 HTML 実装のノードサイズやエッジ生成ロジックを TypeScript へ移植し、同じ計算手順を再利用してください。

```
/docs
  ├─ index.html          # GitHub Pages 公開用にビルドされたエントリ
  └─ assets/…            # Vite ビルド成果物
/src
  ├─ components/         # UI コンポーネント
  ├─ features/           # ドメインごとの状態管理ロジック
  ├─ hooks/              # 共通フック
  ├─ layout/             # レイアウト系
  ├─ lib/vis/            # vis-network 初期化・ユーティリティ
  ├─ routes/             # ページコンポーネント
  ├─ services/           # 認証・データ取得など（localStorage 実装を内包）
  ├─ store/              # Zustand など状態管理ライブラリを採用する場合はここに配置
  └─ data/               # JSONL スキーマ定義・モック（実データはユーザーアップロードのみ）
```

### 認証・アカウント仕様

- サインアップ／メール認証はダミーとし、ログインのみ実働します。以下 3 アカウントを `src/services/auth/accounts.ts` にハードコードで保持し、メールアドレス＋パスワード認証を行います。
  - `student.alpha+demo01@example.com` / `NewsQuest#01`（表示名: `Student Alpha`）
  - `analyst.bravo+demo02@example.com` / `NewsQuest#02`（表示名: `Analyst Bravo`）
  - `mentor.charlie+demo03@example.com` / `NewsQuest#03`（表示名: `Mentor Charlie`）
- ログイン後はヘッダー右上などにユーザー名と `Logout` ボタンのみをミニマム表示し、その他の認証関連 UI は折りたたみます。メール確認／再設定ボタンはプレースホルダーとして設置し、現状はモーダルで「現在は未対応です」と通知するだけに留めてください。
- 認証状態は React Query もしくは Zustand などでグローバル管理しつつ、`localStorage` に `ragDemo.auth.session`（現在ログイン中のメールアドレス）として永続化します。将来の API 移行に備え、サービス層ではストレージ操作をカプセル化し、後日 fetch 実装に差し替えやすい形を保ちます。

### プレイ履歴・成績データ管理

- `localStorage` には `ragDemo.progress.<userEmail>` キーで JSON を保存します。スキーマ例：
  ```json
  {
    "attempts": [
      {
        "dateId": "20251114",
        "questionId": "commonsense-20251114-001",
        "selectedChoice": 2,
        "isCorrect": true,
        "answeredAt": "2025-11-14T12:34:56.000Z"
      }
    ],
    "lastPlayedAt": "2025-11-14T12:34:56.000Z",
  }
  ```
- 集計結果（正解率・網羅率・ランキング順位・プレイ日数）はメモ化セレクタで算出し、画面表示時に都度計算します。将来のサーバ同期では同スキーマをそのまま API へ POST できるように保ちます。
- 問題セットの網羅率は「同一日付で提供される総問題数に対する回答済み数」、全体順位は他アカウントの問題数と比較してリアルタイムに順位づけします（ローカル環境では 3 アカウントのデータから算出）。

### コア UI コンポーネント

- `AppLayout`：PC 向け 2 カラムレイアウトをベースに、グラフをセンターに大きく配置し、補助情報カードを四隅にフローティング表示。スマホでは補助コンポーネントを FAB から Drawer/Modal で表示。
- `UploadPanel`：filters パネル最上部に固定し、`.jsonl` ファイル選択とドラッグ＆ドロップを受け付けます。アップロードが成功しデータが注入された時点で自動的に非表示となり、代わりに再アップロードボタンを補助メニューへ移してください。
- `AuthGate`：未ログイン時はフルスクリーンでログインフォーム（メール・パスワード）＋確認ボタン。ログイン後は子要素を描画。
- `AuthStatusChip`：ログイン後の最小表示（表示名＋`Logout`）。
- `NetworkGraph`：vis-network を利用し、`current-affairs-quest-latest.html` の node/edge 構築ロジック（ノードサイズ計算、エッジ重み）を TypeScript に移植。ノードクリックで該当質問をイベント発火。
- `DateMultiSelector`：カレンダー UI（Chakra の `Calendar` 相当ライブラリ、なければ `react-day-picker` など）で複数日付選択に対応。選択日はハイライトし、グラフと問題一覧へフィルタを適用。
- `QuizPanel`：選択したノードに紐づくクイズを表示。選択肢は初期表示時にシャッフルし、回答後は正誤を旧 GOOD/BAD 演出に合わせて Chakra の `Alert` / `Toast` で再現。解説（`explanation`/`reasoning`）があれば折りたたみ表示。
- `ArticleDetailModal`：記事本文や named entities を表示する既存モーダル挙動を再現。
- `PerformanceSummary`：総解答数・正解率・網羅率・順位・プレイ日数をカード表示。PC では右下にフローティング固定、スマホでは Drawer から表示。
- `ProgressTimeline`：日別の解答数をスパークラインで表示し、将来の時系列分析に備えます。

### 画面遷移と状態

- ルート構成は `routes/AppShell.tsx`（メイン画面）と、将来の `routes/Admin.tsx` など拡張に備えて React Router を導入。現時点ではシングルページ構成で問題ありません。
- グローバル状態管理は小規模のためまずは React Context + Reducer で十分。拡張が見込まれる場合は Zustand を導入し `store/authStore.ts`, `store/progressStore.ts` に分離します。
- データロード時は `services/data/newsService.ts` でアップロード済み `File` を読み込み、エンティティから vis-network 用の nodes/edges を生成するユーティリティを `lib/vis/transformers.ts` に配置します。未アップロード時は `undefined` を返し、UI 側はプレースホルダー状態を描画してください。

### レスポンシブ・アクセシビリティ指針

- PC（幅 1280px 以上）ではグラフ領域を 70% 幅で確保し、補助カードは `position: absolute` ではなく Chakra の `useBreakpointValue` を用いた `Stack` 配置で、アニメーションや focus 循環が途切れないようにします。既存 HTML のキーボード操作を踏襲してください。
- スマホ（幅 < 768px）ではグラフを縦長に再配置し、補助情報は FAB → Drawer/Modal に移行。Drawer オープン時にはスクリーンリーダー向けにタイトルと閉じるボタンへ `aria` 属性を付与します。
- ノードクリック時のフィードバック、正解／不正解時のアニメーションは既存挙動とビジュアルを合わせ、必要に応じて Chakra の `Motion` コンポーネント（`framer-motion` 連携）で再現してください。

### 将来拡張・確認事項

- ランキング機能（上位◯パーセント表示）はローカルデータからの暫定計算で実装しつつ、API 化時には全ユーザー集計が必要になるため、ソート前提のデータ構造と計算手順を `services/analytics/ranking.ts` として切り出します。
- 認証方式、成績データの永続化先、ランキング算出ロジックが確定していない場合はオーナーに確認してから着手してください。特にメール認証フローを実装する場合は GitHub Pages 上でのフロント単体実装では限界があるため、外部サービス（Firebase Auth 等）の採用可否を事前に調整します。
- 旧 HTML との整合性確認として、同一 JSONL を読み込ませた際にノード数・エッジ数・クイズ件数が一致するかを E2E テスト（Playwright など）で将来的に追加予定です。現段階では手動検証でもかまいませんが、テスト観点は残しておいてください。

### 実装状況メモ（2025-11-14 時点）

- React/Vite ベースのデモ UI を `src/` 以下に追加済み。`npm run dev` でローカル起動、`npm run build` 後に `docs/` へ成果物コピー。
- `public/news_full_mcq3_type9_entities_novectors.jsonl` はアップロードバリデーションや回帰テスト用のリファレンスファイルとして保持します。実行時は必ず利用者がアップロードした JSONL を `services/data/newsService.ts` から読み込むようにしてください。
- 認証デモ用ハードコードアカウントは `src/features/auth/accounts.ts` に定義：
  - `student.alpha+demo01@example.com` / `NewsQuest#01` （Student Alpha）
  - `analyst.bravo+demo02@example.com` / `NewsQuest#02` （Analyst Bravo）
  - `mentor.charlie+demo03@example.com` / `NewsQuest#03` （Mentor Charlie）
- ログイン状態は `AuthProvider`（`src/features/auth/AuthContext.tsx`）が管理し、`ragDemo.auth.session` キーで `localStorage` 永続化。サインアップや再設定ボタンはトースト表示のみのダミー。
- 旧 HTML 群は `legacy-html/` 以下へ退避済み。編集時は命名規則（`*-YYYYMMDD.html` バックアップ）を維持しつつ、React 側と混在させないこと。
