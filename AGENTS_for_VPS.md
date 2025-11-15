# AGENTS_for_VPS

Xserver VPS 上で React/Node/MySQL 構成を立ち上げ、初期画面を公開 URL から確認できる状態にするための手順メモです。公開先は `https://health-discovery.com/`（IP: `162.43.51.135`）です。

## 1. VPS 前提とインストール確認

- OS は最新の安定版 Linux（例: Ubuntu 22.04/24.04）を想定します。`sudo apt update && sudo apt upgrade -y` で事前更新。
- Node.js / npm は最新安定版（問題があれば 1 つ前）を `nvm` で導入。
  ```bash
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source ~/.nvm/nvm.sh
  nvm install --lts
  node -v && npm -v
  ```
- MySQL は 8.x 系最新を利用。`sudo apt install mysql-server` 後 `sudo mysql_secure_installation` を走らせ、root パスワードとリモート接続ポリシーを設定。
- Web サーバーは Apache2（ユーザー要望）を利用。`sudo apt install apache2`、`sudo a2enmod rewrite proxy proxy_http headers`。React のビルド成果物を `/var/www/html` から配信します。
- Node プロセス管理は PM2（最も一般的）を採用。`sudo npm install -g pm2`。

## 2. リポジトリとディレクトリ構成

1. VPS 上の作業ディレクトリ（例: `/var/www/RAG-demo`）を作成し、このリポジトリを `git clone`。
2. ルート直下に React/Vite プロジェクト（既存 `src/`, `docs/` 想定）と、サーバー用ディレクトリ（例: `server/`）を配置。
3. `.env`/`.env.local` などに機微情報を置き、`gitignore` に追加。

## 3. MySQL セットアップとアカウント投入

1. MySQL に管理者でログイン：`sudo mysql -u root -p`
2. データベースとアプリ専用ユーザーを作成。
   ```sql
   CREATE DATABASE rag_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'ragdemo_app'@'%' IDENTIFIED BY '<<強固なパスワード>>';
   GRANT ALL PRIVILEGES ON rag_demo.* TO 'ragdemo_app'@'%';
   FLUSH PRIVILEGES;
   ```
3. `users` テーブルを作成（認証情報のみ）。
   ```sql
   USE rag_demo;
   CREATE TABLE users (
     id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
     email VARCHAR(255) NOT NULL UNIQUE,
     display_name VARCHAR(255) NOT NULL,
     password_hash CHAR(64) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
   ```
4. サンプル 3 アカウントを SHA-256 で投入（`password_hash` は `SHA2(?, 256)` で生成済み）。
   ```sql
   INSERT INTO users (email, display_name, password_hash) VALUES
   ('student.alpha+demo01@example.com', 'Student Alpha', '5ed6d46b8bb238a81c7efd20a60aebf47157b3ff99e0d3cd974b529b27d6cb9a'),
   ('analyst.bravo+demo02@example.com', 'Analyst Bravo', 'a479380ef9965fd93779dcdcccb8935f9cafc0a702745bc37716375e90bf2371'),
   ('mentor.charlie+demo03@example.com', 'Mentor Charlie', '29b534f5415653d83447faee4cea19e1130e5c977baf6e43ef6dbe5b892de885');
   ```
5. `SELECT email, display_name FROM users;` で投入確認。

## 4. Node.js バックエンド（最小構成）

> **REST API の役割**  
> React から直接 DB へアクセスさせず、Node.js が REST API として橋渡しを行います。これにより、MySQL 資格情報をブラウザへ晒さずに認証・同期処理を安全に提供できます。本ガイドでは `/api/auth/login` の 1 エンドポイントのみを先行導入し、動作を確認できれば今回の目標は達成です（将来の API 拡張はこの構成を基点に行います）。

1. `server/` で初期化：
   ```bash
   cd server
   npm init -y
   npm install express mysql2 dotenv cors
   ```
2. `.env`（server/.env）
   ```
   PORT=3001
   DB_HOST=localhost
   DB_USER=ragdemo_app
   DB_PASSWORD=<<強固なパスワード>>
   DB_NAME=rag_demo
   ```
