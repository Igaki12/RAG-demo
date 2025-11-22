#!/usr/bin/env node
/**
 * JSONL -> MySQL importer for News Network data.
 *
 * Usage:
 *   node scripts/import-jsonl.js [/path/to/file.jsonl]
 *
 * The script loads database credentials from ../.env (same as the API),
 * streams the JSONL file line-by-line, and populates:
 *   - articles
 *   - subject_codes / article_subject_codes
 *   - entities / article_entities
 *   - questions / choices
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const mysql = require('mysql2/promise')
const dotenv = require('dotenv')

const envPath = path.join(__dirname, '..', '.env')
dotenv.config({ path: envPath })

const DEFAULT_JSONL = path.resolve(
  __dirname,
  '../../public/news_full_mcq3_type9_entities_novectors.jsonl',
)

const jsonlPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_JSONL

if (!fs.existsSync(jsonlPath)) {
  console.error(`JSONL ファイルが見つかりません: ${jsonlPath}`)
  process.exit(1)
}

const {
  DB_HOST = '127.0.0.1',
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT = 3306,
} = process.env

if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error('DB 接続情報が .env に設定されていません。DB_USER / DB_PASSWORD / DB_NAME を確認してください。')
  process.exit(1)
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: Number(DB_PORT),
  waitForConnections: true,
  connectionLimit: 2,
})

const DATE_TIME_REGEX = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/

function formatDateTime(value) {
  if (typeof value !== 'string') return null
  const match = value.match(DATE_TIME_REGEX)
  if (!match) return null
  const [, y, m, d, hh, mm, ss] = match
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

function normalizeString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

async function ensureSubjectCode(conn, subject, subjectMatter) {
  if (!subject || !subjectMatter) return null
  const [result] = await conn.execute(
    `
      INSERT INTO subject_codes (subject, subject_matter)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
    `,
    [subject, subjectMatter],
  )
  return result.insertId
}

async function ensureEntity(conn, name) {
  if (!name) return null
  const [result] = await conn.execute(
    `
      INSERT INTO entities (name)
      VALUES (?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
    `,
    [name],
  )
  return result.insertId
}

async function insertSubjectRelations(conn, articleId, subjectCodes) {
  if (!Array.isArray(subjectCodes)) return
  const seen = new Set()
  for (const entry of subjectCodes) {
    if (!entry || typeof entry !== 'object') continue
    const subject = normalizeString(entry.subject)
    const matter = normalizeString(entry.subject_matter)
    if (!subject || !matter) continue
    const key = `${subject}-${matter}`
    if (seen.has(key)) continue
    seen.add(key)
    const subjectId = await ensureSubjectCode(conn, subject, matter)
    if (!subjectId) continue
    await conn.execute(
      `
        INSERT INTO article_subject_codes (article_id, subject_code_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE subject_code_id = VALUES(subject_code_id)
      `,
      [articleId, subjectId],
    )
  }
}

async function insertEntities(conn, articleId, entities) {
  if (!Array.isArray(entities) || entities.length === 0) return
  const counts = new Map()
  for (const raw of entities) {
    const name = normalizeString(typeof raw === 'string' ? raw : String(raw))
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  for (const [name, frequency] of counts.entries()) {
    const entityId = await ensureEntity(conn, name)
    if (!entityId) continue
    await conn.execute(
      `
        INSERT INTO article_entities (article_id, entity_id, frequency)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE frequency = VALUES(frequency)
      `,
      [articleId, entityId, frequency],
    )
  }
}

async function insertQuestions(conn, articleId, questions) {
  if (!Array.isArray(questions) || questions.length === 0) return
  let orderInArticle = 1
  for (const item of questions) {
    if (!item || typeof item !== 'object') continue
    const questionText = normalizeString(item.question)
    if (!questionText) continue
    const [questionResult] = await conn.execute(
      `
        INSERT INTO questions (article_id, question_text, explanation, order_in_article)
        VALUES (?, ?, NULL, ?)
      `,
      [articleId, questionText, orderInArticle],
    )
    orderInArticle += 1
    const questionId = questionResult.insertId
    const choices = Array.isArray(item.choices) ? item.choices : []
    for (let idx = 0; idx < choices.length; idx += 1) {
      const choice = choices[idx]
      const text = normalizeString(typeof choice === 'string' ? choice : String(choice))
      if (!text) continue
      await conn.execute(
        `
          INSERT INTO choices (question_id, choice_index, choice_text, is_correct)
          VALUES (?, ?, ?, ?)
        `,
        [questionId, idx, text, idx === 0 ? 1 : 0],
      )
    }
  }
}

function extractArticleValues(record) {
  const contentProfile =
    typeof record.content_profile === 'string'
      ? record.content_profile
      : normalizeString(record.content_profile?.media_type || record.content_profile?.format)

  const priorityValue =
    record.priority !== undefined && record.priority !== null
      ? Number(record.priority)
      : null
  const priority = Number.isFinite(priorityValue) ? priorityValue : null

  return {
    providerId: normalizeString(record.provider_id),
    dateId: record.date_id ? Number(record.date_id) : null,
    newsItemId: normalizeString(record.news_item_id),
    publicIdentifier: normalizeString(record.public_identifier),
    newsItemType: normalizeString(record.news_item_type),
    firstCreated: formatDateTime(record.first_created),
    thisRevisionCreated: formatDateTime(record.this_revision_created),
    status: normalizeString(record.status),
    canceled: record.canceled ? 1 : 0,
    headline: normalizeString(record.headline),
    subHeadline: normalizeString(record.sub_headline),
    seriesLine: normalizeString(record.series_line),
    language: normalizeString(record.language),
    contentProfile,
    priority,
    content: typeof record.content === 'string' ? record.content : null,
    rawJson: JSON.stringify(record),
  }
}

async function importArticle(conn, record) {
  const articleValues = extractArticleValues(record)
  if (!articleValues.newsItemId) {
    console.warn('news_item_id が無いためスキップします')
    return
  }

  await conn.beginTransaction()
  try {
    await conn.execute('DELETE FROM articles WHERE news_item_id = ?', [articleValues.newsItemId])
    const [articleResult] = await conn.execute(
      `
        INSERT INTO articles (
          provider_id,
          date_id,
          news_item_id,
          public_identifier,
          news_item_type,
          first_created,
          this_revision_created,
          status,
          canceled,
          headline,
          sub_headline,
          series_line,
          language,
          content_profile,
          priority,
          content,
          raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
      `,
      [
        articleValues.providerId,
        articleValues.dateId,
        articleValues.newsItemId,
        articleValues.publicIdentifier,
        articleValues.newsItemType,
        articleValues.firstCreated,
        articleValues.thisRevisionCreated,
        articleValues.status,
        articleValues.canceled,
        articleValues.headline,
        articleValues.subHeadline,
        articleValues.seriesLine,
        articleValues.language,
        articleValues.contentProfile,
        articleValues.priority,
        articleValues.content,
        articleValues.rawJson,
      ],
    )
    const articleId = articleResult.insertId
    await insertSubjectRelations(conn, articleId, record.subject_codes)
    await insertEntities(conn, articleId, record.named_entities)
    await insertQuestions(conn, articleId, record.questions)
    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  }
}

async function main() {
  console.log(`JSONL 取り込み開始: ${jsonlPath}`)
  const connection = await pool.getConnection()
  const stream = fs.createReadStream(jsonlPath)
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  })

  let total = 0
  try {
    for await (const line of rl) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const record = JSON.parse(trimmed)
      await importArticle(connection, record)
      total += 1
      if (total % 100 === 0) {
        console.log(`  ${total} 件取り込み済み`)
      }
    }
    console.log(`取り込み完了: ${total} 件`)
  } catch (error) {
    console.error('取り込み中にエラーが発生しました:', error)
    process.exitCode = 1
  } finally {
    connection.release()
    await pool.end()
  }
}

main()
