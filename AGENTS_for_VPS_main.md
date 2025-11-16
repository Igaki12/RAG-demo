更新済み AGENTS_for_VPS.md

# AGENTS_for_VPS

Health Discovery の公開ドメイン `https://health-discovery.com/`（固定 IP `...`）を、Xserver VPS 上の Ubuntu（25.04 LTS 想定) 上で React(Vite) + Node.js + MySQL 構成に載せ替えるためのインフラ手順です。旧 Flask 環境は存在しない前提で、ここに書かれた手順だけで初期構築と運用が完結します。

## 1. 基本方針

- Web UI は本リポジトリの React/Vite プロジェクトを `npm run build` → `/var/www/rag-demo` へ配置し、Apache が静的配信。  
- Node.js（Express）で認証 API などを提供し、`/api` パスを Apache のリバースプロキシで接続。  
- MySQL 8.x は同一 VPS に設置。サンプル 3 アカウント（`student.alpha+demo01@example.com` など）は DB に格納。  
- TLS は certbot + Apache プラグインで取得し、自動更新のたびに Apache を reload。  
- pm2 で Node プロセスを常駐させ、`/var/log/rag-demo/` 以下へログを集約。  
- JSONL アップロード仕様・UI 方針は `AGENTS.md` を参照（バックアップ運用などのレポルールは変わらず）
- ファイアウォール（UFW 等）の設定は慎重に。過度に厳格化してリモートログイン不能にならないよう、SSH(22/tcp)・HTTP(80/tcp)・HTTPS(443/tcp) を開けてから enable し、現在の SSH セッションを保持したまま別端末/別セッションで疎通確認してから適用。VPS 管理コンソール等の緊急復旧手段も確保しておくこと。

## 2. 初期 OS 設定
### 事前: ChatGPT のユーザ設定（エージェント実行プロファイル）

- リポジトリと運用ルール: RAG-demo の編集・バックアップ命名は AGENTS.md に準拠（`*-latest.html` と日付バックアップ）。
- 対象環境: health-discovery.com（IP: 162.43.51.135）、Ubuntu 25.04 LTS、Apache で静的配信＋Node.js(API)を `/api` でリバースプロキシ。
- 作業ユーザー: `deploy` を管理ユーザーとして使用し、sudo 付与。以降の全手順は `deploy` 前提。
- SSH 方針: `deploy` の公開鍵認証のみ許可。`PermitRootLogin prohibit-password`、`PasswordAuthentication no` に設定後 reload。
- 接続プロファイル: ローカルの `~/.ssh/config` に `Host health-discovery`（deploy ユーザー、鍵パス指定）を登録して接続統一。
- プロセス常駐: pm2 は `deploy` で運用し、自動起動は次で登録すること:  
  `pm2 startup systemd -u deploy --hp /home/deploy`
- フロント/データ仕様: JSONL は利用者アップロードのみをデータソースとし、自動読み込み禁止（AGENTS.md の UI/バリデーション仕様に従う）。

以降の 1〜5 の初期設定は上記前提のもとで実施する。