3. `server/index.js`（REST 最小：`POST /api/auth/login` でメール＋パスワードを照合）。
   ```js
   import express from 'express';
   import cors from 'cors';
   import mysql from 'mysql2/promise';
   import crypto from 'crypto';
   import dotenv from 'dotenv';

   dotenv.config();

   const app = express();
   app.use(cors());
   app.use(express.json());

   const pool = mysql.createPool({
     host: process.env.DB_HOST,
     user: process.env.DB_USER,
     password: process.env.DB_PASSWORD,
     database: process.env.DB_NAME,
     waitForConnections: true,
   });

   app.post('/api/auth/login', async (req, res) => {
     const { email, password } = req.body ?? {};
     if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

     const hash = crypto.createHash('sha256').update(password).digest('hex');
     const [rows] = await pool.execute(
       'SELECT email, display_name FROM users WHERE email = ? AND password_hash = ? LIMIT 1',
       [email, hash]
     );
     if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });
     res.json({ email: rows[0].email, displayName: rows[0].display_name });
   });

   app.listen(process.env.PORT, () => {
     console.log(`Auth server ready on ${process.env.PORT}`);
   });
   ```
4. 実行と常駐
   ```bash
   node server/index.js          # 動作確認
   pm2 start server/index.js --name rag-auth
   pm2 save
   pm2 startup                   # 再起動時に自動復旧
   ```

## 5. React (Vite) フロントの公開

1. 既存の React/Vite プロジェクトで依存をインストールし、`.env` を設定。
   ```
   VITE_API_BASE_URL=http://162.43.51.135:3001
   ```
   ※ リバースプロキシを使わない前提なので、フロントから直接ポート 3001 を叩く。ファイアウォールで 3000/3001 を開放。
2. `npm install` → `npm run dev` で初期画面をローカル確認。RAG Demo 仕様（JSONL アップロード、スケルトン表示、3 択クイズなど）は `AGENTS.md` のポリシーを継承。
3. ビルドとデプロイ（成果物は `https://health-discovery.com/` → `/var/www/html` に配置）：
   ```bash
   npm run build
   sudo rm -rf /var/www/html/*
   sudo cp -R dist/* /var/www/html/
   sudo chown -R www-data:www-data /var/www/html
   ```
4. Apache2 にシンプルな設定を適用（`/etc/apache2/sites-available/000-default.conf`）。
   ```apache
   <VirtualHost *:80>
     DocumentRoot /var/www/html
     <Directory /var/www/html>
       AllowOverride All
       Require all granted
     </Directory>
     ErrorLog ${APACHE_LOG_DIR}/rag-demo-error.log
     CustomLog ${APACHE_LOG_DIR}/rag-demo-access.log combined
   </VirtualHost>
   ```
   `sudo systemctl reload apache2`。

## 6. 動作確認フロー

1. **バックエンド**: `curl -X POST http://162.43.51.135:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"student.alpha+demo01@example.com","password":"NewsQuest#01"}'` が 200 / JSON を返すこと。
2. **React 初期画面**: ブラウザで `https://health-discovery.com/` を開き、JSONL アップロード UI が表示されることを確認。未アップロード時のスケルトン表示、アップロード成功時のフィードが既存仕様通りか手動確認。
3. **フロント→バック連携**: ログインフォーム（`AuthGate`）から上記 3 アカウントを入力して、バックエンドからのレスポンスで表示名がレンダリングされること。ネットワークタブで `https://health-discovery.com` から `http://162.43.51.135:3001/api/auth/login` へアクセスしていることを確認。

## 7. 追加メモ

- まだ API 群は `/api/auth/login` のみ。将来追加する際はサービス層（`src/services/auth/accounts.ts` → 実 DB 呼び出し）を拡張し、`newsService` など既存ロジックとの責務分離を保つ。
- JSONL アップロード仕様、UI/UX 方針、Vite/Chakra 設計は `AGENTS.md` を参照。React 側でのデータロードは必ずユーザーアップロードファイルから行い、サーバー側で自動読み込みしない。
- VPS 側での作業ログには、日付付きバックアップをどの HTML に対して作成したか、またどのコマンドで DB/サービスを更新したかを必ず記録する。
