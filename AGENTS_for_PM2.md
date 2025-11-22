# AGENTS_for_PM2

Health Discovery 環境で PM2 を使って Node.js（Express）API を常駐させる際の運用メモです。ここでは `/srv/rag-demo/app/server` にある認証 API を `pm2` 管理下に置く前提でまとめています。

## 1. 役割と全体像
- PM2 は Node.js プロセスのフォークリングマネージャー。プロセス死活監視、自動再起動、ログ収集、OS 起動時の復元を担当します。
- 現在の API プロセス名は `rag-auth`。`server/index.js` を直接 `node` で実行し、Apache から `/api` 経由でリバースプロキシされています。
- この環境は root 以外のユーザーで pm2 コマンドを実行する権限が制限されているため、pm2 デーモンは root ユーザーで動作しています（本来は `deploy` での運用が推奨）。

## 2. プロセス管理コマンド
```bash
# 状態確認
pm2 status

# API 再起動
pm2 restart rag-auth

# 停止 / 起動
pm2 stop rag-auth
pm2 start /srv/rag-demo/app/server/index.js --name rag-auth --cwd /srv/rag-demo/app/server

# プロセス一覧を保存（再起動復元用）
pm2 save
```

## 3. 自動起動設定
```bash
# systemd 向けの起動スクリプトを作成
pm2 startup systemd

# 出力されるコマンドを実行済み（サービス名: pm2-root）
# 以後は pm2 save / pm2 resurrect でプロセス一覧を維持
```

生成されたユニットファイル: `/etc/systemd/system/pm2-root.service`  
起動後の復元は pm2 が `/root/.pm2/dump.pm2` を参照します。

## 4. ログと監視
- 位置: `/root/.pm2/logs/rag-auth-out.log`（標準出力）、`/root/.pm2/logs/rag-auth-error.log`（標準エラー）
- tail 表示: `pm2 logs rag-auth`
- Apache 経由のアクセスログは ` /var/log/apache2/rag-demo-access.log` を参照。

## 5. 環境変数とビルド
- API の `.env` は `/srv/rag-demo/app/server/.env`
- SMTP や DB 接続情報を更新したら `pm2 restart rag-auth`
- React フロントのビルド更新時は `npm run build` → `/var/www/rag-demo` へ rsync し、Apache を reload。

## 6. トラブルシューティング
| 症状 | 確認コマンド / 対処 |
| --- | --- |
| API に接続できない | `pm2 status` で `rag-auth` が `online` か確認。`pm2 logs rag-auth` で例外を調査。 |
| ポート 3001 が LISTEN していない | `ss -tlnp | grep 3001` で確認。プロセスが停止している場合は `pm2 restart rag-auth`。 |
| サーバー再起動後に API が起動しない | `pm2 resurrect` または `pm2 save` が実行されているか確認。`systemctl status pm2-root` でユニット状態を確認。 |
| `deploy` ユーザーから pm2 コマンドが使えない | この環境は root 以外での pm2 実行が制限されている。必要に応じて root で実行するか、権限調整後に `pm2 unstartup systemd` → `sudo -u deploy pm2 startup systemd` を設定し直す。 |

## 7. 今後のメモ
- 可能であれば pm2 を `deploy` ユーザーに移行し、`/home/deploy/.pm2` 配下で管理する。
- ログローテーションが必要な場合は `pm2 install pm2-logrotate` を root で実行（または `deploy` 環境整備後に実行）。
- 新しい API を追加する際は `pm2 start <path> --name <process>` を増やし、`pm2 save` で一覧を更新する。