1. VPS へ root でログインし、管理ユーザーを作成。
   ```bash
   adduser deploy
   usermod -aG sudo deploy

	2.	SSH 鍵を ~deploy/.ssh/authorized_keys へ登録。/etc/ssh/sshd_config で PermitRootLogin prohibit-password、PasswordAuthentication no を設定し sudo systemctl reload sshd。
	3.	~/.ssh/config（ローカルPC）例：

Host health-discovery
  HostName 162.43.51.135
  User deploy
  IdentityFile ~/.ssh/health-discovery
  IdentitiesOnly yes


	4.	パッケージ更新と基本ツール。

sudo apt update
# アップグレード途中で止まった場合は `sudo dpkg --configure -a` で復旧してから再実行
sudo apt upgrade -y
sudo apt install -y build-essential git curl unzip ufw


	5.	UFW を有効化（SSH/HTTP/HTTPS のみ許可）。

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose



3. Node.js / pnpm / pm2

curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install --lts
node -v && npm -v
npm install -g pnpm pm2

補足: syslog 実績では Node v24.11.1 / pnpm 10.22.0 / pm2 6.0.13 で問題なく動作しているが、基本的には LTS 系を追従すればよい。

pnpm は任意だが、リポジトリ本体が pnpm ワークスペースの場合に備えて導入。pm2 startup systemd -u deploy --hp /home/deploy を実行して自動起動を登録。

4. MySQL 8.x

sudo apt install -y mysql-server
# インストール中に mysqld のロック等で停止した場合:
#   sudo pkill -9 mysqld; sudo dpkg --configure -a
sudo mysql_secure_installation --use-default

	1.	ルートログイン後、アプリ用 DB/ユーザー作成。

CREATE DATABASE rag_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ragdemo_app'@'%' IDENTIFIED BY '<<強固なパスワード>>';
GRANT ALL PRIVILEGES ON rag_demo.* TO 'ragdemo_app'@'%';
FLUSH PRIVILEGES;


	2.	認証テーブルとサンプルデータ。

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  password_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (email, display_name, password_hash) VALUES
('student.alpha+demo01@example.com', 'Student Alpha', '5ed6d46b8bb238a81c7efd20a60aebf47157b3ff99e0d3cd974b529b27d6cb9a'),
('analyst.bravo+demo02@example.com', 'Analyst Bravo', 'a479380ef9965fd93779dcdcccb8935f9cafc0a702745bc37716375e90bf2371'),
('mentor.charlie+demo03@example.com', 'Mentor Charlie', '29b534f5415653d83447faee4cea19e1130e5c977baf6e43ef6dbe5b892de885');


	3.	ファイアウォールで 3306 を閉じたままにし、必要なら SSH トンネル経由で管理。

5. ディレクトリ構成

/srv/rag-demo
  ├─ app/                 # リポジトリ clone (React + Node)
  ├─ server/.env          # Node API 用環境変数
  ├─ docs/                # GH Pages 用（必要なら）
  ├─ dist/                # Vite ビルド成果物
/var/www/rag-demo         # Apache の DocumentRoot（rsync で dist → ここ）
/var/log/rag-demo         # pm2/app 用ログ

/srv/rag-demo/app に git clone → pnpm install。機微情報は .env/server/.env に置き、.gitignore 済みか確認。ディレクトリの所有権は /srv/rag-demo 配下を deploy:deploy、/var/www/rag-demo を www-data:www-data、/var/log/rag-demo を deploy:deploy（~/.pm2/logs からのシンボリックリンク）としておくと、syslog 実績と揃う。

6. Node.js バックエンド
	1.	依存インストール

cd /srv/rag-demo/app/server
pnpm install express mysql2 dotenv cors crypto


	2.	server/.env サンプル

PORT=3001
DB_HOST=127.0.0.1
DB_USER=ragdemo_app
DB_PASSWORD=<<強固なパスワード>>
DB_NAME=rag_demo
ALLOWED_ORIGINS=https://health-discovery.com,https://www.health-discovery.com


	3.	server/index.js（抜粋）

import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const origins = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

const app = express();
app.use(cors({ origin: origins, credentials: false }));
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

app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Auth server ready on ${process.env.PORT}`);
});


	4.	pm2 常駐

cd /srv/rag-demo/app/server
pm2 start index.js --name rag-auth
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy

pm2 logs rag-auth で確認。/var/log/rag-demo にシンボリックリンクを作成しておくと監視しやすい。

7. React (Vite) フロント
	1.	.env（フロント）で API ベース URL を統一。

VITE_API_BASE_URL=https://health-discovery.com/api


	2.	pnpm install → pnpm run dev でローカル確認。JSONL アップロードや 3 択クイズなどの仕様は AGENTS.md に準拠。
	3.	ビルド & 配置

pnpm run build
sudo mkdir -p /var/www/rag-demo
sudo rsync -a --delete dist/ /var/www/rag-demo/
sudo chown -R www-data:www-data /var/www/rag-demo



8. Apache 設定
	1.	モジュールとサイト設定

sudo apt install -y apache2
sudo a2enmod ssl rewrite headers proxy proxy_http


	2.	/etc/apache2/sites-available/rag-demo.conf

<VirtualHost *:80>
  ServerName health-discovery.com
  ServerAlias www.health-discovery.com

  DocumentRoot /var/www/rag-demo
  <Directory /var/www/rag-demo>
    AllowOverride All
    Require all granted
  </Directory>

  ProxyPass /api http://127.0.0.1:3001/api
  ProxyPassReverse /api http://127.0.0.1:3001/api

  ErrorLog ${APACHE_LOG_DIR}/rag-demo-error.log
  CustomLog ${APACHE_LOG_DIR}/rag-demo-access.log combined
</VirtualHost>


	3.	有効化

sudo a2dissite 000-default.conf
sudo a2ensite rag-demo.conf
sudo apachectl configtest
sudo systemctl reload apache2



9. TLS（Let’s Encrypt）
	1.	certbot 導入

sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot


	2.	証明書取得（実績ベースの手順）
	1.	事前に DNS を確認し、A/AAAA レコードが存在することを確認。

