# AGENTS_for_VPS_about_DB

X Server VPS（Ubuntu）上の **ニュース学習サービス用データベース** を MySQL で設計・構築するための手順です。  
フロントエンドは `commonsense-latest.html`（vis-network を使ったニュースネットワーク＋理解度テスト UI , 別段階で実装）を前提とし、  
バックエンドは Node.js（Express + mysql2）から本 DB に接続します。

既存の `AGENTS_for_VPS.md` で定義済みの:

- `rag_demo` データベース
- `users` テーブル
- アプリ用 MySQL ユーザー `ragdemo_app`@`%`

を前提として、**ニュース記事・エンティティ・subject_code・クイズ・学習ログ** を追加で管理する構成を定義します。

---

## 1. 前提環境（VPS_syslog の要約）

### 1-1. OS / ミドルウェア

- Ubuntu（X Server VPS 標準）
- `deploy` ユーザー作成済み、sudo 付与・SSH 公開鍵ログイン済み
- UFW 有効化済み（OpenSSH/80/443 のみ許可）
- Node.js: nvm 経由で **Node LTS v24.11.1** 導入済み
- npm グローバル:
  - pnpm 10.22.0
  - pm2 6.0.13
- Apache2 導入済み
  - `ssl`, `rewrite`, `headers`, `proxy`, `proxy_http` 有効化
  - `rag-demo.conf` にて Vite のビルド成果物を `/var/www/rag-demo` から配信
- certbot 導入済み・Let’s Encrypt 証明書取得済み（一部 ServerAlias は DNS 状況に応じて再実行要）

### 1-2. MySQL

- `apt install -y mysql-server` 済み
- `mysql_secure_installation --use-default` 済み（匿名ユーザー削除・テスト DB 削除・root リモート拒否など）
- `rag_demo` データベース作成済み
- アプリケーション用ユーザー:
  - ユーザー名: `ragdemo_app`@`%`
  - パスワード: **AGENTS_for_VPS.md / パスワード管理ツールを参照**（syslog 上の平文はここでは再掲しない）
- `rag_demo.users` テーブルは既に存在（メール・表示名・パスワードハッシュを保持）

本ファイルでは、上記環境に **追加で作成するテーブル構成と DDL** を定義します。

---

## 2. データモデル概要

### 2-1. ユースケースからの要件

1. ニュース記事のメタデータを **subject_code を含めて完全に保持** する  
   - JSONL の 1 行 = 1 記事  
   - すべての key を `raw_json`（JSON 型）に格納しつつ、よく使う key（`date_id`, `headline`, `content` など）は列として展開
   - `subject_codes` / `named_entities` は正規化テーブルで管理し、共起ネットワークの元データにする

2. 学習ログを **「読むログ」と「クイズ回答ログ」で分離** する  
   - 記事を開いて読んだ記録（`article_reads`）
   - 設問に回答した記録（`question_answers`）
   - 回答モード（記事からの確認テスト／ランダム出題など）を区別する

3. クイズは 3 択（将来 n 択対応）  
   - 設問（`questions`）と選択肢（`choices`）を分離
   - 設問の `difficulty` は**持たない**
   - 代わりに「実測の正解率」「選択肢の選択率」を統計テーブル（`question_stats`, `choice_stats`）として保持

4. 学習量とランキング  
   - ユーザーごと／日ごとに「読んだ記事数」「解いた問題数」「正答率」などを集約（`daily_user_stats`）
   - 所属グループ（学校・クラス・研修班など）の中での順位を出せるようにする（`groups`, `user_group_memberships`）

### 2-2. テーブル一覧

既存:  

- `users` … アカウント（メール・表示名・パスワードハッシュ）。メール認証フローに対応するため `email_verified TINYINT(1)` を追加し、既存ユーザーは 1（認証済み）を初期値とする。

本ファイルで追加するテーブル:

1. **マスタ／記事メタデータ**
   - `articles` … ニュース記事本体＋メタデータ＋`raw_json`
   - `subject_codes` … subject / subject_matter のマスタ
   - `article_subject_codes` … 記事と subject_code の多対多
   - `entities` … named_entities のマスタ
   - `article_entities` … 記事とエンティティの多対多（頻度付き）

2. **クイズ**
   - `questions` … 設問本体（difficulty なし）
   - `choices` … 選択肢（3 択想定、先頭が正解でも DB 上はフラットに管理）

3. **ログ**
   - `article_reads` … 「記事を読んだ」ログ
   - `question_answers` … 「クイズに回答した」ログ（セッション単位のテーブルは持たない）

