# Admin Console Specification (Draft)

作成日: 2025-11-27  
担当: Codex (提案フェーズ、実装前)

## 1. 目的と範囲
- `admin.health-discovery.com` で提供する運用者専用 SPA。  
- 利用者向け UI とは完全に分離し、一般ユーザーとは別の認証基盤を持つ。  
- 主なユースケース: ユーザーランキング確認、回答/読了ログの追跡、アカウント照会、メタデータ監視。

## 2. 技術スタックと配置
- フロント: 既存 React/Vite プロジェクトに `src/admin` を追加し、`/admin/*` ビルド成果物を Apache とは別の DocumentRoot (`/var/www/rag-demo-admin`) へ配置。  
- バックエンド: 既存 Node.js(API) に `/api/admin/*` ルートを追加。認可ミドルウェアで管理者専用トークンを検証。  
- サブドメイン: `admin.health-discovery.com` → Apache vhost にて別 DocumentRoot とし、TLS は certbot で SAN に追加。  
- デプロイ: `pnpm run build:admin`（例）で `dist-admin/` を生成→ `/var/www/rag-demo-admin` へ rsync。

## 3. 認証 / 認可
1. **専用テーブル**
   ```sql
   CREATE TABLE admin_users (
     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     email VARCHAR(255) NOT NULL UNIQUE,
     password_hash CHAR(64) NOT NULL,
     display_name VARCHAR(100) NOT NULL,
     is_active TINYINT(1) NOT NULL DEFAULT 1,
     last_login_at DATETIME NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. **ログインフロー**
   - `/api/admin/auth/login`: email + password を検証。  
   - (任意) 2FA が有効な場合、ワンタイムパスコードを要求。検証後、JWT (短命) + refresh token (HttpOnly cookie) を発行。
   - `/api/admin/auth/me`: 現在の管理者情報。  
   - `/api/admin/auth/logout`: refresh token 失効。
3. **認可**
   - `requireAdmin` ミドルウェア: JWT を検証し `admin_users` を参照。  
   - 将来の権限拡張を想定して `role ENUM('viewer','operator','super')` を admin_users に追加する余地あり。  
4. **セキュリティ**
   - 全エンドポイント HTTPS 前提。  
   - 2FA (TOTP) は任意項目。必要なら `admin_user_mfa` テーブルで管理。  
   - 監査ログ `admin_audit_logs(admin_id, action, payload, created_at)` を最低限記録。

## 4. 主要機能 / 画面

### 4.1 ログイン画面
- サブドメイン専用。ユーザー名/パスワード + (任意) 2FA。  
- 失敗時はレートリミット。成功時にダッシュボードへ遷移。

### 4.2 ダッシュボード
- KPI カード: 今日の回答数 / 正答率、今月の新規ユーザー数、JSONL アップロード数。  
- 直近イベント: question_answers / article_reads の最新 10 件。  
- アラート: API エラー件数、MySQL 接続失敗など（サーバーログ収集が整っていれば表示）。

### 4.3 ランキングビュー (要件強化)
- 目的: 学習者アカウントの順位を多軸で比較。  
- 画面構成:
  1. **フィルタパネル**  
     - 集計期間: `今日 / 今週 / 今月 / 直近30日 / 任意期間 (date picker)`  
     - 指標: `回答数`, `正答率`, `平均回答時間`, `記事読了数`, `CBT完走数` など  
     - グループ・ロール絞り込み（例: Student Alpha グループのみ）。  
  2. **ランキングテーブル**  
     - 列: 順位、表示名、メール、指標値、前期間比(矢印)、バー表示。  
     - 行クリックでユーザードロワーを開き詳細ログへ。  
  3. **チャート/ヒートマップ** (任意)  
     - トップ10推移を折れ線グラフで表示。  
  4. **エクスポート**  
     - CSV ダウンロード（同フィルタ条件で question_answers/daily_user_stats から抽出）。

### 4.4 ユーザー管理 (閲覧専用)
- 一覧テーブル: メール、表示名、所属グループ、登録日、総回答数、メール検証有無。  
- 詳細ドロワー:  
  - プロフィール情報 + 最近の activity (article_reads/question_answers)。  
  - アカウントロック/解除ボタン（admin_users とは別、一般ユーザー表）。  
  - JSONL アップロード履歴との紐付け (必要なら)。

### 4.5 ログ参照
- question_answers ログ: 時系列グラフ + テーブル。  
- article_reads ログ: 個別記事の閲覧履歴。  
- JSONL アップロード状況: ステータス/エラー確認。

## 5. API 設計（案）
| Method | Path | 説明 |
|--------|------|------|
| POST | `/api/admin/auth/login` | 管理者ログイン (専用テーブル) |
| POST | `/api/admin/auth/logout` | トークン無効化 |
| GET | `/api/admin/auth/me` | 現在の管理者情報 |
| GET | `/api/admin/users` | 一般ユーザー一覧 + フィルタ (pagination) |
| GET | `/api/admin/users/:id` | 一般ユーザー詳細 + activity 概要 |
| GET | `/api/admin/rankings` | 指標・期間・グループを受け取り、順位リストを返す |
| GET | `/api/admin/logs/question-answers` | 最新回答ログ |
| GET | `/api/admin/logs/article-reads` | 最新読了ログ |
| GET | `/api/admin/uploads` | JSONL 取込状況 |

- ランキング API は `daily_user_stats` + 生ログから集計。SQL 例:  
  ```sql
  SELECT
    u.id,
    u.display_name,
    dus.questions_answered,
    dus.correct_answers,
    dus.avg_accuracy,
    dus.articles_read
  FROM daily_user_stats dus
  JOIN users u ON u.id = dus.user_id
  WHERE dus.date BETWEEN :from AND :to
  ORDER BY CASE WHEN :metric = 'correct_rate' THEN dus.avg_accuracy END DESC,
           CASE WHEN :metric = 'answers' THEN dus.questions_answered END DESC
  LIMIT :limit OFFSET :offset;
  ```

## 6. データモデル追記
- `daily_user_stats` を日/ユーザー単位で集計する cron (夜間) を前提にしているが、リアルタイム指標は question_answers から即時計算が必要→ SQL View or materialized view を検討。  
- 管理者専用 DB ユーザー: `ragdemo_admin_api`（読取り主体）を作成し、アプリからはこのアカウントで SELECT/INSERT (ログ) を行う。

## 7. デプロイ / 運用
1. DNS: `admin.health-discovery.com` を VPS IP へ。  
2. Apache: `/etc/apache2/sites-available/rag-demo-admin.conf` を追加し、DocumentRoot を `/var/www/rag-demo-admin` に設定。  
3. certbot: 既存証明書へ SAN 追加 (`certbot --apache -d health-discovery.com -d www.health-discovery.com -d admin.health-discovery.com --expand`)。  
4. CI/CD: main ブランチへマージ → `pnpm run build`（一般 UI）、`pnpm run build:admin`（管理 UI）を順に配信。  
5. 監査: 管理画面操作は `admin_audit_logs` に記録し、週次でバックアップ。

## 8. 未確定事項 / 質問
1. **管理者アカウント発行フロー**  
   - 誰が admin_users を作成/削除するか。  
   - 初期パスワード配布方法 （手動）
2. **ランキング指標の詳細**  
   - 「順位の定義」を固定 (例: 質問回答数 → 同数なら正答率優先) でよいか?  
   - 「CBT 完走数」の条件 (10問すべて回答?) を確定する必要あり。
3. **CSV/エクスポートの粒度**  
   - 1回で出力できる行数に制約を設けるか (例: 5,000件まで)。  
4. **アクセス制御の厳格度**  
   - VPN などネットワーク制限を併用するか、Basic Auth を追加するか。  
   - 2FA (二要素認証) を必須とするか。必須とする場合、TOTP (アプリ) とメールOTPのどちらをサポートするか。
5. **UI スタイルガイド**  
   - 既存フロントと同じテーマ (Chakra UI) を流用するか、別テーマにするか指示待ち。

上記の不明点を詰めつつ、確定し次第この文書を更新してください。準備が整ったら実装計画（タスク分解、DB マイグレーション、API 実装順序）を追記します。