dig health-discovery.com A +short
dig www.health-discovery.com A +short


	2.	www 側の DNS がまだ伝播していない場合は、まず apex のみで取得。

sudo certbot --apache -d health-discovery.com


	3.	www も到達可能になったら、両ドメインで再実行して統合。

sudo certbot --apache -d health-discovery.com -d www.health-discovery.com


Let’s Encrypt から NXDOMAIN を返される場合は、www の DNS レコードが未設定/未伝播なので落ち着いて待つ。syslog 実績では apex 単独→のちに www 追加の流れで成功している。

	3.	自動更新
	•	sudo systemctl list-timers 'snap.certbot.*' でスケジュール確認。
	•	手動検証: sudo certbot renew --dry-run --no-random-sleep-on-renew
	•	更新時に pm2 を触る必要はなく、Apache reload のみで反映される。

10. デプロイ手順まとめ
	1.	Git pull → pnpm install（必要があれば）。
	2.	バックエンド：cd server && pnpm install && pm2 restart rag-auth。
	3.	フロント：pnpm run build && sudo rsync -a --delete dist/ /var/www/rag-demo/ && sudo systemctl reload apache2。
	4.	確認：
	•	curl -X POST https://health-discovery.com/api/auth/login ...
	•	ブラウザで JSONL 未読時のスケルトン表示→アップロード後の挙動を手動チェック。
	•	curl https://health-discovery.com/api/health が 200 を返すか。

11. 監視・ログ
	•	Apache: /var/log/apache2/rag-demo-access.log / rag-demo-error.log
	•	Node: pm2 logs rag-auth（~/.pm2/logs → /var/log/rag-demo/pm2 への symlink を張っておくと閲覧しやすい。ローテーションは pm2 install pm2-logrotate 推奨）
	•	MySQL: sudo journalctl -u mysql

12. バックアップと復旧
	1.	アプリコード：GitHub が single source of truth。
	2.	DB：mysqldump rag_demo > /srv/backups/rag_demo-$(date +%Y%m%d).sql を cron 化。
	3.	証明書：Let’s Encrypt は自動。バックアップは /etc/letsencrypt を tar で月次退避。
	4.	復旧：OS 再インストール後は本ドキュメントを順に実施すれば環境を再構築できる。

13. 動作確認チェックリスト
	1.	pm2 status に rag-auth が online。
	2.	curl http://127.0.0.1:3001/api/health が {"ok":true,...} を返す（Apache を挟まないローカル疎通確認）。
	3.	sudo apachectl configtest → Syntax OK。
	4.	curl -I https://health-discovery.com/ が 200。
	5.	curl -I https://health-discovery.com/api/health が 200。
	6.	openssl s_client -connect health-discovery.com:443 -servername health-discovery.com で証明書 CN/有効期限を確認。
	7.	JSONL アップロード → グラフ／クイズ表示 → 3 アカウントでログイン可。
	8.	sudo certbot renew --dry-run --no-random-sleep-on-renew が成功。
	9.	mysqldump rag_demo がエラーなく完了。

14. トラブル対処メモ
	•	apt upgrade でフリーズした: sudo dpkg --configure -a を実行し、残タスクを完了させてから再度 sudo apt upgrade -y。syslog 実績でも途中停止→dpkg --configure -a で復旧している。
	•	mysql-server インストール時にロックで停止: sudo pkill -9 mysqld で残った mysqld を止めてから sudo dpkg --configure -a を実行し、その後 sudo systemctl enable --now mysql。
	•	CORS エラー: VITE_API_BASE_URL と Apache の /api プロキシが一致しているか、ALLOWED_ORIGINS の値を確認。
	•	502 Bad Gateway: Node が停止していないか pm2 logs rag-auth、Apache の ProxyPass パスを再確認。
	•	MySQL 接続拒否: sudo mysql -u root でローカル接続し、SHOW PROCESSLIST; や SHOW VARIABLES LIKE 'max_connections'; を確認。必要なら mysql_config_editor でアプリ専用資格情報を再発行。
	•	証明書取得/更新失敗 (NXDOMAIN): dig health-discovery.com A / dig www.health-discovery.com A で DNS を確認。www が NXDOMAIN の場合は apex のみで certbot を実行し、www のレコード伝播後に両ドメインで再実行する。
	•	証明書更新失敗 (その他): sudo systemctl status snap.certbot.renew.service を確認。HTTP80/HTTPS443 が開いているか、Apache の default site が重複していないかをチェック。

この手順を順守すれば、OS 再インストール後でも短時間で健康な React/Node/MySQL 環境を再構築できます。README 等の補足が必要になった場合は本ファイルに追記し、常に最新の運用フローを共有してください。