4. **統計**
   - `question_stats` … 設問ごとの回答総数・正解数・正解率
   - `choice_stats` … 選択肢ごとの選択回数・選択率
   - `daily_user_stats` … ユーザー × 日付の集計（読んだ記事数・解いた問題数・正答率など）

5. **グループ・ランキング**
   - `groups` … 学校・クラス・研修班など
   - `user_group_memberships` … ユーザーとグループの紐付け

---

## 3. テーブル定義（DDL: MySQL 8 / InnoDB）

> 実運用では `mysql` CLI から `USE rag_demo;` を実行した上で、以下を順番に流します。  
> 既存の `users` テーブルは **作り直さない** 前提です。

```sql
USE rag_demo;

-- 1. subject_codes: subject / subject_matter マスタ
CREATE TABLE IF NOT EXISTS subject_codes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject         VARCHAR(32) NOT NULL,
  subject_matter  VARCHAR(32) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subject_subject_matter (subject, subject_matter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. entities: named_entities マスタ
CREATE TABLE IF NOT EXISTS entities (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  entity_type     VARCHAR(64) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entity_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. articles: ニュース記事本体＋メタデータ
CREATE TABLE IF NOT EXISTS articles (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider_id             VARCHAR(64) NULL,
  date_id                 BIGINT NULL, -- JSONL の date_id をそのまま格納（例: 20250622）
  news_item_id            VARCHAR(64) NOT NULL,
  public_identifier       VARCHAR(128) NULL,
  news_item_type          VARCHAR(64) NULL,
  first_created           DATETIME NULL,
  this_revision_created   DATETIME NULL,
  status                  VARCHAR(32) NULL,
  canceled                TINYINT(1) DEFAULT 0,
  headline                TEXT NULL,
  sub_headline            TEXT NULL,
  series_line             TEXT NULL,
  language                VARCHAR(16) NULL,
  content_profile         VARCHAR(64) NULL,
  priority                INT NULL,
  content                 MEDIUMTEXT NULL,
  raw_json                JSON NULL, -- 元 JSONL 1 行分を丸ごと保持
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_news_item_id (news_item_id),
  KEY idx_articles_date_id (date_id),
  KEY idx_articles_provider_date (provider_id, date_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. article_subject_codes: 記事 ↔ subject_code
CREATE TABLE IF NOT EXISTS article_subject_codes (
  article_id       BIGINT UNSIGNED NOT NULL,
  subject_code_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (article_id, subject_code_id),
  CONSTRAINT fk_asc_article
    FOREIGN KEY (article_id) REFERENCES articles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_asc_subject_code
    FOREIGN KEY (subject_code_id) REFERENCES subject_codes(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. article_entities: 記事 ↔ エンティティ（共起ネットワーク用）
CREATE TABLE IF NOT EXISTS article_entities (
  article_id   BIGINT UNSIGNED NOT NULL,
  entity_id    INT UNSIGNED NOT NULL,
  frequency    INT UNSIGNED DEFAULT 1,
  PRIMARY KEY (article_id, entity_id),
  CONSTRAINT fk_ae_article
    FOREIGN KEY (article_id) REFERENCES articles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ae_entity
    FOREIGN KEY (entity_id) REFERENCES entities(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. groups: 学校・クラス・研修班など
CREATE TABLE IF NOT EXISTS groups (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  group_type   VARCHAR(64) NULL, -- 'school', 'company', 'class' など
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. user_group_memberships: ユーザー所属
--    users テーブルは既存の定義を前提とする
CREATE TABLE IF NOT EXISTS user_group_memberships (
  user_id      INT UNSIGNED NOT NULL,
  group_id     INT UNSIGNED NOT NULL,
  role_in_group VARCHAR(64) DEFAULT 'member',
  joined_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, group_id),
  CONSTRAINT fk_ugm_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ugm_group
    FOREIGN KEY (group_id) REFERENCES groups(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. questions: 設問本体（difficulty は持たない）
CREATE TABLE IF NOT EXISTS questions (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  article_id        BIGINT UNSIGNED NOT NULL,
  question_text     TEXT NOT NULL,
  explanation       TEXT NULL,
  order_in_article  INT UNSIGNED NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_questions_article
    FOREIGN KEY (article_id) REFERENCES articles(id)
    ON DELETE CASCADE,
  KEY idx_questions_article (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. choices: 選択肢（3 択〜n 択対応）
CREATE TABLE IF NOT EXISTS choices (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id   BIGINT UNSIGNED NOT NULL,
  choice_index  INT UNSIGNED NOT NULL,
  choice_text   TEXT NOT NULL,
  is_correct    TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_choices_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE,
  KEY idx_choices_question (question_id),
  KEY idx_choices_question_index (question_id, choice_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. article_reads: 「記事を読んだ」ログ
CREATE TABLE IF NOT EXISTS article_reads (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  article_id      BIGINT UNSIGNED NOT NULL,
  read_started_at DATETIME NOT NULL,
  read_finished_at DATETIME NULL,
  read_seconds    INT UNSIGNED NULL,
  read_source     VARCHAR(64) NULL, -- 'network_click', 'random_modal' など
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_article_reads_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_article_reads_article
    FOREIGN KEY (article_id) REFERENCES articles(id)
    ON DELETE CASCADE,
  KEY idx_article_reads_user_date (user_id, read_started_at),
  KEY idx_article_reads_article (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. email_verifications: サインアップ用のメール認証コード
CREATE TABLE IF NOT EXISTS email_verifications (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  code_hash     CHAR(64) NOT NULL,
  expires_at    DATETIME NOT NULL,
  consumed_at   DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_verifications_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. question_answers: 「クイズに回答した」ログ（セッション単位ではない）
CREATE TABLE IF NOT EXISTS question_answers (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  article_id    BIGINT UNSIGNED NOT NULL,
  question_id   BIGINT UNSIGNED NOT NULL,
  choice_id     BIGINT UNSIGNED NOT NULL,
  is_correct    TINYINT(1) NOT NULL,
  question_mode VARCHAR(32) NOT NULL, -- 出題 UI: 'article_modal', 'random_single', 'cbt_batch' など 3 種以上
  answered_at   DATETIME NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qa_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qa_article
    FOREIGN KEY (article_id) REFERENCES articles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qa_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_qa_choice
    FOREIGN KEY (choice_id) REFERENCES choices(id)
    ON DELETE CASCADE,
  KEY idx_qa_user_answered_at (user_id, answered_at),
  KEY idx_qa_question (question_id),
  KEY idx_qa_choice (choice_id),
  KEY idx_qa_article (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`question_mode` は React フロントエンドの出題手段を明示するカラムで、現状は
`article_modal`（記事詳細モーダル）、`random_single`（ランダム一問モーダル）、
`cbt_batch`（CBT 形式の連続出題）の 3 パターンを最低限記録する。将来的に
モードが増えた場合は値を追加し、クライアントから送信されるモード名と同期させる。

-- 13. question_stats: 設問ごとの統計（一般正解率など）
CREATE TABLE IF NOT EXISTS question_stats (
  question_id          BIGINT UNSIGNED PRIMARY KEY,
  total_answers        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  correct_answers      BIGINT UNSIGNED NOT NULL DEFAULT 0,
  global_correct_rate  DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  last_calculated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qs_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. choice_stats: 選択肢ごとの統計（選択率など）
CREATE TABLE IF NOT EXISTS choice_stats (
  choice_id        BIGINT UNSIGNED PRIMARY KEY,
  total_selected   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  selection_rate   DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  last_calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cs_choice
    FOREIGN KEY (choice_id) REFERENCES choices(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. daily_user_stats: ユーザー × 日付の集計
CREATE TABLE IF NOT EXISTS daily_user_stats (
  user_id                    INT UNSIGNED NOT NULL,
  date                       DATE NOT NULL,
  articles_read              INT UNSIGNED NOT NULL DEFAULT 0,
  questions_answered         INT UNSIGNED NOT NULL DEFAULT 0,
  correct_answers            INT UNSIGNED NOT NULL DEFAULT 0,
  distinct_articles_answered INT UNSIGNED NOT NULL DEFAULT 0,
  avg_accuracy               DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  last_calculated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, date),
  CONSTRAINT fk_dus_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  KEY idx_dus_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


⸻

4. 初回適用手順

Codex CLI での自動化を想定した、おおまかな手順です。
	1.	deploy ユーザーで VPS にログイン

ssh deploy@<VPS_IP>


	2.	MySQL クライアントで rag_demo に接続できることを確認

mysql -u root -p

-- 例
SHOW DATABASES LIKE 'rag_demo';
SHOW GRANTS FOR 'ragdemo_app'@'%';


	3.	本ファイルの DDL 部分を schema_news_learning.sql として保存
	•	例: /srv/rag-demo/db/schema_news_learning.sql
	•	Codex に「指定のパスに SQL ファイルを書き出す」タスクを実行させる
	4.	スキーマを適用

mysql -u root -p rag_demo < /srv/rag-demo/db/schema_news_learning.sql


	5.	JSONL データ取り込み（オプション）

cd /srv/rag-demo/app/server
node scripts/import-jsonl.js [/path/to/file.jsonl]


	5.	必要に応じてアプリ用ユーザーの権限を確認／再付与（既に付与済みのはず）

GRANT ALL PRIVILEGES ON rag_demo.* TO 'ragdemo_app'@'%';
FLUSH PRIVILEGES;



⸻

5. 動作確認用サンプルクエリ

5-1. JSONL 取り込み後、記事件数と subject_code の確認

SELECT COUNT(*) AS article_count FROM articles;

SELECT sc.subject, sc.subject_matter, COUNT(*) AS article_cnt
FROM article_subject_codes ascj
JOIN subject_codes sc ON ascj.subject_code_id = sc.id
GROUP BY sc.subject, sc.subject_matter
ORDER BY article_cnt DESC
LIMIT 20;

5-2. ある記事のエンティティリスト

SELECT a.news_item_id, e.name, ae.frequency
FROM articles a
JOIN article_entities ae ON ae.article_id = a.id
JOIN entities e ON e.id = ae.entity_id
WHERE a.id = :article_id
ORDER BY ae.frequency DESC;

5-3. 設問の正解率・選択率（統計テーブルを利用）

SELECT
  q.id AS question_id,
  q.question_text,
  qs.total_answers,
  qs.correct_answers,
  qs.global_correct_rate,
  c.id AS choice_id,
  c.choice_index,
  c.choice_text,
  c.is_correct,
  cs.total_selected,
  cs.selection_rate
FROM questions q
LEFT JOIN question_stats qs ON qs.question_id = q.id
LEFT JOIN choices c ON c.question_id = q.id
LEFT JOIN choice_stats cs ON cs.choice_id = c.id
WHERE q.article_id = :article_id
ORDER BY q.id, c.choice_index;

5-4. 日次学習量とグループ内ランキング

-- ユーザーの日次学習量
SELECT
  dus.date,
  dus.articles_read,
  dus.questions_answered,
  dus.correct_answers,
  dus.avg_accuracy
FROM daily_user_stats dus
WHERE dus.user_id = :user_id
ORDER BY dus.date DESC
LIMIT 30;

-- あるグループ内で、その日のランキング
SELECT
  u.id AS user_id,
  u.display_name,
  dus.articles_read,
  dus.questions_answered,
  dus.avg_accuracy,
  RANK() OVER (
    PARTITION BY ugm.group_id, dus.date
    ORDER BY dus.questions_answered DESC, dus.avg_accuracy DESC
  ) AS rank_in_group
FROM daily_user_stats dus
JOIN user_group_memberships ugm ON dus.user_id = ugm.user_id
JOIN users u ON u.id = dus.user_id
WHERE ugm.group_id = :group_id
  AND dus.date = :target_date
ORDER BY rank_in_group;


⸻

6. 実装メモ（Node.js 側）
	•	接続ライブラリ: mysql2（既存の AGENTS_for_VPS と同じ前提）
	•	.env 例:

DB_HOST=localhost
DB_PORT=3306
DB_USER=ragdemo_app
DB_PASSWORD=<<強固なパスワード>>
DB_NAME=rag_demo


	•	主な API のイメージ:
	•	JSONL インポートバッチ:
	•	articles, subject_codes, article_subject_codes, entities, article_entities, questions, choices を INSERT/UPSERT
	•	記事読了ログ:
	•	/api/articles/:id/read で article_reads に 1 レコード追加
	•	新規登録フロー:
	•	/api/auth/send-code で email_verifications に 1 レコード upsert → nodemailer で認証コードを送信
	•	/api/auth/register で email_verifications を検証し、users / user_group_memberships へ反映
	•	クイズ回答ログ:
	•	/api/questions/:id/answer で question_answers に INSERT（question_mode を指定）
	•	統計更新:
	•	バックグラウンドジョブ（cron / pm2 cron モジュールなど）で
	•	question_answers から question_stats, choice_stats を集計更新
	•	article_reads / question_answers から daily_user_stats を集計更新

⸻

7. このファイルを使うときの方針
	•	インフラ構築の手順（Apache, Node, pm2, certbot 等）は AGENTS_for_VPS.md を正とする。
	•	本 AGENTS_for_VPS_about_DB.md は、主に以下の用途で Codex CLI に読ませる:
	1.	schema_news_learning.sql を自動生成させる
	2.	JSONL 取り込み用スクリプト（Node.js）の雛形を生成させる
	3.	統計更新バッチ（question_stats / choice_stats / daily_user_stats）を実装させる
	•	既存の users テーブルや ragdemo_app ユーザー定義と矛盾させないこと。
	•	実際のパスワードやドメイン名などの秘密情報は、syslog ではなく .env / パスワード管理ツール側を正とする。
